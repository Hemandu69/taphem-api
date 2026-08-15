import { Router } from "express";
import { healthRoutes } from "./health.routes.js";
import { mangaRoutes } from "../modules/manga/manga.routes.js";

const apiRouter = Router();

// /api/v1/health
apiRouter.use("/health", healthRoutes);

// /api/v1/manga
apiRouter.use("/manga", mangaRoutes);

export const v1Router = apiRouter;
