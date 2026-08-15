import { createApp } from "./app.js";
import { config } from "./config/index.js";

/**
 * Starts the Taphem API HTTP server.
 */
function startServer(): void {
  try {
    const app = createApp();

    const server = app.listen(config.port, () => {
      console.log("==================================================");
      console.log(`Taphem API running in [${config.nodeEnv}] mode`);
      console.log(`Server listening on port: ${config.port}`);
      console.log(`Health check: http://localhost:${config.port}/api/v1/health`);
      console.log("==================================================");
    });

    // Graceful shutdown
    const handleShutdown = (signal: string) => {
      console.log(`\nReceived ${signal}. Gracefully shutting down Taphem API...`);
      server.close(() => {
        console.log("HTTP server closed.");
        process.exit(0);
      });

      // Force shutdown after timeout if connections remain open
      setTimeout(() => {
        console.error("Forcing shutdown due to open connections...");
        process.exit(1);
      }, 10000).unref();
    };

    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));

    process.on("uncaughtException", (error: Error) => {
      console.error("Uncaught Exception:", error);
      process.exit(1);
    });

    process.on("unhandledRejection", (reason: unknown) => {
      console.error("Unhandled Promise Rejection:", reason);
      process.exit(1);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
