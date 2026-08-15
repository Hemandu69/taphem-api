-- =============================================================================
-- Migration: 004_add_chapter_type_and_external_url.sql
-- Description: Add chapter_type and external_url to chapters table
-- =============================================================================

ALTER TABLE chapters ADD COLUMN IF NOT EXISTS external_url TEXT;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS chapter_type VARCHAR(32) NOT NULL DEFAULT 'hosted';
