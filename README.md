# Taphem API (`taphem-api`)

Production-ready backend API service for **Taphem**, a premium manga discovery and reading platform.

---

## 1. Overview

`taphem-api` is the dedicated backend service for Taphem. It provides a structured HTTP API foundation built with Node.js, TypeScript, Express, and Zod. It serves client requests, enforces CORS policies, validates environment configurations, and establishes centralized error and response conventions.

---

## 2. Architecture

The codebase follows a clean, layered architecture designed to scale seamlessly as domain features (manga catalog, chapters, search, library, reading progress, user authentication) are introduced:

```
taphem-api/
├── src/
│   ├── config/             # Environment validation and application settings
│   │   ├── env.ts          # Zod schema validation for runtime configuration
│   │   └── index.ts        # Configuration singleton export
│   │
│   ├── controllers/        # Request handlers & response formatting
│   │   └── health.controller.ts
│   │
│   ├── middleware/         # Express middleware (CORS, error handling, 404)
│   │   ├── cors.ts
│   │   ├── error.ts
│   │   └── notFound.ts
│   │
│   ├── routes/             # API route definitions and versioning
│   │   ├── health.routes.ts
│   │   └── index.ts        # Aggregated /api/v1 router
│   │
│   ├── services/           # Business logic layer (for future domain modules)
│   │   └── index.ts
│   │
│   ├── types/              # TypeScript interfaces and envelope definitions
│   │   └── index.ts
│   │
│   ├── utils/              # General utilities (AppError, response envelopes)
│   │   ├── errors.ts
│   │   └── response.ts
│   │
│   ├── app.ts              # Express application factory (independent of listener)
│   └── server.ts           # Server bootstrap, signal handling, and listener
│
├── .env.example            # Template for environment configuration
├── .gitignore              # Ignored files & build artifacts
├── eslint.config.mjs       # Modern ESLint configuration
├── package.json            # Dependencies and npm scripts
├── tsconfig.json           # Strict TypeScript configuration
└── README.md
```

---

## 3. Installation

Ensure you have [Node.js](https://nodejs.org/) (v20+ recommended) installed.

Install dependencies using `npm`:

```bash
npm install
```

---

## 4. Environment Configuration

The application validates all configuration variables at startup using **Zod**. If any required variable is invalid or missing, the server will fail immediately with detailed diagnostics.

Create a `.env` file from the provided template:

```bash
cp .env.example .env
```

### Supported Variables:

| Variable | Description | Default | Example |
| :--- | :--- | :--- | :--- |
| `PORT` | Port number for the HTTP server | `4000` | `4000` |
| `NODE_ENV` | Application environment (`development`, `production`, `test`) | `development` | `development` |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend client origins | `""` | `http://localhost:3000,http://localhost:5173` |
| `MANGA_CDN_BASE_URL` | Public CDN base URL for manga assets | `""` | `https://cdn-beta.example.com` |
| `DATABASE_URL` | PostgreSQL connection string | `""` | `postgresql://user:pass@localhost:5432/taphem_db` |

> **IMPORTANT**: Never commit `.env` files containing environment-specific values, production endpoints, or credentials into source control.

---

## 5. Database Setup, Migrations & Seeding

The application uses PostgreSQL with a flexible repository layer:
- When `DATABASE_URL` is set, the API automatically connects to PostgreSQL using connection pooling (`pg.Pool`).
- When `DATABASE_URL` is omitted (e.g., during lightweight local testing without DB), the API gracefully falls back to the in-memory static catalog.

### Run Database Migrations

Apply database schema migrations (creates `mangas`, `chapters`, and `chapter_pages` tables with indexes and constraints):

```bash
npm run db:migrate
```

To roll back migrations:

```bash
npm run db:migrate:down
```

### Seed Database

Populate the database with the seed manga catalog and chapter data:

```bash
npm run db:seed
```

### Database Schema Overview

```
mangas
  ├── id (VARCHAR PK)
  ├── slug (VARCHAR UNIQUE, indexed)
  ├── title, alternative_titles, author, artist, description
  ├── cover_image, genres, status, rating, release_year, chapter_count
  └── created_at, updated_at

chapters
  ├── id (VARCHAR PK)
  ├── manga_id (VARCHAR FK -> mangas.id, indexed)
  ├── chapter_number (INTEGER)
  ├─�## 6. Development Mode

Run the server in development mode with automatic restarts on file changes:

```bash
npm run dev
```

---

## 7. Building for Production

Compile TypeScript source files into the `dist/` directory:

```bash
npm run build
```

To verify type safety without emitting files:

```bash
npm run typecheck
```

To run lint checks:

```bash
npm run lint
```

To run unit and integration tests:

```bash
npm test
```

---

## 8. Running in Production

After building the application, start the compiled production server:

```bash
npm run start
```

---

## 9. Current Endpoints

### System Health Check

- **Method**: `GET`
- **Path**: `/api/v1/health`
- **Response**: `200 OK`

```json
{
  "success": true,
  "data": {
    "status": "ok"
  }
}
```

### Manga Catalog

> **Note on Storage**: The Manga module implements a clean Repository pattern (`MangaRepository`). When `DATABASE_URL` is set, queries run against PostgreSQL (`DatabaseMangaRepository`). When omitted, it gracefully falls back to the in-memory static repository (`StaticMangaRepository`).

#### 1. Get All Manga

- **Method**: `GET`
- **Path**: `/api/v1/manga`
- **Response**: `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "manga_01j7x0a1b2c3d4e5f6g7h8j9k0",
      "slug": "echoes-of-the-abyss",
      "title": "Echoes of the Abyss",
      "alternativeTitles": ["Shinsou no Zankyou", "심연의 메아리", "深渊的回响"],
      "author": "Renjiro Kuroki",
      "artist": "Aoi Tachibana",
      "description": "In a world where deep-sea chasms open portals to forgotten dimensions...",
      "coverImage": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
      "genres": ["Dark Fantasy", "Supernatural", "Mystery", "Adventure"],
      "status": "ongoing",
      "rating": 8.9,
      "releaseYear": 2024,
      "chapterCount": 48
    }
  ]
}
```

#### 2. Get Single Manga by Slug

- **Method**: `GET`
- **Path**: `/api/v1/manga/:slug`
- **Example**: `GET /api/v1/manga/echoes-of-the-abyss`
- **Response**: `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "manga_01j7x0a1b2c3d4e5f6g7h8j9k0",
    "slug": "echoes-of-the-abyss",
    "title": "Echoes of the Abyss",
    "alternativeTitles": ["Shinsou no Zankyou", "심연의 메아리", "深渊的回响"],
    "author": "Renjiro Kuroki",
    "artist": "Aoi Tachibana",
    "description": "In a world where deep-sea chasms open portals to forgotten dimensions...",
    "coverImage": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80",
    "genres": ["Dark Fantasy", "Supernatural", "Mystery", "Adventure"],
    "status": "ongoing",
    "rating": 8.9,
    "releaseYear": 2024,
    "chapterCount": 48
  }
}
```

- **Not Found (404)**:

```json
{
  "success": false,
  "error": {
    "code": "MANGA_NOT_FOUND",
    "message": "Manga 'unknown-slug' was not found"
  }
}
```

### Manga Chapters

> **Note on Storage & CDN**: The Chapter module implements the `ChapterRepository` interface and resolves asset paths via a vendor-agnostic `MangaStorageService` (`StorageService`). When `MANGA_CDN_BASE_URL` is configured, page URLs are deterministically addressed in the format: `${MANGA_CDN_BASE_URL}/manga/${slug}/chapters/${chapterNumber}/${paddedPageNumber}.webp` (e.g., `https://cdn-beta.example.com/manga/neon-valkyrie/chapters/1/003.webp`). If no CDN is configured, it falls back to the stored asset paths seamlessly.

#### 1. Get Chapters List for a Manga

- **Method**: `GET`
- **Path**: `/api/v1/manga/:slug/chapters`
- **Example**: `GET /api/v1/manga/neon-valkyrie/chapters`
- **Response**: `200 OK`

```json
{
  "success": true,
  "data": [
    {
      "id": "chap_nv_01_98a7b6c5d4e3f2",
      "mangaSlug": "neon-valkyrie",
      "chapterNumber": 1,
      "title": "Awakening in Neo-Kyoto",
      "pageCount": 8,
      "createdAt": "2024-01-15T00:00:00.000Z"
    }
  ]
}
```

#### 2. Get Complete Chapter with Pages

- **Method**: `GET`
- **Path**: `/api/v1/manga/:slug/chapters/:chapterNumber`
- **Example**: `GET /api/v1/manga/neon-valkyrie/chapters/1`
- **Response**: `200 OK`

```json
{
  "success": true,
  "data": {
    "id": "chap_nv_01_98a7b6c5d4e3f2",
    "mangaSlug": "neon-valkyrie",
    "chapterNumber": 1,
    "title": "Awakening in Neo-Kyoto",
    "pageCount": 8,
    "createdAt": "2024-01-15T00:00:00.000Z",
    "pages": [
      {
        "pageNumber": 1,
        "imageUrl": "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=80"
      },
      {
        "pageNumber": 2,
        "imageUrl": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=80"
      }
    ]
  }
}
```

- **Not Found (404)**:

```json
{
  "success": false,
  "error": {
    "code": "CHAPTER_NOT_FOUND",
    "message": "Chapter 999 for manga 'neon-valkyrie' was not found"
  }
}
```

### Error Response Convention

All errors (including 404 Not Found, 400 Bad Request, malformed JSON, and 500 Internal Server Errors) adhere to a consistent structure:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable description"
  }
}
```

---

## 10. Environment Strategy (Local / Beta / Production)

Taphem operates with separate repositories for frontend and backend:

```
Taphem Frontend (separate repo)
            ↓ (HTTPS / CORS)
taphem-api (this repo)
            ↓
PostgreSQL Database / Manga Providers / CDN
```

- **Local**: Development server runs with local ports (e.g. `PORT=4000`, `NODE_ENV=development`) with `CORS_ORIGINS` set to the local frontend development URLs and `DATABASE_URL` set to a local PostgreSQL instance.
- **Beta / Staging**: Pre-production environment deployed with staging domain origins in `CORS_ORIGINS`, managed PostgreSQL, and `NODE_ENV=production`.
- **Production**: Live environment with production domain origins in `CORS_ORIGINS`, managed PostgreSQL, and `NODE_ENV=production`.

---

## 11. Multi-Repo Isolation & Security Rules

1. **No Hardcoded URLs**: Frontend URLs, backend URLs, CDN URLs, database strings, and secret keys must **never** be hardcoded in application source code.
2. **Environment Variable Injection**: All endpoints and access policies must be supplied through validated environment variables (`CORS_ORIGINS`, `PORT`, `NODE_ENV`, `DATABASE_URL`).
3. **Multi-Origin CORS**: The backend evaluates `CORS_ORIGINS` dynamically, rejecting unlisted cross-origin requests in production without modifying application code.

---

## 12. CI/CD & Deployment Architecture

```
feature branch
      ↓
Pull Request → main
      ↓
GitHub Actions (CI Quality Gate)
      ├── npm ci
      ├── npm run typecheck
      ├── npm run lint
      ├── npm test
      └── npm run build
      ↓
    PASS
      ↓
Merge to main
      ↓
Render (Deployment)
      ├── Build: npm run build
      └── Start: npm start
```

- **GitHub Actions (`CI`)**: Acts as the automated quality gate. It runs on every push and pull request targeting `main`, executing clean dependency installation (`npm ci`), TypeScript type checking (`npm run typecheck`), ESLint (`npm run lint`), unit/integration tests (`npm test`), and the production build (`npm run build`).
- **Render (`Deployment`)**: Automatically deploys the backend upon detecting merged commits to `main`. GitHub Actions does not contain deployment logic or tokens.
rt
```

- **GitHub Actions (`CI`)**: Acts as the automated quality gate. It runs on every push and pull request targeting `main`, executing clean dependency installation (`npm ci`), TypeScript type checking (`npm run typecheck`), ESLint (`npm run lint`), and the production build (`npm run build`).
- **Render (`Deployment`)**: Automatically deploys the backend upon detecting merged commits to `main`. GitHub Actions does not contain deployment logic or tokens.