import { Router } from "express";
import { mangaController } from "./manga.controller.js";
import { chapterRoutes } from "../chapter/chapter.routes.js";

const router = Router();

// Chapter sub-routes: /api/v1/manga/:slug/chapters
router.use("/:slug/chapters", chapterRoutes);

// GET /api/v1/manga
router.get("/", mangaController.getAllManga);

// GET /api/v1/manga/:slug
router.get("/:slug", mangaController.getMangaBySlug);

export const mangaRoutes = router;
