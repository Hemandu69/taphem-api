-- =============================================================================
-- Migration: 002_normalize_genres_and_chapter_assets.sql
-- Description: Normalize genres into genres & manga_genres tables, add search
--              indexing, and safely deprecate chapter_pages in favor of deterministic storage.
-- =============================================================================

-- 1. Create normalized genres table
CREATE TABLE IF NOT EXISTS genres (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(64) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_genres_slug ON genres(slug);

-- 2. Create manga_genres junction table
CREATE TABLE IF NOT EXISTS manga_genres (
  manga_id VARCHAR(64) NOT NULL REFERENCES mangas(id) ON DELETE CASCADE,
  genre_id INTEGER NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (manga_id, genre_id)
);

CREATE INDEX IF NOT EXISTS idx_manga_genres_genre_id ON manga_genres(genre_id);
CREATE INDEX IF NOT EXISTS idx_manga_genres_manga_id ON manga_genres(manga_id);

-- 3. Add title index on mangas for future catalog searching
CREATE INDEX IF NOT EXISTS idx_mangas_title ON mangas(title);

-- 4. Migrate existing genre data from mangas.genres into genres & manga_genres
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'mangas' AND column_name = 'genres'
  ) THEN
    -- Extract and insert distinct genres into genres table
    INSERT INTO genres (slug, name)
    SELECT DISTINCT
      lower(regexp_replace(trim(g), '[^a-zA-Z0-9]+', '-', 'g')),
      trim(g)
    FROM mangas m,
         unnest(m.genres) AS g
    WHERE trim(g) <> ''
    ON CONFLICT (slug) DO NOTHING;

    -- Link mangas to genres
    INSERT INTO manga_genres (manga_id, genre_id)
    SELECT DISTINCT
      m.id,
      g.id
    FROM mangas m,
         unnest(m.genres) AS genre_name
    JOIN genres g ON lower(g.name) = lower(trim(genre_name))
    ON CONFLICT (manga_id, genre_id) DO NOTHING;

    -- Drop legacy array column
    ALTER TABLE mangas DROP COLUMN IF EXISTS genres;
  END IF;
END $$;

-- 5. Drop deprecated chapter_pages table (page URLs are deterministically generated via StorageService)
DROP TABLE IF EXISTS chapter_pages CASCADE;
