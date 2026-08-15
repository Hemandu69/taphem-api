import { Router } from "express";
import { searchSourceManga } from "./source.controller.js";

const router = Router();

// GET /api/v1/sources/:sourceId/search?q=...&page=1&limit=20
router.get("/:sourceId/search", searchSourceManga);

export const sourceRoutes = router;
