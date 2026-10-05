/* R+V Lernwelt – Persona-Datenbank
 * Oberfläche (ohne Framework). Daten, Benutzerkonten und Anmeldung liegen auf dem
 * Server (PHP + MySQL, api/index.php). In der Artifact-Vorschau sind die Daten
 * eingebettet und nur lesbar (Modus "vorschau").
 */
(function () {
  'use strict';

  var KONFIG = {
    api: 'api/index.php',
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

  // Symbole aus dem R+V-Iconfont "RuV-Icons-v3" (Codepunkte im Bereich U+E900)
  var ICONS = {
    personen: 'e929', person: 'e92c', firma: 'e924', buch: 'e9da', einstellungen: 'e9a6',
    suche: 'e972', plus: 'e97c', zurueck: 'e979', stift: 'e981', papierkorb: 'e992', x: 'e97b',
    speichern: 'e9d9', ordner: 'e933', kopieren: 'e9ce', extern: 'e973', ort: 'e93c',
    koffer: 'e958', herz: 'e9d4', gehirn: 'e944', mikro: 'e9d1', hochladen: 'e96e',
    herunterladen: 'e96f', zuschnitt: 'e967', menue: 'e96b', mond: 'e993', sonne: 'e946',
    datenbank: 'e932', video: 'e9cb', kopfhoerer: 'e9a4', monitor: 'e954', abmelden: 'e98e',
    schloss: 'e956', hilfe: 'e904', fehler: 'e902', info: 'e900', ok: 'e984',
    uhr: 'e942', gruppe: 'e92b', liste: 'e955', mail: 'e95a', senden: 'e95e', auge: 'e994',
    wiederherstellen: 'e96d', schild: 'e922'
  };

  function icon(name, extraKlasse) {
    return '<span class="icon ' + (extraKlasse || '') + '" aria-hidden="true">&#x' + (ICONS[name] || 'e900') + ';</span>';
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

  function lsLesen(schluessel) {
    try { return window.localStorage.getItem(schluessel); } catch (e) { return null; }
  }
  function lsSchreiben(schluessel, wert) {
    try { window.localStorage.setItem(schluessel, wert); return true; } catch (e) { return false; }
  }

  function datumText(iso) {
    if (!iso) return '–';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '–';
    return d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  }

  // ------------------------------------------------------------------
  // Datenhaltung und Server
  // ------------------------------------------------------------------
  var store = {
    daten: null,
    modus: 'server',  // 'server' | 'vorschau' (Artifact, Daten eingebettet, nur lesen)
    ich: null,
    appTitel: 'R+V Lernwelt – Persona-Datenbank'
  };

  function datenNormalisieren(d) {
    d.einstellungen = d.einstellungen || {};
    if (!d.einstellungen.appTitel) d.einstellungen.appTitel = 'R+V Lernwelt – Persona-Datenbank';
    ['personas', 'firmen', 'firmaPersonas', 'beziehungen', 'formate', 'formatPersonas'].forEach(function (k) {
      if (!Array.isArray(d[k])) d[k] = [];
    });
    return d;
  }

  function eingebetteteDaten() {
    var el = document.getElementById('startdaten');
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  function recht(name) {
    return !!(store.ich && store.ich.rechte && store.ich.rechte.indexOf(name) >= 0);
  }
  function darfBearbeiten() {
    return store.modus !== 'vorschau' && recht('daten_bearbeiten');
  }

  function apiFehler(meldung, status, daten) {
    var e = new Error(meldung);
    e.status = status;
    e.daten = daten || {};
    return e;
  }

  // Aufruf des Server-Teils: GET ohne Körper, sonst POST mit CSRF-Token.
  function api(route, koerper, query) {
    var opt = { cache: 'no-store', credentials: 'same-origin', headers: { 'X-Lernwelt': '1' } };
    if (koerper !== undefined) {
      opt.method = 'POST';
      opt.headers['Content-Type'] = 'application/json; charset=utf-8';
      opt.headers['X-CSRF-Token'] = store.ich ? store.ich.csrf : '';
      opt.body = JSON.stringify(koerper);
    }
    return fetch(KONFIG.api + '?r=' + route + (query || ''), opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && j.anmelden) {
          store.ich = null;
          store.daten = null;
          zeigeAnmeldung('Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.');
          var e = apiFehler(j.meldung || 'Bitte melden Sie sich an.', 401, j);
          e.abgemeldet = true;
          throw e;
        }
        if (!r.ok || j.ok === false) throw apiFehler(j.meldung || ('Fehler beim Server (HTTP ' + r.status + ').'), r.status, j);
        return j;
      });
    }, function () {
      throw apiFehler('Der Server ist nicht erreichbar. Bitte prüfen Sie Ihre Internetverbindung.', 0);
    });
  }

  function datenLaden() {
    return api('daten').then(function (d) {
      store.daten = datenNormalisieren(d);
      store.appTitel = store.daten.einstellungen.appTitel;
    });
  }

  function fehlerAnzeigen(e) {
    if (e && e.abgemeldet) return null;
    if (e && e.status === 409 && e.daten && e.daten.konflikt) {
      konfliktDialog();
      return null;
    }
    toast((e && e.message) || 'Das hat nicht geklappt.', true);
    return null;
  }

  // Änderung über den Server; der Server liefert den aktuellen Datenbestand zurück.
  function serverAenderung(route, koerper, meldung) {
    return api(route, koerper).then(function (j) {
      if (j.daten) store.daten = datenNormalisieren(j.daten);
      if (meldung) toast(meldung);
      zeichneNavigation();
      return j;
    }).catch(fehlerAnzeigen);
  }

  function konfliktDialog() {
    dialog({
      titel: 'Eintrag wurde inzwischen geändert',
      text: 'Jemand anderes hat diesen Eintrag gespeichert, während Sie ihn bearbeitet haben. Laden Sie die aktuellen Daten und wiederholen Sie Ihre Änderung.',
      ok: 'Aktuelle Daten laden',
      abbrechen: 'Schließen'
    }).then(function (ja) {
      if (ja) datenLaden().then(zeichneSeite).catch(fehlerAnzeigen);
    });
  }

  // Bilder kommen als Adresse des Servers ("api/index.php?r=bild&id=…") oder als data:-URL
  function bildUrl(pfad) {
    return pfad || '';
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

  // ------------------------------------------------------------------
  // Anmeldung und Konto-Abläufe ohne Anmeldung
  // ------------------------------------------------------------------
  var PASSWORT_HINWEIS = 'Mindestens 10 Zeichen. Gut merkbar sind mehrere Wörter oder ein kurzer Satz. Passwörter aus bekannten Datenlecks werden abgelehnt.';

  function oeffentlicheSeite(inhalt) {
    var app = document.getElementById('app');
    app.className = 'app';
    app.innerHTML = '<div class="anmeldung-huelle"><div class="anmeldung">' +
      '<img class="anmeldung-logo" src="assets/logo-claim-positiv.svg" alt="R+V – Du bist nicht allein.">' +
      '<p class="topline">Lernwelt</p>' + inhalt +
      '</div></div><div class="toasts" id="toasts" aria-live="polite"></div>';
    document.title = store.appTitel;
  }

  function formFehler(id, text) {
    var el = document.getElementById(id);
    if (!el) return;
    el.textContent = text ? 'Fehler: ' + text : '';
    el.hidden = !text;
  }

  function knopfWarten(knopf, text) {
    var alt = knopf.textContent;
    knopf.disabled = true;
    knopf.textContent = text;
    return function () { knopf.disabled = false; knopf.textContent = alt; };
  }

  function passwortFelder(prefix, neu) {
    return '<div class="feld"><label for="' + prefix + '-pw">' + (neu ? 'Neues Passwort' : 'Passwort') + '</label><input id="' + prefix + '-pw" type="password" autocomplete="new-password" minlength="10" required>' +
      '<span class="hilfe">' + PASSWORT_HINWEIS + '</span></div>' +
      '<div class="feld"><label for="' + prefix + '-pw2">Passwort wiederholen</label><input id="' + prefix + '-pw2" type="password" autocomplete="new-password" required></div>';
  }

  function passwortLesen(prefix) {
    var pw = wert(prefix + '-pw'), pw2 = wert(prefix + '-pw2');
    if (pw.length < 10) return { fehler: 'Das Passwort muss mindestens 10 Zeichen lang sein.' };
    if (pw !== pw2) return { fehler: 'Die beiden Passwörter stimmen nicht überein.' };
    return { passwort: pw };
  }

  // Org-Einheit: Großbuchstaben, nach je 2 Zeichen ein Bindestrich, höchstens 11 Zeichen
  function orgFormatieren(text) {
    var roh = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    return (roh.match(/.{1,2}/g) || []).join('-');
  }
  function orgFeld(id, wertAlt) {
    return '<div class="feld"><label for="' + id + '">Org-Einheit</label><input id="' + id + '" type="text" maxlength="11" autocomplete="off" spellcheck="false" placeholder="z. B. VH-VP-TV" value="' + esc(wertAlt) + '">' +
      '<span class="hilfe">Zweiergruppen mit Bindestrich, z. B. VH, VH-VP oder VH-VP-TV-PR.</span></div>';
  }
  function orgFeldAktivieren(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function () { el.value = orgFormatieren(el.value); });
  }
  function orgGueltig(text) {
    return /^[A-Z0-9]{2}(-[A-Z0-9]{2}){0,3}$/.test(text);
  }

  function nachAnmeldung(ich, ziel) {
    store.ich = ich;
    return datenLaden().then(function () {
      try {
        if (ziel || !/^#\/(personas|firmen|formate|benutzer|konto|protokoll|einstellungen)/.test(window.location.hash)) {
          history.replaceState(null, '', '#' + (ziel || '/personas'));
        }
      } catch (e) { /* ohne History-API weiter */ }
      appStarten();
    });
  }

  function zeigeAnmeldung(hinweis) {
    oeffentlicheSeite(
      '<h1>' + esc(store.appTitel) + '</h1>' +
      '<p class="anmeldung-text">Bitte melden Sie sich mit Ihrer E-Mail-Adresse an.</p>' +
      (hinweis ? '<p class="anmeldung-hinweis" role="status">' + esc(hinweis) + '</p>' : '') +
      '<form id="anmelde-form" class="stapel" style="gap:16px" novalidate>' +
      '<div class="feld"><label for="anm-email">E-Mail-Adresse</label><input id="anm-email" type="email" autocomplete="username" required></div>' +
      '<div class="feld"><label for="anm-passwort">Passwort</label><input id="anm-passwort" type="password" autocomplete="current-password" required></div>' +
      '<p class="anmeldung-fehler" id="anm-fehler" role="alert" hidden></p>' +
      '<button type="submit" class="knopf knopf-primaer" id="anm-knopf">Anmelden</button>' +
      '</form>' +
      '<div class="anmeldung-links"><a class="link" href="#/passwort-vergessen">Passwort vergessen?</a>' +
      '<a class="link" href="handbuch.html" target="_blank" rel="noopener">' + icon('hilfe') + 'Hilfe</a></div>'
    );
    var email = document.getElementById('anm-email');
    email.focus();
    document.getElementById('anmelde-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var pw = document.getElementById('anm-passwort');
      if (!email.value.trim() || !pw.value) return formFehler('anm-fehler', 'Bitte geben Sie E-Mail-Adresse und Passwort ein.');
      formFehler('anm-fehler', '');
      var fertig = knopfWarten(document.getElementById('anm-knopf'), 'Anmelden …');
      api('anmelden', { email: email.value.trim(), passwort: pw.value }).then(function (j) {
        return nachAnmeldung(j.ich);
      }).catch(function (err) {
        fertig();
        pw.value = '';
        pw.setAttribute('aria-invalid', 'true');
        formFehler('anm-fehler', err.message);
        pw.focus();
      });
    });
  }

  function zeigePasswortVergessen() {
    oeffentlicheSeite(
      '<h1>Passwort vergessen</h1>' +
      '<div id="pv-inhalt" class="stapel" style="gap:16px">' +
      '<p class="anmeldung-text">Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen Link, mit dem Sie ein neues Passwort festlegen.</p>' +
      '<form id="pv-form" class="stapel" style="gap:16px" novalidate>' +
      '<div class="feld"><label for="pv-email">E-Mail-Adresse</label><input id="pv-email" type="email" autocomplete="username" required></div>' +
      '<p class="anmeldung-fehler" id="pv-fehler" role="alert" hidden></p>' +
      '<button type="submit" class="knopf knopf-primaer" id="pv-knopf">Link anfordern</button></form></div>' +
      '<div class="anmeldung-links"><a class="link" href="#/anmelden">Zurück zur Anmeldung</a></div>'
    );
    document.getElementById('pv-email').focus();
    document.getElementById('pv-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var email = wert('pv-email').trim();
      if (!email) return formFehler('pv-fehler', 'Bitte geben Sie Ihre E-Mail-Adresse ein.');
      var fertig = knopfWarten(document.getElementById('pv-knopf'), 'Wird gesendet …');
      api('passwort-vergessen', { email: email }).then(function () {
        document.getElementById('pv-inhalt').innerHTML = '<p class="anmeldung-hinweis" role="status">Wenn ein Konto mit der Adresse ' + esc(email) +
          ' existiert, erhalten Sie in wenigen Minuten eine E-Mail mit einem Link. Der Link ist eine Stunde gültig. Sehen Sie auch im Spam-Ordner nach.</p>';
      }).catch(function (err) { fertig(); formFehler('pv-fehler', err.message); });
    });
  }

  function linkUngueltig(text) {
    oeffentlicheSeite('<h1>Link ungültig</h1><p class="anmeldung-hinweis" role="status">' + esc(text) + '</p>' +
      '<div class="anmeldung-links"><a class="link" href="#/anmelden">Zur Anmeldung</a><a class="link" href="#/passwort-vergessen">Neuen Link anfordern</a></div>');
  }

  function zeigeEinladung(token) {
    oeffentlicheSeite('<p class="anmeldung-text">Einladung wird geprüft …</p>');
    api('token-info', { token: token, zweck: 'einladung' }).then(function (info) {
      oeffentlicheSeite(
        '<h1>Konto aktivieren</h1>' +
        '<p class="anmeldung-text">Sie wurden als <strong>' + esc(info.rolleName) + '</strong> eingeladen. Legen Sie Ihr Passwort fest, um Ihr Konto zu aktivieren.</p>' +
        '<form id="ea-form" class="stapel" style="gap:16px" novalidate>' +
        '<div class="feld"><span class="label">E-Mail-Adresse</span><span>' + esc(info.email) + '</span></div>' +
        '<div class="raster raster-2"><div class="feld"><label for="ea-vorname">Vorname</label><input id="ea-vorname" type="text" autocomplete="given-name" value="' + esc(info.vorname) + '"></div>' +
        '<div class="feld"><label for="ea-nachname">Nachname</label><input id="ea-nachname" type="text" autocomplete="family-name" value="' + esc(info.nachname) + '"></div></div>' +
        '<input type="email" autocomplete="username" value="' + esc(info.email) + '" hidden>' +
        passwortFelder('ea') +
        '<p class="anmeldung-fehler" id="ea-fehler" role="alert" hidden></p>' +
        '<button type="submit" class="knopf knopf-primaer" id="ea-knopf">Konto aktivieren</button></form>'
      );
      document.getElementById('ea-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var pw = passwortLesen('ea');
        if (!wert('ea-vorname').trim() || !wert('ea-nachname').trim()) return formFehler('ea-fehler', 'Bitte geben Sie Vor- und Nachnamen ein.');
        if (pw.fehler) return formFehler('ea-fehler', pw.fehler);
        var fertig = knopfWarten(document.getElementById('ea-knopf'), 'Wird aktiviert …');
        api('einladung-annehmen', { token: token, vorname: wert('ea-vorname'), nachname: wert('ea-nachname'), passwort: pw.passwort }).then(function (j) {
          return nachAnmeldung(j.ich, '/personas');
        }).then(function () { toast('Willkommen! Ihr Konto ist aktiv.'); }).catch(function (err) { fertig(); formFehler('ea-fehler', err.message); });
      });
    }).catch(function (err) { linkUngueltig(err.message + ' Bitten Sie die Person, die Sie eingeladen hat, die Einladung erneut zu senden.'); });
  }

  function zeigePasswortNeu(token) {
    oeffentlicheSeite('<p class="anmeldung-text">Link wird geprüft …</p>');
    api('token-info', { token: token, zweck: 'passwort' }).then(function (info) {
      oeffentlicheSeite(
        '<h1>Neues Passwort festlegen</h1>' +
        '<p class="anmeldung-text">Für ' + esc(info.email) + '. Danach sind Sie direkt angemeldet; alle anderen Anmeldungen werden beendet.</p>' +
        '<form id="pn-form" class="stapel" style="gap:16px" novalidate>' +
        '<input type="email" autocomplete="username" value="' + esc(info.email) + '" hidden>' +
        passwortFelder('pn', true) +
        '<p class="anmeldung-fehler" id="pn-fehler" role="alert" hidden></p>' +
        '<button type="submit" class="knopf knopf-primaer" id="pn-knopf">Passwort speichern</button></form>'
      );
      document.getElementById('pn-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var pw = passwortLesen('pn');
        if (pw.fehler) return formFehler('pn-fehler', pw.fehler);
        var fertig = knopfWarten(document.getElementById('pn-knopf'), 'Wird gespeichert …');
        api('passwort-zuruecksetzen', { token: token, passwort: pw.passwort }).then(function (j) {
          return nachAnmeldung(j.ich, '/personas');
        }).then(function () { toast('Ihr neues Passwort ist gespeichert.'); }).catch(function (err) { fertig(); formFehler('pn-fehler', err.message); });
      });
    }).catch(function (err) { linkUngueltig(err.message + ' Fordern Sie über „Passwort vergessen“ einen neuen Link an.'); });
  }

  function zeigeEmailBestaetigen(token) {
    oeffentlicheSeite('<p class="anmeldung-text">E-Mail-Adresse wird bestätigt …</p>');
    api('email-bestaetigen', { token: token }).then(function (j) {
      oeffentlicheSeite('<h1>E-Mail-Adresse bestätigt</h1><p class="anmeldung-hinweis" role="status">Ihre E-Mail-Adresse lautet jetzt ' + esc(j.email) +
        '. Melden Sie sich künftig mit dieser Adresse an.</p><div class="anmeldung-links"><a class="link" href="#/personas">Zur Anwendung</a></div>');
    }).catch(function (err) { linkUngueltig(err.message + ' Fordern Sie die Änderung unter „Mein Konto“ erneut an.'); });
  }

  function zeigeEinrichtung(ersterAdmin) {
    oeffentlicheSeite(
      '<h1>Erst-Einrichtung</h1>' +
      '<p class="anmeldung-text">Die Anwendung ist noch nicht eingerichtet. Legen Sie das Konto des ersten Administrators an. Den Einrichtungscode finden Sie in der Datei konfiguration.php auf dem Server.</p>' +
      '<form id="er-form" class="stapel" style="gap:16px" novalidate>' +
      '<div class="feld"><label for="er-code">Einrichtungscode</label><input id="er-code" type="password" autocomplete="off" required></div>' +
      '<div class="feld"><label for="er-email">E-Mail-Adresse</label><input id="er-email" type="email" autocomplete="username" value="' + esc(ersterAdmin) + '"' + (ersterAdmin ? ' readonly' : '') + '></div>' +
      '<div class="raster raster-2"><div class="feld"><label for="er-vorname">Vorname</label><input id="er-vorname" type="text" autocomplete="given-name"></div>' +
      '<div class="feld"><label for="er-nachname">Nachname</label><input id="er-nachname" type="text" autocomplete="family-name"></div></div>' +
      orgFeld('er-org', '') + passwortFelder('er') +
      '<p class="anmeldung-fehler" id="er-fehler" role="alert" hidden></p>' +
      '<button type="submit" class="knopf knopf-primaer" id="er-knopf">Einrichten</button></form>'
    );
    orgFeldAktivieren('er-org');
    document.getElementById('er-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var pw = passwortLesen('er');
      if (!wert('er-code') || !wert('er-vorname').trim() || !wert('er-nachname').trim()) return formFehler('er-fehler', 'Bitte füllen Sie alle Felder aus.');
      if (!orgGueltig(wert('er-org'))) return formFehler('er-fehler', 'Bitte geben Sie eine gültige Org-Einheit ein, z. B. VH-VP.');
      if (pw.fehler) return formFehler('er-fehler', pw.fehler);
      var fertig = knopfWarten(document.getElementById('er-knopf'), 'Wird eingerichtet …');
      api('einrichten', { code: wert('er-code'), email: wert('er-email'), vorname: wert('er-vorname'), nachname: wert('er-nachname'), orgEinheit: wert('er-org'), passwort: pw.passwort }).then(function (j) {
        return nachAnmeldung(j.ich, '/einstellungen').then(function () {
          toast(j.importiert ? 'Eingerichtet. ' + j.importiert.personas + ' Personas und ' + j.importiert.firmen + ' Firmen übernommen.' : 'Die Anwendung ist eingerichtet.');
        });
      }).catch(function (err) { fertig(); formFehler('er-fehler', err.message); });
    });
  }

  function abmelden() {
    api('abmelden', {}).catch(function () { return null; }).then(function () {
      store.ich = null;
      store.daten = null;
      zeigeAnmeldung('Sie wurden abgemeldet.');
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
      '<a class="link" href="' + esc(explorerUrl(roh)) + '" target="_blank" rel="noopener">' + icon('ordner') + esc(titel) + '</a>' +
      '<button type="button" class="link" data-kopieren="' + esc(pfad) + '">' + icon('kopieren') + 'Pfad kopieren</button>' +
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
    el.innerHTML = icon(fehler ? 'fehler' : 'ok') + '<span>' + esc(text) + '</span>';
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
        '<button type="button" class="knopf ' + 'knopf-primaer' + '" data-antwort="ja">' + esc(opt.ok || 'Löschen') + '</button>' +
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
  function navEintraege() {
    var liste = [
      { pfad: '/personas', text: 'Personas', icon: 'personen' },
      { pfad: '/firmen', text: 'Firmen', icon: 'firma' },
      { pfad: '/formate', text: 'E-Learning-Formate', icon: 'buch' }
    ];
    if (recht('benutzer_sehen')) liste.push({ pfad: '/benutzer', text: 'Benutzer', icon: 'gruppe' });
    if (recht('protokoll')) liste.push({ pfad: '/protokoll', text: 'Protokoll', icon: 'liste' });
    if (recht('einstellungen')) liste.push({ pfad: '/einstellungen', text: 'Einstellungen', icon: 'einstellungen' });
    return liste;
  }

  var ui = {
    pfad: null,
    personaSuche: '', personaGruppe: '', personaKundenprofil: '',
    firmaSuche: '',
    formatSuche: '', formatTyp: '',
    benutzerSuche: '', benutzerStatus: '', benutzerRolle: '',
    protokollBereich: '', protokollSuche: '', protokollSeite: 1
  };

  function rohPfad() {
    var h = '';
    try { h = window.location.hash.replace(/^#/, ''); } catch (e) { h = ''; }
    return h && h.charAt(0) === '/' ? h : '';
  }

  function aktuellerPfad() {
    return rohPfad() || '/personas';
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

  // Links mit Einmal-Token funktionieren mit und ohne Anmeldung
  var TOKEN_ROUTEN = /^\/(einladung|passwort-neu|email-bestaetigen)\/([A-Za-z0-9_-]{20,100})$/;

  function oeffentlichRouten() {
    var pfad = rohPfad();
    var m = pfad.match(TOKEN_ROUTEN);
    if (m && m[1] === 'einladung') return zeigeEinladung(m[2]);
    if (m && m[1] === 'passwort-neu') return zeigePasswortNeu(m[2]);
    if (m && m[1] === 'email-bestaetigen') return zeigeEmailBestaetigen(m[2]);
    if (pfad === '/passwort-vergessen') return zeigePasswortVergessen();
    zeigeAnmeldung();
  }

  function listenerRegistrieren() {
    var app = document.getElementById('app');
    // Interne Links ohne Neuladen; Kopier-Knöpfe überall
    document.addEventListener('click', function (e) {
      var kopierKnopf = e.target.closest('[data-kopieren]');
      if (kopierKnopf) { kopieren(kopierKnopf.getAttribute('data-kopieren')); return; }
      var a = e.target.closest('a[href^="#/"]');
      if (!a || !store.daten || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      app.classList.remove('nav-offen');
      gehe(a.getAttribute('href').slice(1));
    });
    window.addEventListener('hashchange', function () {
      if (TOKEN_ROUTEN.test(rohPfad()) || !store.daten) return oeffentlichRouten();
      ui.pfad = aktuellerPfad();
      zeichneSeite();
    });
  }

  function geruest() {
    var app = document.getElementById('app');
    app.innerHTML =
      '<header class="kopf-mobil">' +
      '<button type="button" class="menue-knopf" id="menue-knopf" aria-label="Menü öffnen">' + icon('menue') + '</button>' +
      '<span class="nav-logo"><img src="assets/logo-negativ.svg" alt="R+V"></span>' +
      '<span class="nav-titel" id="titel-mobil"></span>' +
      '</header>' +
      '<div class="abdunkler" id="abdunkler"></div>' +
      '<aside class="nav" id="nav" aria-label="Hauptnavigation"></aside>' +
      '<main class="haupt" id="haupt"></main>' +
      '<div class="toasts" id="toasts" aria-live="polite"></div>';
    document.getElementById('menue-knopf').addEventListener('click', function () { app.classList.toggle('nav-offen'); });
    document.getElementById('abdunkler').addEventListener('click', function () { app.classList.remove('nav-offen'); });
  }

  function zeichneNavigation() {
    var nav = document.getElementById('nav');
    if (!nav || !store.daten) return;
    var titel = store.daten.einstellungen.appTitel;
    store.appTitel = titel;
    document.title = titel;
    var tm = document.getElementById('titel-mobil');
    if (tm) tm.textContent = titel;
    var pfad = ui.pfad || '/personas';
    var dunkel = effektivesThema() === 'dark';
    var ich = store.ich || {};
    var kontoAktiv = pfad.indexOf('/konto') === 0;
    nav.innerHTML =
      '<div class="nav-marke"><span class="nav-logo"><img src="assets/logo-negativ.svg" alt="R+V"></span>' +
      '<span class="nav-titel">' + esc(titel) + '</span></div>' +
      '<nav class="nav-liste">' + navEintraege().map(function (n) {
        var aktiv = pfad.indexOf(n.pfad) === 0;
        return '<a class="nav-link" href="#' + n.pfad + '"' + (aktiv ? ' aria-current="page"' : '') + '>' + icon(n.icon) + '<span>' + n.text + '</span></a>';
      }).join('') + '</nav>' +
      '<div class="nav-fuss">' +
      (store.modus === 'vorschau'
        ? '<span class="nav-konto">' + icon('auge') + '<span><span class="nav-konto-name">Vorschau</span><span class="nav-konto-rolle">nur lesen</span></span></span>'
        : '<a class="nav-konto" href="#/konto"' + (kontoAktiv ? ' aria-current="page"' : '') + '>' + icon('person') +
          '<span><span class="nav-konto-name">' + esc((ich.vorname || '') + ' ' + (ich.nachname || '')) + '</span><span class="nav-konto-rolle">' + esc(ich.rolleName || '') + ' · Mein Konto</span></span></a>') +
      '<a class="nav-knopf" href="handbuch.html" target="_blank" rel="noopener">' + icon('hilfe') + '<span>Handbuch</span></a>' +
      '<button type="button" class="nav-knopf" id="thema-knopf">' + icon(dunkel ? 'sonne' : 'mond') + '<span>' + (dunkel ? 'Helles Design' : 'Dunkles Design') + '</span></button>' +
      (store.modus !== 'vorschau' ? '<button type="button" class="nav-knopf" id="abmelde-knopf">' + icon('abmelden') + '<span>Abmelden</span></button>' : '') +
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
    if (store.modus !== 'vorschau') return '';
    return '<div class="banner"><p>Vorschau: Sie sehen die Daten nur lesend. Anmeldung, Bearbeiten und Benutzerverwaltung gibt es in der installierten Anwendung.</p></div>';
  }

  function keinZugriff(ziel) {
    toast('Dafür fehlt Ihnen die Berechtigung.', true);
    gehe(ziel || '/personas');
  }

  function zeichneSeite() {
    var haupt = document.getElementById('haupt');
    if (!haupt) return;
    seitenNummer++;
    var pfad = ui.pfad || aktuellerPfad();
    ui.pfad = pfad;
    zeichneNavigation();
    var teile = pfad.split('/').filter(Boolean);
    var bereich = teile[0], id = teile[1] ? Number(teile[1]) : null, aktion = teile[2];
    var neu = teile[1] === 'neu';
    window.scrollTo(0, 0);

    var typen = { personas: 'persona', firmen: 'firma', formate: 'format' };
    if (typen[bereich]) {
      var typ = typen[bereich];
      if ((neu || aktion === 'bearbeiten') && !darfBearbeiten()) return keinZugriff('/' + bereich + (id ? '/' + id : ''));
      if (id && aktion === 'versionen') return seiteVersionen(haupt, typ, id);
      if (typ === 'persona') {
        if (neu) return seitePersonaForm(haupt, null);
        if (id && aktion === 'bearbeiten') return seitePersonaForm(haupt, id);
        if (id) return seitePersonaDetail(haupt, id);
        return seitePersonas(haupt);
      }
      if (typ === 'firma') {
        if (neu) return seiteFirmaForm(haupt, null);
        if (id && aktion === 'bearbeiten') return seiteFirmaForm(haupt, id);
        if (id) return seiteFirmaDetail(haupt, id);
        return seiteFirmen(haupt);
      }
      if (neu) return seiteFormatForm(haupt, null);
      if (id && aktion === 'bearbeiten') return seiteFormatForm(haupt, id);
      if (id) return seiteFormatDetail(haupt, id);
      return seiteFormate(haupt);
    }
    if (bereich === 'benutzer') {
      if (!recht('benutzer_sehen')) return keinZugriff();
      if (teile[1] === 'einladen') return recht('benutzer_einladen') ? seiteEinladen(haupt) : keinZugriff('/benutzer');
      if (id) return recht('benutzer_verwalten') ? seiteBenutzerBearbeiten(haupt, id) : keinZugriff('/benutzer');
      return seiteBenutzer(haupt);
    }
    if (bereich === 'konto' && store.modus !== 'vorschau') return seiteKonto(haupt);
    if (bereich === 'protokoll') return recht('protokoll') ? seiteProtokoll(haupt) : keinZugriff();
    if (bereich === 'einstellungen') return recht('einstellungen') ? seiteEinstellungen(haupt) : keinZugriff();
    gehe('/personas');
  }

  // Zeigt „Wird geladen …“ und liefert eine Prüfung, ob die Seite noch angezeigt wird.
  // Antworten, die nach einem Seitenwechsel eintreffen, dürfen die neue Seite nicht überschreiben.
  var seitenNummer = 0;
  function laedt(haupt) {
    haupt.innerHTML = '<div class="laden" role="status">Wird geladen …</div>';
    var nummer = seitenNummer;
    return function () { return nummer === seitenNummer; };
  }

  function nichtGefunden(haupt, text, zurueck) {
    haupt.innerHTML = '<div class="leerzustand">' + icon('suche', 'icon-gross') + '<p>' + esc(text) + '</p>' +
      '<a class="link" href="#' + zurueck + '">Zurück zur Liste</a></div>';
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

  // Kopfleiste einer Detailseite: Zurück, Versionen, Bearbeiten, Löschen (je nach Recht)
  function detailLeiste(liste, basis, loeschenId) {
    var rechts = '';
    if (store.modus !== 'vorschau') rechts += '<a class="knopf knopf-rahmen" href="#' + basis + '/versionen">' + icon('uhr') + 'Versionen</a>';
    if (darfBearbeiten()) {
      rechts += '<a class="knopf knopf-primaer" href="#' + basis + '/bearbeiten">' + icon('stift') + 'Bearbeiten</a>' +
        '<button type="button" class="knopf knopf-rahmen" id="' + loeschenId + '">' + icon('papierkorb') + 'Löschen</button>';
    }
    return '<div class="leiste"><a class="knopf knopf-text" href="#' + liste + '">' + icon('zurueck') + 'Zurück</a>' +
      '<div class="leiste-rechts">' + rechts + '</div></div>';
  }

  function geaendertHinweis(o) {
    if (!o || !o.geaendertAm) return '';
    return '<p class="geaendert">Zuletzt geändert am ' + esc(datumText(o.geaendertAm)) + (o.geaendertVon ? ' von ' + esc(o.geaendertVon) : '') + '</p>';
  }

  function neuKnopf(pfad, text) {
    return darfBearbeiten() ? '<a class="knopf knopf-primaer" href="#' + pfad + '">' + icon('plus') + esc(text) + '</a>' : '';
  }

  function loeschenAnbinden(knopfId, typ, id, titel, html, ziel) {
    var knopf = document.getElementById(knopfId);
    if (!knopf) return;
    knopf.addEventListener('click', function () {
      dialog({ titel: titel, html: html }).then(function (ja) {
        if (!ja) return;
        serverAenderung('loeschen', { typ: typ, id: id }, typInfoName(typ) + ' gelöscht').then(function (j) { if (j) gehe(ziel); });
      });
    });
  }

  function typInfoName(typ) {
    return { persona: 'Persona', firma: 'Firma', format: 'Format' }[typ];
  }

  // ------------------------------------------------------------------
  // Personas: Liste
  // ------------------------------------------------------------------
  function seitePersonas(haupt) {
    var gruppen = OPTIONEN.gruppe.slice();
    store.daten.personas.forEach(function (p) { if (p.gruppe && gruppen.indexOf(p.gruppe) < 0) gruppen.push(p.gruppe); });
    haupt.innerHTML = hinweisBanner() +
      '<div class="seitenkopf"><div><p class="topline">Lernwelt</p><h1>Personas</h1><p id="personas-anzahl"></p></div>' +
      neuKnopf('/personas/neu', 'Neue Persona') + '</div>' +
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
        (darfBearbeiten() ? '<button type="button" class="knopf-icon" data-bez-entfernen="' + andere.id + '" aria-label="Beziehung zu ' + esc(vollerName(andere)) + ' entfernen">' + icon('x') + '</button>' : '') + '</div>';
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

    haupt.innerHTML = hinweisBanner() + detailLeiste('/personas', '/personas/' + id, 'p-loeschen') +
      '<div class="stapel">' +
      '<section class="karte profil-karte"><div class="profil">' + portrait +
      '<div class="profil-text"><p class="topline">' + esc(p.gruppe || 'Persona') + '</p><h1>' + esc(vollerName(p)) + '</h1>' +
      '<div class="unterzeile">' + esc(p.funktion || '–') + (p.beruf ? ' · ' + esc(p.beruf) : '') + '</div>' +
      '<div class="chips">' +
      (p.personaId ? '<span class="chip chip-grau">ID ' + esc(p.personaId) + '</span>' : '') +
      (p.cJourney ? '<span class="chip chip-grau">Customer Journey: ' + esc(p.cJourney) + '</span>' : '') + '</div>' +
      (fakten.length ? '<div class="profil-fakten">' + fakten.join('') + '</div>' : '') +
      geaendertHinweis(p) +
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
        darfBearbeiten() ? '<button type="button" class="knopf knopf-rahmen knopf-klein" id="bez-hinzu">' + icon('plus', 'icon-klein') + 'Beziehung</button>' : '') +
      karte('Persönlichkeit', 'gehirn', feldListe([
        feld('Charakter', p.charakter), feld('Aktivitäten', p.aktivitaeten), feld('Sonstiges', p.sonstiges)])) +
      karte('Firmenzugehörigkeit', 'firma', firmenHtml) +
      karte('Voiceover & Avatar', 'mikro', feldListe([feld('WoC-Stimme', p.wocStimme), feld('DID-Avatar', p.didAvatar)])) +
      karte('Links & Medien', 'ordner', p.bilderLink ? dateiLinkBlock(p.bilderLink, 'Ordner im Explorer öffnen') : '<p class="leer">Kein Bilder-Link hinterlegt.</p>') +
      karte('E-Learning-Formate', 'buch', formateHtml) +
      '</div></div>';

    loeschenAnbinden('p-loeschen', 'persona', id, 'Persona löschen?', 'Möchten Sie <strong>' + esc(vollerName(p)) + '</strong> wirklich löschen? Beziehungen und Zuordnungen dieser Persona werden ebenfalls entfernt. Die Administration kann gelöschte Einträge wiederherstellen.', '/personas');

    haupt.querySelectorAll('[data-bez-entfernen]').forEach(function (knopf) {
      knopf.addEventListener('click', function () {
        var andere = Number(knopf.getAttribute('data-bez-entfernen'));
        dialog({ titel: 'Beziehung entfernen?', text: 'Die Verknüpfung zwischen ' + vollerName(p) + ' und ' + vollerName(persona(andere)) + ' wird auf beiden Seiten entfernt.', ok: 'Entfernen' })
          .then(function (ja) {
            if (!ja) return;
            serverAenderung('beziehung', { personaId: id, andere: andere, entfernen: true }, 'Beziehung entfernt').then(function (j) { if (j) zeichneSeite(); });
          });
      });
    });

    var bezHinzu = document.getElementById('bez-hinzu');
    if (bezHinzu) bezHinzu.addEventListener('click', function () {
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
        serverAenderung('beziehung', { personaId: id, andere: andere, verhaeltnis: oderNull(verh), gegen: oderNull(gegen) }, 'Familienbeziehung hinzugefügt').then(function (j) { if (j) zeichneSeite(); });
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
      '<div class="seitenkopf"><div><p class="topline">Personas</p><h1>' + (id ? 'Persona bearbeiten' : 'Neue Persona') + '</h1>' +
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
        (vorschau ? '<button type="button" class="knopf knopf-rahmen" id="pf-bild-loeschen">' + icon('x') + 'Bild löschen</button>' : '') +
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
      var knopf = e.submitter || document.querySelector('#persona-form button[type=submit]');
      var fertig = knopfWarten(knopf, 'Wird gespeichert …');
      serverAenderung('speichern', {
        typ: 'persona', id: id || undefined, version: bestehend ? bestehend.version : undefined,
        daten: daten, firmen: firmen,
        beziehungen: zustand.beziehungen.filter(function (b) { return b.andere; }).map(function (b) {
          return { andere: b.andere, verhaeltnis: oderNull(b.verhaeltnis), gegen: oderNull(b.gegen) };
        })
      }, id ? 'Persona gespeichert' : 'Persona angelegt').then(function (j) {
        fertig();
        if (j) gehe('/personas/' + j.id);
      });
    });
  }

  // ------------------------------------------------------------------
  // Firmen
  // ------------------------------------------------------------------
  function seiteFirmen(haupt) {
    haupt.innerHTML = hinweisBanner() +
      '<div class="seitenkopf"><div><p class="topline">Lernwelt</p><h1>Firmen</h1><p id="firmen-anzahl"></p></div>' +
      neuKnopf('/firmen/neu', 'Neue Firma') + '</div>' +
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
    haupt.innerHTML = hinweisBanner() + detailLeiste('/firmen', '/firmen/' + id, 'f-loeschen') +
      '<div class="stapel">' +
      '<section class="karte profil-karte"><div class="profil"><span class="avatar avatar-eckig">' + icon('firma') + '</span>' +
      '<div class="profil-text"><p class="topline">' + esc(f.funktion && f.funktion !== 'keine Angabe' ? f.funktion : 'Firma') + '</p><h1>' + esc(f.name) + '</h1>' +
      '<div class="chips">' + (f.branche ? '<span class="chip">' + esc(f.branche) + '</span>' : '') +
      (f.firmenId ? '<span class="chip chip-grau">ID ' + esc(f.firmenId) + '</span>' : '') + '</div>' + geaendertHinweis(f) + '</div></div></section>' +
      '<div class="raster-karten">' +
      karte('Firmendaten', 'firma', feldListe([feld('Funktion', f.funktion), feld('Branche', f.branche), feld('Adresse', adresse), feld('Sonstiges', f.sonstiges)])) +
      karte('Zugeordnete Personas (' + zuordnungen.length + ')', 'personen', zuordnungen.length ? '<div class="liste">' + zuordnungen.map(function (fp) {
        var p = persona(fp.personaId);
        return '<div class="eintrag"><a class="eintrag-link" href="#/personas/' + p.id + '">' + avatarHtml(p, true) +
          '<span style="min-width:0"><span class="eintrag-titel">' + esc(vollerName(p)) + '</span><br><span class="eintrag-sub">' + esc(fp.funktionInFirma || p.funktion || '–') + '</span></span></a></div>';
      }).join('') + '</div>' : '<p class="leer">Keine Personas zugeordnet.</p>') +
      '</div></div>';
    loeschenAnbinden('f-loeschen', 'firma', id, 'Firma löschen?', 'Möchten Sie <strong>' + esc(f.name) + '</strong> wirklich löschen? Die Personas bleiben erhalten, nur die Zuordnung wird entfernt.', '/firmen');
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
      '<div class="seitenkopf"><div><p class="topline">Firmen</p><h1>' + (id ? 'Firma bearbeiten' : 'Neue Firma') + '</h1></div></div>' +
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
      var fertig = knopfWarten(e.submitter || document.querySelector('#firma-form button[type=submit]'), 'Wird gespeichert …');
      serverAenderung('speichern', {
        typ: 'firma', id: id || undefined, version: bestehend ? bestehend.version : undefined, daten: daten,
        personas: zuordnungen.map(function (z) { return { personaId: z.personaId, funktionInFirma: oderNull(z.funktionInFirma) }; })
      }, id ? 'Firma gespeichert' : 'Firma angelegt').then(function (j) {
        fertig();
        if (j) gehe('/firmen/' + j.id);
      });
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
      '<div class="seitenkopf"><div><p class="topline">Lernwelt</p><h1>E-Learning-Formate</h1><p id="formate-anzahl"></p></div>' +
      neuKnopf('/formate/neu', 'Neues Format') + '</div>' +
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
          (store.daten.formate.length || !darfBearbeiten() ? '' : '<a class="link" href="#/formate/neu">' + icon('plus', 'icon-klein') + 'Erstes Format anlegen</a>') + '</div>';
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
    haupt.innerHTML = hinweisBanner() + detailLeiste('/formate', '/formate/' + id, 'fo-loeschen') +
      '<div class="stapel">' +
      '<section class="karte profil-karte"><div class="profil"><span class="avatar avatar-eckig">' + icon(formatIcon(f.formatTyp)) + '</span>' +
      '<div class="profil-text"><p class="topline">' + esc(f.formatTyp) + '</p><h1>' + esc(f.name) + '</h1><div class="chips">' +
      '<span class="chip chip-grau">ID ' + formatNummer(f.formatId) + '</span></div>' + geaendertHinweis(f) + '</div></div></section>' +
      '<div class="raster-karten">' +
      karte('Formatdaten', 'buch', '<div class="stapel" style="gap:16px">' + feldListe([
        feld('ID', formatNummer(f.formatId)), feld('Format', f.formatTyp), feld('Medienentwickler', f.medienentwickler)]) +
        (f.link ? '<div><div class="felder"><dt>Datei-Link</dt></div>' + dateiLinkBlock(f.link, 'Im Explorer öffnen') + '</div>' : '') +
        (f.httpLink ? '<div class="felder"><dt>HTTP-Link</dt><dd><a class="link" href="' + esc(f.httpLink) + '" target="_blank" rel="noopener">' + icon('extern') + esc(f.httpLink) + '</a></dd></div>' : '') +
        '</div>') +
      karte('Zugewiesene Personas (' + personen.length + ')', 'personen', personen.length ? '<div class="liste">' + personen.map(function (p) {
        return '<div class="eintrag"><a class="eintrag-link" href="#/personas/' + p.id + '">' + avatarHtml(p, true) +
          '<span style="min-width:0"><span class="eintrag-titel">' + esc(vollerName(p)) + '</span><br><span class="eintrag-sub">' + esc(p.funktion || '–') + '</span></span></a></div>';
      }).join('') + '</div>' : '<p class="leer">Keine Personas zugewiesen.</p>') +
      '</div></div>';
    loeschenAnbinden('fo-loeschen', 'format', id, 'Format löschen?', 'Möchten Sie <strong>' + esc(f.name) + '</strong> wirklich löschen?', '/formate');
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
      '<div class="seitenkopf"><div><p class="topline">E-Learning-Formate</p><h1>' + (id ? 'Format bearbeiten' : 'Neues Format') + '</h1></div></div>' +
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
      var fertig = knopfWarten(e.submitter || document.querySelector('#format-form button[type=submit]'), 'Wird gespeichert …');
      serverAenderung('speichern', {
        typ: 'format', id: id || undefined, version: bestehend ? bestehend.version : undefined, daten: daten, personas: ids
      }, id ? 'Format gespeichert' : 'Format angelegt').then(function (j) {
        fertig();
        if (j) gehe('/formate/' + j.id);
      });
    });
  }

  // ------------------------------------------------------------------
  // Versionen (Personas, Firmen, Formate)
  // ------------------------------------------------------------------
  var FELDER = {
    persona: [['vorname', 'Vorname'], ['name', 'Name'], ['personaId', 'Persona-ID'], ['gruppe', 'Gruppe'], ['funktion', 'Funktion in der Lernwelt'],
      ['beruf', 'Beruf'], ['kundenprofil', 'Kundenprofil'], ['cJourney', 'Customer Journey'], ['geschlecht', 'Geschlecht'], ['geburtstag', 'Geburtstag'],
      ['alter', 'Alter'], ['herkunft', 'Herkunft'], ['strasse', 'Straße'], ['plz', 'PLZ'], ['ort', 'Ort'], ['stadtteil', 'Stadtteil'], ['wohnart', 'Wohnart'],
      ['familienstand', 'Familienstand'], ['verwandt', 'Weitere Familienangaben'], ['lebenslauf', 'Lebenslauf'], ['aktivitaeten', 'Aktivitäten'],
      ['charakter', 'Charakter'], ['sonstiges', 'Sonstiges'], ['wocStimme', 'WoC-Stimme'], ['didAvatar', 'DID-Avatar'], ['bilderLink', 'Bilder-Link']],
    firma: [['name', 'Name'], ['firmenId', 'ID'], ['funktion', 'Funktion'], ['branche', 'Branche'], ['strasse', 'Straße'], ['plz', 'PLZ'], ['ort', 'Ort'], ['sonstiges', 'Sonstiges']],
    format: [['name', 'Name'], ['formatId', 'ID'], ['formatTyp', 'Format-Typ'], ['medienentwickler', 'Medienentwickler'], ['link', 'Datei-Link'], ['httpLink', 'HTTP-Link']]
  };
  var AKTIONEN = { angelegt: 'Angelegt', geaendert: 'Geändert', geloescht: 'Gelöscht', wiederhergestellt: 'Wiederhergestellt', importiert: 'Übernommen' };

  function personaNameById(id) { var p = persona(id); return p ? vollerName(p) : 'Persona #' + id + ' (gelöscht)'; }
  function firmaNameById(id) { var f = firma(id); return f ? f.name : 'Firma #' + id + ' (gelöscht)'; }
  function formatNameById(id) { var f = format(id); return f ? f.name : 'Format #' + id + ' (gelöscht)'; }

  // Alle Felder eines Standes als lesbare Texte
  function standTexte(typ, d) {
    var liste = FELDER[typ].map(function (f) { return [f[1], d[f[0]] === null || d[f[0]] === undefined ? '' : String(d[f[0]])]; });
    if (typ === 'persona') {
      liste.push(['Profilbild', d.bildId ? 'Bild Nr. ' + d.bildId : 'kein Bild']);
      liste.push(['Firmen', (d.firmen || []).map(function (f) { return firmaNameById(f.firmaId) + (f.funktionInFirma ? ' (' + f.funktionInFirma + ')' : ''); }).join('\n')]);
      liste.push(['Familie', (d.beziehungen || []).map(function (b) { return personaNameById(b.andere) + (b.verhaeltnis ? ' – ' + b.verhaeltnis : '') + (b.gegen ? ' / Gegenrichtung: ' + b.gegen : ''); }).join('\n')]);
      liste.push(['E-Learning-Formate', (d.formate || []).map(formatNameById).join('\n')]);
    } else if (typ === 'firma') {
      liste.push(['Personas', (d.personas || []).map(function (p) { return personaNameById(p.personaId) + (p.funktionInFirma ? ' (' + p.funktionInFirma + ')' : ''); }).join('\n')]);
    } else {
      liste.push(['Personas', (d.personas || []).map(personaNameById).join('\n')]);
    }
    return liste;
  }

  function seiteVersionen(haupt, typ, id) {
    var basis = { persona: '/personas/', firma: '/firmen/', format: '/formate/' }[typ] + id;
    var objekt = typ === 'persona' ? persona(id) : typ === 'firma' ? firma(id) : format(id);
    if (!objekt) return nichtGefunden(haupt, 'Eintrag nicht gefunden.', basis.replace(/\/\d+$/, ''));
    var name = typ === 'persona' ? vollerName(objekt) : objekt.name;
    var aktuell = laedt(haupt);
    api('versionen', undefined, '&typ=' + typ + '&id=' + id).then(function (j) {
      if (!aktuell()) return;
      var versionen = j.versionen;
      var auswahl = 0;
      function zeichnen() {
        var v = versionen[auswahl];
        var aktuell = standTexte(typ, versionen[0].daten);
        var stand = standTexte(typ, v.daten);
        var zeilen = stand.map(function (z, i) {
          var anders = auswahl > 0 && z[1] !== aktuell[i][1];
          if (!z[1] && !aktuell[i][1]) return '';
          return '<tr' + (anders ? ' class="zeile-anders"' : '') + '><th scope="row">' + esc(z[0]) + (anders ? ' <span class="chip chip-warnung">anders</span>' : '') + '</th>' +
            '<td>' + esc(z[1] || '–') + '</td>' + (auswahl > 0 ? '<td>' + esc(aktuell[i][1] || '–') + '</td>' : '') + '</tr>';
        }).join('');
        haupt.innerHTML =
          '<div class="leiste"><a class="knopf knopf-text" href="#' + basis + '">' + icon('zurueck') + 'Zurück</a>' +
          (auswahl > 0 && darfBearbeiten() ? '<button type="button" class="knopf knopf-primaer" id="v-wiederherstellen">' + icon('wiederherstellen') + 'Diesen Stand wiederherstellen</button>' : '') + '</div>' +
          '<div class="seitenkopf"><div><p class="topline">Versionen</p><h1>' + esc(name) + '</h1><p>' + versionen.length + ' gespeicherte Stände</p></div></div>' +
          '<div class="versionen-raster">' +
          '<nav class="versionen-liste" aria-label="Gespeicherte Stände">' + versionen.map(function (x, i) {
            return '<button type="button" class="version-eintrag" data-version="' + i + '"' + (i === auswahl ? ' aria-current="true"' : '') + '>' +
              '<span class="eintrag-titel">' + esc(datumText(x.zeit)) + '</span>' +
              '<span class="eintrag-sub">' + esc(AKTIONEN[x.aktion] || x.aktion) + (x.benutzer ? ' · ' + esc(x.benutzer) : '') + (i === 0 ? ' · aktuell' : '') + '</span></button>';
          }).join('') + '</nav>' +
          '<section class="karte" style="min-width:0"><div class="karte-kopf"><h2>' + icon('uhr') + 'Stand vom ' + esc(datumText(v.zeit)) + '</h2></div>' +
          (auswahl === 0 ? '<p class="klein-hinweis" style="margin-bottom:12px">Das ist der aktuelle Stand. Wählen Sie links einen älteren Stand, um ihn zu vergleichen.</p>'
            : '<p class="klein-hinweis" style="margin-bottom:12px">Abweichungen zum aktuellen Stand sind markiert.</p>') +
          '<div class="tabelle-huelle"><table class="tabelle tabelle-vergleich"><thead><tr><th scope="col">Feld</th><th scope="col">' + (auswahl === 0 ? 'Aktueller Stand' : 'Dieser Stand') + '</th>' +
          (auswahl > 0 ? '<th scope="col">Aktueller Stand</th>' : '') + '</tr></thead><tbody>' + zeilen + '</tbody></table></div></section></div>';
        haupt.querySelectorAll('[data-version]').forEach(function (k) {
          k.addEventListener('click', function () { auswahl = Number(k.getAttribute('data-version')); zeichnen(); });
        });
        var w = document.getElementById('v-wiederherstellen');
        if (w) w.addEventListener('click', function () {
          dialog({ titel: 'Stand wiederherstellen?', text: 'Der Stand vom ' + datumText(v.zeit) + ' wird wiederhergestellt. Der heutige Stand bleibt als Version erhalten.', ok: 'Wiederherstellen' }).then(function (ja) {
            if (!ja) return;
            serverAenderung('wiederherstellen', { versionId: v.id }, 'Stand wiederhergestellt').then(function (r) { if (r) gehe(basis); });
          });
        });
      }
      zeichnen();
    }).catch(function (e) { fehlerAnzeigen(e); gehe(basis); });
  }

  // ------------------------------------------------------------------
  // Benutzerverwaltung
  // ------------------------------------------------------------------
  var STATUS_TEXT = { aktiv: 'Aktiv', eingeladen: 'Eingeladen', deaktiviert: 'Deaktiviert' };

  function monateSeit(iso) {
    if (!iso) return null;
    return Math.floor((Date.now() - new Date(iso).getTime()) / (30.44 * 86400000));
  }

  function statusChip(b) {
    if (b.status === 'eingeladen') {
      return b.einladungAbgelaufen ? '<span class="chip chip-warnung">Einladung abgelaufen</span>' : '<span class="chip chip-grau">Eingeladen</span>';
    }
    if (b.status === 'deaktiviert') return '<span class="chip chip-grau">Deaktiviert</span>';
    var m = monateSeit(b.letzteAnmeldung || b.aktiviertAm);
    return m !== null && m >= 6 ? '<span class="chip chip-warnung">Seit ' + m + ' Monaten inaktiv</span>' : '<span class="chip">Aktiv</span>';
  }

  function darfEinladungVerwalten(b) {
    return recht('benutzer_einladen') && (store.ich.einladbareRollen || []).some(function (r) { return r.wert === b.rolle; });
  }

  function seiteBenutzer(haupt) {
    var aktuell = laedt(haupt);
    api('benutzer').then(function (j) {
      if (!aktuell()) return;
      var alle = j.benutzer;
      haupt.innerHTML =
        '<div class="seitenkopf"><div><p class="topline">Verwaltung</p><h1>Benutzer</h1><p id="b-anzahl"></p></div>' +
        (recht('benutzer_einladen') ? '<a class="knopf knopf-primaer" href="#/benutzer/einladen">' + icon('mail') + 'Person einladen</a>' : '') + '</div>' +
        (recht('benutzer_verwalten') ? '' : '<p class="klein-hinweis" style="margin:-16px 0 24px">Sie können Personen mit der Rolle Nutzer einladen. Konten bearbeiten oder löschen kann nur die Administration.</p>') +
        '<div class="filterzeile">' +
        '<div class="suche">' + icon('suche') + '<input id="b-suche" type="search" placeholder="Name, E-Mail oder Org-Einheit …" aria-label="Benutzer durchsuchen" value="' + esc(ui.benutzerSuche) + '"></div>' +
        '<select id="b-status" aria-label="Nach Status filtern">' + optionenHtml([{ wert: 'aktiv', text: 'Aktiv' }, { wert: 'eingeladen', text: 'Eingeladen' }, { wert: 'deaktiviert', text: 'Deaktiviert' }, { wert: 'inaktiv', text: 'Lange inaktiv (6+ Monate)' }], ui.benutzerStatus, 'Alle Status') + '</select>' +
        '<select id="b-rolle" aria-label="Nach Rolle filtern">' + optionenHtml([{ wert: 'admin', text: 'Administrator' }, { wert: 'mediengestalter', text: 'Mediengestalter' }, { wert: 'designer', text: 'Designer' }, { wert: 'nutzer', text: 'Nutzer' }], ui.benutzerRolle, 'Alle Rollen') + '</select></div>' +
        '<div id="b-liste"></div>';

      function aktualisieren() {
        var q = ui.benutzerSuche.trim().toLowerCase();
        var liste = alle.filter(function (b) {
          if (ui.benutzerRolle && b.rolle !== ui.benutzerRolle) return false;
          if (ui.benutzerStatus === 'inaktiv') {
            var m = monateSeit(b.letzteAnmeldung || b.aktiviertAm);
            if (b.status !== 'aktiv' || m === null || m < 6) return false;
          } else if (ui.benutzerStatus && b.status !== ui.benutzerStatus) return false;
          return !q || [b.vorname + ' ' + b.nachname, b.email, b.orgEinheit].some(function (w) { return String(w || '').toLowerCase().indexOf(q) >= 0; });
        });
        document.getElementById('b-anzahl').textContent = liste.length === alle.length ? alle.length + ' Konten' : liste.length + ' von ' + alle.length + ' Konten';
        document.getElementById('b-status').classList.toggle('filter-aktiv', !!ui.benutzerStatus);
        document.getElementById('b-rolle').classList.toggle('filter-aktiv', !!ui.benutzerRolle);
        var ziel = document.getElementById('b-liste');
        if (!liste.length) { ziel.innerHTML = '<div class="leerzustand">' + icon('gruppe', 'icon-gross') + '<p>Keine Konten gefunden.</p></div>'; return; }
        ziel.innerHTML = '<div class="tabelle-huelle"><table class="tabelle"><thead><tr><th scope="col">Name</th><th scope="col">Org-Einheit</th><th scope="col">Rolle</th><th scope="col">Status</th><th scope="col">Letzte Anmeldung</th><th scope="col"><span class="sr-only">Aktionen</span></th></tr></thead><tbody>' +
          liste.map(function (b) {
            var aktionen = '';
            if (b.status === 'eingeladen' && darfEinladungVerwalten(b)) {
              aktionen += '<button type="button" class="knopf knopf-rahmen knopf-klein" data-erneut="' + b.id + '">' + icon('senden', 'icon-klein') + 'Erneut senden</button>' +
                '<button type="button" class="knopf knopf-rahmen knopf-klein" data-zurueck="' + b.id + '">' + icon('x', 'icon-klein') + 'Zurückziehen</button>';
            }
            if (recht('benutzer_verwalten') && b.status !== 'eingeladen') {
              aktionen += '<a class="knopf knopf-rahmen knopf-klein" href="#/benutzer/' + b.id + '">' + icon('stift', 'icon-klein') + 'Bearbeiten</a>';
            }
            return '<tr><td><span class="eintrag-titel">' + esc(b.vorname + ' ' + b.nachname) + (store.ich && b.id === store.ich.id ? ' <span class="chip chip-grau">Sie</span>' : '') + '</span><br><span class="eintrag-sub">' + esc(b.email) + '</span></td>' +
              '<td>' + esc(b.orgEinheit || '–') + '</td><td>' + esc(b.rolleName) + '</td><td>' + statusChip(b) + '</td>' +
              '<td>' + (b.status === 'eingeladen' ? '<span class="eintrag-sub">eingeladen ' + esc(datumText(b.erstelltAm)) + (b.eingeladenVon ? '<br>von ' + esc(b.eingeladenVon) : '') + '</span>' : esc(datumText(b.letzteAnmeldung))) + '</td>' +
              '<td><div class="tabelle-aktionen">' + aktionen + '</div></td></tr>';
          }).join('') + '</tbody></table></div>';
        ziel.querySelectorAll('[data-erneut]').forEach(function (k) {
          k.addEventListener('click', function () {
            api('einladung-erneut', { id: Number(k.getAttribute('data-erneut')) }).then(function (r) {
              alle = r.benutzer;
              einladungErgebnis(r, 'Einladung erneut gesendet');
              aktualisieren();
            }).catch(fehlerAnzeigen);
          });
        });
        ziel.querySelectorAll('[data-zurueck]').forEach(function (k) {
          k.addEventListener('click', function () {
            dialog({ titel: 'Einladung zurückziehen?', text: 'Der Einladungslink wird ungültig und das vorbereitete Konto gelöscht.', ok: 'Zurückziehen' }).then(function (ja) {
              if (!ja) return;
              api('einladung-zurueckziehen', { id: Number(k.getAttribute('data-zurueck')) }).then(function (r) {
                alle = r.benutzer;
                toast('Einladung zurückgezogen');
                aktualisieren();
              }).catch(fehlerAnzeigen);
            });
          });
        });
      }
      document.getElementById('b-suche').addEventListener('input', function (e) { ui.benutzerSuche = e.target.value; aktualisieren(); });
      document.getElementById('b-status').addEventListener('change', function (e) { ui.benutzerStatus = e.target.value; aktualisieren(); });
      document.getElementById('b-rolle').addEventListener('change', function (e) { ui.benutzerRolle = e.target.value; aktualisieren(); });
      aktualisieren();
    }).catch(fehlerAnzeigen);
  }

  // Ohne Mailversand bekommt die einladende Person den Link zum Weitergeben
  function einladungErgebnis(r, meldung) {
    if (r.mailGesendet) { toast(meldung); return Promise.resolve(); }
    return dialog({
      titel: 'E-Mail nicht versendet',
      html: 'Die Einladung ist angelegt, die E-Mail konnte aber nicht gesendet werden (' + esc(r.mailFehler || 'E-Mail-Versand nicht eingerichtet') + ').<br><br>' +
        'Geben Sie diesen Link persönlich an die eingeladene Person weiter. Er ist 7 Tage gültig:</p><div class="pfad" style="margin-top:8px">' + esc(r.link) + '</div>' +
        '<p style="margin-top:8px"><button type="button" class="link" data-kopieren="' + esc(r.link) + '">' + icon('kopieren') + 'Link kopieren</button>',
      ok: 'Fertig', abbrechen: 'Schließen'
    });
  }

  function seiteEinladen(haupt) {
    var rollen = store.ich.einladbareRollen || [];
    haupt.innerHTML =
      '<form id="ein-form" novalidate>' +
      '<div class="leiste"><a class="knopf knopf-text" href="#/benutzer">' + icon('zurueck') + 'Zurück</a></div>' +
      '<div class="seitenkopf"><div><p class="topline">Benutzer</p><h1>Person einladen</h1><p>Die Person erhält eine E-Mail mit einem Link. Darüber legt sie ihr Passwort fest und aktiviert ihr Konto.</p></div></div>' +
      '<div class="stapel" style="max-width:720px">' +
      karte('Angaben zur Person', 'mail', '<div class="raster raster-2">' +
        '<div class="feld spalte-voll"><label for="ein-email">E-Mail-Adresse</label><input id="ein-email" type="email" autocomplete="off" required></div>' +
        eingabe('ein-vorname', 'Vorname', '', 'text', ' autocomplete="off"') + eingabe('ein-nachname', 'Nachname', '', 'text', ' autocomplete="off"') +
        orgFeld('ein-org', '') +
        (rollen.length > 1 ? auswahlFeld('ein-rolle', 'Rolle', rollen.map(function (r) { return { wert: r.wert, text: r.name }; }), 'nutzer', undefined)
          : '<div class="feld"><span class="label">Rolle</span><span>' + esc(rollen[0] ? rollen[0].name : '') + '</span><input type="hidden" id="ein-rolle" value="' + esc(rollen[0] ? rollen[0].wert : '') + '"></div>') +
        '</div>' + rollenHinweis()) +
      '<p class="anmeldung-fehler" id="ein-fehler" role="alert" hidden></p>' +
      '<div><button type="submit" class="knopf knopf-primaer" id="ein-knopf">' + icon('senden') + 'Einladung senden</button></div>' +
      '</div></form>';
    orgFeldAktivieren('ein-org');
    document.getElementById('ein-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var daten = { email: wert('ein-email').trim(), vorname: wert('ein-vorname').trim(), nachname: wert('ein-nachname').trim(), orgEinheit: wert('ein-org'), rolle: wert('ein-rolle') };
      if (!daten.email || !daten.vorname || !daten.nachname) return formFehler('ein-fehler', 'Bitte füllen Sie E-Mail-Adresse, Vor- und Nachnamen aus.');
      if (!orgGueltig(daten.orgEinheit)) return formFehler('ein-fehler', 'Bitte geben Sie eine gültige Org-Einheit ein, z. B. VH-VP.');
      formFehler('ein-fehler', '');
      var fertig = knopfWarten(document.getElementById('ein-knopf'), 'Wird gesendet …');
      api('einladen', daten).then(function (r) {
        return einladungErgebnis(r, 'Einladung an ' + daten.email + ' gesendet').then(function () { gehe('/benutzer'); });
      }).catch(function (err) { fertig(); formFehler('ein-fehler', err.message); });
    });
  }

  function rollenHinweis() {
    return '<dl class="rollen-hinweis">' +
      '<dt>Administrator</dt><dd>Alles, auch Benutzerverwaltung, Protokoll und Einstellungen.</dd>' +
      '<dt>Mediengestalter</dt><dd>Personas, Firmen und Formate bearbeiten; Nutzer einladen.</dd>' +
      '<dt>Designer</dt><dd>Personas, Firmen und Formate ansehen.</dd>' +
      '<dt>Nutzer</dt><dd>Personas, Firmen und Formate ansehen.</dd></dl>';
  }

  function seiteBenutzerBearbeiten(haupt, id) {
    var aktuell = laedt(haupt);
    api('benutzer').then(function (j) {
      if (!aktuell()) return;
      var b = j.benutzer.find(function (x) { return x.id === id; });
      if (!b) return nichtGefunden(haupt, 'Konto nicht gefunden.', '/benutzer');
      var selbst = store.ich && store.ich.id === id;
      var rollen = [{ wert: 'admin', text: 'Administrator' }, { wert: 'mediengestalter', text: 'Mediengestalter' }, { wert: 'designer', text: 'Designer' }, { wert: 'nutzer', text: 'Nutzer' }];
      haupt.innerHTML =
        '<div class="leiste"><a class="knopf knopf-text" href="#/benutzer">' + icon('zurueck') + 'Zurück</a></div>' +
        '<div class="seitenkopf"><div><p class="topline">Benutzer</p><h1>' + esc(b.vorname + ' ' + b.nachname) + '</h1><p>' + esc(b.email) + '</p></div></div>' +
        '<div class="raster-karten">' +
        karte('Konto bearbeiten', 'stift', '<form id="bb-form" class="stapel" style="gap:16px" novalidate><div class="raster raster-2">' +
          '<div class="feld spalte-voll"><label for="bb-email">E-Mail-Adresse</label><input id="bb-email" type="email" value="' + esc(b.email) + '"></div>' +
          eingabe('bb-vorname', 'Vorname', b.vorname) + eingabe('bb-nachname', 'Nachname', b.nachname) +
          orgFeld('bb-org', b.orgEinheit) + auswahlFeld('bb-rolle', 'Rolle', rollen, b.rolle, undefined) + '</div>' +
          '<p class="klein-hinweis">Eine Änderung der Rolle gilt sofort; die Person wird dabei abgemeldet. Bei geänderter E-Mail-Adresse erhält die bisherige Adresse einen Hinweis.</p>' +
          '<p class="anmeldung-fehler" id="bb-fehler" role="alert" hidden></p>' +
          '<div><button type="submit" class="knopf knopf-primaer" id="bb-knopf">' + icon('speichern') + 'Speichern</button></div></form>') +
        karte('Status', 'schild', '<div class="stapel" style="gap:16px">' + feldListe([
          '<div><dt>Status</dt><dd>' + statusChip(b) + '</dd></div>',
          feld('Eingeladen am', datumText(b.erstelltAm)), feld('Eingeladen von', b.eingeladenVon),
          feld('Aktiviert am', b.aktiviertAm ? datumText(b.aktiviertAm) : ''), feld('Letzte Anmeldung', datumText(b.letzteAnmeldung))]) +
          (selbst ? '<p class="klein-hinweis">Das ist Ihr eigenes Konto. Deaktivieren und Löschen sind hier nicht möglich.</p>' :
            '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
            '<button type="button" class="knopf knopf-rahmen" id="bb-status">' + icon(b.status === 'deaktiviert' ? 'ok' : 'schloss') + (b.status === 'deaktiviert' ? 'Wieder aktivieren' : 'Deaktivieren') + '</button>' +
            '<button type="button" class="knopf knopf-rahmen" id="bb-loeschen">' + icon('papierkorb') + 'Konto löschen</button></div>' +
            '<p class="klein-hinweis">Deaktivierte Konten können sich nicht mehr anmelden und lassen sich jederzeit wieder aktivieren. Konten ohne Anmeldung seit 12 Monaten deaktiviert das System automatisch.</p>') +
          '</div>') +
        '</div>';
      orgFeldAktivieren('bb-org');
      document.getElementById('bb-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var daten = { id: id, email: wert('bb-email').trim(), vorname: wert('bb-vorname').trim(), nachname: wert('bb-nachname').trim(), orgEinheit: wert('bb-org'), rolle: wert('bb-rolle') };
        if (!orgGueltig(daten.orgEinheit)) return formFehler('bb-fehler', 'Bitte geben Sie eine gültige Org-Einheit ein, z. B. VH-VP.');
        formFehler('bb-fehler', '');
        var fertig = knopfWarten(document.getElementById('bb-knopf'), 'Wird gespeichert …');
        api('benutzer-speichern', daten).then(function () {
          toast('Konto gespeichert');
          if (selbst) return api('status').then(function (s) { store.ich = s.ich; gehe('/benutzer'); });
          gehe('/benutzer');
        }).catch(function (err) { fertig(); formFehler('bb-fehler', err.message); });
      });
      var statusKnopf = document.getElementById('bb-status');
      if (statusKnopf) statusKnopf.addEventListener('click', function () {
        var aktivieren = b.status === 'deaktiviert';
        dialog({
          titel: aktivieren ? 'Konto wieder aktivieren?' : 'Konto deaktivieren?',
          text: aktivieren ? b.email + ' kann sich danach wieder anmelden.' : b.email + ' kann sich danach nicht mehr anmelden; laufende Anmeldungen werden beendet.',
          ok: aktivieren ? 'Aktivieren' : 'Deaktivieren'
        }).then(function (ja) {
          if (!ja) return;
          api('benutzer-status', { id: id, aktiv: aktivieren }).then(function () {
            toast(aktivieren ? 'Konto aktiviert' : 'Konto deaktiviert');
            seiteBenutzerBearbeiten(haupt, id);
          }).catch(fehlerAnzeigen);
        });
      });
      var loeschKnopf = document.getElementById('bb-loeschen');
      if (loeschKnopf) loeschKnopf.addEventListener('click', function () {
        dialog({ titel: 'Konto löschen?', html: 'Das Konto von <strong>' + esc(b.vorname + ' ' + b.nachname) + '</strong> wird endgültig gelöscht. Einträge im Protokoll und in den Versionen behalten den Namen.' }).then(function (ja) {
          if (!ja) return;
          api('benutzer-loeschen', { id: id }).then(function () { toast('Konto gelöscht'); gehe('/benutzer'); }).catch(fehlerAnzeigen);
        });
      });
    }).catch(fehlerAnzeigen);
  }

  // ------------------------------------------------------------------
  // Mein Konto
  // ------------------------------------------------------------------
  function seiteKonto(haupt) {
    var ich = store.ich;
    haupt.innerHTML =
      '<div class="seitenkopf"><div><p class="topline">' + esc(ich.rolleName) + '</p><h1>Mein Konto</h1><p>' + esc(ich.email) + '</p></div></div>' +
      '<div class="raster-karten">' +
      karte('Persönliche Daten', 'person', '<form id="k-form" class="stapel" style="gap:16px" novalidate><div class="raster raster-2">' +
        eingabe('k-vorname', 'Vorname', ich.vorname, 'text', ' autocomplete="given-name"') + eingabe('k-nachname', 'Nachname', ich.nachname, 'text', ' autocomplete="family-name"') + '</div>' +
        feldListe([feld('Rolle', ich.rolleName), feld('Org-Einheit', ich.orgEinheit), feld('Letzte Anmeldung', datumText(ich.letzteAnmeldung))]) +
        '<p class="klein-hinweis">Rolle und Org-Einheit ändert die Administration.</p>' +
        '<div><button type="submit" class="knopf knopf-primaer">' + icon('speichern') + 'Namen speichern</button></div></form>') +
      karte('Passwort ändern', 'schloss', '<form id="kp-form" class="stapel" style="gap:16px" novalidate>' +
        '<input type="email" autocomplete="username" value="' + esc(ich.email) + '" hidden>' +
        '<div class="feld"><label for="kp-alt">Aktuelles Passwort</label><input id="kp-alt" type="password" autocomplete="current-password"></div>' +
        passwortFelder('kp', true) +
        '<p class="anmeldung-fehler" id="kp-fehler" role="alert" hidden></p>' +
        '<div><button type="submit" class="knopf knopf-primaer" id="kp-knopf">' + icon('speichern') + 'Passwort ändern</button></div>' +
        '<p class="klein-hinweis">Nach der Änderung werden Sie auf allen anderen Geräten abgemeldet und erhalten eine Bestätigung per E-Mail.</p></form>') +
      karte('E-Mail-Adresse ändern', 'mail', '<form id="ke-form" class="stapel" style="gap:16px" novalidate>' +
        '<div class="feld"><label for="ke-email">Neue E-Mail-Adresse</label><input id="ke-email" type="email" autocomplete="email"></div>' +
        '<div class="feld"><label for="ke-pw">Aktuelles Passwort</label><input id="ke-pw" type="password" autocomplete="current-password"></div>' +
        '<p class="anmeldung-fehler" id="ke-fehler" role="alert" hidden></p>' +
        '<div id="ke-ergebnis"></div>' +
        '<div><button type="submit" class="knopf knopf-primaer" id="ke-knopf">' + icon('senden') + 'Bestätigungslink senden</button></div>' +
        '<p class="klein-hinweis">Die neue Adresse gilt erst, wenn Sie den Link in der E-Mail an die neue Adresse bestätigen.</p></form>') +
      karte('Anmeldungen', 'schild', '<div class="stapel" style="gap:16px"><p style="margin:0">Haben Sie sich auf einem fremden oder verlorenen Gerät angemeldet? Beenden Sie dort alle Anmeldungen.</p>' +
        '<div><button type="button" class="knopf knopf-rahmen" id="k-ueberall">' + icon('abmelden') + 'Auf allen anderen Geräten abmelden</button></div>' +
        '<p class="klein-hinweis">Nach 2 Stunden ohne Aktivität oder spätestens nach 12 Stunden werden Sie automatisch abgemeldet.</p></div>') +
      '</div>';
    document.getElementById('k-form').addEventListener('submit', function (e) {
      e.preventDefault();
      api('konto', { vorname: wert('k-vorname'), nachname: wert('k-nachname') }).then(function (j) {
        store.ich = j.ich;
        toast('Name gespeichert');
        zeichneNavigation();
      }).catch(fehlerAnzeigen);
    });
    document.getElementById('kp-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var pw = passwortLesen('kp');
      if (!wert('kp-alt')) return formFehler('kp-fehler', 'Bitte geben Sie Ihr aktuelles Passwort ein.');
      if (pw.fehler) return formFehler('kp-fehler', pw.fehler);
      formFehler('kp-fehler', '');
      var fertig = knopfWarten(document.getElementById('kp-knopf'), 'Wird gespeichert …');
      api('passwort-aendern', { alt: wert('kp-alt'), neu: pw.passwort }).then(function () {
        fertig();
        document.getElementById('kp-form').reset();
        toast('Passwort geändert');
      }).catch(function (err) { fertig(); formFehler('kp-fehler', err.message); });
    });
    document.getElementById('ke-form').addEventListener('submit', function (e) {
      e.preventDefault();
      if (!wert('ke-email').trim() || !wert('ke-pw')) return formFehler('ke-fehler', 'Bitte geben Sie die neue Adresse und Ihr Passwort ein.');
      formFehler('ke-fehler', '');
      var fertig = knopfWarten(document.getElementById('ke-knopf'), 'Wird gesendet …');
      api('email-aendern', { email: wert('ke-email').trim(), passwort: wert('ke-pw') }).then(function (j) {
        fertig();
        document.getElementById('ke-form').reset();
        document.getElementById('ke-ergebnis').innerHTML = '<p class="anmeldung-hinweis" role="status">Wir haben einen Bestätigungslink an ' + esc(j.email) + ' gesendet. Er ist 24 Stunden gültig.</p>';
      }).catch(function (err) { fertig(); formFehler('ke-fehler', err.message); });
    });
    document.getElementById('k-ueberall').addEventListener('click', function () {
      api('ueberall-abmelden', {}).then(function () { toast('Alle anderen Anmeldungen wurden beendet'); }).catch(fehlerAnzeigen);
    });
  }

  // ------------------------------------------------------------------
  // Protokoll (Administration)
  // ------------------------------------------------------------------
  function objektLink(e) {
    var basis = { persona: '/personas/', firma: '/firmen/', format: '/formate/' }[e.objektTyp];
    if (!basis || !e.objektId) return '';
    var da = e.objektTyp === 'persona' ? persona(e.objektId) : e.objektTyp === 'firma' ? firma(e.objektId) : format(e.objektId);
    return da ? ' <a class="link" href="#' + basis + e.objektId + '">öffnen</a>' : '';
  }

  function seiteProtokoll(haupt) {
    haupt.innerHTML =
      '<div class="seitenkopf"><div><p class="topline">Verwaltung</p><h1>Protokoll</h1><p id="pr-anzahl">Wird geladen …</p></div></div>' +
      '<div class="filterzeile">' +
      '<div class="suche">' + icon('suche') + '<input id="pr-suche" type="search" placeholder="Suche in Beschreibung oder Person …" aria-label="Protokoll durchsuchen" value="' + esc(ui.protokollSuche) + '"></div>' +
      '<select id="pr-bereich" aria-label="Bereich">' + optionenHtml([{ wert: 'daten', text: 'Personas, Firmen, Formate' }, { wert: 'konten', text: 'Benutzerkonten und System' }], ui.protokollBereich, 'Alle Bereiche') + '</select></div>' +
      '<div id="pr-liste"></div>' +
      '<p class="klein-hinweis" style="margin-top:16px">IP-Adressen werden nach 90 Tagen entfernt, Einträge nach 2 Jahren gelöscht.</p>';
    var zeitgeber = null;
    function laden() {
      var q = '&seite=' + ui.protokollSeite + '&bereich=' + encodeURIComponent(ui.protokollBereich) + '&suche=' + encodeURIComponent(ui.protokollSuche);
      api('protokoll', undefined, q).then(function (j) {
        if (!document.getElementById('pr-liste')) return;
        document.getElementById('pr-anzahl').textContent = j.gesamt + ' Einträge';
        var ziel = document.getElementById('pr-liste');
        if (!j.eintraege.length) { ziel.innerHTML = '<div class="leerzustand">' + icon('liste', 'icon-gross') + '<p>Keine Einträge gefunden.</p></div>'; return; }
        ziel.innerHTML = '<div class="tabelle-huelle"><table class="tabelle"><thead><tr><th scope="col">Zeit</th><th scope="col">Person</th><th scope="col">Ereignis</th><th scope="col">IP-Adresse</th></tr></thead><tbody>' +
          j.eintraege.map(function (e) {
            var warnung = /fehlgeschlagen|fehler/.test(e.aktion);
            return '<tr><td class="nowrap">' + esc(datumText(e.zeit)) + '</td><td>' + esc(e.benutzer || '–') + '</td>' +
              '<td>' + (warnung ? '<span class="chip chip-warnung">Achtung</span> ' : '') + esc(e.beschreibung) + objektLink(e) + '</td><td class="nowrap">' + esc(e.ip || '–') + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<div class="blaettern"><button type="button" class="knopf knopf-rahmen knopf-klein" id="pr-zurueck"' + (j.seite <= 1 ? ' disabled' : '') + '>' + icon('zurueck', 'icon-klein') + 'Neuere</button>' +
          '<span>Seite ' + j.seite + ' von ' + j.seiten + '</span>' +
          '<button type="button" class="knopf knopf-rahmen knopf-klein" id="pr-weiter"' + (j.seite >= j.seiten ? ' disabled' : '') + '>Ältere</button></div>';
        document.getElementById('pr-zurueck').addEventListener('click', function () { ui.protokollSeite--; laden(); });
        document.getElementById('pr-weiter').addEventListener('click', function () { ui.protokollSeite++; laden(); });
      }).catch(fehlerAnzeigen);
    }
    document.getElementById('pr-suche').addEventListener('input', function (e) {
      ui.protokollSuche = e.target.value;
      ui.protokollSeite = 1;
      clearTimeout(zeitgeber);
      zeitgeber = setTimeout(laden, 300);
    });
    document.getElementById('pr-bereich').addEventListener('change', function (e) { ui.protokollBereich = e.target.value; ui.protokollSeite = 1; laden(); });
    laden();
  }

  // ------------------------------------------------------------------
  // Einstellungen (Administration)
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
    var aktuell = laedt(haupt);
    Promise.all([api('einstellungen'), api('geloescht')]).then(function (erg) {
      if (!aktuell()) return;
      var e = erg[0], geloescht = erg[1].eintraege, s = e.smtp;
      var d = store.daten;
      haupt.innerHTML =
        '<div class="seitenkopf"><div><p class="topline">System</p><h1>Einstellungen</h1><p>Anwendung, E-Mail-Versand und Datenhaltung</p></div></div>' +
        '<div class="raster-karten">' +
        karte('Anwendung', 'einstellungen', '<form id="e-form" class="stapel" style="gap:16px" novalidate>' +
          eingabe('e-titel', 'Titel der Anwendung', e.appTitel) +
          '<div><button type="submit" class="knopf knopf-primaer">' + icon('speichern') + 'Titel speichern</button></div></form>') +
        karte('E-Mail-Versand', 'mail', '<form id="m-form" class="stapel" style="gap:16px" novalidate>' +
          '<div class="schalter-zeile"><span>Einladungen, Links zum Zurücksetzen und Hinweise werden über diesen Postausgang versendet.</span>' +
          (e.mailEingerichtet ? '<span class="chip">Eingerichtet</span>' : '<span class="chip chip-warnung">Nicht eingerichtet</span>') + '</div>' +
          '<div class="raster raster-2">' +
          '<div class="feld spalte-voll"><label for="m-host">SMTP-Server</label><input id="m-host" type="text" value="' + esc(s.host || '') + '" placeholder="z. B. w0123456.kasserver.com" autocomplete="off"></div>' +
          eingabe('m-port', 'Port', s.port, 'number', ' min="1" max="65535"') +
          auswahlFeld('m-verschl', 'Verschlüsselung', [{ wert: 'ssl', text: 'SSL/TLS' }, { wert: 'starttls', text: 'STARTTLS' }, { wert: 'keine', text: 'Keine' }], s.verschluesselung, undefined) +
          eingabe('m-benutzer', 'Benutzername', s.benutzer, 'text', ' autocomplete="off" placeholder="meist die E-Mail-Adresse"') +
          '<div class="feld"><label for="m-passwort">Passwort</label><input id="m-passwort" type="password" autocomplete="new-password" placeholder="' + (s.passwortGesetzt ? 'unverändert (gespeichert)' : '') + '">' +
          '<span class="hilfe">' + (s.passwortGesetzt ? 'Leer lassen, um das gespeicherte Passwort zu behalten.' : 'Wird verschlüsselt gespeichert.') + '</span></div>' +
          eingabe('m-absender', 'Absenderadresse', s.absender, 'email', ' placeholder="info@ruv-lernwelt.de"') +
          eingabe('m-absendername', 'Absendername', s.absenderName) + '</div>' +
          '<p class="klein-hinweis">Bei ALL-INKL: Server aus dem KAS (Postfach → Details), Port 465 mit SSL/TLS, Benutzername ist die vollständige E-Mail-Adresse.</p>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px"><button type="submit" class="knopf knopf-primaer">' + icon('speichern') + 'Speichern</button></div></form>' +
          '<form id="mt-form" class="stapel" style="gap:12px;border-top:1px solid var(--border);padding-top:16px;margin-top:16px" novalidate>' +
          '<div class="feld"><label for="mt-an">Test-E-Mail senden an</label><input id="mt-an" type="email" value="' + esc(store.ich.email) + '"></div>' +
          '<div><button type="submit" class="knopf knopf-rahmen" id="mt-knopf">' + icon('senden') + 'Test-E-Mail senden</button></div></form>') +
        karte('Datenhaltung', 'datenbank', '<div class="stapel" style="gap:16px">' +
          '<p style="margin:0">Alle Daten liegen in der MySQL-Datenbank. Jede Änderung wird als Version gespeichert und im Protokoll festgehalten.</p>' +
          '<dl class="felder">' + feld('Personas / Firmen / Formate', d.personas.length + ' / ' + d.firmen.length + ' / ' + d.formate.length) + '</dl>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
          '<button type="button" class="knopf knopf-primaer" id="e-export">' + icon('herunterladen') + 'Daten exportieren</button>' +
          '<label class="knopf knopf-rahmen" for="e-import">' + icon('hochladen') + 'Daten importieren</label>' +
          '<input id="e-import" type="file" accept="application/json,.json" hidden></div>' +
          '<p class="klein-hinweis">Der Export enthält alle Texte, Zuordnungen und Bilder als eine JSON-Datei. Ein Import ersetzt den gesamten Datenbestand; die bisherigen Stände bleiben als Versionen erhalten.</p></div>') +
        karte('Gelöschte Einträge', 'papierkorb', geloescht.length ? '<div class="liste">' + geloescht.map(function (g) {
          return '<div class="eintrag" style="flex-wrap:wrap"><span style="min-width:0;flex:1 1 200px"><span class="eintrag-titel">' + esc(g.name) + '</span><br><span class="eintrag-sub">' + esc(g.typName) + ' · gelöscht ' + esc(datumText(g.zeit)) + (g.benutzer ? ' von ' + esc(g.benutzer) : '') + '</span></span>' +
            '<button type="button" class="knopf knopf-rahmen knopf-klein" data-wiederherstellen="' + g.versionId + '">' + icon('wiederherstellen', 'icon-klein') + 'Wiederherstellen</button></div>';
        }).join('') + '</div>' : '<p class="leer">Keine gelöschten Einträge.</p>') +
        karte('Benutzerkonten', 'gruppe', '<div class="stapel" style="gap:12px"><p style="margin:0">Konten ohne Anmeldung seit 12 Monaten werden automatisch deaktiviert. Die Administration erhält 14 Tage vorher eine E-Mail mit den betroffenen Konten.</p>' +
          '<div><a class="knopf knopf-rahmen" href="#/benutzer">' + icon('gruppe') + 'Zur Benutzerverwaltung</a></div></div>') +
        karte('Hilfe', 'hilfe', '<div class="stapel" style="gap:16px"><p style="margin:0">Das Handbuch erklärt alle Funktionen Schritt für Schritt, auch Installation und Einrichtung bei ALL-INKL.</p>' +
          '<div style="display:flex;flex-wrap:wrap;gap:8px"><a class="knopf knopf-rahmen" href="handbuch.html" target="_blank" rel="noopener">' + icon('buch') + 'Handbuch öffnen</a>' +
          '<a class="knopf knopf-rahmen" href="handbuch.pdf" download>' + icon('herunterladen') + 'Handbuch als PDF</a></div></div>') +
        '</div>';

      document.getElementById('e-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var titel = wert('e-titel').trim();
        if (!titel) { toast('Bitte einen Titel eingeben.', true); return; }
        api('einstellungen-speichern', { appTitel: titel }).then(function () {
          store.daten.einstellungen.appTitel = titel;
          zeichneNavigation();
          toast('Titel gespeichert');
        }).catch(fehlerAnzeigen);
      });
      document.getElementById('m-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        api('einstellungen-speichern', { smtp: {
          host: wert('m-host').trim(), port: Number(wert('m-port')) || 465, verschluesselung: wert('m-verschl'),
          benutzer: wert('m-benutzer').trim(), passwort: wert('m-passwort'), absender: wert('m-absender').trim(), absenderName: wert('m-absendername').trim()
        } }).then(function () {
          toast('E-Mail-Einstellungen gespeichert');
          if (aktuell()) seiteEinstellungen(haupt);
        }).catch(fehlerAnzeigen);
      });
      document.getElementById('m-verschl').addEventListener('change', function (ev) {
        var port = document.getElementById('m-port');
        if (ev.target.value === 'ssl') port.value = 465;
        if (ev.target.value === 'starttls') port.value = 587;
      });
      document.getElementById('mt-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var fertig = knopfWarten(document.getElementById('mt-knopf'), 'Wird gesendet …');
        api('mail-test', { an: wert('mt-an').trim() }).then(function () {
          fertig();
          toast('Test-E-Mail gesendet. Bitte prüfen Sie das Postfach.');
        }).catch(function (err) { fertig(); fehlerAnzeigen(err); });
      });
      document.getElementById('e-export').addEventListener('click', function () {
        api('export').then(function (j) {
          delete j.ok;
          dateiHerunterladen('lernwelt_' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(j, null, 1));
          toast('Export erstellt');
        }).catch(fehlerAnzeigen);
      });
      document.getElementById('e-import').addEventListener('change', function (ev) {
        var datei = ev.target.files && ev.target.files[0];
        ev.target.value = '';
        if (!datei) return;
        var leser = new FileReader();
        leser.onload = function () {
          var neu;
          try { neu = JSON.parse(leser.result); } catch (err) { toast('Die Datei ist keine gültige JSON-Datei.', true); return; }
          if (!neu || !Array.isArray(neu.personas)) { toast('Die Datei enthält keine Persona-Daten.', true); return; }
          dialog({
            titel: 'Daten importieren?',
            text: 'Der gesamte Datenbestand wird durch den Inhalt der Datei ersetzt (' + neu.personas.length + ' Personas, ' + (neu.firmen || []).length + ' Firmen, ' + (neu.formate || []).length + ' Formate). Die bisherigen Stände bleiben als Versionen erhalten.',
            ok: 'Importieren'
          }).then(function (ja) {
            if (!ja) return;
            serverAenderung('import', neu, 'Daten importiert').then(function (j) { if (j && aktuell()) seiteEinstellungen(haupt); });
          });
        };
        leser.readAsText(datei, 'utf-8');
      });
      haupt.querySelectorAll('[data-wiederherstellen]').forEach(function (k) {
        k.addEventListener('click', function () {
          serverAenderung('wiederherstellen', { versionId: Number(k.getAttribute('data-wiederherstellen')) }, 'Eintrag wiederhergestellt').then(function (j) {
            if (j) gehe({ persona: '/personas/', firma: '/firmen/', format: '/formate/' }[j.typ] + j.id);
          });
        });
      });
    }).catch(fehlerAnzeigen);
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
    listenerRegistrieren();
    var eingebettet = eingebetteteDaten();
    if (eingebettet) {
      store.modus = 'vorschau';
      store.ich = { vorname: 'Vorschau', nachname: '', rolleName: 'nur lesen', rechte: [] };
      store.daten = datenNormalisieren(eingebettet);
      return appStarten();
    }
    api('status').then(function (j) {
      if (!j.eingerichtet) return zeigeEinrichtung(j.ersterAdmin || '');
      store.appTitel = j.appTitel || store.appTitel;
      if (j.ich && !TOKEN_ROUTEN.test(rohPfad())) {
        store.ich = j.ich;
        return datenLaden().then(appStarten);
      }
      oeffentlichRouten();
    }).catch(function (e) {
      fehlerSeite(e.message + ' Prüfen Sie die Konfiguration auf dem Server (siehe Handbuch, Kapitel Installation).');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
