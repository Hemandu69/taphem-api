-- =============================================================================
-- Migration: 003_add_source_identity_to_catalog.sql
-- Description: Add source and source_id columns to mangas and chapters
--              with partial unique indexes to support multi-source catalog ingestion.
-- =============================================================================

-- 1. Add source identity to mangas
ALTER TABLE mangas ADD COLUMN IF NOT EXISTS source VARCHAR(64);
ALTER TABLE mangas ADD COLUMN IF NOT EXISTS source_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mangas_source_source_id
  ON mangas (source, source_id)
  WHERE source IS NOT NULL AND source_id IS NOT NULL;

-- 2. Add source identity to chapters
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS source VARCHAR(64);
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS source_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chapters_source_source_id
  ON chapters (source, source_id)
  WHERE source IS NOT NULL AND source_id IS NOT NULL;
