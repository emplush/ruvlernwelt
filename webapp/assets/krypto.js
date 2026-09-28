/* SHA-256, HMAC-SHA256 und PBKDF2-HMAC-SHA256 in reinem JavaScript.
 * Nötig, weil Browser die Web Crypto API (crypto.subtle) nur über HTTPS anbieten.
 * Das Passwort verlässt den Browser nie: Übertragen wird nur ein Beweis
 * HMAC(PBKDF2(Passwort, Salt), Einmalwert).
 */
(function (global) {
  'use strict';

  var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  var W = new Uint32Array(64);

  function sha256(daten) {
    var laenge = daten.length;
    var bloecke = ((laenge + 9 + 63) >> 6) << 6;
    var puffer = new Uint8Array(bloecke);
    puffer.set(daten);
    puffer[laenge] = 0x80;
    var bits = laenge * 8;
    var ansicht = new DataView(puffer.buffer);
    ansicht.setUint32(bloecke - 8, Math.floor(bits / 0x100000000));
    ansicht.setUint32(bloecke - 4, bits >>> 0);

    var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    var h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    for (var o = 0; o < bloecke; o += 64) {
      var i;
      for (i = 0; i < 16; i++) W[i] = ansicht.getUint32(o + i * 4);
      for (i = 16; i < 64; i++) {
        var x = W[i - 15], y = W[i - 2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
      }
      var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (i = 0; i < 64; i++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var t1 = (h + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
    }
    var aus = new Uint8Array(32);
    var av = new DataView(aus.buffer);
    [h0, h1, h2, h3, h4, h5, h6, h7].forEach(function (v, n) { av.setUint32(n * 4, v >>> 0); });
    return aus;
  }

  function verbinden(a, b) {
    var c = new Uint8Array(a.length + b.length);
    c.set(a);
    c.set(b, a.length);
    return c;
  }

  // Liefert eine HMAC-Funktion mit vorbereiteten Innen-/Außenschlüsseln.
  function hmacMit(schluessel) {
    if (schluessel.length > 64) schluessel = sha256(schluessel);
    var innen = new Uint8Array(64), aussen = new Uint8Array(64);
    for (var i = 0; i < 64; i++) {
      var k = i < schluessel.length ? schluessel[i] : 0;
      innen[i] = k ^ 0x36;
      aussen[i] = k ^ 0x5c;
    }
    return function (nachricht) {
      return sha256(verbinden(aussen, sha256(verbinden(innen, nachricht))));
    };
  }

  function hmac(schluessel, nachricht) {
    return hmacMit(schluessel)(nachricht);
  }

  // PBKDF2-HMAC-SHA256 mit 32 Byte Ausgabe (ein Block)
  function pbkdf2(passwort, salt, iterationen) {
    var prf = hmacMit(passwort);
    var u = prf(verbinden(salt, new Uint8Array([0, 0, 0, 1])));
    var t = u.slice();
    for (var i = 1; i < iterationen; i++) {
      u = prf(u);
      for (var j = 0; j < 32; j++) t[j] ^= u[j];
    }
    return t;
  }

  function utf8(text) {
    return new TextEncoder().encode(text);
  }
  function hexZuBytes(hex) {
    var aus = new Uint8Array(hex.length / 2);
    for (var i = 0; i < aus.length; i++) aus[i] = parseInt(hex.substr(i * 2, 2), 16);
    return aus;
  }
  function bytesZuHex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16);
    return s;
  }

  global.LernweltKrypto = {
    sha256: sha256, hmac: hmac, pbkdf2: pbkdf2,
    utf8: utf8, hexZuBytes: hexZuBytes, bytesZuHex: bytesZuHex
  };
})(typeof window !== 'undefined' ? window : globalThis);
