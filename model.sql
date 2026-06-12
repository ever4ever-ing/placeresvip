-- Esquema derivado de src/models.js (D1 / SQLite)
-- Uso: npx wrangler d1 execute casa-rocio --local --file=./model.sql
--      npx wrangler d1 execute casa-rocio --remote --file=./model.sql

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- casas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS casas (
  slug          TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL,
  ciudad        TEXT,
  telefonos     TEXT,                    -- JSON: ["+569...", ...]
  admin_secret  TEXT,
  activa        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_casas_activa_nombre
  ON casas (activa, nombre);

CREATE INDEX IF NOT EXISTS idx_casas_ciudad
  ON casas (ciudad);

-- ---------------------------------------------------------------------------
-- models (perfiles / catálogo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS models (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  casa_slug     TEXT NOT NULL,
  nombre        TEXT NOT NULL,
  edad          INTEGER,
  altura        INTEGER,
  pelo          TEXT,
  ciudad        TEXT,
  whatsapp      TEXT,
  descripcion   TEXT,
  servicios     TEXT,                    -- separados por coma
  foto          TEXT,                    -- clave R2 o URL (miniatura)
  fotos         TEXT,                    -- JSON: ["clave-o-url", ...]
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (casa_slug) REFERENCES casas (slug)
);

CREATE INDEX IF NOT EXISTS idx_models_casa_slug
  ON models (casa_slug);

CREATE INDEX IF NOT EXISTS idx_models_casa_created
  ON models (casa_slug, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_models_ciudad
  ON models (ciudad);

CREATE INDEX IF NOT EXISTS idx_models_created_at
  ON models (created_at DESC, id DESC);
