// Browser-Test der Oberfläche gegen einen frischen Testserver (tools/test/test_starten.sh).
// Aufruf: NODE_PATH=$(npm root -g) node ui_test.js <basis-url> <mails.jsonl> [bilder-ordner]
const { chromium } = require('playwright');
const fs = require('fs');
const [URL, MAILS, BILDER] = process.argv.slice(2);
const fehler = [];
let schritt = 0;
function pruefe(ok, text) { console.log((ok ? 'OK     ' : 'FEHLER ') + text); if (!ok) fehler.push(text); }
function link(an, art) {
  const mails = fs.readFileSync(MAILS, 'utf8').split('\n').filter(Boolean).map(JSON.parse).reverse();
  for (const m of mails) { const t = m.an === an && m.text.match(new RegExp('#/' + art + '/([A-Za-z0-9_-]+)')); if (t) return t[1]; }
  return null;
}

(async () => {
  const browser = await chromium.launch();
  async function seite(opt) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1360, height: 900 } }, opt || {}));
    const p = await ctx.newPage();
    p.on('pageerror', e => fehler.push('JS-Fehler: ' + e.message));
    p.on('console', m => { if (m.type() === 'error' && !/40[0139]|429/.test(m.text())) fehler.push('Konsole: ' + m.text()); });
    return p;
  }
  async function foto(p, name) { if (BILDER) await p.screenshot({ path: BILDER + '/' + String(++schritt).padStart(2, '0') + '-' + name + '.png', fullPage: false }); }

  // --- Erst-Einrichtung
  const admin = await seite();
  await admin.goto(URL);
  await admin.waitForSelector('#er-form');
  pruefe(await admin.inputValue('#er-email') === 'michael.herget@ruv.de', 'Einrichtung zeigt die E-Mail des ersten Admins');
  await foto(admin, 'einrichtung');
  await admin.fill('#er-code', 'code-123-test');
  await admin.fill('#er-vorname', 'Michael'); await admin.fill('#er-nachname', 'Herget');
  await admin.type('#er-org', 'vhvp');
  pruefe(await admin.inputValue('#er-org') === 'VH-VP', 'Org-Einheit wird automatisch formatiert (vhvp → VH-VP)');
  await admin.fill('#er-pw', 'EinSicheresPasswort-2026'); await admin.fill('#er-pw2', 'EinSicheresPasswort-2026');
  await admin.click('#er-knopf');
  await admin.waitForSelector('#m-form');
  pruefe((await admin.textContent('.toast')).includes('52 Personas'), 'Einrichtung übernimmt die Startdaten');
  await foto(admin, 'einstellungen');

  // E-Mail-Versand (Testmodus: Datei)
  await admin.fill('#m-host', 'datei'); await admin.fill('#m-absender', 'info@ruv-lernwelt.de');
  await admin.click('#m-form button[type=submit]');
  await admin.waitForSelector('.chip >> text=Eingerichtet');
  pruefe(true, 'E-Mail-Versand eingerichtet');

  // --- Einladung Mediengestalterin
  await admin.click('.nav >> text=Benutzer');
  await admin.waitForSelector('.tabelle');
  await admin.click('text=Person einladen');
  await admin.fill('#ein-email', 'mia@example.org'); await admin.fill('#ein-vorname', 'Mia'); await admin.fill('#ein-nachname', 'Gestalter');
  await admin.type('#ein-org', 'VHVPTV');
  await admin.selectOption('#ein-rolle', 'mediengestalter');
  await foto(admin, 'einladen');
  await admin.click('#ein-knopf');
  await admin.waitForSelector('.tabelle >> text=mia@example.org');
  pruefe(await admin.isVisible('tr:has-text("mia@example.org") .chip:has-text("Eingeladen")'), 'Einladung erscheint als „Eingeladen“');
  await foto(admin, 'benutzerliste');

  const mg = await seite();
  await mg.goto(URL + '#/einladung/' + link('mia@example.org', 'einladung'));
  await mg.waitForSelector('#ea-form');
  pruefe((await mg.textContent('.anmeldung')).includes('Mediengestalter'), 'Einladungsseite nennt die Rolle');
  await foto(mg, 'einladung-annehmen');
  await mg.fill('#ea-pw', 'kurz'); await mg.fill('#ea-pw2', 'kurz'); await mg.click('#ea-knopf');
  pruefe((await mg.textContent('#ea-fehler')).startsWith('Fehler:'), 'Zu kurzes Passwort mit „Fehler:“ gemeldet');
  await mg.fill('#ea-pw', 'Mediengestalterin-2026'); await mg.fill('#ea-pw2', 'Mediengestalterin-2026'); await mg.click('#ea-knopf');
  await mg.waitForSelector('.kachel');
  const navMg = await mg.textContent('.nav-liste');
  pruefe(navMg.includes('Benutzer') && !navMg.includes('Einstellungen') && !navMg.includes('Protokoll'), 'Mediengestalterin: Benutzer ja, Einstellungen/Protokoll nein');
  await mg.goto(URL + '#/einstellungen'); await mg.waitForTimeout(300);
  pruefe(!(await mg.isVisible('#m-form')), 'Mediengestalterin kommt nicht in die Einstellungen');

  // Persona bearbeiten als Mediengestalterin
  await mg.goto(URL + '#/personas/1/bearbeiten'); await mg.waitForSelector('#persona-form');
  await mg.fill('#pf-beruf', 'Rentner (Braumeister)');
  await mg.click('#persona-form button[type=submit]');
  await mg.waitForSelector('.profil h1');
  pruefe((await mg.textContent('.geaendert')).includes('Mia Gestalter'), 'Detailseite zeigt „Zuletzt geändert von Mia Gestalter“');
  await foto(mg, 'detail-geaendert');

  // Mediengestalterin lädt Nutzer ein
  await mg.click('.nav >> text=Benutzer'); await mg.waitForSelector('.tabelle');
  pruefe(await mg.locator('.tabelle a:has-text("Bearbeiten")').count() === 0, 'Mediengestalterin sieht keine Bearbeiten-Knöpfe bei Konten');
  await mg.click('text=Person einladen');
  pruefe(!(await mg.isVisible('select#ein-rolle')) && (await mg.textContent('#ein-form')).includes('Nutzer'), 'Mediengestalterin kann nur „Nutzer“ einladen');
  await mg.fill('#ein-email', 'nora@example.org'); await mg.fill('#ein-vorname', 'Nora'); await mg.fill('#ein-nachname', 'Nutzer'); await mg.type('#ein-org', 'VH');
  await mg.click('#ein-knopf'); await mg.waitForSelector('.tabelle >> text=nora@example.org');

  // --- Nutzerin: nur lesen
  const nutzer = await seite();
  await nutzer.goto(URL + '#/einladung/' + link('nora@example.org', 'einladung'));
  await nutzer.waitForSelector('#ea-form');
  await nutzer.fill('#ea-pw', 'Nutzerin-Passwort-26'); await nutzer.fill('#ea-pw2', 'Nutzerin-Passwort-26'); await nutzer.click('#ea-knopf');
  await nutzer.waitForSelector('.kachel');
  pruefe(!(await nutzer.isVisible('text=Neue Persona')), 'Nutzerin: kein „Neue Persona“');
  await nutzer.goto(URL + '#/personas/1'); await nutzer.waitForSelector('.profil h1');
  pruefe(!(await nutzer.isVisible('text=Bearbeiten')) && !(await nutzer.isVisible('#p-loeschen')) && await nutzer.isVisible('text=Versionen'), 'Nutzerin: Detailseite ohne Bearbeiten/Löschen, mit Versionen');
  pruefe(!(await nutzer.textContent('.nav-liste')).includes('Benutzer'), 'Nutzerin: kein Menüpunkt Benutzer');
  await foto(nutzer, 'nutzerin-detail');
  await nutzer.goto(URL + '#/personas/1/bearbeiten'); await nutzer.waitForTimeout(400);
  pruefe(!(await nutzer.isVisible('#persona-form')), 'Nutzerin kommt nicht ins Formular');

  // --- Versionen
  await admin.goto(URL + '#/personas/1/versionen'); await admin.waitForSelector('.version-eintrag');
  pruefe(await admin.locator('.version-eintrag').count() === 2, 'Zwei Versionen (Übernahme, Änderung)');
  await admin.click('.version-eintrag >> nth=1');
  pruefe(await admin.locator('.zeile-anders').count() >= 1, 'Älterer Stand: Abweichung markiert');
  await foto(admin, 'versionen');
  await admin.click('#v-wiederherstellen'); await admin.click('.dialog [data-antwort="ja"]');
  await admin.waitForSelector('.profil h1');
  pruefe(!(await admin.textContent('.unterzeile')).includes('Braumeister'), 'Alter Stand wiederhergestellt');

  // --- Löschen und Wiederherstellen
  await admin.goto(URL + '#/firmen/2'); await admin.waitForSelector('.profil h1');
  const firmaName = await admin.textContent('.profil h1');
  await admin.click('#f-loeschen'); await admin.click('.dialog [data-antwort="ja"]');
  await admin.waitForSelector('.kachel-breit');
  await admin.click('.nav >> text=Einstellungen'); await admin.waitForSelector('[data-wiederherstellen]');
  pruefe((await admin.textContent('.raster-karten')).includes(firmaName), 'Gelöschte Firma in „Gelöschte Einträge“');
  await admin.click('[data-wiederherstellen]'); await admin.waitForSelector('.profil h1');
  pruefe(await admin.textContent('.profil h1') === firmaName, 'Firma wiederhergestellt');

  // --- Protokoll
  await admin.click('.nav >> text=Protokoll'); await admin.waitForSelector('.tabelle');
  const prot = await admin.textContent('.tabelle');
  pruefe(prot.includes('gelöscht') && prot.includes('eingeladen'), 'Protokoll zeigt Löschung und Einladungen');
  await foto(admin, 'protokoll');

  // --- Passwort vergessen
  const gast = await seite();
  await gast.goto(URL); await gast.waitForSelector('#anmelde-form');
  await foto(gast, 'anmeldung');
  await gast.click('text=Passwort vergessen?'); await gast.waitForSelector('#pv-form');
  await gast.fill('#pv-email', 'nora@example.org'); await gast.click('#pv-knopf');
  await gast.waitForSelector('#pv-inhalt .anmeldung-hinweis');
  await gast.goto(URL + '#/passwort-neu/' + link('nora@example.org', 'passwort-neu'));
  await gast.waitForSelector('#pn-form');
  await gast.fill('#pn-pw', 'Neues-Passwort-Nora-1'); await gast.fill('#pn-pw2', 'Neues-Passwort-Nora-1'); await gast.click('#pn-knopf');
  await gast.waitForSelector('.kachel');
  pruefe(true, 'Passwort vergessen: neues Passwort gesetzt, direkt angemeldet');
  await nutzer.reload(); await nutzer.waitForSelector('#anmelde-form');
  pruefe(true, 'Alte Sitzung der Nutzerin wurde beendet');

  // Anmeldung mit falschem Passwort
  await nutzer.fill('#anm-email', 'nora@example.org'); await nutzer.fill('#anm-passwort', 'falsch-falsch'); await nutzer.click('#anm-knopf');
  await nutzer.waitForSelector('#anm-fehler:not([hidden])');
  pruefe((await nutzer.textContent('#anm-fehler')) === 'Fehler: E-Mail-Adresse oder Passwort ist falsch.', 'Falsches Passwort: allgemeine Meldung');
  await foto(nutzer, 'anmeldung-fehler');
  await nutzer.fill('#anm-passwort', 'Neues-Passwort-Nora-1'); await nutzer.click('#anm-knopf'); await nutzer.waitForSelector('.nav-konto');

  // --- Mein Konto
  await nutzer.click('.nav-konto'); await nutzer.waitForSelector('#k-form');
  await nutzer.fill('#k-vorname', 'Nora Maria'); await nutzer.click('#k-form button[type=submit]');
  await nutzer.waitForSelector('.toast >> text=Name gespeichert');
  pruefe((await nutzer.textContent('.nav-konto-name')).includes('Nora Maria'), 'Name im Konto geändert, Navigation aktualisiert');
  await foto(nutzer, 'konto');

  // --- Admin bearbeitet Konto: Rolle ändern
  await admin.goto(URL + '#/benutzer'); await admin.waitForSelector('.tabelle');
  await admin.click('tr:has-text("nora@example.org") >> text=Bearbeiten'); await admin.waitForSelector('#bb-form');
  await admin.selectOption('#bb-rolle', 'designer'); await admin.click('#bb-knopf');
  await admin.waitForSelector('.tabelle >> text=Designer');
  await nutzer.reload(); await nutzer.waitForSelector('#anmelde-form');
  pruefe(true, 'Rollenänderung meldet die Person ab');

  // --- Mobil
  const m = await seite({ viewport: { width: 390, height: 844 } });
  await m.context().addCookies(await admin.context().cookies());
  await m.goto(URL + '#/benutzer'); await m.waitForSelector('.tabelle');
  pruefe(await m.evaluate(() => document.documentElement.scrollWidth) <= 390, 'Mobil: Seite scrollt nicht seitlich');
  await foto(m, 'mobil-benutzer');

  console.log(fehler.length ? '\nFehler:\n' + fehler.join('\n') : '\n0 Fehler');
  await browser.close();
  process.exit(fehler.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
