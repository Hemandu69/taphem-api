import { Router } from "express";
import { mangaController } from "./manga.controller.js";

const router = Router();

// GET /api/v1/manga
router.get("/", mangaController.getAllManga);

// GET /api/v1/manga/:slug
router.get("/:slug", mangaController.getMangaBySlug);

export const mangaRoutes = router;
