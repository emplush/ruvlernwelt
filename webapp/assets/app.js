/* R+V Lernwelt – Persona-Datenbank
 * Web-App ohne Datenbank. Die Daten liegen in App_Data/lernwelt.json und
 * werden nur über api/daten.ashx geladen und gespeichert (mit Passwortabfrage).
 * In der Artifact-Vorschau sind die Daten eingebettet (Modus "vorschau").
 */
(function () {
  'use strict';

  var KONFIG = {
    api: 'api/daten.ashx',
    themaSchluessel: 'ruv-lernwelt-thema'
  };

  var OPTIONEN = {
    gruppe: ['Privatkunde', 'Firmenkunde', 'Privat- & Firmenkunde', 'R+V Innendienst', 'R+V Außendienst', 'Bankmitarbeitende/r', 'Extern'],
    geschlecht: ['männlich', 'weiblich', 'divers'],
    cJourney: ['Online', 'Offline'],
    familienstand: ['ledig / Single', 'ledig / in Beziehung', 'verheiratet', 'geschieden', 'verwitwet', 'keine Angabe'],
    // "keine Angabe" zuerst, restliche Einträge alphabetisch absteigend (wie in der Abacus-App)
    kundenprofil: ['keine Angabe', 'Weltoffene', 'Traditionelle', 'Lebensentdecker', 'Karriereeltern', 'Familienmenschen', 'Durchstarter', 'Besonnene', 'Aktive'],
    firmaFunktion: ['keine Angabe', 'Firmenkunde', 'Gewerbekunde', 'Unternehmenskunde'],
    formatTyp: ['Lernprogramm', 'Video', 'Podcast'],
    monate: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
  };

  var ICONS = {
    personen: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    person: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    firma: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    buch: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    einstellungen: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    suche: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    zurueck: '<path d="m12 19-7-7 7-7M19 12H5"/>',
    stift: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    papierkorb: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    speichern: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    ordner: '<path d="m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/>',
    kopieren: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    extern: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    ort: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    koffer: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    herz: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    gehirn: '<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>',
    mikro: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3"/>',
    hochladen: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    herunterladen: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    zuschnitt: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/>',
    abmelden: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    schloss: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    menue: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    mond: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sonne: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    datenbank: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    video: '<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    kopfhoerer: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
    monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>'
  };

  function icon(name, extraKlasse) {
    return '<svg class="icon ' + (extraKlasse || '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  function esc(wert) {
    if (wert === null || wert === undefined) return '';
    return String(wert).replace(/[&<>"']/g, function (z) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z];
    });
  }

  function leer(wert) {
    return wert === null || wert === undefined || String(wert).trim() === '';
  }

  function oderNull(wert) {
    return leer(wert) ? null : String(wert).trim();
  }

  function vergleich(a, b) {
    return String(a || '').localeCompare(String(b || ''), 'de', { sensitivity: 'base' });
  }

  function klon(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function naechsteId(liste) {
    return liste.reduce(function (max, e) { return Math.max(max, e.id || 0); }, 0) + 1;
  }

  function lsLesen(schluessel) {
    try { return window.localStorage.getItem(schluessel); } catch (e) { return null; }
  }
  function lsSchreiben(schluessel, wert) {
    try { window.localStorage.setItem(schluessel, wert); return true; } catch (e) { return false; }
  }
  function lsLoeschen(schluessel) {
    try { window.localStorage.removeItem(schluessel); } catch (e) { /* ignorieren */ }
  }

  function datumText(iso) {
    if (!iso) return '–';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '–';
    return d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  }

  // ------------------------------------------------------------------
  // Datenhaltung
  // ------------------------------------------------------------------
  var store = {
    daten: null,
    modus: 'server',         // 'server' | 'vorschau' (Artifact, Daten eingebettet)
    basisRevision: 0,
    anmeldungAktiv: false,
    schreibfehler: null
  };

  function datenNormalisieren(d) {
    d.einstellungen = d.einstellungen || {};
    if (!d.einstellungen.appTitel) d.einstellungen.appTitel = 'R+V Lernwelt – Persona-Datenbank';
    ['personas', 'firmen', 'firmaPersonas', 'beziehungen', 'formate', 'formatPersonas'].forEach(function (k) {
      if (!Array.isArray(d[k])) d[k] = [];
    });
    if (typeof d.revision !== 'number') d.revision = 0;
    return d;
  }

  function eingebetteteDaten() {
    var el = document.getElementById('startdaten');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  // Aufruf des Server-Teils. Liefert { status, daten }; bei 401 erscheint die Anmeldung.
  function api(aktion, koerper, extra) {
    var opt = { cache: 'no-store', credentials: 'same-origin', headers: { 'X-Lernwelt': '1' } };
    if (koerper !== undefined) {
      opt.method = 'POST';
      opt.headers['Content-Type'] = 'application/json; charset=utf-8';
      opt.body = JSON.stringify(koerper);
    }
    return fetch(KONFIG.api + '?aktion=' + aktion + (extra || '') + '&t=' + Date.now(), opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && j.anmelden) {
          zeigeAnmeldung('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.');
          var e = new Error(j.meldung || 'Bitte melden Sie sich an.');
          e.abgemeldet = true;
          throw e;
        }
        return { status: r.status, daten: j };
      });
    });
  }

  function serverFehler(text) {
    return new Error(text || 'Der Server ist nicht erreichbar. Prüfen Sie, ob ASP.NET 4.x auf dem IIS aktiviert ist.');
  }

  function datenLaden() {
    return api('laden').then(function (r) {
      if (r.status !== 200 || !Array.isArray(r.daten.personas)) throw serverFehler(r.daten.meldung);
      store.daten = datenNormalisieren(r.daten);
      store.basisRevision = store.daten.revision;
    });
  }

  function speichern() {
    var d = store.daten;
    d.geaendertAm = new Date().toISOString();
    if (store.modus === 'vorschau') return Promise.resolve();
    return api('speichern', { erwarteteRevision: store.basisRevision, daten: d }).then(function (r) {
      if (r.status === 409) {
        var fehler = new Error('konflikt');
        fehler.konflikt = true;
        throw fehler;
      }
      if (r.status !== 200 || !r.daten.ok) throw new Error(r.daten.meldung || ('Speichern fehlgeschlagen (HTTP ' + r.status + ').'));
      store.daten = datenNormalisieren(r.daten.daten);
      store.basisRevision = store.daten.revision;
    });
  }

  // Führt eine Änderung aus, speichert und setzt bei Fehlern zurück.
  function aendern(aenderung, meldung) {
    var vorher = klon(store.daten);
    var ergebnis;
    try {
      ergebnis = aenderung(store.daten);
    } catch (e) {
      store.daten = vorher;
      toast(e.message, true);
      return Promise.resolve(null);
    }
    return speichern().then(function () {
      if (meldung) toast(meldung);
      zeichneNavigation();
      return ergebnis === undefined ? true : ergebnis;
    }).catch(function (e) {
      store.daten = vorher;
      if (e.abgemeldet) return null;
      if (e.konflikt) {
        konfliktDialog();
      } else {
        toast(e.message || 'Speichern fehlgeschlagen.', true);
      }
      return null;
    });
  }

  // Bildpfade aus den Daten ("bilder/1004.jpg") liefert der Server nur nach Anmeldung aus.
  function bildUrl(pfad) {
    if (!pfad) return '';
    if (/^data:/.test(pfad) || store.modus === 'vorschau') return pfad;
    return KONFIG.api + '?aktion=bild&name=' + encodeURIComponent(pfad.replace(/^bilder\//, ''));
  }

  // ------------------------------------------------------------------
  // Anmeldung: Das Passwort verlässt den Browser nie (siehe krypto.js)
  // ------------------------------------------------------------------
  var K = window.LernweltKrypto;

  function schluesselAus(passwort, saltHex, iterationen) {
    return K.pbkdf2(K.utf8(passwort), K.hexZuBytes(saltHex), iterationen);
  }
  function beweis(schluessel, zweck, nonce, zusatz) {
    return K.bytesZuHex(K.hmac(schluessel, K.utf8(zweck + ':' + nonce + ':' + (zusatz || ''))));
  }
  // Rechnen erst nach dem nächsten Bildaufbau, damit der Hinweis "Prüfe …" sichtbar ist
  function spaeter(fn) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () { try { resolve(fn()); } catch (e) { reject(e); } }, 30);
    });
  }
  function challenge() {
    return api('challenge').then(function (r) {
      if (r.status !== 200 || !r.daten.ok) throw serverFehler(r.daten.meldung);
      return r.daten;
    });
  }

  function anmelden(passwort) {
    return challenge().then(function (c) {
      return spaeter(function () {
        return beweis(schluesselAus(passwort, c.salt, c.iterationen), 'anmelden', c.nonce, '');
      }).then(function (b) { return api('anmelden', { nonce: c.nonce, beweis: b }); });
    }).then(function (r) {
      if (r.status !== 200 || !r.daten.ok) throw new Error(r.daten.meldung || 'Anmeldung fehlgeschlagen.');
    });
  }

  function passwortAendern(aktuell, neu) {
    return challenge().then(function (c) {
      return spaeter(function () {
        var alt = schluesselAus(aktuell, c.salt, c.iterationen);
        var neuerSchluessel = schluesselAus(neu, c.neuSalt, c.neuIterationen);
        var maske = K.hmac(alt, K.utf8('schluessel:' + c.nonce));
        var verschluesselt = new Uint8Array(32);
        for (var i = 0; i < 32; i++) verschluesselt[i] = neuerSchluessel[i] ^ maske[i];
        return { nonce: c.nonce, neuSalt: c.neuSalt, beweis: beweis(alt, 'passwort', c.nonce, c.neuSalt), neu: K.bytesZuHex(verschluesselt) };
      }).then(function (k) { return api('passwort', k); });
    }).then(function (r) {
      if (r.status !== 200 || !r.daten.ok) throw new Error(r.daten.meldung || 'Das Passwort konnte nicht geändert werden.');
    });
  }

  function abfrageSetzen(passwort, aktiv) {
    return challenge().then(function (c) {
      return spaeter(function () {
        return beweis(schluesselAus(passwort, c.salt, c.iterationen), 'abfrage', c.nonce, aktiv ? '1' : '0');
      }).then(function (b) { return api('abfrage', { nonce: c.nonce, beweis: b, aktiv: aktiv }); });
    }).then(function (r) {
      if (r.status !== 200 || !r.daten.ok) throw new Error(r.daten.meldung || 'Die Einstellung konnte nicht gespeichert werden.');
      store.anmeldungAktiv = r.daten.anmeldungAktiv;
    });
  }

  function abmelden() {
    return api('abmelden', {}).catch(function () { return null; }).then(function () {
      store.daten = null;
      zeigeAnmeldung('Sie wurden abgemeldet.');
    });
  }

  function zeigeAnmeldung(hinweis, titel) {
    var app = document.getElementById('app');
    app.className = 'app';
    app.innerHTML = '<div class="anmeldung-huelle"><form class="anmeldung" id="anmelde-form" novalidate>' +
      '<span class="nav-logo anmeldung-logo"><img src="assets/ruv-logo.png" alt="R+V"></span>' +
      '<h1>' + esc(titel || document.title || 'R+V Lernwelt – Persona-Datenbank') + '</h1>' +
      '<p class="anmeldung-text">Bitte geben Sie das Passwort ein.</p>' +
      (hinweis ? '<p class="anmeldung-hinweis" role="status">' + esc(hinweis) + '</p>' : '') +
      '<div class="feld"><label for="anm-passwort">Passwort</label><input id="anm-passwort" type="password" autocomplete="current-password" required></div>' +
      '<p class="anmeldung-fehler" id="anm-fehler" role="alert" hidden></p>' +
      '<button type="submit" class="knopf knopf-primaer" id="anm-knopf">Anmelden</button>' +
      '</form></div><div class="toasts" id="toasts" aria-live="polite"></div>';
    var feldEl = document.getElementById('anm-passwort');
    feldEl.focus();
    document.getElementById('anmelde-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var knopf = document.getElementById('anm-knopf');
      var fehler = document.getElementById('anm-fehler');
      if (!feldEl.value) { fehler.textContent = 'Bitte geben Sie das Passwort ein.'; fehler.hidden = false; return; }
      knopf.disabled = true;
      knopf.textContent = 'Prüfe Passwort …';
      fehler.hidden = true;
      anmelden(feldEl.value).then(function () {
        return datenLaden();
      }).then(function () {
        appStarten();
      }).catch(function (err) {
        fehler.textContent = err.message;
        fehler.hidden = false;
        knopf.disabled = false;
        knopf.textContent = 'Anmelden';
        feldEl.select();
      });
    });
  }

  // Dialog mit Passwortfeld; liefert das Passwort oder null
  function passwortDialog(titel, text, okText) {
    return new Promise(function (resolve) {
      var huelle = document.createElement('div');
      huelle.className = 'dialog-huelle';
      huelle.innerHTML = '<form class="dialog" role="dialog" aria-modal="true" aria-labelledby="pdlg-titel" novalidate>' +
        '<h3 id="pdlg-titel">' + esc(titel) + '</h3><p>' + esc(text) + '</p>' +
        '<div class="feld"><label for="pdlg-passwort">Aktuelles Passwort</label><input id="pdlg-passwort" type="password" autocomplete="current-password"></div>' +
        '<div class="aktionen"><button type="button" class="knopf knopf-rahmen" data-antwort="nein">Abbrechen</button>' +
        '<button type="submit" class="knopf knopf-primaer">' + esc(okText) + '</button></div></form>';
      function schliessen(wert) {
        document.removeEventListener('keydown', taste);
        huelle.remove();
        resolve(wert);
      }
      function taste(e) { if (e.key === 'Escape') schliessen(null); }
      huelle.addEventListener('click', function (e) {
        if (e.target === huelle || e.target.closest('[data-antwort="nein"]')) schliessen(null);
      });
      huelle.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var wert = huelle.querySelector('#pdlg-passwort').value;
        if (wert) schliessen(wert);
      });
      document.addEventListener('keydown', taste);
      document.body.appendChild(huelle);
      huelle.querySelector('#pdlg-passwort').focus();
    });
  }

  function konfliktDialog() {
    dialog({
      titel: 'Daten wurden inzwischen geändert',
      text: 'Jemand anderes hat die Daten gespeichert, seit Sie die Seite geöffnet haben. Laden Sie die Seite neu und wiederholen Sie Ihre Änderung.',
      ok: 'Seite neu laden',
      gefahr: false,
      abbrechen: 'Schließen'
    }).then(function (ja) { if (ja) window.location.reload(); });
  }

  // Zugriffe
  function persona(id) { return store.daten.personas.find(function (p) { return p.id === id; }); }
  function firma(id) { return store.daten.firmen.find(function (f) { return f.id === id; }); }
  function format(id) { return store.daten.formate.find(function (f) { return f.id === id; }); }
  function vollerName(p) { return p ? (p.vorname + ' ' + p.name) : 'Unbekannt'; }
  function sortiertePersonas() {
    return store.daten.personas.slice().sort(function (a, b) {
      return vergleich(a.name, b.name) || vergleich(a.vorname, b.vorname);
    });
  }

  // Beziehungen sind gerichtet: personaId -> relatedPersonaId mit dem Verhältnis
  // aus Sicht von personaId ("Anna Seidel -> Susanne Seidel: Mutter").
  function beziehungenVon(pid) {
    var alle = store.daten.beziehungen;
    var liste = [];
    alle.forEach(function (b) {
      if (b.personaId === pid) {
        var gegen = alle.find(function (x) { return x.personaId === b.relatedPersonaId && x.relatedPersonaId === pid; });
        liste.push({ andere: b.relatedPersonaId, verhaeltnis: b.verhaeltnis, gegen: gegen ? gegen.verhaeltnis : null });
      }
    });
    alle.forEach(function (b) {
      if (b.relatedPersonaId === pid && !liste.some(function (e) { return e.andere === b.personaId; })) {
        liste.push({ andere: b.personaId, verhaeltnis: null, gegen: b.verhaeltnis });
      }
    });
    return liste.filter(function (e) { return persona(e.andere); });
  }

  function beziehungenErsetzen(d, pid, eintraege) {
    d.beziehungen = d.beziehungen.filter(function (b) { return b.personaId !== pid && b.relatedPersonaId !== pid; });
    eintraege.forEach(function (e) {
      if (!e.andere || e.andere === pid) return;
      if (d.beziehungen.some(function (b) { return b.personaId === pid && b.relatedPersonaId === e.andere; })) return;
      d.beziehungen.push({ id: naechsteId(d.beziehungen), personaId: pid, relatedPersonaId: e.andere, verhaeltnis: oderNull(e.verhaeltnis) });
      if (!leer(e.gegen)) {
        d.beziehungen.push({ id: naechsteId(d.beziehungen), personaId: e.andere, relatedPersonaId: pid, verhaeltnis: oderNull(e.gegen) });
      }
    });
  }

  // ------------------------------------------------------------------
  // Pfade, Links, Zwischenablage
  // ------------------------------------------------------------------
  function explorerUrl(roh) {
    var p = String(roh || '').trim();
    if (!p) return p;
    if (/^https?:/i.test(p)) return p;
    if (/^file:/i.test(p)) return p.replace(/\\/g, '/');
    if (p.indexOf('\\\\') === 0) return 'file://' + p.slice(2).replace(/\\/g, '/');
    if (/^[a-zA-Z]:[\\/]/.test(p)) return 'file:///' + p.replace(/\\/g, '/');
    return p;
  }

  // "file:///X:\Ordner\1004%20-%20Name" -> "X:\Ordner\1004 - Name"
  function windowsPfad(roh) {
    var p = String(roh || '').trim();
    if (!/^file:/i.test(p)) return p;
    p = p.replace(/^file:\/*/i, '');
    try { p = decodeURIComponent(p); } catch (e) { /* unverändert lassen */ }
    p = p.replace(/\//g, '\\');
    if (!/^[a-zA-Z]:/.test(p)) p = '\\\\' + p;
    return p;
  }

  function kopieren(text) {
    function ersatz() {
      var feld = document.createElement('textarea');
      feld.value = text;
      feld.setAttribute('readonly', '');
      feld.style.position = 'fixed';
      feld.style.opacity = '0';
      document.body.appendChild(feld);
      feld.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(feld);
      toast(ok ? 'Pfad kopiert' : 'Kopieren nicht möglich – bitte den Pfad markieren und kopieren.', !ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('Pfad kopiert'); }, ersatz);
    } else {
      ersatz();
    }
  }

  function dateiLinkBlock(roh, titel) {
    var pfad = windowsPfad(roh);
    return '<div class="stapel" style="gap:10px">' +
      '<div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center">' +
      '<a class="link-akzent" href="' + esc(explorerUrl(roh)) + '" target="_blank" rel="noopener">' + icon('ordner') + esc(titel) + '</a>' +
      '<button type="button" class="link-akzent" data-kopieren="' + esc(pfad) + '">' + icon('kopieren') + 'Pfad kopieren</button>' +
      '</div>' +
      '<div class="pfad">' + esc(pfad) + '</div>' +
      '<p class="klein-hinweis">Browser öffnen Ordner auf dem Netzlaufwerk oft nicht direkt. Kopieren Sie dann den Pfad und fügen Sie ihn in die Adresszeile des Windows-Explorers ein.</p>' +
      '</div>';
  }

  // ------------------------------------------------------------------
  // Toasts und Dialoge
  // ------------------------------------------------------------------
  function toast(text, fehler) {
    var huelle = document.getElementById('toasts');
    if (!huelle) return;
    var el = document.createElement('div');
    el.className = 'toast' + (fehler ? ' fehler' : '');
    el.setAttribute('role', fehler ? 'alert' : 'status');
    el.textContent = text;
    huelle.appendChild(el);
    setTimeout(function () { el.remove(); }, fehler ? 6000 : 3000);
  }

  function dialog(opt) {
    return new Promise(function (resolve) {
      var huelle = document.createElement('div');
      huelle.className = 'dialog-huelle';
      huelle.innerHTML = '<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-titel">' +
        '<h3 id="dlg-titel">' + esc(opt.titel) + '</h3>' +
        '<p>' + (opt.html || esc(opt.text)) + '</p>' +
        '<div class="aktionen">' +
        '<button type="button" class="knopf knopf-rahmen" data-antwort="nein">' + esc(opt.abbrechen || 'Abbrechen') + '</button>' +
        '<button type="button" class="knopf ' + (opt.gefahr === false ? 'knopf-primaer' : 'knopf-gefahr-voll') + '" data-antwort="ja">' + esc(opt.ok || 'Löschen') + '</button>' +
        '</div></div>';
      function schliessen(wert) {
        document.removeEventListener('keydown', taste);
        huelle.remove();
        resolve(wert);
      }
      function taste(e) { if (e.key === 'Escape') schliessen(false); }
      huelle.addEventListener('click', function (e) {
        if (e.target === huelle) return schliessen(false);
        var knopf = e.target.closest('[data-antwort]');
        if (knopf) schliessen(knopf.getAttribute('data-antwort') === 'ja');
      });
      document.addEventListener('keydown', taste);
      document.body.appendChild(huelle);
      huelle.querySelector('[data-antwort="ja"]').focus();
    });
  }

  // ------------------------------------------------------------------
  // Bildzuschnitt (quadratisch, Ausgabe als JPEG)
  // ------------------------------------------------------------------
  function bildLaden(quelle) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('Das Bild konnte nicht gelesen werden.')); };
      img.src = quelle;
    });
  }

  function verkleinern(img, maxKante, qualitaet) {
    var f = Math.min(1, maxKante / Math.max(img.naturalWidth, img.naturalHeight));
    var c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * f);
    c.height = Math.round(img.naturalHeight * f);
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', qualitaet);
  }

  // Liefert { quadrat: dataUrl } oder null bei Abbruch
  function zuschnittDialog(img) {
    return new Promise(function (resolve) {
      var GROESSE = 480;
      var iw = img.naturalWidth, ih = img.naturalHeight;
      var basis = Math.max(GROESSE / iw, GROESSE / ih);
      var zoom = 1;
      var cx = iw / 2;
      var cy = ih > iw ? Math.min(ih / 2, (GROESSE / basis) / 2 + ih * 0.02) : ih / 2;

      var huelle = document.createElement('div');
      huelle.className = 'dialog-huelle';
      huelle.innerHTML = '<div class="dialog dialog-breit" role="dialog" aria-modal="true" aria-labelledby="zs-titel">' +
        '<div class="dialog-kopf">' + icon('zuschnitt') + '<h3 id="zs-titel">Bildausschnitt wählen</h3></div>' +
        '<div class="zuschnitt"><canvas width="' + GROESSE + '" height="' + GROESSE + '"></canvas></div>' +
        '<div class="dialog-inhalt">' +
        '<div class="feld"><label for="zs-zoom">Zoom</label><input id="zs-zoom" type="range" min="1" max="4" step="0.01" value="1"></div>' +
        '<p class="klein-hinweis">Ziehen Sie das Bild, um den Ausschnitt zu verschieben.</p>' +
        '<div class="aktionen" style="display:flex;justify-content:flex-end;gap:8px">' +
        '<button type="button" class="knopf knopf-rahmen" data-zs="abbrechen">Abbrechen</button>' +
        '<button type="button" class="knopf knopf-primaer" data-zs="ok">Ausschnitt übernehmen</button>' +
        '</div></div></div>';
      document.body.appendChild(huelle);
      var canvas = huelle.querySelector('canvas');
      var ctx = canvas.getContext('2d');
      var regler = huelle.querySelector('#zs-zoom');

      function begrenzen() {
        var s = basis * zoom;
        var halb = GROESSE / 2 / s;
        cx = Math.min(Math.max(cx, halb), iw - halb);
        cy = Math.min(Math.max(cy, halb), ih - halb);
      }
      function zeichnen(ziel, kante) {
        var s = basis * zoom * (kante / GROESSE);
        var c = ziel.getContext('2d');
        c.fillStyle = '#fff';
        c.fillRect(0, 0, kante, kante);
        c.drawImage(img, kante / 2 - cx * s, kante / 2 - cy * s, iw * s, ih * s);
      }
      function neu() { begrenzen(); zeichnen(canvas, GROESSE); }
      neu();

      var ziehen = null;
      canvas.addEventListener('pointerdown', function (e) {
        ziehen = { x: e.clientX, y: e.clientY };
        canvas.setPointerCapture(e.pointerId);
      });
      canvas.addEventListener('pointermove', function (e) {
        if (!ziehen) return;
        var faktor = GROESSE / canvas.getBoundingClientRect().width / (basis * zoom);
        cx -= (e.clientX - ziehen.x) * faktor;
        cy -= (e.clientY - ziehen.y) * faktor;
        ziehen = { x: e.clientX, y: e.clientY };
        neu();
      });
      canvas.addEventListener('pointerup', function () { ziehen = null; });
      canvas.addEventListener('pointercancel', function () { ziehen = null; });
      canvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        zoom = Math.min(4, Math.max(1, zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
        regler.value = zoom;
        neu();
      }, { passive: false });
      regler.addEventListener('input', function () { zoom = Number(regler.value); neu(); });

      function schliessen(ergebnis) {
        document.removeEventListener('keydown', taste);
        huelle.remove();
        resolve(ergebnis);
      }
      function taste(e) { if (e.key === 'Escape') schliessen(null); }
      document.addEventListener('keydown', taste);
      huelle.addEventListener('click', function (e) {
        var k = e.target.closest('[data-zs]');
        if (!k) return;
        if (k.getAttribute('data-zs') === 'abbrechen') return schliessen(null);
        var aus = document.createElement('canvas');
        aus.width = 320;
        aus.height = 320;
        zeichnen(aus, 320);
        schliessen({ quadrat: aus.toDataURL('image/jpeg', 0.88) });
      });
    });
  }

  // ------------------------------------------------------------------
  // Navigation und Seitenrahmen
  // ------------------------------------------------------------------
  var NAV = [
    { pfad: '/personas', text: 'Personas', icon: 'personen' },
    { pfad: '/firmen', text: 'Firmen', icon: 'firma' },
    { pfad: '/formate', text: 'E-Learning-Formate', icon: 'buch' },
    { pfad: '/einstellungen', text: 'Einstellungen', icon: 'einstellungen' }
  ];

  var ui = {
    pfad: null,
    personaSuche: '', personaGruppe: '', personaKundenprofil: '',
    firmaSuche: '',
    formatSuche: '', formatTyp: ''
  };

  function aktuellerPfad() {
    var h = '';
    try { h = window.location.hash.replace(/^#/, ''); } catch (e) { h = ''; }
    return h && h.charAt(0) === '/' ? h : '/personas';
  }

  function gehe(pfad) {
    ui.pfad = pfad;
    var gesetzt = false;
    try {
      if (window.location.hash !== '#' + pfad) {
        window.location.hash = pfad;
        gesetzt = true;
      }
    } catch (e) { gesetzt = false; }
    if (!gesetzt) zeichneSeite();
  }

  function effektivesThema() {
    var gesetzt = document.documentElement.getAttribute('data-theme');
    if (gesetzt) return gesetzt;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function geruest() {
    var app = document.getElementById('app');
    app.innerHTML =
      '<header class="kopf-mobil">' +
      '<button type="button" class="menue-knopf" id="menue-knopf" aria-label="Menü öffnen">' + icon('menue') + '</button>' +
      '<span class="nav-logo"><img src="assets/ruv-logo.png" alt="R+V"></span>' +
      '<span class="nav-titel" id="titel-mobil"></span>' +
      '</header>' +
      '<div class="abdunkler" id="abdunkler"></div>' +
      '<aside class="nav" id="nav" aria-label="Hauptnavigation"></aside>' +
      '<main class="haupt" id="haupt"></main>' +
      '<div class="toasts" id="toasts" aria-live="polite"></div>';
    document.getElementById('menue-knopf').addEventListener('click', function () { app.classList.toggle('nav-offen'); });
    document.getElementById('abdunkler').addEventListener('click', function () { app.classList.remove('nav-offen'); });

    if (geruest.fertig) return;
    geruest.fertig = true;
    // Interne Links ohne Neuladen; Kopier-Knöpfe überall
    document.addEventListener('click', function (e) {
      var kopierKnopf = e.target.closest('[data-kopieren]');
      if (kopierKnopf) { kopieren(kopierKnopf.getAttribute('data-kopieren')); return; }
      var a = e.target.closest('a[href^="#/"]');
      if (!a || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      app.classList.remove('nav-offen');
      gehe(a.getAttribute('href').slice(1));
    });
    window.addEventListener('hashchange', function () {
      if (!store.daten) return;
      ui.pfad = aktuellerPfad();
      zeichneSeite();
    });
  }

  function zeichneNavigation() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    var titel = store.daten.einstellungen.appTitel;
    document.title = titel;
    var tm = document.getElementById('titel-mobil');
    if (tm) tm.textContent = titel;
    var pfad = ui.pfad || '/personas';
    var status;
    if (store.modus === 'vorschau') status = { klasse: 'lokal', text: 'Vorschau · Änderungen im Browser' };
    else if (store.schreibfehler) status = { klasse: 'lokal', text: 'Speichern nicht möglich' };
    else status = { klasse: '', text: 'Gespeichert auf dem Server' };
    var dunkel = effektivesThema() === 'dark';
    nav.innerHTML =
      '<div class="nav-marke"><span class="nav-logo"><img src="assets/ruv-logo.png" alt="R+V"></span>' +
      '<span class="nav-titel">' + esc(titel) + '</span></div>' +
      '<nav class="nav-liste">' + NAV.map(function (n) {
        var aktiv = pfad.indexOf(n.pfad) === 0;
        return '<a class="nav-link" href="#' + n.pfad + '"' + (aktiv ? ' aria-current="page"' : '') + '>' + icon(n.icon) + '<span>' + n.text + '</span></a>';
      }).join('') + '</nav>' +
      '<div class="nav-fuss">' +
      '<a class="nav-status ' + status.klasse + '" href="#/einstellungen" style="text-decoration:none"><span class="punkt"></span>' + esc(status.text) + '</a>' +
      '<button type="button" class="nav-knopf" id="thema-knopf">' + icon(dunkel ? 'sonne' : 'mond') + '<span>' + (dunkel ? 'Helles Design' : 'Dunkles Design') + '</span></button>' +
      (store.anmeldungAktiv ? '<button type="button" class="nav-knopf" id="abmelde-knopf">' + icon('abmelden') + '<span>Abmelden</span></button>' : '') +
      '</div>';
    document.getElementById('thema-knopf').addEventListener('click', function () {
      var neu = effektivesThema() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', neu);
      lsSchreiben(KONFIG.themaSchluessel, neu);
      zeichneNavigation();
    });
    var abmeldeKnopf = document.getElementById('abmelde-knopf');
    if (abmeldeKnopf) abmeldeKnopf.addEventListener('click', abmelden);
  }

  function hinweisBanner() {
    if (!store.schreibfehler || store.modus === 'vorschau') return '';
    return '<div class="banner"><p>' + esc(store.schreibfehler) + ' Die Einrichtung ist in der README beschrieben.</p></div>';
  }

  function zeichneSeite() {
    var haupt = document.getElementById('haupt');
    if (!haupt) return;
    var pfad = ui.pfad || aktuellerPfad();
    ui.pfad = pfad;
    zeichneNavigation();
    var teile = pfad.split('/').filter(Boolean);
    var bereich = teile[0], id = teile[1] ? Number(teile[1]) : null, aktion = teile[2];
    var neu = teile[1] === 'neu';
    window.scrollTo(0, 0);

    if (bereich === 'personas') {
      if (neu) return seitePersonaForm(haupt, null);
      if (id && aktion === 'bearbeiten') return seitePersonaForm(haupt, id);
      if (id) return seitePersonaDetail(haupt, id);
      return seitePersonas(haupt);
    }
    if (bereich === 'firmen') {
      if (neu) return seiteFirmaForm(haupt, null);
      if (id && aktion === 'bearbeiten') return seiteFirmaForm(haupt, id);
      if (id) return seiteFirmaDetail(haupt, id);
      return seiteFirmen(haupt);
    }
    if (bereich === 'formate') {
      if (neu) return seiteFormatForm(haupt, null);
      if (id && aktion === 'bearbeiten') return seiteFormatForm(haupt, id);
      if (id) return seiteFormatDetail(haupt, id);
      return seiteFormate(haupt);
    }
    if (bereich === 'einstellungen') return seiteEinstellungen(haupt);
    gehe('/personas');
  }

  function nichtGefunden(haupt, text, zurueck) {
    haupt.innerHTML = '<div class="leerzustand">' + icon('suche', 'icon-gross') + '<p>' + esc(text) + '</p>' +
      '<a class="link-akzent" href="#' + zurueck + '">Zurück zur Liste</a></div>';
  }

  function avatarHtml(p, klein) {
    var inhalt = p && p.bild
      ? '<img src="' + esc(bildUrl(p.bild)) + '" alt="" loading="lazy">'
      : icon('person');
    return '<span class="avatar' + (klein ? ' avatar-klein' : '') + '">' + inhalt + '</span>';
  }

  function feld(label, wert) {
    if (leer(wert) && wert !== 0) return '';
    return '<div><dt>' + esc(label) + '</dt><dd>' + esc(wert) + '</dd></div>';
  }

  function feldListe(felder) {
    var inhalt = felder.join('');
    return inhalt ? '<dl class="felder">' + inhalt + '</dl>' : '<p class="leer">Keine Angaben.</p>';
  }

  function karte(titel, iconName, inhalt, aktion, extraKlasse) {
    return '<section class="karte ' + (extraKlasse || '') + '"><div class="karte-kopf"><h2>' + icon(iconName) + esc(titel) + '</h2>' + (aktion || '') + '</div>' + inhalt + '</section>';
  }

  function optionenHtml(liste, gewaehlt, platzhalter) {
    var html = platzhalter !== undefined ? '<option value="">' + esc(platzhalter) + '</option>' : '';
    var vorhanden = false;
    liste.forEach(function (o) {
      var wert = typeof o === 'object' ? o.wert : o;
      var text = typeof o === 'object' ? o.text : o;
      var sel = String(wert) === String(gewaehlt === null || gewaehlt === undefined ? '' : gewaehlt);
      if (sel) vorhanden = true;
      html += '<option value="' + esc(wert) + '"' + (sel ? ' selected' : '') + '>' + esc(text) + '</option>';
    });
    // Unbekannte Altwerte nicht verlieren
    if (!vorhanden && !leer(gewaehlt)) html += '<option value="' + esc(gewaehlt) + '" selected>' + esc(gewaehlt) + '</option>';
    return html;
  }

  // ------------------------------------------------------------------
  // Personas: Liste
  // ------------------------------------------------------------------
  function seitePersonas(haupt) {
    var gruppen = OPTIONEN.gruppe.slice();
    store.daten.personas.forEach(function (p) { if (p.gruppe && gruppen.indexOf(p.gruppe) < 0) gruppen.push(p.gruppe); });
    haupt.innerHTML = hinweisBanner() +
      '<div class="seitenkopf"><div><h1>Personas</h1><p id="personas-anzahl"></p></div>' +
      '<a class="knopf knopf-primaer" href="#/personas/neu">' + icon('plus') + 'Neue Persona</a></div>' +
      '<div class="filterzeile">' +
      '<div class="suche">' + icon('suche') + '<input id="p-suche" type="search" placeholder="Persona suchen (Name, Funktion, Beruf, Ort …)" aria-label="Personas durchsuchen" value="' + esc(ui.personaSuche) + '"></div>' +
      '<select id="p-gruppe" aria-label="Nach Gruppe filtern">' + optionenHtml(gruppen, ui.personaGruppe, 'Alle Gruppen') + '</select>' +
      '<select id="p-kundenprofil" aria-label="Nach Kundenprofil filtern">' + optionenHtml(OPTIONEN.kundenprofil, ui.personaKundenprofil, 'Alle Kundenprofile') + '</select>' +
      '</div>' +
      '<div id="personas-kacheln"></div>';

    function aktualisieren() {
      var q = ui.personaSuche.trim().toLowerCase();
      var liste = sortiertePersonas().filter(function (p) {
        if (ui.personaGruppe && p.gruppe !== ui.personaGruppe) return false;
        if (ui.personaKundenprofil && (p.kundenprofil || 'keine Angabe') !== ui.personaKundenprofil) return false;
        if (!q) return true;
        return [p.vorname, p.name, p.vorname + ' ' + p.name, p.funktion, p.beruf, p.ort, p.gruppe, p.personaId]
          .some(function (w) { return w !== null && w !== undefined && String(w).toLowerCase().indexOf(q) >= 0; });
      });
      var gesamt = store.daten.personas.length;
      document.getElementById('personas-anzahl').textContent = liste.length === gesamt
        ? gesamt + ' Personas in der Datenbank'
        : liste.length + ' von ' + gesamt + ' Personas';
      document.getElementById('p-gruppe').classList.toggle('filter-aktiv', !!ui.personaGruppe);
      document.getElementById('p-kundenprofil').classList.toggle('filter-aktiv', !!ui.personaKundenprofil);
      var ziel = document.getElementById('personas-kacheln');
      if (!liste.length) {
        ziel.innerHTML = '<div class="leerzustand">' + icon('person', 'icon-gross') + '<p>Keine Personas gefunden.</p></div>';
        return;
      }
      ziel.innerHTML = '<div class="kacheln">' + liste.map(function (p) {
        return '<a class="kachel" href="#/personas/' + p.id + '">' + avatarHtml(p) +
          '<span class="kachel-name">' + esc(vollerName(p)) + '</span>' +
          '<span class="kachel-sub">' + esc(p.funktion || '–') + '</span>' +
          (p.personaId ? '<span class="kachel-id">ID ' + esc(p.personaId) + '</span>' : '') +
          (p.gruppe ? '<span class="chip">' + esc(p.gruppe) + '</span>' : '') +
          '</a>';
      }).join('') + '</div>';
    }

    document.getElementById('p-suche').addEventListener('input', function (e) { ui.personaSuche = e.target.value; aktualisieren(); });
    document.getElementById('p-gruppe').addEventListener('change', function (e) { ui.personaGruppe = e.target.value; aktualisieren(); });
    document.getElementById('p-kundenprofil').addEventListener('change', function (e) { ui.personaKundenprofil = e.target.value; aktualisieren(); });
    aktualisieren();
  }

  // ------------------------------------------------------------------
  // Personas: Detail
  // ------------------------------------------------------------------
  function seitePersonaDetail(haupt, id) {
    var p = persona(id);
    if (!p) return nichtGefunden(haupt, 'Persona nicht gefunden.', '/personas');
    var d = store.daten;
    var beziehungen = beziehungenVon(id);
    var firmen = d.firmaPersonas.filter(function (fp) { return fp.personaId === id && firma(fp.firmaId); });
    var formate = d.formatPersonas.filter(function (fp) { return fp.personaId === id && format(fp.formatId); });

    var bild = p.bildGross || p.bild;
    var portrait = '<div class="portrait' + (p.bildGross ? '' : ' portrait-quadrat') + '">' +
      (bild ? '<img src="' + esc(bildUrl(bild)) + '" alt="' + esc(vollerName(p)) + '">' : icon('person', 'icon-gross')) + '</div>';

    var fakten = [];
    if (p.alter !== null && p.alter !== undefined && p.alter !== '') fakten.push('<span><strong>' + esc(p.alter) + '</strong> Jahre</span>');
    if (p.geburtstag) fakten.push('<span>Geburtstag <strong>' + esc(p.geburtstag) + '</strong></span>');
    if (p.ort) fakten.push('<span>' + esc([p.ort, p.stadtteil].filter(Boolean).join(' · ')) + '</span>');
    if (p.kundenprofil && p.kundenprofil !== 'keine Angabe') fakten.push('<span>Kundenprofil <strong>' + esc(p.kundenprofil) + '</strong></span>');

    var familieHtml = (beziehungen.length ? '<div class="liste">' + beziehungen.map(function (b) {
      var andere = persona(b.andere);
      var unter = b.verhaeltnis ? esc(b.verhaeltnis) : (b.gegen ? 'aus Sicht von ' + esc(andere.vorname) + ': ' + esc(b.gegen) : 'Verhältnis nicht angegeben');
      return '<div class="eintrag"><a class="eintrag-link" href="#/personas/' + andere.id + '">' + avatarHtml(andere, true) +
        '<span style="min-width:0"><span class="eintrag-titel">' + esc(vollerName(andere)) + '</span><br><span class="eintrag-sub">' + unter + '</span></span></a>' +
        '<button type="button" class="knopf-icon" data-bez-entfernen="' + andere.id + '" aria-label="Beziehung zu ' + esc(vollerName(andere)) + ' entfernen">' + icon('x') + '</button></div>';
    }).join('') + '</div>' : '<p class="leer">Keine Familienbeziehungen erfasst.</p>') +
      '<div id="bez-neu" hidden></div>';

    var firmenHtml = firmen.length ? '<div class="liste">' + firmen.map(function (fp) {
      var f = firma(fp.firmaId);
      return '<div class="eintrag"><a class="eintrag-link" href="#/firmen/' + f.id + '"><span class="avatar avatar-klein">' + icon('firma') + '</span>' +
        '<span style="min-width:0"><span class="eintrag-titel">' + esc(f.name) + '</span><br><span class="eintrag-sub">' +
        esc(fp.funktionInFirma || 'Funktion nicht angegeben') + (f.branche ? ' · ' + esc(f.branche) : '') + '</span></span></a></div>';
    }).join('') + '</div>' : '<p class="leer">Keiner Firma zugeordnet.</p>';

    var formateHtml = formate.length ? '<div class="liste">' + formate.map(function (fp) {
      var f = format(fp.formatId);
      return '<div class="eintrag"><a class="eintrag-link" href="#/formate/' + f.id + '"><span class="avatar avatar-klein">' + icon(formatIcon(f.formatTyp)) + '</span>' +
        '<span style="min-width:0"><span class="eintrag-titel">' + esc(f.name) + '</span><br><span class="eintrag-sub">' + esc(f.formatTyp) + ' · ' + esc(f.medienentwickler) + '</span></span></a></div>';
    }).join('') + '</div>' : '<p class="leer">Noch keinem E-Learning-Format zugewiesen.</p>';

    haupt.innerHTML = hinweisBanner() +
      '<div class="leiste"><a class="knopf knopf-text" href="#/personas">' + icon('zurueck') + 'Zurück</a>' +
      '<div class="leiste-rechts"><a class="knopf knopf-primaer" href="#/personas/' + id + '/bearbeiten">' + icon('stift') + 'Bearbeiten</a>' +
      '<button type="button" class="knopf knopf-gefahr" id="p-loeschen">' + icon('papierkorb') + 'Löschen</button></div></div>' +
      '<div class="stapel">' +
      '<section class="karte"><div class="profil">' + portrait +
      '<div class="profil-text"><h1>' + esc(vollerName(p)) + '</h1>' +
      '<div class="unterzeile">' + esc(p.funktion || '–') + (p.beruf ? ' · ' + esc(p.beruf) : '') + '</div>' +
      '<div class="chips">' + (p.gruppe ? '<span class="chip">' + esc(p.gruppe) + '</span>' : '') +
      (p.personaId ? '<span class="chip chip-grau">ID ' + esc(p.personaId) + '</span>' : '') +
      (p.cJourney ? '<span class="chip chip-grau">Customer Journey: ' + esc(p.cJourney) + '</span>' : '') + '</div>' +
      (fakten.length ? '<div class="profil-fakten">' + fakten.join('') + '</div>' : '') +
      '</div></div></section>' +
      '<div class="raster-karten">' +
      karte('Persönliche Daten', 'person', feldListe([
        feld('Vorname', p.vorname), feld('Name', p.name), feld('Geschlecht', p.geschlecht),
        feld('Geburtstag', p.geburtstag), feld('Alter', p.alter), feld('Herkunft', p.herkunft)])) +
      karte('Kontakt & Wohnen', 'ort', feldListe([
        feld('Straße', p.strasse), feld('PLZ', p.plz), feld('Ort', p.ort), feld('Stadtteil', p.stadtteil), feld('Wohnart', p.wohnart)])) +
      karte('Beruf & Rolle', 'koffer', feldListe([
        feld('Funktion in der Lernwelt', p.funktion), feld('Gruppe', p.gruppe), feld('Beruf', p.beruf),
        feld('Kundenprofil', p.kundenprofil), feld('Customer Journey', p.cJourney)])) +
      karte('Biografie', 'herz', feldListe([
        feld('Familienstand', p.familienstand), feld('Weitere Familienangaben', p.verwandt), feld('Lebenslauf', p.lebenslauf)])) +
      karte('Familie', 'personen', familieHtml,
        '<button type="button" class="knopf knopf-rahmen knopf-klein" id="bez-hinzu">' + icon('plus', 'icon-klein') + 'Beziehung</button>') +
      karte('Persönlichkeit', 'gehirn', feldListe([
        feld('Charakter', p.charakter), feld('Aktivitäten', p.aktivitaeten), feld('Sonstiges', p.sonstiges)])) +
      karte('Firmenzugehörigkeit', 'firma', firmenHtml) +
      karte('Voiceover & Avatar', 'mikro', feldListe([feld('WoC-Stimme', p.wocStimme), feld('DID-Avatar', p.didAvatar)])) +
      karte('Links & Medien', 'ordner', p.bilderLink ? dateiLinkBlock(p.bilderLink, 'Ordner im Explorer öffnen') : '<p class="leer">Kein Bilder-Link hinterlegt.</p>') +
      karte('E-Learning-Formate', 'buch', formateHtml) +
      '</div></div>';

    document.getElementById('p-loeschen').addEventListener('click', function () {
      dialog({ titel: 'Persona löschen?', html: 'Möchten Sie <strong>' + esc(vollerName(p)) + '</strong> wirklich löschen? Beziehungen und Zuordnungen dieser Persona werden ebenfalls entfernt.' })
        .then(function (ja) {
          if (!ja) return;
          aendern(function (dd) {
            dd.personas = dd.personas.filter(function (x) { return x.id !== id; });
            dd.beziehungen = dd.beziehungen.filter(function (b) { return b.personaId !== id && b.relatedPersonaId !== id; });
            dd.firmaPersonas = dd.firmaPersonas.filter(function (fp) { return fp.personaId !== id; });
            dd.formatPersonas = dd.formatPersonas.filter(function (fp) { return fp.personaId !== id; });
          }, 'Persona gelöscht').then(function (ok) { if (ok) gehe('/personas'); });
        });
    });

    haupt.querySelectorAll('[data-bez-entfernen]').forEach(function (knopf) {
      knopf.addEventListener('click', function () {
        var andere = Number(knopf.getAttribute('data-bez-entfernen'));
        dialog({ titel: 'Beziehung entfernen?', text: 'Die Verknüpfung zwischen ' + vollerName(p) + ' und ' + vollerName(persona(andere)) + ' wird auf beiden Seiten entfernt.', ok: 'Entfernen' })
          .then(function (ja) {
            if (!ja) return;
            aendern(function (dd) {
              dd.beziehungen = dd.beziehungen.filter(function (b) {
                return !((b.personaId === id && b.relatedPersonaId === andere) || (b.personaId === andere && b.relatedPersonaId === id));
              });
            }, 'Beziehung entfernt').then(function (ok) { if (ok) zeichneSeite(); });
          });
      });
    });

    document.getElementById('bez-hinzu').addEventListener('click', function () {
      var box = document.getElementById('bez-neu');
      if (!box.hidden) { box.hidden = true; return; }
      var verbunden = beziehungen.map(function (b) { return b.andere; });
      var auswahl = sortiertePersonas().filter(function (x) { return x.id !== id && verbunden.indexOf(x.id) < 0; })
        .map(function (x) { return { wert: x.id, text: vollerName(x) }; });
      box.innerHTML = '<div class="inline-form" style="margin-top:12px">' +
        '<div class="feld"><label for="bez-person">Person</label><select id="bez-person">' + optionenHtml(auswahl, '', '– Persona wählen –') + '</select></div>' +
        '<div class="feld"><label for="bez-verh">Verhältnis aus Sicht von ' + esc(p.vorname) + '</label><input id="bez-verh" type="text" placeholder="z. B. Tochter, Ehemann, Bruder"></div>' +
        '<div class="feld"><label for="bez-gegen">Gegenrichtung (optional)</label><input id="bez-gegen" type="text" placeholder="z. B. Vater, Ehefrau, Schwester"><span class="hilfe">Was ist ' + esc(p.vorname) + ' für die gewählte Person?</span></div>' +
        '<div class="aktionen"><button type="button" class="knopf knopf-rahmen knopf-klein" id="bez-abbrechen">Abbrechen</button>' +
        '<button type="button" class="knopf knopf-primaer knopf-klein" id="bez-speichern">Hinzufügen</button></div></div>';
      box.hidden = false;
      document.getElementById('bez-abbrechen').addEventListener('click', function () { box.hidden = true; });
      document.getElementById('bez-speichern').addEventListener('click', function () {
        var andere = Number(document.getElementById('bez-person').value);
        if (!andere) { toast('Bitte eine Persona wählen.', true); return; }
        var verh = document.getElementById('bez-verh').value;
        var gegen = document.getElementById('bez-gegen').value;
        aendern(function (dd) {
          dd.beziehungen.push({ id: naechsteId(dd.beziehungen), personaId: id, relatedPersonaId: andere, verhaeltnis: oderNull(verh) });
          if (!leer(gegen)) dd.beziehungen.push({ id: naechsteId(dd.beziehungen), personaId: andere, relatedPersonaId: id, verhaeltnis: oderNull(gegen) });
        }, 'Familienbeziehung hinzugefügt').then(function (ok) { if (ok) zeichneSeite(); });
      });
    });
  }

  // ------------------------------------------------------------------
  // Personas: Formular
  // ------------------------------------------------------------------
  function eingabe(id, label, wert, typ, extra) {
    return '<div class="feld"><label for="' + id + '">' + esc(label) + '</label><input id="' + id + '" type="' + (typ || 'text') + '" value="' + esc(wert) + '"' + (extra || '') + '></div>';
  }
  function auswahlFeld(id, label, liste, wert, platzhalter) {
    return '<div class="feld"><label for="' + id + '">' + esc(label) + '</label><select id="' + id + '">' + optionenHtml(liste, wert, platzhalter === undefined ? '– Bitte wählen –' : platzhalter) + '</select></div>';
  }
  function textFeld(id, label, wert) {
    return '<div class="feld"><label for="' + id + '">' + esc(label) + '</label><textarea id="' + id + '" rows="4">' + esc(wert) + '</textarea></div>';
  }
  function wert(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function geburtstagZerlegen(text) {
    var t = String(text || '').trim();
    var iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return { tag: iso[3], monat: OPTIONEN.monate[Number(iso[2]) - 1] || '' };
    var m = t.match(/^(\d{1,2})\.\s*(.*)$/);
    if (m) return { tag: m[1].length === 1 ? '0' + m[1] : m[1], monat: m[2].trim() };
    return { tag: '', monat: OPTIONEN.monate.indexOf(t) >= 0 ? t : '' };
  }

  function seitePersonaForm(haupt, id) {
    var bestehend = id ? persona(id) : null;
    if (id && !bestehend) return nichtGefunden(haupt, 'Persona nicht gefunden.', '/personas');
    var p = bestehend ? klon(bestehend) : {};
    var d = store.daten;
    var zustand = {
      bild: p.bild || null,
      bildGross: p.bildGross || null,
      firmen: d.firmaPersonas.filter(function (fp) { return id && fp.personaId === id; })
        .map(function (fp) { return { firmaId: fp.firmaId, funktionInFirma: fp.funktionInFirma || '' }; }),
      beziehungen: id ? beziehungenVon(id).map(function (b) { return { andere: b.andere, verhaeltnis: b.verhaeltnis || '', gegen: b.gegen || '' }; }) : []
    };
    var geb = geburtstagZerlegen(p.geburtstag);
    var tage = [];
    for (var i = 1; i <= 31; i++) tage.push(i < 10 ? '0' + i : String(i));
    var zurueck = id ? '#/personas/' + id : '#/personas';

    haupt.innerHTML =
      '<form id="persona-form" novalidate>' +
      '<div class="leiste"><a class="knopf knopf-text" href="' + zurueck + '">' + icon('zurueck') + 'Zurück</a>' +
      '<button type="submit" class="knopf knopf-primaer">' + icon('speichern') + 'Speichern</button></div>' +
      '<div class="seitenkopf"><div><h1>' + (id ? 'Persona bearbeiten' : 'Neue Persona') + '</h1>' +
      (id ? '<p>' + esc(vollerName(bestehend)) + '</p>' : '') + '</div></div>' +
      '<div class="stapel">' +
      karte('Profilbild', 'person', '<div class="bild-bereich" id="bild-bereich"></div>') +
      karte('Persönliche Daten', 'person', '<div class="raster raster-3">' +
        eingabe('pf-vorname', 'Vorname *', p.vorname, 'text', ' required autocomplete="off"') +
        eingabe('pf-name', 'Name *', p.name, 'text', ' required autocomplete="off"') +
        auswahlFeld('pf-geschlecht', 'Geschlecht', OPTIONEN.geschlecht, p.geschlecht) +
        '<div class="feld"><span class="label">Geburtstag</span><div class="geburtstag">' +
        '<select id="pf-geb-tag" aria-label="Tag">' + optionenHtml(tage, geb.tag, 'Tag') + '</select>' +
        '<select id="pf-geb-monat" aria-label="Monat">' + optionenHtml(OPTIONEN.monate, geb.monat, 'Monat') + '</select></div></div>' +
        eingabe('pf-alter', 'Alter', p.alter, 'number', ' min="0" max="130"') +
        eingabe('pf-herkunft', 'Herkunft', p.herkunft) +
        eingabe('pf-personaId', 'Persona-ID (Access)', p.personaId, 'number', ' min="0"') +
        '</div>') +
      karte('Kontakt & Wohnen', 'ort', '<div class="raster raster-3">' +
        eingabe('pf-strasse', 'Straße', p.strasse) + eingabe('pf-plz', 'PLZ', p.plz) + eingabe('pf-ort', 'Ort', p.ort) +
        eingabe('pf-stadtteil', 'Stadtteil', p.stadtteil) + eingabe('pf-wohnart', 'Wohnart', p.wohnart) + '</div>') +
      karte('Beruf & Rolle', 'koffer', '<div class="raster raster-3">' +
        eingabe('pf-funktion', 'Funktion in der Lernwelt', p.funktion) +
        auswahlFeld('pf-gruppe', 'Gruppe', OPTIONEN.gruppe, p.gruppe) +
        eingabe('pf-beruf', 'Beruf', p.beruf) +
        auswahlFeld('pf-kundenprofil', 'Kundenprofil', OPTIONEN.kundenprofil, p.kundenprofil) +
        auswahlFeld('pf-cJourney', 'Customer Journey', OPTIONEN.cJourney, p.cJourney) + '</div>') +
      karte('Firmenzuordnung', 'firma', '<div id="pf-firmen"></div>',
        '<button type="button" class="knopf knopf-rahmen knopf-klein" id="pf-firma-hinzu">' + icon('plus', 'icon-klein') + 'Firma hinzufügen</button>') +
      karte('Biografie & Persönlichkeit', 'herz', '<div class="raster raster-2">' +
        auswahlFeld('pf-familienstand', 'Familienstand', OPTIONEN.familienstand, p.familienstand) +
        '<div></div>' +
        textFeld('pf-lebenslauf', 'Lebenslauf', p.lebenslauf) +
        textFeld('pf-aktivitaeten', 'Aktivitäten', p.aktivitaeten) +
        textFeld('pf-charakter', 'Charakter', p.charakter) +
        textFeld('pf-sonstiges', 'Sonstiges', p.sonstiges) + '</div>') +
      karte('Familie', 'personen', '<div id="pf-familie"></div><div style="margin-top:16px">' +
        textFeld('pf-verwandt', 'Weitere Familienangaben (Freitext)', p.verwandt) + '</div>',
        '<button type="button" class="knopf knopf-rahmen knopf-klein" id="pf-bez-hinzu">' + icon('plus', 'icon-klein') + 'Verwandte/n hinzufügen</button>') +
      karte('Voiceover & Avatar', 'mikro', '<div class="raster raster-3">' +
        eingabe('pf-wocStimme', 'WoC-Stimme', p.wocStimme) + eingabe('pf-didAvatar', 'DID-Avatar', p.didAvatar) + '</div>') +
      karte('Links & Medien', 'ordner', '<div class="raster">' +
        eingabe('pf-bilderLink', 'Bilder-Link', p.bilderLink, 'text', ' placeholder="\\\\Server\\Freigabe\\Ordner oder X:\\Ordner"') + '</div>') +
      '<div style="display:flex;justify-content:flex-end"><button type="submit" class="knopf knopf-primaer">' + icon('speichern') + 'Speichern</button></div>' +
      '</div></form>';

    function zeichneBild() {
      var ziel = document.getElementById('bild-bereich');
      var vorschau = zustand.bild;
      ziel.innerHTML = '<span class="avatar" style="width:96px;height:96px">' + (vorschau ? '<img src="' + esc(bildUrl(vorschau)) + '" alt="Vorschau">' : icon('person')) + '</span>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
        '<label class="knopf knopf-rahmen" for="pf-bilddatei">' + icon('hochladen') + (vorschau ? 'Bild ändern' : 'Bild auswählen') + '</label>' +
        '<input id="pf-bilddatei" type="file" accept="image/jpeg,image/png,image/webp" hidden>' +
        (zustand.bildGross || zustand.bild ? '<button type="button" class="knopf knopf-rahmen" id="pf-bild-ausschnitt">' + icon('zuschnitt') + 'Ausschnitt anpassen</button>' : '') +
        (vorschau ? '<button type="button" class="knopf knopf-gefahr" id="pf-bild-loeschen">' + icon('x') + 'Bild löschen</button>' : '') +
        '</div>';
      document.getElementById('pf-bilddatei').addEventListener('change', function (e) {
        var datei = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!datei) return;
        var url = URL.createObjectURL(datei);
        bildLaden(url).then(function (img) {
          return zuschnittDialog(img).then(function (erg) {
            if (erg) {
              zustand.bild = erg.quadrat;
              zustand.bildGross = verkleinern(img, 800, 0.85);
              zeichneBild();
            }
            URL.revokeObjectURL(url);
          });
        }).catch(function (err) { toast(err.message, true); });
      });
      var aus = document.getElementById('pf-bild-ausschnitt');
      if (aus) aus.addEventListener('click', function () {
        bildLaden(bildUrl(zustand.bildGross || zustand.bild)).then(zuschnittDialog).then(function (erg) {
          if (erg) { zustand.bild = erg.quadrat; zeichneBild(); }
        }).catch(function (err) { toast(err.message, true); });
      });
      var weg = document.getElementById('pf-bild-loeschen');
      if (weg) weg.addEventListener('click', function () { zustand.bild = null; zustand.bildGross = null; zeichneBild(); });
    }

    function zeichneFirmen() {
      var ziel = document.getElementById('pf-firmen');
      var alle = d.firmen.slice().sort(function (a, b) { return vergleich(a.name, b.name); })
        .map(function (f) { return { wert: f.id, text: f.name }; });
      if (!zustand.firmen.length) {
        ziel.innerHTML = '<p class="leer">' + (alle.length ? 'Keine Firma zugeordnet.' : 'Noch keine Firmen vorhanden. Legen Sie zuerst unter „Firmen“ eine Firma an.') + '</p>';
        return;
      }
      ziel.innerHTML = '<div class="stapel" style="gap:12px">' + zustand.firmen.map(function (a, i) {
        return '<div class="zeile-zuordnung">' +
          '<div class="feld"><label for="pf-fi-' + i + '">Firma</label><select id="pf-fi-' + i + '" data-firma-idx="' + i + '">' + optionenHtml(alle, a.firmaId, '– Firma wählen –') + '</select></div>' +
          '<div class="feld"><label for="pf-ff-' + i + '">Funktion in der Firma</label><input id="pf-ff-' + i + '" type="text" data-funktion-idx="' + i + '" value="' + esc(a.funktionInFirma) + '"></div>' +
          '<button type="button" class="knopf-icon" data-firma-weg="' + i + '" aria-label="Zuordnung entfernen">' + icon('x') + '</button></div>';
      }).join('') + '</div>';
      ziel.querySelectorAll('[data-firma-idx]').forEach(function (el) {
        el.addEventListener('change', function () { zustand.firmen[Number(el.getAttribute('data-firma-idx'))].firmaId = Number(el.value) || ''; });
      });
      ziel.querySelectorAll('[data-funktion-idx]').forEach(function (el) {
        el.addEventListener('input', function () { zustand.firmen[Number(el.getAttribute('data-funktion-idx'))].funktionInFirma = el.value; });
      });
      ziel.querySelectorAll('[data-firma-weg]').forEach(function (el) {
        el.addEventListener('click', function () { zustand.firmen.splice(Number(el.getAttribute('data-firma-weg')), 1); zeichneFirmen(); });
      });
    }

    function zeichneFamilie() {
      var ziel = document.getElementById('pf-familie');
      var alle = sortiertePersonas().filter(function (x) { return x.id !== id; }).map(function (x) { return { wert: x.id, text: vollerName(x) }; });
      if (!zustand.beziehungen.length) {
        ziel.innerHTML = '<p class="leer">Keine Familienbeziehungen erfasst.</p>';
        return;
      }
      ziel.innerHTML = '<div class="stapel" style="gap:12px">' + zustand.beziehungen.map(function (b, i) {
        return '<div class="zeile-zuordnung zeile-zuordnung-3">' +
          '<div class="feld"><label for="pf-bp-' + i + '">Person</label><select id="pf-bp-' + i + '" data-bez-idx="' + i + '" data-bez-feld="andere">' + optionenHtml(alle, b.andere, '– Persona wählen –') + '</select></div>' +
          '<div class="feld"><label for="pf-bv-' + i + '">Verhältnis (aus Sicht dieser Persona)</label><input id="pf-bv-' + i + '" type="text" data-bez-idx="' + i + '" data-bez-feld="verhaeltnis" value="' + esc(b.verhaeltnis) + '" placeholder="z. B. Tochter"></div>' +
          '<div class="feld"><label for="pf-bg-' + i + '">Gegenrichtung</label><input id="pf-bg-' + i + '" type="text" data-bez-idx="' + i + '" data-bez-feld="gegen" value="' + esc(b.gegen) + '" placeholder="z. B. Vater"></div>' +
          '<button type="button" class="knopf-icon" data-bez-weg="' + i + '" aria-label="Beziehung entfernen">' + icon('x') + '</button></div>';
      }).join('') + '</div>';
      ziel.querySelectorAll('[data-bez-idx]').forEach(function (el) {
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', function () {
          var eintrag = zustand.beziehungen[Number(el.getAttribute('data-bez-idx'))];
          var f = el.getAttribute('data-bez-feld');
          eintrag[f] = f === 'andere' ? (Number(el.value) || '') : el.value;
        });
      });
      ziel.querySelectorAll('[data-bez-weg]').forEach(function (el) {
        el.addEventListener('click', function () { zustand.beziehungen.splice(Number(el.getAttribute('data-bez-weg')), 1); zeichneFamilie(); });
      });
    }

    zeichneBild();
    zeichneFirmen();
    zeichneFamilie();
    document.getElementById('pf-firma-hinzu').addEventListener('click', function () { zustand.firmen.push({ firmaId: '', funktionInFirma: '' }); zeichneFirmen(); });
    document.getElementById('pf-bez-hinzu').addEventListener('click', function () { zustand.beziehungen.push({ andere: '', verhaeltnis: '', gegen: '' }); zeichneFamilie(); });

    document.getElementById('persona-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var vorname = wert('pf-vorname').trim(), name = wert('pf-name').trim();
      if (!vorname || !name) { toast('Vorname und Name sind Pflichtfelder.', true); return; }
      var tag = wert('pf-geb-tag'), monat = wert('pf-geb-monat');
      var geburtstag = tag && monat ? tag + '. ' + monat : (monat || (tag ? tag + '.' : null));
      var alter = wert('pf-alter'), pid = wert('pf-personaId');
      var daten = {
        vorname: vorname, name: name,
        geschlecht: oderNull(wert('pf-geschlecht')), geburtstag: geburtstag,
        alter: leer(alter) ? null : parseInt(alter, 10),
        herkunft: oderNull(wert('pf-herkunft')),
        personaId: leer(pid) ? null : parseInt(pid, 10),
        strasse: oderNull(wert('pf-strasse')), plz: oderNull(wert('pf-plz')), ort: oderNull(wert('pf-ort')),
        stadtteil: oderNull(wert('pf-stadtteil')), wohnart: oderNull(wert('pf-wohnart')),
        funktion: oderNull(wert('pf-funktion')), gruppe: oderNull(wert('pf-gruppe')), beruf: oderNull(wert('pf-beruf')),
        kundenprofil: oderNull(wert('pf-kundenprofil')), cJourney: oderNull(wert('pf-cJourney')),
        familienstand: oderNull(wert('pf-familienstand')),
        lebenslauf: oderNull(wert('pf-lebenslauf')), aktivitaeten: oderNull(wert('pf-aktivitaeten')),
        charakter: oderNull(wert('pf-charakter')), sonstiges: oderNull(wert('pf-sonstiges')),
        verwandt: oderNull(wert('pf-verwandt')),
        wocStimme: oderNull(wert('pf-wocStimme')), didAvatar: oderNull(wert('pf-didAvatar')),
        bilderLink: oderNull(wert('pf-bilderLink')),
        bild: zustand.bild, bildGross: zustand.bildGross
      };
      if (daten.personaId !== null && d.personas.some(function (x) { return x.personaId === daten.personaId && x.id !== id; })) {
        toast('Die Persona-ID ' + daten.personaId + ' ist bereits vergeben.', true);
        return;
      }
      var firmen = [];
      zustand.firmen.forEach(function (a) {
        if (a.firmaId && !firmen.some(function (x) { return x.firmaId === a.firmaId; })) firmen.push({ firmaId: a.firmaId, funktionInFirma: oderNull(a.funktionInFirma) });
      });
      aendern(function (dd) {
        var ziel;
        if (id) {
          ziel = dd.personas.find(function (x) { return x.id === id; });
          Object.keys(daten).forEach(function (k) { ziel[k] = daten[k]; });
        } else {
          ziel = Object.assign({ id: naechsteId(dd.personas) }, daten);
          dd.personas.push(ziel);
        }
        dd.firmaPersonas = dd.firmaPersonas.filter(function (fp) { return fp.personaId !== ziel.id; })
          .concat(firmen.map(function (f) { return { firmaId: f.firmaId, personaId: ziel.id, funktionInFirma: f.funktionInFirma }; }));
        beziehungenErsetzen(dd, ziel.id, zustand.beziehungen);
        return ziel.id;
      }, id ? 'Persona aktualisiert' : 'Persona angelegt').then(function (neueId) {
        if (neueId) gehe('/personas/' + neueId);
      });
    });
  }

  // ------------------------------------------------------------------
  // Firmen
  // ------------------------------------------------------------------
  function seiteFirmen(haupt) {
    haupt.innerHTML = hinweisBanner() +
      '<div class="seitenkopf"><div><h1>Firmen</h1><p id="firmen-anzahl"></p></div>' +
      '<a class="knopf knopf-primaer" href="#/firmen/neu">' + icon('plus') + 'Neue Firma</a></div>' +
      '<div class="filterzeile"><div class="suche">' + icon('suche') +
      '<input id="f-suche" type="search" placeholder="Suche nach Name, Branche oder Ort …" aria-label="Firmen durchsuchen" value="' + esc(ui.firmaSuche) + '"></div></div>' +
      '<div id="firmen-kacheln"></div>';
    function aktualisieren() {
      var q = ui.firmaSuche.trim().toLowerCase();
      var liste = store.daten.firmen.slice().sort(function (a, b) { return vergleich(a.name, b.name); }).filter(function (f) {
        return !q || [f.name, f.branche, f.ort].some(function (w) { return w && w.toLowerCase().indexOf(q) >= 0; });
      });
      document.getElementById('firmen-anzahl').textContent = store.daten.firmen.length + ' Firmen in der Datenbank';
      var ziel = document.getElementById('firmen-kacheln');
      if (!liste.length) {
        ziel.innerHTML = '<div class="leerzustand">' + icon('firma', 'icon-gross') + '<p>' + (store.daten.firmen.length ? 'Keine Firmen gefunden.' : 'Noch keine Firmen angelegt.') + '</p></div>';
        return;
      }
      ziel.innerHTML = '<div class="kacheln-breit">' + liste.map(function (f) {
        var anzahl = store.daten.firmaPersonas.filter(function (fp) { return fp.firmaId === f.id && persona(fp.personaId); }).length;
        return '<a class="kachel-breit" href="#/firmen/' + f.id + '"><span class="titel"><span class="symbol">' + icon('firma') + '</span><span>' + esc(f.name) +
          (f.funktion && f.funktion !== 'keine Angabe' ? '<br><span class="kachel-sub" style="font-weight:400">' + esc(f.funktion) + '</span>' : '') + '</span></span>' +
          '<dl><dt>Branche</dt><dd>' + esc(f.branche || '–') + '</dd><dt>Personas</dt><dd>' + anzahl + '</dd></dl></a>';
      }).join('') + '</div>';
    }
    document.getElementById('f-suche').addEventListener('input', function (e) { ui.firmaSuche = e.target.value; aktualisieren(); });
    aktualisieren();
  }

  function seiteFirmaDetail(haupt, id) {
    var f = firma(id);
    if (!f) return nichtGefunden(haupt, 'Firma nicht gefunden.', '/firmen');
    var zuordnungen = store.daten.firmaPersonas.filter(function (fp) { return fp.firmaId === id && persona(fp.personaId); })
      .sort(function (a, b) { return vergleich(persona(a.personaId).name, persona(b.personaId).name); });
    var adresse = [f.strasse, [f.plz, f.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    haupt.innerHTML = hinweisBanner() +
      '<div class="leiste"><a class="knopf knopf-text" href="#/firmen">' + icon('zurueck') + 'Zurück</a>' +
      '<div class="leiste-rechts"><a class="knopf knopf-primaer" href="#/firmen/' + id + '/bearbeiten">' + icon('stift') + 'Bearbeiten</a>' +
      '<button type="button" class="knopf knopf-gefahr" id="f-loeschen">' + icon('papierkorb') + 'Löschen</button></div></div>' +
      '<div class="stapel">' +
      '<section class="karte"><div class="profil"><span class="avatar" style="border-radius:12px">' + icon('firma') + '</span>' +
      '<div class="profil-text"><h1>' + esc(f.name) + '</h1>' +
      '<div class="chips">' + (f.funktion ? '<span class="chip">' + esc(f.funktion) + '</span>' : '') +
      (f.firmenId ? '<span class="chip chip-grau">ID ' + esc(f.firmenId) + '</span>' : '') + '</div></div></div></section>' +
      '<div class="raster-karten">' +
      karte('Firmendaten', 'firma', feldListe([feld('Funktion', f.funktion), feld('Branche', f.branche), feld('Adresse', adresse), feld('Sonstiges', f.sonstiges)])) +
      karte('Zugeordnete Personas (' + zuordnungen.length + ')', 'personen', zuordnungen.length ? '<div class="liste">' + zuordnungen.map(function (fp) {
        var p = persona(fp.personaId);
        return '<div class="eintrag"><a class="eintrag-link" href="#/personas/' + p.id + '">' + avatarHtml(p, true) +
          '<span style="min-width:0"><span class="eintrag-titel">' + esc(vollerName(p)) + '</span><br><span class="eintrag-sub">' + esc(fp.funktionInFirma || p.funktion || '–') + '</span></span></a></div>';
      }).join('') + '</div>' : '<p class="leer">Keine Personas zugeordnet.</p>') +
      '</div></div>';
    document.getElementById('f-loeschen').addEventListener('click', function () {
      dialog({ titel: 'Firma löschen?', html: 'Möchten Sie <strong>' + esc(f.name) + '</strong> wirklich löschen? Die Personas bleiben erhalten, nur die Zuordnung wird entfernt.' })
        .then(function (ja) {
          if (!ja) return;
          aendern(function (dd) {
            dd.firmen = dd.firmen.filter(function (x) { return x.id !== id; });
            dd.firmaPersonas = dd.firmaPersonas.filter(function (fp) { return fp.firmaId !== id; });
          }, 'Firma gelöscht').then(function (ok) { if (ok) gehe('/firmen'); });
        });
    });
  }

  function seiteFirmaForm(haupt, id) {
    var bestehend = id ? firma(id) : null;
    if (id && !bestehend) return nichtGefunden(haupt, 'Firma nicht gefunden.', '/firmen');
    var f = bestehend || {};
    var zuordnungen = store.daten.firmaPersonas.filter(function (fp) { return id && fp.firmaId === id && persona(fp.personaId); })
      .map(function (fp) { return { personaId: fp.personaId, funktionInFirma: fp.funktionInFirma || '' }; });
    var zurueck = id ? '#/firmen/' + id : '#/firmen';
    haupt.innerHTML =
      '<form id="firma-form" novalidate>' +
      '<div class="leiste"><a class="knopf knopf-text" href="' + zurueck + '">' + icon('zurueck') + 'Zurück</a>' +
      '<button type="submit" class="knopf knopf-primaer">' + icon('speichern') + 'Speichern</button></div>' +
      '<div class="seitenkopf"><div><h1>' + (id ? 'Firma bearbeiten' : 'Neue Firma') + '</h1></div></div>' +
      '<div class="stapel">' +
      karte('Firmendaten', 'firma', '<div class="raster raster-2">' +
        eingabe('ff-name', 'Name *', f.name, 'text', ' required autocomplete="off"') +
        auswahlFeld('ff-funktion', 'Funktion', OPTIONEN.firmaFunktion, f.funktion) +
        eingabe('ff-branche', 'Branche', f.branche) +
        eingabe('ff-strasse', 'Straße & Hausnummer', f.strasse) +
        eingabe('ff-plz', 'PLZ', f.plz) + eingabe('ff-ort', 'Ort', f.ort) +
        '<div class="spalte-voll">' + textFeld('ff-sonstiges', 'Sonstiges', f.sonstiges) + '</div></div>') +
      karte('Personas zuordnen', 'personen', '<div id="ff-zuordnungen"></div>' +
        '<div class="feld" style="margin-top:16px"><label for="ff-suche">Persona hinzufügen</label>' +
        '<div class="suche">' + icon('suche') + '<input id="ff-suche" type="search" placeholder="Persona suchen und hinzufügen …" autocomplete="off"></div>' +
        '<div class="treffer" id="ff-treffer" hidden></div></div>') +
      '<div style="display:flex;justify-content:flex-end"><button type="submit" class="knopf knopf-primaer">' + icon('speichern') + 'Speichern</button></div>' +
      '</div></form>';

    function zeichneZuordnungen() {
      var ziel = document.getElementById('ff-zuordnungen');
      if (!zuordnungen.length) { ziel.innerHTML = '<p class="leer">Noch keine Personas zugeordnet.</p>'; return; }
      ziel.innerHTML = '<div class="liste">' + zuordnungen.map(function (z, i) {
        var p = persona(z.personaId);
        return '<div class="eintrag" style="flex-wrap:wrap">' +
          '<span class="eintrag-link" style="flex:1 1 200px">' + avatarHtml(p, true) + '<span class="eintrag-titel">' + esc(vollerName(p)) + '</span></span>' +
          '<input type="text" style="flex:1 1 200px" aria-label="Funktion in der Firma" placeholder="Funktion in der Firma …" data-zu-idx="' + i + '" value="' + esc(z.funktionInFirma) + '">' +
          '<button type="button" class="knopf-icon" data-zu-weg="' + i + '" aria-label="Zuordnung entfernen">' + icon('x') + '</button></div>';
      }).join('') + '</div>';
      ziel.querySelectorAll('[data-zu-idx]').forEach(function (el) {
        el.addEventListener('input', function () { zuordnungen[Number(el.getAttribute('data-zu-idx'))].funktionInFirma = el.value; });
      });
      ziel.querySelectorAll('[data-zu-weg]').forEach(function (el) {
        el.addEventListener('click', function () { zuordnungen.splice(Number(el.getAttribute('data-zu-weg')), 1); zeichneZuordnungen(); });
      });
    }
    var suche = document.getElementById('ff-suche');
    var treffer = document.getElementById('ff-treffer');
    function zeigeTreffer() {
      var q = suche.value.trim().toLowerCase();
      if (!q) { treffer.hidden = true; return; }
      var liste = sortiertePersonas().filter(function (p) {
        return !zuordnungen.some(function (z) { return z.personaId === p.id; }) &&
          (vollerName(p).toLowerCase().indexOf(q) >= 0 || (p.funktion || '').toLowerCase().indexOf(q) >= 0);
      }).slice(0, 12);
      treffer.innerHTML = liste.length ? liste.map(function (p) {
        return '<button type="button" data-hinzu="' + p.id + '">' + icon('plus', 'icon-klein') + '<span>' + esc(vollerName(p)) + ' <span class="auswahl-sub">' + esc(p.funktion || '') + '</span></span></button>';
      }).join('') : '<p class="leer" style="padding:8px 12px">Keine passende Persona.</p>';
      treffer.hidden = false;
    }
    suche.addEventListener('input', zeigeTreffer);
    treffer.addEventListener('click', function (e) {
      var k = e.target.closest('[data-hinzu]');
      if (!k) return;
      zuordnungen.push({ personaId: Number(k.getAttribute('data-hinzu')), funktionInFirma: '' });
      suche.value = '';
      treffer.hidden = true;
      zeichneZuordnungen();
      suche.focus();
    });
    zeichneZuordnungen();

    document.getElementById('firma-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = wert('ff-name').trim();
      if (!name) { toast('Der Name ist ein Pflichtfeld.', true); return; }
      var daten = {
        name: name, funktion: oderNull(wert('ff-funktion')), branche: oderNull(wert('ff-branche')),
        strasse: oderNull(wert('ff-strasse')), plz: oderNull(wert('ff-plz')), ort: oderNull(wert('ff-ort')),
        sonstiges: oderNull(wert('ff-sonstiges'))
      };
      aendern(function (dd) {
        var ziel;
        if (id) {
          ziel = dd.firmen.find(function (x) { return x.id === id; });
          Object.keys(daten).forEach(function (k) { ziel[k] = daten[k]; });
        } else {
          ziel = Object.assign({ id: naechsteId(dd.firmen) }, daten);
          dd.firmen.push(ziel);
        }
        dd.firmaPersonas = dd.firmaPersonas.filter(function (fp) { return fp.firmaId !== ziel.id; })
          .concat(zuordnungen.map(function (z) { return { firmaId: ziel.id, personaId: z.personaId, funktionInFirma: oderNull(z.funktionInFirma) }; }));
        return ziel.id;
      }, id ? 'Firma aktualisiert' : 'Firma angelegt').then(function (neueId) { if (neueId) gehe('/firmen/' + neueId); });
    });
  }

  // ------------------------------------------------------------------
  // E-Learning-Formate
  // ------------------------------------------------------------------
  function formatIcon(typ) {
    return typ === 'Video' ? 'video' : typ === 'Podcast' ? 'kopfhoerer' : 'monitor';
  }
  function formatNummer(n) {
    return n === null || n === undefined || n === '' ? '–' : String(n).padStart(3, '0');
  }

  function seiteFormate(haupt) {
    haupt.innerHTML = hinweisBanner() +
      '<div class="seitenkopf"><div><h1>E-Learning-Formate</h1><p id="formate-anzahl"></p></div>' +
      '<a class="knopf knopf-primaer" href="#/formate/neu">' + icon('plus') + 'Neues Format</a></div>' +
      '<div class="filterzeile"><div class="suche">' + icon('suche') +
      '<input id="fo-suche" type="search" placeholder="Suche nach Name oder Mediengestalter …" aria-label="Formate durchsuchen" value="' + esc(ui.formatSuche) + '"></div>' +
      '<select id="fo-typ" aria-label="Nach Format filtern">' + optionenHtml(OPTIONEN.formatTyp, ui.formatTyp, 'Alle Formate') + '</select></div>' +
      '<div id="formate-kacheln"></div>';
    function aktualisieren() {
      var q = ui.formatSuche.trim().toLowerCase();
      var liste = store.daten.formate.slice().sort(function (a, b) { return vergleich(a.name, b.name); }).filter(function (f) {
        if (ui.formatTyp && f.formatTyp !== ui.formatTyp) return false;
        return !q || [f.name, f.medienentwickler].some(function (w) { return w && w.toLowerCase().indexOf(q) >= 0; });
      });
      document.getElementById('formate-anzahl').textContent = store.daten.formate.length + ' Formate in der Datenbank';
      document.getElementById('fo-typ').classList.toggle('filter-aktiv', !!ui.formatTyp);
      var ziel = document.getElementById('formate-kacheln');
      if (!liste.length) {
        ziel.innerHTML = '<div class="leerzustand">' + icon('buch', 'icon-gross') + '<p>' +
          (store.daten.formate.length ? 'Keine Formate gefunden.' : 'Noch keine E-Learning-Formate angelegt.') + '</p>' +
          (store.daten.formate.length ? '' : '<a class="link-akzent" href="#/formate/neu">' + icon('plus', 'icon-klein') + 'Erstes Format anlegen</a>') + '</div>';
        return;
      }
      ziel.innerHTML = '<div class="kacheln-breit">' + liste.map(function (f) {
        return '<a class="kachel-breit" href="#/formate/' + f.id + '"><span class="titel"><span class="symbol">' + icon(formatIcon(f.formatTyp)) + '</span><span>' + esc(f.name) + '</span></span>' +
          '<dl><dt>ID</dt><dd style="font-variant-numeric:tabular-nums">' + formatNummer(f.formatId) + '</dd><dt>Format</dt><dd>' + esc(f.formatTyp) + '</dd>' +
          '<dt>Mediengestalter</dt><dd>' + esc(f.medienentwickler || '–') + '</dd></dl></a>';
      }).join('') + '</div>';
    }
    document.getElementById('fo-suche').addEventListener('input', function (e) { ui.formatSuche = e.target.value; aktualisieren(); });
    document.getElementById('fo-typ').addEventListener('change', function (e) { ui.formatTyp = e.target.value; aktualisieren(); });
    aktualisieren();
  }

  function seiteFormatDetail(haupt, id) {
    var f = format(id);
    if (!f) return nichtGefunden(haupt, 'Format nicht gefunden.', '/formate');
    var personen = store.daten.formatPersonas.filter(function (fp) { return fp.formatId === id && persona(fp.personaId); })
      .map(function (fp) { return persona(fp.personaId); })
      .sort(function (a, b) { return vergleich(a.name, b.name); });
    haupt.innerHTML = hinweisBanner() +
      '<div class="leiste"><a class="knopf knopf-text" href="#/formate">' + icon('zurueck') + 'Zurück</a>' +
      '<div class="leiste-rechts"><a class="knopf knopf-primaer" href="#/formate/' + id + '/bearbeiten">' + icon('stift') + 'Bearbeiten</a>' +
      '<button type="button" class="knopf knopf-gefahr" id="fo-loeschen">' + icon('papierkorb') + 'Löschen</button></div></div>' +
      '<div class="stapel">' +
      '<section class="karte"><div class="profil"><span class="avatar" style="border-radius:12px">' + icon(formatIcon(f.formatTyp)) + '</span>' +
      '<div class="profil-text"><h1>' + esc(f.name) + '</h1><div class="chips"><span class="chip">' + esc(f.formatTyp) + '</span>' +
      '<span class="chip chip-grau">ID ' + formatNummer(f.formatId) + '</span></div></div></div></section>' +
      '<div class="raster-karten">' +
      karte('Formatdaten', 'buch', '<div class="stapel" style="gap:16px">' + feldListe([
        feld('ID', formatNummer(f.formatId)), feld('Format', f.formatTyp), feld('Medienentwickler', f.medienentwickler)]) +
        (f.link ? '<div><div class="felder"><dt>Datei-Link</dt></div>' + dateiLinkBlock(f.link, 'Im Explorer öffnen') + '</div>' : '') +
        (f.httpLink ? '<div class="felder"><dt>HTTP-Link</dt><dd><a class="link-akzent" href="' + esc(f.httpLink) + '" target="_blank" rel="noopener">' + icon('extern') + esc(f.httpLink) + '</a></dd></div>' : '') +
        '</div>') +
      karte('Zugewiesene Personas (' + personen.length + ')', 'personen', personen.length ? '<div class="liste">' + personen.map(function (p) {
        return '<div class="eintrag"><a class="eintrag-link" href="#/personas/' + p.id + '">' + avatarHtml(p, true) +
          '<span style="min-width:0"><span class="eintrag-titel">' + esc(vollerName(p)) + '</span><br><span class="eintrag-sub">' + esc(p.funktion || '–') + '</span></span></a></div>';
      }).join('') + '</div>' : '<p class="leer">Keine Personas zugewiesen.</p>') +
      '</div></div>';
    document.getElementById('fo-loeschen').addEventListener('click', function () {
      dialog({ titel: 'Format löschen?', html: 'Möchten Sie <strong>' + esc(f.name) + '</strong> wirklich löschen?' }).then(function (ja) {
        if (!ja) return;
        aendern(function (dd) {
          dd.formate = dd.formate.filter(function (x) { return x.id !== id; });
          dd.formatPersonas = dd.formatPersonas.filter(function (fp) { return fp.formatId !== id; });
        }, 'Format gelöscht').then(function (ok) { if (ok) gehe('/formate'); });
      });
    });
  }

  function seiteFormatForm(haupt, id) {
    var bestehend = id ? format(id) : null;
    if (id && !bestehend) return nichtGefunden(haupt, 'Format nicht gefunden.', '/formate');
    var f = bestehend || {};
    var gewaehlt = store.daten.formatPersonas.filter(function (fp) { return id && fp.formatId === id; }).map(function (fp) { return fp.personaId; });
    var zurueck = id ? '#/formate/' + id : '#/formate';
    haupt.innerHTML =
      '<form id="format-form" novalidate>' +
      '<div class="leiste"><a class="knopf knopf-text" href="' + zurueck + '">' + icon('zurueck') + 'Zurück</a>' +
      '<button type="submit" class="knopf knopf-primaer">' + icon('speichern') + 'Speichern</button></div>' +
      '<div class="seitenkopf"><div><h1>' + (id ? 'Format bearbeiten' : 'Neues Format') + '</h1></div></div>' +
      '<div class="stapel">' +
      karte('Formatdaten', 'buch', '<div class="raster raster-2">' +
        eingabe('fo-name', 'Name *', f.name, 'text', ' required autocomplete="off"') +
        auswahlFeld('fo-typ-feld', 'Format-Typ *', OPTIONEN.formatTyp, f.formatTyp || 'Lernprogramm', undefined) +
        eingabe('fo-nummer', 'ID', f.formatId, 'number', ' min="0" max="999" placeholder="3-stellige Nummer"') +
        eingabe('fo-medienentwickler', 'Medienentwickler *', f.medienentwickler) +
        '<div class="feld"><label for="fo-link">Datei-Link</label><input id="fo-link" type="text" value="' + esc(f.link) + '" placeholder="\\\\Server\\Freigabe\\Ordner oder X:\\Ordner"><span class="hilfe">Pfad auf Dateiebene, der im Windows-Explorer geöffnet wird.</span></div>' +
        eingabe('fo-http', 'HTTP-Link', f.httpLink, 'url', ' placeholder="https://…"') + '</div>') +
      karte('Personas zuweisen', 'personen',
        '<div class="suche" style="margin-bottom:12px">' + icon('suche') + '<input id="fo-psuche" type="search" placeholder="Persona suchen …" aria-label="Personas filtern"></div>' +
        '<p class="klein-hinweis" id="fo-anzahl" style="margin-bottom:8px"></p><div class="auswahlliste" id="fo-personen"></div>') +
      '<div style="display:flex;justify-content:flex-end"><button type="submit" class="knopf knopf-primaer">' + icon('speichern') + 'Speichern</button></div>' +
      '</div></form>';

    var liste = document.getElementById('fo-personen');
    liste.innerHTML = sortiertePersonas().map(function (p) {
      return '<label class="auswahl" data-name="' + esc((vollerName(p) + ' ' + (p.funktion || '')).toLowerCase()) + '">' +
        '<input type="checkbox" value="' + p.id + '"' + (gewaehlt.indexOf(p.id) >= 0 ? ' checked' : '') + '>' +
        avatarHtml(p, true) + '<span><span class="eintrag-titel">' + esc(vollerName(p)) + '</span><br><span class="auswahl-sub">' + esc(p.funktion || '–') + '</span></span></label>';
    }).join('');
    function zaehlen() {
      document.getElementById('fo-anzahl').textContent = liste.querySelectorAll('input:checked').length + ' ausgewählt';
    }
    liste.addEventListener('change', zaehlen);
    zaehlen();
    document.getElementById('fo-psuche').addEventListener('input', function (e) {
      var q = e.target.value.trim().toLowerCase();
      liste.querySelectorAll('.auswahl').forEach(function (el) { el.hidden = q && el.getAttribute('data-name').indexOf(q) < 0; });
    });

    document.getElementById('format-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = wert('fo-name').trim(), medien = wert('fo-medienentwickler').trim(), nummer = wert('fo-nummer');
      if (!name || !medien) { toast('Name und Medienentwickler sind Pflichtfelder.', true); return; }
      var daten = {
        name: name, formatTyp: wert('fo-typ-feld') || 'Lernprogramm', medienentwickler: medien,
        formatId: leer(nummer) ? null : parseInt(nummer, 10),
        link: oderNull(wert('fo-link')), httpLink: oderNull(wert('fo-http'))
      };
      var ids = Array.prototype.map.call(liste.querySelectorAll('input:checked'), function (el) { return Number(el.value); });
      aendern(function (dd) {
        var ziel;
        if (id) {
          ziel = dd.formate.find(function (x) { return x.id === id; });
          Object.keys(daten).forEach(function (k) { ziel[k] = daten[k]; });
        } else {
          ziel = Object.assign({ id: naechsteId(dd.formate) }, daten);
          dd.formate.push(ziel);
        }
        dd.formatPersonas = dd.formatPersonas.filter(function (fp) { return fp.formatId !== ziel.id; })
          .concat(ids.map(function (pid) { return { formatId: ziel.id, personaId: pid }; }));
        return ziel.id;
      }, id ? 'Format aktualisiert' : 'Format angelegt').then(function (neueId) { if (neueId) gehe('/formate/' + neueId); });
    });
  }

  // ------------------------------------------------------------------
  // Einstellungen: Titel, Datenhaltung, Export/Import
  // ------------------------------------------------------------------
  function dateiHerunterladen(name, inhalt) {
    var blob = new Blob([inhalt], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function seiteEinstellungen(haupt) {
    var d = store.daten;
    var vorschau = store.modus === 'vorschau';
    var modusText = vorschau
      ? '<p style="margin:0">Dies ist eine Vorschau. Änderungen bleiben nur in diesem Browserfenster erhalten.</p>'
      : '<p style="margin:0">Änderungen werden sofort auf dem Server gespeichert (<span class="pfad" style="display:inline;padding:2px 6px">App_Data/lernwelt.json</span>). Vor jedem Speichern legt der Server eine Sicherungskopie an.</p>';
    var anmeldungHtml;
    if (vorschau) {
      anmeldungHtml = '<p style="margin:0">Passwortabfrage und Passwortänderung stehen nur auf dem Server zur Verfügung.</p>';
    } else {
      anmeldungHtml = '<div class="stapel" style="gap:16px">' +
        '<div class="schalter-zeile"><div><strong>Passwortabfrage</strong><br><span class="klein-hinweis">' +
        (store.anmeldungAktiv ? 'Aktiv: Die Daten sind nur nach Eingabe des Passworts sichtbar.' : 'Deaktiviert: Jede Person im Netzwerk kann die Daten sehen und ändern.') +
        '</span></div><span class="chip' + (store.anmeldungAktiv ? '' : ' chip-warnung') + '">' + (store.anmeldungAktiv ? 'Aktiv' : 'Aus') + '</span></div>' +
        '<div><button type="button" class="knopf knopf-rahmen" id="e-abfrage">' + icon('schloss') +
        (store.anmeldungAktiv ? 'Passwortabfrage deaktivieren' : 'Passwortabfrage aktivieren') + '</button></div>' +
        '<form id="e-passwort" class="stapel" style="gap:12px;border-top:1px solid var(--linie);padding-top:16px" novalidate>' +
        '<strong>Passwort ändern</strong>' +
        '<div class="feld"><label for="e-pw-alt">Aktuelles Passwort</label><input id="e-pw-alt" type="password" autocomplete="current-password"></div>' +
        '<div class="feld"><label for="e-pw-neu">Neues Passwort</label><input id="e-pw-neu" type="password" autocomplete="new-password"><span class="hilfe">Mindestens 8 Zeichen.</span></div>' +
        '<div class="feld"><label for="e-pw-neu2">Neues Passwort wiederholen</label><input id="e-pw-neu2" type="password" autocomplete="new-password"></div>' +
        '<p class="anmeldung-fehler" id="e-pw-fehler" role="alert" hidden></p>' +
        '<div><button type="submit" class="knopf knopf-primaer" id="e-pw-knopf">' + icon('speichern') + 'Passwort ändern</button></div></form>' +
        '<p class="klein-hinweis">Das Passwort wird nie über das Netzwerk geschickt, auch ohne HTTPS. Nach einer Änderung werden alle anderen Anmeldungen beendet.</p>' +
        '</div>';
    }
    haupt.innerHTML = hinweisBanner() +
      '<div class="seitenkopf"><div><h1>Einstellungen</h1><p>Anwendungstitel, Anmeldung und Datenhaltung</p></div></div>' +
      '<div class="raster-karten">' +
      karte('Anwendung', 'einstellungen', '<form id="e-form" class="stapel" style="gap:16px" novalidate>' +
        eingabe('e-titel', 'Titel der Anwendung', d.einstellungen.appTitel) +
        '<div><button type="submit" class="knopf knopf-primaer">' + icon('speichern') + 'Titel speichern</button></div></form>') +
      karte('Anmeldung & Passwort', 'schloss', anmeldungHtml) +
      karte('Datenhaltung', 'datenbank', '<div class="stapel" style="gap:16px">' + modusText +
        '<dl class="felder">' + feld('Personas / Firmen / Formate', d.personas.length + ' / ' + d.firmen.length + ' / ' + d.formate.length) +
        feld('Zuletzt gespeichert', datumText(d.geaendertAm)) + feld('Revision', store.basisRevision) + '</dl>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
        '<button type="button" class="knopf knopf-primaer" id="e-export">' + icon('herunterladen') + 'Daten exportieren</button>' +
        '<label class="knopf knopf-rahmen" for="e-import">' + icon('hochladen') + 'Daten importieren</label>' +
        '<input id="e-import" type="file" accept="application/json,.json" hidden>' +
        '</div>' +
        '<p class="klein-hinweis">Der Export ist eine Sicherung aller Texte. Die Profilbilder liegen auf dem Server im Ordner <span class="pfad" style="display:inline;padding:2px 6px">App_Data/bilder</span>.</p>' +
        '</div>') +
      '</div>';

    var abfrageKnopf = document.getElementById('e-abfrage');
    if (abfrageKnopf) abfrageKnopf.addEventListener('click', function () {
      var ziel = !store.anmeldungAktiv;
      passwortDialog(ziel ? 'Passwortabfrage aktivieren' : 'Passwortabfrage deaktivieren',
        ziel ? 'Danach ist die Anwendung nur noch mit Passwort erreichbar.' : 'Danach kann jede Person im Netzwerk die Daten ohne Passwort sehen und ändern.',
        ziel ? 'Aktivieren' : 'Deaktivieren').then(function (pw) {
        if (!pw) return;
        abfrageSetzen(pw, ziel).then(function () {
          toast(ziel ? 'Passwortabfrage aktiviert' : 'Passwortabfrage deaktiviert');
          zeichneSeite();
        }).catch(function (e) { if (!e.abgemeldet) toast(e.message, true); });
      });
    });
    var pwForm = document.getElementById('e-passwort');
    if (pwForm) pwForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var fehler = document.getElementById('e-pw-fehler');
      var knopf = document.getElementById('e-pw-knopf');
      var alt = wert('e-pw-alt'), neu = wert('e-pw-neu'), neu2 = wert('e-pw-neu2');
      function zeigeFehler(text) { fehler.textContent = text; fehler.hidden = false; }
      fehler.hidden = true;
      if (!alt) return zeigeFehler('Bitte geben Sie das aktuelle Passwort ein.');
      if (neu.length < 8) return zeigeFehler('Das neue Passwort muss mindestens 8 Zeichen lang sein.');
      if (neu !== neu2) return zeigeFehler('Die beiden neuen Passwörter stimmen nicht überein.');
      knopf.disabled = true;
      passwortAendern(alt, neu).then(function () {
        pwForm.reset();
        toast('Passwort geändert');
      }).catch(function (err) {
        if (!err.abgemeldet) zeigeFehler(err.message);
      }).then(function () { knopf.disabled = false; });
    });

    document.getElementById('e-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var titel = wert('e-titel').trim();
      if (!titel) { toast('Bitte einen Titel eingeben.', true); return; }
      aendern(function (dd) { dd.einstellungen.appTitel = titel; }, 'Titel gespeichert');
    });
    document.getElementById('e-export').addEventListener('click', function () {
      var heute = new Date().toISOString().slice(0, 10);
      dateiHerunterladen('lernwelt_' + heute + '.json', JSON.stringify(store.daten, null, 1));
      toast('Export erstellt');
    });
    document.getElementById('e-import').addEventListener('change', function (e) {
      var datei = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!datei) return;
      var leser = new FileReader();
      leser.onload = function () {
        var neu;
        try { neu = JSON.parse(leser.result); } catch (err) { toast('Die Datei ist keine gültige JSON-Datei.', true); return; }
        if (!neu || !Array.isArray(neu.personas)) { toast('Die Datei enthält keine Persona-Daten.', true); return; }
        datenNormalisieren(neu);
        dialog({
          titel: 'Daten importieren?',
          text: 'Die aktuellen Daten werden vollständig durch den Inhalt der Datei ersetzt (' + neu.personas.length + ' Personas, ' + neu.firmen.length + ' Firmen, ' + neu.formate.length + ' Formate).',
          ok: 'Importieren'
        }).then(function (ja) {
          if (!ja) return;
          aendern(function (dd) {
            Object.keys(dd).forEach(function (k) { delete dd[k]; });
            Object.keys(neu).forEach(function (k) { dd[k] = neu[k]; });
            dd.revision = store.basisRevision;
          }, 'Daten importiert').then(function (ok) { if (ok) zeichneSeite(); });
        });
      };
      leser.readAsText(datei, 'utf-8');
    });
  }

  // ------------------------------------------------------------------
  // Start
  // ------------------------------------------------------------------
  function fehlerSeite(text) {
    document.getElementById('app').innerHTML = '<div class="haupt" style="margin-left:0"><div class="banner"><p><strong>Die Anwendung konnte nicht gestartet werden.</strong> ' +
      esc(text) + '</p></div></div>';
  }

  function appStarten() {
    geruest();
    ui.pfad = aktuellerPfad();
    zeichneSeite();
  }

  function start() {
    var thema = lsLesen(KONFIG.themaSchluessel);
    if (thema === 'dark' || thema === 'light') document.documentElement.setAttribute('data-theme', thema);
    var eingebettet = eingebetteteDaten();
    if (eingebettet) {
      store.modus = 'vorschau';
      store.daten = datenNormalisieren(eingebettet);
      store.basisRevision = store.daten.revision;
      return appStarten();
    }
    api('status').then(function (r) {
      if (r.status !== 200 || !r.daten.ok) throw serverFehler(r.daten.meldung);
      store.anmeldungAktiv = !!r.daten.anmeldungAktiv;
      store.schreibfehler = r.daten.schreibfehler || null;
      if (r.daten.appTitel) document.title = r.daten.appTitel;
      if (!r.daten.angemeldet) return zeigeAnmeldung(null, r.daten.appTitel);
      return datenLaden().then(appStarten);
    }).catch(function (e) {
      if (e.abgemeldet) return;
      fehlerSeite(e instanceof SyntaxError || e instanceof TypeError ? serverFehler().message : e.message);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
