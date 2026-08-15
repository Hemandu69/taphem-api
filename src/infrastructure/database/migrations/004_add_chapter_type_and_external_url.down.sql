-- =============================================================================
-- Migration: 004_add_chapter_type_and_external_url.down.sql
-- =============================================================================

ALTER TABLE chapters DROP COLUMN IF EXISTS external_url;
ALTER TABLE chapters DROP COLUMN IF EXISTS chapter_type;
