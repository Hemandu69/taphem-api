-- =============================================================================
-- Migration: 001_initial_schema.sql
-- Description: Create initial schema for mangas, chapters, and chapter_pages
-- =============================================================================

CREATE TABLE IF NOT EXISTS mangas (
  id VARCHAR(64) PRIMARY KEY,
  slug VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  alternative_titles TEXT[] NOT NULL DEFAULT '{}',
  author VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  cover_image TEXT NOT NULL,
  genres TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(32) NOT NULL,
  rating NUMERIC(3, 1) NOT NULL DEFAULT 0.0,
  release_year INTEGER NOT NULL,
  chapter_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mangas_slug ON mangas(slug);

CREATE TABLE IF NOT EXISTS chapters (
  id VARCHAR(64) PRIMARY KEY,
  manga_id VARCHAR(64) NOT NULL REFERENCES mangas(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_chapters_manga_chapter UNIQUE(manga_id, chapter_number)
);

CREATE INDEX IF NOT EXISTS idx_chapters_manga_id ON chapters(manga_id);
CREATE INDEX IF NOT EXISTS idx_chapters_manga_id_chapter_number ON chapters(manga_id, chapter_number);

CREATE TABLE IF NOT EXISTS chapter_pages (
  id VARCHAR(64) PRIMARY KEY,
  chapter_id VARCHAR(64) NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  image_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_chapter_pages_chapter_page UNIQUE(chapter_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_chapter_pages_chapter_id_page_number ON chapter_pages(chapter_id, page_number);
