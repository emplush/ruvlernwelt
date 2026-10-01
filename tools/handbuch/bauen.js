// Bildschirmfotos für das Handbuch und PDF-Fassung. Aufruf über bauen.sh.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const [URL, ZIEL, KOPIE] = process.argv.slice(2);
const BILDER = path.join(ZIEL, 'handbuch');

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

  const p = await neueSeite();
  await p.goto(URL);
  await p.waitForSelector('#anmelde-form');
  await foto(p, 'anmeldung.jpg');
  await p.fill('#anm-passwort', 'RuVTest1234');
  await p.click('#anm-knopf');
  await p.waitForSelector('.kachel');
  await foto(p, 'liste.jpg');

  await p.goto(URL + '#/personas/1');
  await p.waitForSelector('.portrait img');
  await foto(p, 'detail.jpg');

  await p.goto(URL + '#/personas/1/bearbeiten');
  await p.waitForSelector('#persona-form');
  await foto(p, 'formular.jpg');
  await p.setInputFiles('#pf-bilddatei', path.join(KOPIE, 'App_Data', 'bilder', '1022.jpg'));
  await p.waitForSelector('.zuschnitt canvas');
  await p.fill('#zs-zoom', '1.3');
  await foto(p, 'zuschnitt.jpg');
  await p.click('[data-zs="abbrechen"]');

  await p.goto(URL + '#/personas/1');
  await p.waitForSelector('#bez-hinzu');
  await p.click('#bez-hinzu');
  await p.selectOption('#bez-person', { label: 'Heidrun Düring' });
  await p.fill('#bez-verh', 'Ehefrau');
  await p.fill('#bez-gegen', 'Ehemann');
  const familie = p.locator('section.karte', { has: p.locator('#bez-neu') });
  await familie.scrollIntoViewIfNeeded();
  await foto(p, 'familie.jpg', familie);

  await p.goto(URL + '#/firmen');
  await p.waitForSelector('.kachel-breit');
  await foto(p, 'firmen.jpg');

  await p.goto(URL + '#/formate/neu');
  await p.waitForSelector('#format-form');
  await p.fill('#fo-name', 'Hausrat kompakt');
  await p.selectOption('#fo-typ-feld', 'Video');
  await p.fill('#fo-nummer', '7');
  await p.fill('#fo-medienentwickler', 'Max Mustermann');
  await p.fill('#fo-psuche', 'düring');
  await p.locator('#fo-personen input:visible').first().check();
  await p.evaluate(() => window.scrollTo(0, 260));
  await foto(p, 'format.jpg');

  await p.goto(URL + '#/einstellungen');
  await p.waitForSelector('#e-form');
  await foto(p, 'einstellungen.jpg');

  const cookies = await p.context().cookies();
  const m = await neueSeite({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  await m.context().addCookies(cookies);
  await m.goto(URL);
  await m.waitForSelector('.kachel');
  await foto(m, 'mobil.jpg');

  // PDF aus der Handbuch-Seite (Bilder des aktuellen Laufs)
  fs.cpSync(BILDER, path.join(KOPIE, 'handbuch'), { recursive: true });
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
