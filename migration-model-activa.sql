ALTER TABLE models ADD COLUMN activa INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_models_casa_activa
  ON models (casa_slug, activa);
