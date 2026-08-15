-- =============================================================================
-- Migration Rollback: 002_normalize_genres_and_chapter_assets.down.sql
-- Description: Recreate chapter_pages, restore genres column on mangas,
--              and drop normalized genre tables.
-- =============================================================================

-- 1. Recreate chapter_pages table
CREATE TABLE IF NOT EXISTS chapter_pages (
  id VARCHAR(64) PRIMARY KEY,
  chapter_id VARCHAR(64) NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  image_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_chapter_pages_chapter_page UNIQUE(chapter_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_chapter_pages_chapter_id_page_number ON chapter_pages(chapter_id, page_number);

-- 2. Restore genres array column on mangas
ALTER TABLE mangas ADD COLUMN IF NOT EXISTS genres TEXT[] NOT NULL DEFAULT '{}';

-- 3. Backfill genres array from manga_genres
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'manga_genres'
  ) THEN
    UPDATE mangas m
    SET genres = sub.genre_array
    FROM (
      SELECT mg.manga_id, array_agg(g.name ORDER BY g.name ASC) AS genre_array
      FROM manga_genres mg
      JOIN genres g ON g.id = mg.genre_id
      GROUP BY mg.manga_id
    ) sub
    WHERE m.id = sub.manga_id;
  END IF;
END $$;

-- 4. Drop normalized tables & index
DROP TABLE IF EXISTS manga_genres CASCADE;
DROP TABLE IF EXISTS genres CASCADE;
DROP INDEX IF EXISTS idx_mangas_title;
