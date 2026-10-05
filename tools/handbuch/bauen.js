// Bildschirmfotos für das Handbuch und PDF-Fassung. Aufruf über bauen.sh.
// Richtet eine frische Testumgebung ein (Admin, Mediengestalterin, Nutzer) und fotografiert alle Ansichten.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const [URL, ZIEL, ARBEIT] = process.argv.slice(2);
const BILDER = path.join(ZIEL, 'handbuch');
const MAILS = path.join(ARBEIT, 'mails.jsonl');
const PW_ADMIN = 'EinSicheresPasswort-2026';

function link(an, art) {
  const mails = fs.readFileSync(MAILS, 'utf8').split('\n').filter(Boolean).map(JSON.parse).reverse();
  for (const m of mails) { const t = m.an === an && m.text.match(new RegExp('#/' + art + '/([A-Za-z0-9_-]+)')); if (t) return t[1]; }
  throw new Error('Kein Link ' + art + ' für ' + an);
}

(async () => {
  fs.mkdirSync(BILDER, { recursive: true });
  const browser = await chromium.launch();
  const fehler = [];
  async function neueSeite(opt) {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: 1280, height: 800 }, colorScheme: 'light' }, opt));
    const p = await ctx.newPage();
    p.on('pageerror', e => fehler.push(e.message));
    return p;
  }
  async function foto(p, name, ziel) {
    await p.waitForTimeout(400);
    await (ziel || p).screenshot({ path: path.join(BILDER, name), type: 'jpeg', quality: 82 });
    console.log('Bild', name);
  }
  async function einladen(p, email, vorname, nachname, org, rolle) {
    await p.goto(URL + '#/benutzer/einladen'); await p.waitForSelector('#ein-form');
    await p.fill('#ein-email', email); await p.fill('#ein-vorname', vorname); await p.fill('#ein-nachname', nachname);
    await p.type('#ein-org', org);
    if (rolle) await p.selectOption('#ein-rolle', rolle);
  }

  // Einrichtung und E-Mail-Versand (Testmodus: Datei)
  const p = await neueSeite();
  await p.goto(URL); await p.waitForSelector('#er-form');
  await p.fill('#er-code', 'code-123-test');
  await p.fill('#er-vorname', 'Michael'); await p.fill('#er-nachname', 'Herget'); await p.type('#er-org', 'VHVP');
  await p.fill('#er-pw', PW_ADMIN); await p.fill('#er-pw2', PW_ADMIN);
  await p.click('#er-knopf'); await p.waitForSelector('#m-form');
  await p.fill('#m-host', 'datei'); await p.fill('#m-absender', 'info@ruv-lernwelt.de'); await p.fill('#m-absendername', 'R+V Lernwelt');
  await p.click('#m-form button[type=submit]'); await p.waitForSelector('.chip >> text=Eingerichtet');

  // Ein paar Konten, damit die Benutzerverwaltung nach etwas aussieht
  await einladen(p, 'mia.gestalter@ruv.de', 'Mia', 'Gestalter', 'VHVPTV', 'mediengestalter');
  await foto(p, 'einladen.jpg');
  await p.click('#ein-knopf'); await p.waitForSelector('.tabelle >> text=mia.gestalter@ruv.de');
  await einladen(p, 'david.design@ruv.de', 'David', 'Design', 'VHVPTVPR', 'designer');
  await p.click('#ein-knopf'); await p.waitForSelector('.tabelle >> text=david.design@ruv.de');
  await einladen(p, 'nora.nutzer@ruv.de', 'Nora', 'Nutzer', 'VH', 'nutzer');
  await p.click('#ein-knopf'); await p.waitForSelector('.tabelle >> text=nora.nutzer@ruv.de');

  // Einladung annehmen (Mediengestalterin) und Designer
  const mg = await neueSeite();
  await mg.goto(URL + '#/einladung/' + link('mia.gestalter@ruv.de', 'einladung')); await mg.waitForSelector('#ea-form');
  await mg.fill('#ea-pw', 'Mediengestalterin-2026'); await mg.fill('#ea-pw2', 'Mediengestalterin-2026');
  await foto(mg, 'einladung.jpg');
  await mg.click('#ea-knopf'); await mg.waitForSelector('.kachel');
  const de = await neueSeite();
  await de.goto(URL + '#/einladung/' + link('david.design@ruv.de', 'einladung')); await de.waitForSelector('#ea-form');
  await de.fill('#ea-pw', 'Designer-Passwort-26'); await de.fill('#ea-pw2', 'Designer-Passwort-26');
  await de.click('#ea-knopf'); await de.waitForSelector('.kachel');

  // Mediengestalterin ändert eine Persona → Versionen und „zuletzt geändert von“
  await mg.goto(URL + '#/personas/1/bearbeiten'); await mg.waitForSelector('#persona-form');
  await mg.fill('#pf-beruf', 'Rentner (Braumeister)');
  await mg.click('#persona-form button[type=submit]'); await mg.waitForSelector('.geaendert');

  // Anmeldung (frischer Browser)
  const gast = await neueSeite();
  await gast.goto(URL); await gast.waitForSelector('#anmelde-form');
  await gast.fill('#anm-email', 'michael.herget@ruv.de');
  await foto(gast, 'anmeldung.jpg');

  // Daten-Ansichten als Admin
  await p.goto(URL + '#/personas'); await p.waitForSelector('.kachel');
  await foto(p, 'liste.jpg');
  await p.goto(URL + '#/personas/1'); await p.waitForSelector('.portrait img');
  await foto(p, 'detail.jpg');
  await p.goto(URL + '#/personas/1/versionen'); await p.waitForSelector('.version-eintrag');
  await p.click('.version-eintrag >> nth=1'); await p.waitForSelector('.zeile-anders');
  await foto(p, 'versionen.jpg');

  await p.goto(URL + '#/personas/1/bearbeiten'); await p.waitForSelector('#persona-form');
  await foto(p, 'formular.jpg');
  await p.setInputFiles('#pf-bilddatei', path.join(ARBEIT, 'webapp', 'einrichtung', 'startdaten', 'bilder', '1022.jpg'));
  await p.waitForSelector('.zuschnitt canvas');
  await p.fill('#zs-zoom', '1.3');
  await foto(p, 'zuschnitt.jpg');
  await p.click('[data-zs="abbrechen"]');

  await p.goto(URL + '#/personas/1'); await p.waitForSelector('#bez-hinzu');
  await p.click('#bez-hinzu');
  await p.selectOption('#bez-person', { label: 'Heidrun Düring' });
  await p.fill('#bez-verh', 'Ehefrau'); await p.fill('#bez-gegen', 'Ehemann');
  const familie = p.locator('section.karte', { has: p.locator('#bez-neu') });
  await familie.scrollIntoViewIfNeeded();
  await foto(p, 'familie.jpg', familie);

  // Galerie: Varianten des Profilbilds per Drag & Drop hochladen
  await p.goto(URL + '#/personas/1'); await p.waitForSelector('#gal-upload');
  await p.click('#bez-abbrechen').catch(() => {});
  const varianten = await p.evaluateHandle(async () => {
    const quelle = document.querySelector('.portrait img').src;
    const img = await new Promise((ok, fehler) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fehler; i.src = quelle; });
    const dt = new DataTransfer();
    const machen = async (name, typ, malen, b, h) => {
      const c = document.createElement('canvas'); c.width = b; c.height = h; malen(c.getContext('2d'), b, h);
      const blob = await new Promise(r => c.toBlob(r, typ, 0.9));
      dt.items.add(new File([blob], name, { type: typ }));
    };
    const w = img.naturalWidth, hh = img.naturalHeight;
    await machen('Ottmar Düring – Porträt.jpg', 'image/jpeg', (x) => x.drawImage(img, 0, 0), w, hh);
    await machen('Ottmar gespiegelt.jpg', 'image/jpeg', (x, b) => { x.translate(b, 0); x.scale(-1, 1); x.drawImage(img, 0, 0); }, w, hh);
    await machen('Ottmar Nahaufnahme.jpg', 'image/jpeg', (x, b, h) => x.drawImage(img, w * 0.2, 0, w * 0.6, w * 0.6, 0, 0, b, h), 600, 600);
    await machen('Ottmar Hintergrund Sand.png', 'image/png', (x, b, h) => { x.fillStyle = '#fff4e0'; x.fillRect(0, 0, b, h); x.globalCompositeOperation = 'multiply'; x.drawImage(img, (b - w) / 2, h - hh); }, 1200, hh);
    await machen('Ottmar Hintergrund Mint.png', 'image/png', (x, b, h) => { x.fillStyle = '#00dcdc'; x.fillRect(0, 0, b, h); x.globalCompositeOperation = 'multiply'; x.drawImage(img, (b - w) / 2, h - hh); }, 1200, hh);
    return dt;
  });
  await p.dispatchEvent('#gal-upload', 'dragenter', { dataTransfer: varianten });
  await p.dispatchEvent('#gal-upload', 'drop', { dataTransfer: varianten });
  await p.waitForSelector('#gal-fazit:has-text("5 Bilder hochgeladen")', { timeout: 30000 });
  await p.check('[data-gal-wahl] >> nth=1'); await p.check('[data-gal-wahl] >> nth=3');
  const galerie = p.locator('#galerie');
  await galerie.scrollIntoViewIfNeeded();
  await foto(p, 'galerie.jpg', galerie);
  await p.click('[data-gal-oeffnen="4"]'); await p.waitForSelector('.leuchtkasten img');
  await p.click('[data-lk="beschreiben"]'); await p.fill('#lk-text', 'Porträt in voller Größe, Standardpose');
  await p.click('#lk-form button[type=submit]'); await p.waitForSelector('.leuchtkasten-text');
  await p.waitForSelector('.toast', { state: 'detached' });
  await foto(p, 'galerie-gross.jpg');
  await p.keyboard.press('Escape');

  await p.goto(URL + '#/firmen'); await p.waitForSelector('.kachel-breit');
  await foto(p, 'firmen.jpg');

  await p.goto(URL + '#/formate/neu'); await p.waitForSelector('#format-form');
  await p.fill('#fo-name', 'Hausrat kompakt');
  await p.selectOption('#fo-typ-feld', 'Video');
  await p.fill('#fo-nummer', '7');
  await p.fill('#fo-medienentwickler', 'Max Mustermann');
  await p.fill('#fo-psuche', 'düring');
  await p.locator('#fo-personen input:visible').first().check();
  await p.evaluate(() => window.scrollTo(0, 260));
  await foto(p, 'format.jpg');

  // Verwaltung
  await p.goto(URL + '#/benutzer'); await p.waitForSelector('.tabelle >> text=nora.nutzer@ruv.de');
  await foto(p, 'benutzer.jpg');
  await p.goto(URL + '#/protokoll'); await p.waitForSelector('.tabelle');
  await foto(p, 'protokoll.jpg');
  await p.goto(URL + '#/einstellungen'); await p.waitForSelector('#m-form');
  await foto(p, 'einstellungen.jpg');

  // Mein Konto aus Sicht des Designers
  await de.goto(URL + '#/konto'); await de.waitForSelector('#k-form');
  await foto(de, 'konto.jpg');

  // Mobil
  const m = await neueSeite({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  await m.context().addCookies(await p.context().cookies());
  await m.goto(URL + '#/personas'); await m.waitForSelector('.kachel');
  await foto(m, 'mobil.jpg');

  // PDF aus der Handbuch-Seite (Bilder des aktuellen Laufs)
  fs.cpSync(BILDER, path.join(ARBEIT, 'webapp', 'handbuch'), { recursive: true });
  const h = await neueSeite();
  await h.goto(URL + 'handbuch.html', { waitUntil: 'networkidle' });
  // Bilder sind auf der Seite "lazy"; für das PDF alle sofort laden
  await h.evaluate(async () => {
    const bilder = Array.from(document.images);
    bilder.forEach(b => { b.loading = 'eager'; });
    await Promise.all(bilder.map(b => b.complete && b.naturalWidth ? null : new Promise(r => { b.onload = b.onerror = r; })));
    await document.fonts.ready;
  });
  await h.pdf({
    path: path.join(ZIEL, 'handbuch.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font:9px Arial;color:#707070;text-align:center">Handbuch Persona-Datenbank · Seite <span class="pageNumber"></span> von <span class="totalPages"></span></div>'
  });
  console.log('PDF', path.join(ZIEL, 'handbuch.pdf'));
  if (fehler.length) { console.error('Fehler in der Seite:', fehler); process.exitCode = 1; }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
