-- Datenbankschema der Persona-Datenbank (MySQL 5.7+ / MariaDB 10.3+, utf8mb4).
-- Wird bei der Einrichtung automatisch ausgeführt; alle Anweisungen sind wiederholbar.

CREATE TABLE IF NOT EXISTS benutzer (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  vorname VARCHAR(100) NOT NULL DEFAULT '',
  nachname VARCHAR(100) NOT NULL DEFAULT '',
  org_einheit VARCHAR(11) NOT NULL DEFAULT '',
  rolle VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL,
  passwort_hash VARCHAR(255) NULL,
  erstellt_am DATETIME NOT NULL,
  erstellt_von INT UNSIGNED NULL,
  aktiviert_am DATETIME NULL,
  letzte_anmeldung DATETIME NULL,
  inaktiv_gewarnt_am DATETIME NULL,
  UNIQUE KEY uk_benutzer_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Einmal-Links (Einladung, Passwort zurücksetzen, E-Mail bestätigen); gespeichert wird nur der SHA-256-Hash
CREATE TABLE IF NOT EXISTS tokens (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  benutzer_id INT UNSIGNED NOT NULL,
  zweck VARCHAR(20) NOT NULL,
  neue_email VARCHAR(190) NULL,
  erstellt_am DATETIME NOT NULL,
  ablauf DATETIME NOT NULL,
  verwendet_am DATETIME NULL,
  UNIQUE KEY uk_tokens_hash (token_hash),
  KEY ix_tokens_benutzer (benutzer_id, zweck)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sitzungen; der Cookie enthält das Geheimnis, gespeichert wird nur dessen Hash
CREATE TABLE IF NOT EXISTS sitzungen (
  id CHAR(64) NOT NULL PRIMARY KEY,
  benutzer_id INT UNSIGNED NOT NULL,
  csrf CHAR(64) NOT NULL,
  erstellt_am DATETIME NOT NULL,
  zuletzt_aktiv DATETIME NOT NULL,
  ip VARCHAR(45) NOT NULL DEFAULT '',
  user_agent VARCHAR(255) NOT NULL DEFAULT '',
  KEY ix_sitzungen_benutzer (benutzer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Drosselung von Anmeldung, Passwort-vergessen und Einladungen
CREATE TABLE IF NOT EXISTS drosselung (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  schluessel VARCHAR(190) NOT NULL,
  zeit DATETIME NOT NULL,
  KEY ix_drosselung (schluessel, zeit)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS einstellungen (
  schluessel VARCHAR(64) NOT NULL PRIMARY KEY,
  wert TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS bilder (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  mime VARCHAR(40) NOT NULL,
  daten MEDIUMBLOB NOT NULL,
  erstellt_am DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS personas (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  persona_id INT NULL,
  vorname VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  gruppe VARCHAR(100) NULL,
  funktion VARCHAR(255) NULL,
  kundenprofil VARCHAR(100) NULL,
  c_journey VARCHAR(50) NULL,
  geschlecht VARCHAR(50) NULL,
  herkunft VARCHAR(255) NULL,
  geburtstag VARCHAR(50) NULL,
  alter_jahre INT NULL,
  strasse VARCHAR(255) NULL,
  plz VARCHAR(20) NULL,
  ort VARCHAR(255) NULL,
  stadtteil VARCHAR(255) NULL,
  beruf VARCHAR(255) NULL,
  familienstand VARCHAR(100) NULL,
  wohnart VARCHAR(255) NULL,
  verwandt TEXT NULL,
  lebenslauf TEXT NULL,
  aktivitaeten TEXT NULL,
  charakter TEXT NULL,
  sonstiges TEXT NULL,
  woc_stimme VARCHAR(255) NULL,
  did_avatar VARCHAR(255) NULL,
  bilder_link TEXT NULL,
  bild_id INT UNSIGNED NULL,
  bild_gross_id INT UNSIGNED NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  erstellt_am DATETIME NOT NULL,
  geaendert_am DATETIME NOT NULL,
  geaendert_von INT UNSIGNED NULL,
  geaendert_von_name VARCHAR(201) NOT NULL DEFAULT '',
  UNIQUE KEY uk_personas_persona_id (persona_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS firmen (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  firmen_id INT NULL,
  name VARCHAR(255) NOT NULL,
  funktion VARCHAR(100) NULL,
  branche VARCHAR(255) NULL,
  strasse VARCHAR(255) NULL,
  plz VARCHAR(20) NULL,
  ort VARCHAR(255) NULL,
  sonstiges TEXT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  erstellt_am DATETIME NOT NULL,
  geaendert_am DATETIME NOT NULL,
  geaendert_von INT UNSIGNED NULL,
  geaendert_von_name VARCHAR(201) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS formate (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  format_nr INT NULL,
  name VARCHAR(255) NOT NULL,
  format_typ VARCHAR(50) NOT NULL,
  medienentwickler VARCHAR(255) NOT NULL,
  link TEXT NULL,
  http_link TEXT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  erstellt_am DATETIME NOT NULL,
  geaendert_am DATETIME NOT NULL,
  geaendert_von INT UNSIGNED NULL,
  geaendert_von_name VARCHAR(201) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS firma_personas (
  firma_id INT UNSIGNED NOT NULL,
  persona_id INT UNSIGNED NOT NULL,
  funktion_in_firma VARCHAR(255) NULL,
  PRIMARY KEY (firma_id, persona_id),
  KEY ix_fp_persona (persona_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Gerichtet: verhaeltnis ist das Verhältnis von related_persona_id aus Sicht von persona_id
CREATE TABLE IF NOT EXISTS beziehungen (
  persona_id INT UNSIGNED NOT NULL,
  related_persona_id INT UNSIGNED NOT NULL,
  verhaeltnis VARCHAR(255) NULL,
  PRIMARY KEY (persona_id, related_persona_id),
  KEY ix_bez_related (related_persona_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS format_personas (
  format_id INT UNSIGNED NOT NULL,
  persona_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (format_id, persona_id),
  KEY ix_fop_persona (persona_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vollständige Stände nach jeder Änderung (für Versionen und Wiederherstellen)
CREATE TABLE IF NOT EXISTS versionen (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  typ VARCHAR(20) NOT NULL,
  objekt_id INT UNSIGNED NOT NULL,
  version INT UNSIGNED NOT NULL,
  aktion VARCHAR(20) NOT NULL,
  daten LONGTEXT NOT NULL,
  zeit DATETIME NOT NULL,
  benutzer_id INT UNSIGNED NULL,
  benutzer_name VARCHAR(201) NOT NULL DEFAULT '',
  KEY ix_versionen_objekt (typ, objekt_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Änderungsprotokoll (Anmeldungen, Benutzerkonten, Daten, Einstellungen)
CREATE TABLE IF NOT EXISTS protokoll (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  zeit DATETIME NOT NULL,
  benutzer_id INT UNSIGNED NULL,
  benutzer_name VARCHAR(201) NOT NULL DEFAULT '',
  aktion VARCHAR(50) NOT NULL,
  objekt_typ VARCHAR(20) NULL,
  objekt_id INT UNSIGNED NULL,
  beschreibung VARCHAR(500) NOT NULL DEFAULT '',
  ip VARCHAR(45) NOT NULL DEFAULT '',
  KEY ix_protokoll_zeit (zeit),
  KEY ix_protokoll_benutzer (benutzer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Galerie: hochgeladene Bilder je Persona. Die Dateien liegen im Galerie-Ordner (siehe lib/galerie.php).
CREATE TABLE IF NOT EXISTS galerie (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  persona_id INT UNSIGNED NOT NULL,
  dateiname VARCHAR(150) NOT NULL,
  original_name VARCHAR(255) NOT NULL DEFAULT '',
  speichername VARCHAR(80) NOT NULL,
  hat_vorschau TINYINT(1) NOT NULL DEFAULT 0,
  mime VARCHAR(40) NOT NULL,
  groesse INT UNSIGNED NOT NULL,
  breite INT UNSIGNED NOT NULL,
  hoehe INT UNSIGNED NOT NULL,
  sha256 CHAR(64) NOT NULL,
  beschreibung VARCHAR(500) NULL,
  hochgeladen_am DATETIME NOT NULL,
  hochgeladen_von INT UNSIGNED NULL,
  hochgeladen_von_name VARCHAR(201) NOT NULL DEFAULT '',
  UNIQUE KEY uk_galerie_name (persona_id, dateiname),
  KEY ix_galerie_hash (persona_id, sha256)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
