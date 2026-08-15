-- =============================================================================
-- Migration Rollback: 001_initial_schema.down.sql
-- Description: Drop tables in reverse dependency order
-- =============================================================================

DROP TABLE IF EXISTS chapter_pages CASCADE;
DROP TABLE IF EXISTS chapters CASCADE;
DROP TABLE IF EXISTS mangas CASCADE;
