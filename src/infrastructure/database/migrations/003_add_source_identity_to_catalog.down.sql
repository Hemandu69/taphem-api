-- =============================================================================
-- Migration Rollback: 003_add_source_identity_to_catalog.down.sql
-- Description: Drop source identity columns and indexes from mangas and chapters.
-- =============================================================================

DROP INDEX IF EXISTS uq_chapters_source_source_id;
ALTER TABLE chapters DROP COLUMN IF EXISTS source_id;
ALTER TABLE chapters DROP COLUMN IF EXISTS source;

DROP INDEX IF EXISTS uq_mangas_source_source_id;
ALTER TABLE mangas DROP COLUMN IF EXISTS source_id;
ALTER TABLE mangas DROP COLUMN IF EXISTS source;
