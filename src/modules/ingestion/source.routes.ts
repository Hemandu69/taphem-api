import { Router } from "express";
import {
  searchSourceManga,
  getSourceMangaDetails,
  ingestSourceManga
} from "./source.controller.js";

const router = Router();

// GET /api/v1/sources/:sourceId/search?q=...&page=1&limit=20
router.get("/:sourceId/search", searchSourceManga);

// GET /api/v1/sources/:sourceId/manga/:externalId
router.get("/:sourceId/manga/:externalId", getSourceMangaDetails);

// POST /api/v1/sources/:sourceId/manga/:externalId/ingest
router.post("/:sourceId/manga/:externalId/ingest", ingestSourceManga);

export const sourceRoutes = router;

