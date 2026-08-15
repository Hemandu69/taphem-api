import { Router } from "express";
import { chapterController } from "./chapter.controller.js";

const router = Router({ mergeParams: true });

// GET /api/v1/manga/:slug/chapters
router.get("/", chapterController.getChapters);

// GET /api/v1/manga/:slug/chapters/:chapterNumber/pages/:pageNumber
router.get("/:chapterNumber/pages/:pageNumber", chapterController.getPage);

// GET /api/v1/manga/:slug/chapters/:chapterNumber
router.get("/:chapterNumber", chapterController.getChapterByNumber);

export const chapterRoutes = router;
