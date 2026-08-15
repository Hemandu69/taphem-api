import { Router } from "express";
import { healthRoutes } from "./health.routes.js";
import { mangaRoutes } from "../modules/manga/manga.routes.js";
import { sourceRoutes } from "../modules/ingestion/source.routes.js";

const apiRouter = Router();

// /api/v1/health
apiRouter.use("/health", healthRoutes);

// /api/v1/manga
apiRouter.use("/manga", mangaRoutes);

// /api/v1/sources
apiRouter.use("/sources", sourceRoutes);

export const v1Router = apiRouter;
