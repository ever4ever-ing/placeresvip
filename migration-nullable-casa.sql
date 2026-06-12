-- Permite perfiles sin casa asociada (casa_slug NULL)
-- Uso: npx wrangler d1 execute casa-rocio --local --file=./migration-nullable-casa.sql
--      npx wrangler d1 execute casa-rocio --remote --file=./migration-nullable-casa.sql

PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS models_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  casa_slug     TEXT,
  nombre        TEXT NOT NULL,
  edad          INTEGER,
  altura        INTEGER,
  pelo          TEXT,
  ciudad        TEXT,
  whatsapp      TEXT,
  descripcion   TEXT,
  servicios     TEXT,
  foto          TEXT,
  fotos         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (casa_slug) REFERENCES casas (slug)
);

INSERT INTO models_new (
  id, casa_slug, nombre, edad, altura, pelo, ciudad, whatsapp,
  descripcion, servicios, foto, fotos, created_at
)
SELECT
  id, casa_slug, nombre, edad, altura, pelo, ciudad, whatsapp,
  descripcion, servicios, foto, fotos, created_at
FROM models;

DROP TABLE models;

ALTER TABLE models_new RENAME TO models;

CREATE INDEX IF NOT EXISTS idx_models_casa_slug ON models (casa_slug);
CREATE INDEX IF NOT EXISTS idx_models_casa_created ON models (casa_slug, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_models_ciudad ON models (ciudad);
CREATE INDEX IF NOT EXISTS idx_models_created_at ON models (created_at DESC, id DESC);

PRAGMA foreign_keys = ON;
