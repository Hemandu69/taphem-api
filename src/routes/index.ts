import { Router } from "express";
import { healthRoutes } from "./health.routes.js";

const apiRouter = Router();

// /api/v1/health
apiRouter.use("/health", healthRoutes);

export const v1Router = apiRouter;
