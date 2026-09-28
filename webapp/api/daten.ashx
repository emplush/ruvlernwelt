<%@ WebHandler Language="C#" Class="LernweltDaten" %>
<%@ Assembly Name="System.Web.Extensions, Version=4.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35" %>

// Server-Teil der Persona-Datenbank (ASP.NET 4.x, wird vom IIS beim ersten Aufruf übersetzt).
//
// Die Daten liegen in ../App_Data/ und sind dort per HTTP nicht abrufbar. Zugriff nur über:
//   GET  ?aktion=status        Anmeldestatus, App-Titel
//   GET  ?aktion=challenge     Salt, Iterationen, Einmalwert für Anmeldung/Passwortänderung
//   POST ?aktion=anmelden      {nonce, beweis}
//   POST ?aktion=abmelden
//   GET  ?aktion=laden         Daten (angemeldet)
//   POST ?aktion=speichern     {erwarteteRevision, daten} (angemeldet)
//   GET  ?aktion=bild&name=... Profilbild (angemeldet)
//   POST ?aktion=passwort      {nonce, beweis, neu} (aktuelles Passwort nötig)
//   POST ?aktion=abfrage       {nonce, beweis, aktiv} (aktuelles Passwort nötig)
//
// Anmeldung ohne HTTPS: Das Passwort wird nie übertragen. Der Browser berechnet
// V = PBKDF2-SHA256(Passwort, Salt) und schickt nur HMAC(V, Zweck:Einmalwert).
// Einmalwerte gelten 5 Minuten und nur einmal. Nach 5 Fehlversuchen ist die
// Anmeldung von dieser Adresse 15 Minuten gesperrt.

using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Web;
using System.Web.Script.Serialization;

public class LernweltDaten : IHttpHandler
{
    private static readonly object Sperre = new object();
    private const string CookieName = "lernwelt_sitzung";

    public bool IsReusable { get { return true; } }

    public void ProcessRequest(HttpContext context)
    {
        var req = context.Request;
        var res = context.Response;
        res.ContentType = "application/json";
        res.ContentEncoding = Encoding.UTF8;
        res.Cache.SetCacheability(HttpCacheability.NoCache);
        res.Cache.SetNoStore();
        res.AppendHeader("X-Content-Type-Options", "nosniff");

        string appData = context.Server.MapPath("~/App_Data");
        var ablage = new Ablage(appData);
        var anmeldung = Anmeldung.Laden(appData);
        string aktion = (req.QueryString["aktion"] ?? "").ToLowerInvariant();
        bool post = req.HttpMethod == "POST";

        try
        {
            // Schutz gegen fremde Seiten: POST nur mit eigenem Header (kann ein Formular nicht setzen)
            if (post && req.Headers["X-Lernwelt"] != "1")
            {
                Antwort(res, 403, Fehler("Anfrage abgelehnt."));
                return;
            }

            bool angemeldet = !anmeldung.Aktiv || anmeldung.SitzungGueltig(CookieLesen(req));
            string ip = req.UserHostAddress ?? "";
            bool mitPasswort = post && (aktion == "anmelden" || aktion == "passwort" || aktion == "abfrage");
            if (mitPasswort && Sperrliste.Gesperrt(ip))
            {
                Antwort(res, 429, Fehler("Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen."));
                return;
            }

            if (aktion == "status" && !post)
            {
                string titel = ablage.AppTitel();
                Antwort(res, 200, new Dictionary<string, object> {
                    { "ok", true }, { "anmeldungAktiv", anmeldung.Aktiv }, { "angemeldet", angemeldet },
                    { "appTitel", titel }, { "schreibfehler", ablage.PruefeSchreibrechte() }
                });
                return;
            }

            if (aktion == "challenge" && !post)
            {
                Antwort(res, 200, new Dictionary<string, object> {
                    { "ok", true }, { "salt", anmeldung.Salt }, { "iterationen", anmeldung.Iterationen },
                    { "nonce", Einmalwerte.Neu() }, { "neuSalt", Hilfe.ZufallHex(16) },
                    { "neuIterationen", Anmeldung.StandardIterationen }
                });
                return;
            }

            if (aktion == "anmelden" && post)
            {
                var a = Lesen(req);
                if (!anmeldung.PruefeBeweis("anmelden", Text(a, "nonce"), "", Text(a, "beweis")))
                {
                    Sperrliste.Fehlversuch(ip);
                    Antwort(res, 401, Fehler("Das Passwort ist falsch."));
                    return;
                }
                Sperrliste.Erfolg(ip);
                CookieSetzen(req, res, anmeldung.NeueSitzung());
                Antwort(res, 200, new Dictionary<string, object> { { "ok", true } });
                return;
            }

            if (aktion == "abmelden" && post)
            {
                CookieLoeschen(req, res);
                Antwort(res, 200, new Dictionary<string, object> { { "ok", true } });
                return;
            }

            if (aktion == "passwort" && post)
            {
                var a = Lesen(req);
                string nonce = Text(a, "nonce");
                byte[] alterSchluessel;
                if (!anmeldung.PruefeBeweis("passwort", nonce, Text(a, "neuSalt"), Text(a, "beweis"), out alterSchluessel))
                {
                    Sperrliste.Fehlversuch(ip);
                    Antwort(res, 401, Fehler("Das aktuelle Passwort ist falsch."));
                    return;
                }
                Sperrliste.Erfolg(ip);
                // Der neue Schlüssel kommt XOR-verschlüsselt mit HMAC(alter Schlüssel, "schluessel:" + nonce)
                byte[] maske = Hilfe.Hmac(alterSchluessel, "schluessel:" + nonce);
                byte[] neu = Hilfe.HexZuBytes(Text(a, "neu"));
                if (neu == null || neu.Length != 32)
                {
                    Antwort(res, 400, Fehler("Ungültige Anfrage."));
                    return;
                }
                for (int i = 0; i < 32; i++) neu[i] ^= maske[i];
                string neuSalt = Text(a, "neuSalt");
                if (!System.Text.RegularExpressions.Regex.IsMatch(neuSalt, "^[0-9a-f]{32}$"))
                {
                    Antwort(res, 400, Fehler("Ungültige Anfrage."));
                    return;
                }
                lock (Sperre)
                {
                    anmeldung.PasswortSetzen(neuSalt, Anmeldung.StandardIterationen, neu);
                    anmeldung.Speichern();
                }
                CookieSetzen(req, res, anmeldung.NeueSitzung());
                Antwort(res, 200, new Dictionary<string, object> { { "ok", true } });
                return;
            }

            if (aktion == "abfrage" && post)
            {
                var a = Lesen(req);
                bool aktiv = a.ContainsKey("aktiv") && a["aktiv"] is bool && (bool)a["aktiv"];
                if (!anmeldung.PruefeBeweis("abfrage", Text(a, "nonce"), aktiv ? "1" : "0", Text(a, "beweis")))
                {
                    Sperrliste.Fehlversuch(ip);
                    Antwort(res, 401, Fehler("Das Passwort ist falsch."));
                    return;
                }
                Sperrliste.Erfolg(ip);
                lock (Sperre)
                {
                    anmeldung.Aktiv = aktiv;
                    anmeldung.Speichern();
                }
                if (aktiv) CookieSetzen(req, res, anmeldung.NeueSitzung());
                Antwort(res, 200, new Dictionary<string, object> { { "ok", true }, { "anmeldungAktiv", aktiv } });
                return;
            }

            // Ab hier nur angemeldet
            if (!angemeldet)
            {
                Antwort(res, 401, new Dictionary<string, object> { { "ok", false }, { "anmelden", true }, { "meldung", "Bitte melden Sie sich an." } });
                return;
            }
            if (anmeldung.Aktiv) CookieSetzen(req, res, anmeldung.NeueSitzung());

            if (aktion == "laden" && !post)
            {
                res.StatusCode = 200;
                res.Write(ablage.DatenText());
                return;
            }

            if (aktion == "bild" && !post)
            {
                string pfad = ablage.BildPfad(req.QueryString["name"] ?? "");
                if (pfad == null)
                {
                    Antwort(res, 404, Fehler("Bild nicht gefunden."));
                    return;
                }
                res.ContentType = pfad.EndsWith(".png", StringComparison.OrdinalIgnoreCase) ? "image/png" : "image/jpeg";
                res.Cache.SetCacheability(HttpCacheability.Private);
                res.Cache.SetMaxAge(TimeSpan.FromHours(12));
                res.TransmitFile(pfad);
                return;
            }

            if (aktion == "speichern" && post)
            {
                var anfrage = Lesen(req);
                if (!anfrage.ContainsKey("daten") || !(anfrage["daten"] is Dictionary<string, object>))
                {
                    Antwort(res, 400, Fehler("Ungültige Anfrage: Feld 'daten' fehlt."));
                    return;
                }
                int erwartet = anfrage.ContainsKey("erwarteteRevision") && anfrage["erwarteteRevision"] != null
                    ? Convert.ToInt32(anfrage["erwarteteRevision"]) : -1;
                var daten = (Dictionary<string, object>)anfrage["daten"];
                lock (Sperre)
                {
                    Dictionary<string, object> ergebnis;
                    string meldung = ablage.Speichern(daten, erwartet, out ergebnis);
                    if (meldung == "konflikt")
                    {
                        Antwort(res, 409, Fehler("Die Daten wurden zwischenzeitlich von jemand anderem geändert."));
                        return;
                    }
                    if (meldung != null)
                    {
                        Antwort(res, 400, Fehler(meldung));
                        return;
                    }
                    Antwort(res, 200, new Dictionary<string, object> {
                        { "ok", true }, { "revision", ergebnis["revision"] }, { "daten", ergebnis }
                    });
                }
                return;
            }

            Antwort(res, 404, Fehler("Unbekannte Aktion."));
        }
        catch (UnauthorizedAccessException)
        {
            Antwort(res, 500, Fehler("Der Server darf im Ordner App_Data nicht schreiben."));
        }
        catch (Exception ex)
        {
            Antwort(res, 500, Fehler("Serverfehler: " + ex.Message));
        }
    }

    private static Dictionary<string, object> Lesen(HttpRequest req)
    {
        string body;
        using (var leser = new StreamReader(req.InputStream, Encoding.UTF8))
        {
            body = leser.ReadToEnd();
        }
        var d = Ablage.NeuerSerializer().DeserializeObject(body) as Dictionary<string, object>;
        return d ?? new Dictionary<string, object>();
    }

    private static string Text(Dictionary<string, object> d, string feld)
    {
        return d.ContainsKey(feld) && d[feld] != null ? Convert.ToString(d[feld]) : "";
    }

    private static string CookiePfad(HttpRequest req)
    {
        string p = req.ApplicationPath ?? "/";
        return p.EndsWith("/") ? p : p + "/";
    }

    private static string CookieLesen(HttpRequest req)
    {
        var c = req.Cookies[CookieName];
        return c == null ? null : c.Value;
    }

    // Cookie von Hand setzen, damit SameSite=Strict auch unter .NET 4.5 möglich ist
    private static void CookieSetzen(HttpRequest req, HttpResponse res, string wert)
    {
        res.AppendHeader("Set-Cookie", CookieName + "=" + wert + "; Path=" + CookiePfad(req) + "; HttpOnly; SameSite=Strict");
    }

    private static void CookieLoeschen(HttpRequest req, HttpResponse res)
    {
        res.AppendHeader("Set-Cookie", CookieName + "=; Path=" + CookiePfad(req) + "; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT");
    }

    private static Dictionary<string, object> Fehler(string text)
    {
        return new Dictionary<string, object> { { "ok", false }, { "meldung", text } };
    }

    private static void Antwort(HttpResponse res, int status, object inhalt)
    {
        res.StatusCode = status;
        res.Write(Ablage.NeuerSerializer().Serialize(inhalt));
    }
}

public static class Hilfe
{
    private static readonly RandomNumberGenerator Zufall = RandomNumberGenerator.Create();

    public static string ZufallHex(int bytes)
    {
        var b = new byte[bytes];
        lock (Zufall) { Zufall.GetBytes(b); }
        return BytesZuHex(b);
    }

    public static string BytesZuHex(byte[] b)
    {
        var sb = new StringBuilder(b.Length * 2);
        foreach (var x in b) sb.Append(x.ToString("x2"));
        return sb.ToString();
    }

    public static byte[] HexZuBytes(string hex)
    {
        if (hex == null || hex.Length % 2 != 0) return null;
        var b = new byte[hex.Length / 2];
        for (int i = 0; i < b.Length; i++)
        {
            int wert;
            if (!int.TryParse(hex.Substring(i * 2, 2), System.Globalization.NumberStyles.HexNumber, null, out wert)) return null;
            b[i] = (byte)wert;
        }
        return b;
    }

    public static byte[] Hmac(byte[] schluessel, string nachricht)
    {
        using (var h = new HMACSHA256(schluessel))
        {
            return h.ComputeHash(Encoding.UTF8.GetBytes(nachricht));
        }
    }

    // PBKDF2-HMAC-SHA256, 32 Byte (eigene Umsetzung, läuft auch unter .NET 4.5)
    public static byte[] Pbkdf2(string passwort, byte[] salt, int iterationen)
    {
        using (var h = new HMACSHA256(Encoding.UTF8.GetBytes(passwort)))
        {
            var block = new byte[salt.Length + 4];
            Buffer.BlockCopy(salt, 0, block, 0, salt.Length);
            block[block.Length - 1] = 1;
            byte[] u = h.ComputeHash(block);
            var t = (byte[])u.Clone();
            for (int i = 1; i < iterationen; i++)
            {
                u = h.ComputeHash(u);
                for (int j = 0; j < t.Length; j++) t[j] ^= u[j];
            }
            return t;
        }
    }

    public static bool Gleich(byte[] a, byte[] b)
    {
        if (a == null || b == null || a.Length != b.Length) return false;
        int diff = 0;
        for (int i = 0; i < a.Length; i++) diff |= a[i] ^ b[i];
        return diff == 0;
    }
}

public static class Einmalwerte
{
    private static readonly Dictionary<string, DateTime> Offen = new Dictionary<string, DateTime>();

    public static string Neu()
    {
        string n = Hilfe.ZufallHex(16);
        lock (Offen)
        {
            foreach (var k in Offen.Where(e => e.Value < DateTime.UtcNow).Select(e => e.Key).ToList()) Offen.Remove(k);
            if (Offen.Count > 1000) Offen.Clear();
            Offen[n] = DateTime.UtcNow.AddMinutes(5);
        }
        return n;
    }

    // Gültig genau einmal
    public static bool Einloesen(string n)
    {
        lock (Offen)
        {
            DateTime ablauf;
            if (string.IsNullOrEmpty(n) || !Offen.TryGetValue(n, out ablauf)) return false;
            Offen.Remove(n);
            return ablauf >= DateTime.UtcNow;
        }
    }
}

public static class Sperrliste
{
    private const int MaxVersuche = 5;
    private static readonly TimeSpan Dauer = TimeSpan.FromMinutes(15);
    private static readonly Dictionary<string, KeyValuePair<int, DateTime>> Versuche = new Dictionary<string, KeyValuePair<int, DateTime>>();

    public static bool Gesperrt(string ip)
    {
        lock (Versuche)
        {
            KeyValuePair<int, DateTime> v;
            if (!Versuche.TryGetValue(ip, out v)) return false;
            if (DateTime.UtcNow - v.Value > Dauer) { Versuche.Remove(ip); return false; }
            return v.Key >= MaxVersuche;
        }
    }

    public static void Fehlversuch(string ip)
    {
        lock (Versuche)
        {
            KeyValuePair<int, DateTime> v;
            int anzahl = Versuche.TryGetValue(ip, out v) && DateTime.UtcNow - v.Value <= Dauer ? v.Key + 1 : 1;
            Versuche[ip] = new KeyValuePair<int, DateTime>(anzahl, DateTime.UtcNow);
        }
    }

    public static void Erfolg(string ip)
    {
        lock (Versuche) { Versuche.Remove(ip); }
    }
}

public class Anmeldung
{
    public const int StandardIterationen = 60000;
    private const string Standardpasswort = "RuVTest1234";
    private static readonly TimeSpan SitzungsDauer = TimeSpan.FromHours(10);

    public bool Aktiv;
    public string Salt;
    public int Iterationen;
    public string Schluessel; // PBKDF2(Passwort, Salt) als Hex
    public string Geheimnis;  // signiert die Sitzungs-Cookies
    private string datei;

    public static Anmeldung Laden(string appData)
    {
        string datei = Path.Combine(appData, "anmeldung.json");
        var a = new Anmeldung { datei = datei };
        if (File.Exists(datei))
        {
            var d = Ablage.NeuerSerializer().DeserializeObject(File.ReadAllText(datei, Encoding.UTF8)) as Dictionary<string, object>;
            if (d != null)
            {
                a.Aktiv = !d.ContainsKey("aktiv") || !(d["aktiv"] is bool) || (bool)d["aktiv"];
                a.Salt = Convert.ToString(d["salt"]);
                a.Iterationen = Convert.ToInt32(d["iterationen"]);
                a.Schluessel = Convert.ToString(d["schluessel"]);
                a.Geheimnis = Convert.ToString(d["geheimnis"]);
                return a;
            }
        }
        // Erster Start: Standardpasswort, Passwortabfrage aktiv
        a.Aktiv = true;
        string salt = Hilfe.ZufallHex(16);
        a.PasswortSetzen(salt, StandardIterationen, Hilfe.Pbkdf2(Standardpasswort, Hilfe.HexZuBytes(salt), StandardIterationen));
        try { a.Speichern(); } catch (Exception) { /* ohne Schreibrechte gilt das Standardpasswort bei jedem Start */ }
        return a;
    }

    public void PasswortSetzen(string salt, int iterationen, byte[] schluessel)
    {
        Salt = salt;
        Iterationen = iterationen;
        Schluessel = Hilfe.BytesZuHex(schluessel);
        Geheimnis = Hilfe.ZufallHex(32); // alle bestehenden Sitzungen werden ungültig
    }

    public void Speichern()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(datei));
        var d = new Dictionary<string, object> {
            { "aktiv", Aktiv }, { "salt", Salt }, { "iterationen", Iterationen },
            { "schluessel", Schluessel }, { "geheimnis", Geheimnis }
        };
        File.WriteAllText(datei, Ablage.NeuerSerializer().Serialize(d), new UTF8Encoding(false));
    }

    public bool PruefeBeweis(string zweck, string nonce, string zusatz, string beweis)
    {
        byte[] ignoriert;
        return PruefeBeweis(zweck, nonce, zusatz, beweis, out ignoriert);
    }

    // Beweis = HMAC(Schlüssel, zweck + ":" + nonce + ":" + zusatz)
    public bool PruefeBeweis(string zweck, string nonce, string zusatz, string beweis, out byte[] schluessel)
    {
        schluessel = Hilfe.HexZuBytes(Schluessel);
        if (!Einmalwerte.Einloesen(nonce)) return false;
        byte[] erwartet = Hilfe.Hmac(schluessel, zweck + ":" + nonce + ":" + zusatz);
        return Hilfe.Gleich(erwartet, Hilfe.HexZuBytes(beweis ?? ""));
    }

    // Sitzung = "ablauf.zufall.signatur"
    public string NeueSitzung()
    {
        long ablauf = (long)(DateTime.UtcNow.Add(SitzungsDauer) - new DateTime(1970, 1, 1)).TotalSeconds;
        string inhalt = ablauf + "." + Hilfe.ZufallHex(16);
        return inhalt + "." + Hilfe.BytesZuHex(Hilfe.Hmac(Hilfe.HexZuBytes(Geheimnis), inhalt));
    }

    public bool SitzungGueltig(string wert)
    {
        if (string.IsNullOrEmpty(wert)) return false;
        int punkt = wert.LastIndexOf('.');
        if (punkt < 0) return false;
        string inhalt = wert.Substring(0, punkt);
        byte[] erwartet = Hilfe.Hmac(Hilfe.HexZuBytes(Geheimnis), inhalt);
        if (!Hilfe.Gleich(erwartet, Hilfe.HexZuBytes(wert.Substring(punkt + 1)))) return false;
        long ablauf;
        if (!long.TryParse(inhalt.Split('.')[0], out ablauf)) return false;
        long jetzt = (long)(DateTime.UtcNow - new DateTime(1970, 1, 1)).TotalSeconds;
        return ablauf > jetzt;
    }
}

public class Ablage
{
    private const int AnzahlSicherungen = 50;
    private readonly string datenDatei;
    private readonly string appData;
    private readonly string sicherungsOrdner;
    private readonly string bilderOrdner;

    public Ablage(string appData)
    {
        this.appData = appData;
        datenDatei = Path.Combine(appData, "lernwelt.json");
        sicherungsOrdner = Path.Combine(appData, "sicherung");
        bilderOrdner = Path.Combine(appData, "bilder");
    }

    public static JavaScriptSerializer NeuerSerializer()
    {
        return new JavaScriptSerializer { MaxJsonLength = int.MaxValue, RecursionLimit = 64 };
    }

    public string PruefeSchreibrechte()
    {
        foreach (var ordner in new[] { appData, bilderOrdner })
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
                return "Der Server darf im Ordner '" + Path.GetFileName(ordner) + "' nicht schreiben. Änderungen können nicht gespeichert werden.";
            }
        }
        return null;
    }

    public string DatenText()
    {
        return File.ReadAllText(datenDatei, Encoding.UTF8);
    }

    private Dictionary<string, object> DatenLesen()
    {
        if (!File.Exists(datenDatei)) return null;
        return NeuerSerializer().DeserializeObject(DatenText()) as Dictionary<string, object>;
    }

    public string AppTitel()
    {
        try
        {
            var d = DatenLesen();
            var e = d == null || !d.ContainsKey("einstellungen") ? null : d["einstellungen"] as Dictionary<string, object>;
            if (e != null && e.ContainsKey("appTitel") && e["appTitel"] != null) return Convert.ToString(e["appTitel"]);
        }
        catch (Exception) { }
        return "R+V Lernwelt – Persona-Datenbank";
    }

    public int AktuelleRevision()
    {
        var d = DatenLesen();
        if (d == null || !d.ContainsKey("revision") || d["revision"] == null) return 0;
        return Convert.ToInt32(d["revision"]);
    }

    // Nur einfache Dateinamen aus App_Data/bilder, keine Pfadangaben
    public string BildPfad(string name)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(name, @"^[A-Za-z0-9_\-]+\.(jpg|png)$")) return null;
        string pfad = Path.Combine(bilderOrdner, name);
        return File.Exists(pfad) ? pfad : null;
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
