<%@ WebHandler Language="C#" Class="LernweltSpeichern" %>
<%@ Assembly Name="System.Web.Extensions, Version=4.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35" %>

// Speichert die Daten der Persona-Datenbank in ../data/lernwelt.json.
//
// GET  -> {"ok":true,"revision":n}  (prüft auch die Schreibrechte)
// POST {"erwarteteRevision":n,"daten":{...}}
//      -> {"ok":true,"revision":n+1,"daten":{...}}
//      -> 409, wenn jemand anderes zwischenzeitlich gespeichert hat
//
// Neu hochgeladene Bilder kommen als data:-URL und werden als JPG-Datei
// in ../bilder/ abgelegt. Vor jedem Speichern entsteht eine Sicherung in
// ../data/sicherung/ (die letzten 50 bleiben erhalten).

using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Web;
using System.Web.Script.Serialization;

public class LernweltSpeichern : IHttpHandler
{
    private static readonly object Sperre = new object();

    public bool IsReusable { get { return true; } }

    public void ProcessRequest(HttpContext context)
    {
        context.Response.ContentType = "application/json";
        context.Response.ContentEncoding = Encoding.UTF8;
        context.Response.Cache.SetCacheability(HttpCacheability.NoCache);

        string basis = context.Server.MapPath("~/");
        var ablage = new Ablage(basis);
        var json = Ablage.NeuerSerializer();

        try
        {
            if (context.Request.HttpMethod == "GET")
            {
                string fehler = ablage.PruefeSchreibrechte();
                if (fehler != null)
                {
                    Antwort(context, 200, new Dictionary<string, object> { { "ok", false }, { "meldung", fehler } });
                    return;
                }
                Antwort(context, 200, new Dictionary<string, object> { { "ok", true }, { "revision", ablage.AktuelleRevision() } });
                return;
            }

            if (context.Request.HttpMethod != "POST")
            {
                Antwort(context, 405, Fehler("Nur GET und POST sind erlaubt."));
                return;
            }

            string body;
            using (var leser = new StreamReader(context.Request.InputStream, Encoding.UTF8))
            {
                body = leser.ReadToEnd();
            }

            var anfrage = json.DeserializeObject(body) as Dictionary<string, object>;
            if (anfrage == null || !anfrage.ContainsKey("daten") || !(anfrage["daten"] is Dictionary<string, object>))
            {
                Antwort(context, 400, Fehler("Ungültige Anfrage: Feld 'daten' fehlt."));
                return;
            }

            int erwartet = anfrage.ContainsKey("erwarteteRevision") ? Convert.ToInt32(anfrage["erwarteteRevision"]) : -1;
            var daten = (Dictionary<string, object>)anfrage["daten"];

            lock (Sperre)
            {
                Dictionary<string, object> ergebnis;
                string meldung = ablage.Speichern(daten, erwartet, out ergebnis);
                if (meldung == "konflikt")
                {
                    Antwort(context, 409, Fehler("Die Daten wurden zwischenzeitlich von jemand anderem geändert."));
                    return;
                }
                if (meldung != null)
                {
                    Antwort(context, 400, Fehler(meldung));
                    return;
                }
                Antwort(context, 200, new Dictionary<string, object> {
                    { "ok", true }, { "revision", ergebnis["revision"] }, { "daten", ergebnis }
                });
            }
        }
        catch (UnauthorizedAccessException)
        {
            Antwort(context, 500, Fehler("Keine Schreibrechte auf den Ordnern data und bilder."));
        }
        catch (Exception ex)
        {
            Antwort(context, 500, Fehler("Serverfehler: " + ex.Message));
        }
    }

    private static Dictionary<string, object> Fehler(string text)
    {
        return new Dictionary<string, object> { { "ok", false }, { "meldung", text } };
    }

    private static void Antwort(HttpContext context, int status, object inhalt)
    {
        context.Response.StatusCode = status;
        context.Response.Write(Ablage.NeuerSerializer().Serialize(inhalt));
    }
}

public class Ablage
{
    private const int AnzahlSicherungen = 50;
    private readonly string datenDatei;
    private readonly string datenOrdner;
    private readonly string sicherungsOrdner;
    private readonly string bilderOrdner;

    public Ablage(string basis)
    {
        datenOrdner = Path.Combine(basis, "data");
        datenDatei = Path.Combine(datenOrdner, "lernwelt.json");
        sicherungsOrdner = Path.Combine(datenOrdner, "sicherung");
        bilderOrdner = Path.Combine(basis, "bilder");
    }

    public static JavaScriptSerializer NeuerSerializer()
    {
        return new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 64 };
    }

    public string PruefeSchreibrechte()
    {
        foreach (var ordner in new[] { datenOrdner, bilderOrdner })
        {
            try
            {
                Directory.CreateDirectory(ordner);
                string test = Path.Combine(ordner, ".schreibtest-" + Guid.NewGuid().ToString("N"));
                File.WriteAllText(test, "ok");
                File.Delete(test);
            }
            catch (Exception)
            {
                return "Der Server darf im Ordner '" + Path.GetFileName(ordner) + "' nicht schreiben";
            }
        }
        return null;
    }

    public int AktuelleRevision()
    {
        if (!File.Exists(datenDatei)) return 0;
        var d = NeuerSerializer().DeserializeObject(File.ReadAllText(datenDatei, Encoding.UTF8)) as Dictionary<string, object>;
        if (d == null || !d.ContainsKey("revision") || d["revision"] == null) return 0;
        return Convert.ToInt32(d["revision"]);
    }

    // Liefert null bei Erfolg, "konflikt" bei veralteter Revision, sonst eine Fehlermeldung.
    public string Speichern(Dictionary<string, object> daten, int erwarteteRevision, out Dictionary<string, object> ergebnis)
    {
        ergebnis = null;
        if (!(daten.ContainsKey("personas") && daten["personas"] is IEnumerable) || daten["personas"] is string)
            return "Ungültige Daten: Liste 'personas' fehlt.";

        int aktuell = AktuelleRevision();
        if (erwarteteRevision != aktuell) return "konflikt";

        BilderAuslagern((IEnumerable)daten["personas"]);
        daten["revision"] = aktuell + 1;

        string inhalt = NeuerSerializer().Serialize(daten);

        Directory.CreateDirectory(sicherungsOrdner);
        if (File.Exists(datenDatei))
        {
            string ziel = Path.Combine(sicherungsOrdner, "lernwelt_" + DateTime.Now.ToString("yyyyMMdd_HHmmss_fff") + ".json");
            File.Copy(datenDatei, ziel, true);
            AlteSicherungenLoeschen();
        }

        string temp = datenDatei + ".tmp";
        File.WriteAllText(temp, inhalt, new UTF8Encoding(false));
        if (File.Exists(datenDatei)) File.Replace(temp, datenDatei, null);
        else File.Move(temp, datenDatei);

        ergebnis = daten;
        return null;
    }

    private void BilderAuslagern(IEnumerable personas)
    {
        Directory.CreateDirectory(bilderOrdner);
        foreach (var eintrag in personas)
        {
            var p = eintrag as Dictionary<string, object>;
            if (p == null) continue;
            string id = p.ContainsKey("id") && p["id"] != null ? Convert.ToString(p["id"]) : "neu";
            foreach (var feld in new[] { "bild", "bildGross" })
            {
                if (!p.ContainsKey(feld)) continue;
                string wert = p[feld] as string;
                if (wert == null || !wert.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase)) continue;
                int komma = wert.IndexOf(',');
                if (komma < 0 || wert.IndexOf(";base64", 0, komma, StringComparison.OrdinalIgnoreCase) < 0) continue;
                byte[] bytes = Convert.FromBase64String(wert.Substring(komma + 1));
                string endung = wert.StartsWith("data:image/png", StringComparison.OrdinalIgnoreCase) ? ".png" : ".jpg";
                string name = "p" + id + "_" + DateTime.Now.ToString("yyyyMMddHHmmssfff") + (feld == "bild" ? "_q" : "") + endung;
                File.WriteAllBytes(Path.Combine(bilderOrdner, name), bytes);
                p[feld] = "bilder/" + name;
            }
        }
    }

    private void AlteSicherungenLoeschen()
    {
        var dateien = new DirectoryInfo(sicherungsOrdner).GetFiles("lernwelt_*.json")
            .OrderByDescending(f => f.Name).Skip(AnzahlSicherungen).ToList();
        foreach (var f in dateien)
        {
            try { f.Delete(); } catch (IOException) { }
        }
    }
}
