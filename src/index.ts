import { config, ensureDirectories } from "./utils/config";
import { logger } from "./utils/logger";
import {
  initDomainStorage,
  closeDomainStorage,
  getAllDomains,
} from "./loaders/domainLoader";
import {
  initProjectStorage,
  closeProjectStorage,
} from "./loaders/projectLoader";
import {
  startAllProjects,
  stopAllProjects,
  startHealthMonitor,
  stopHealthMonitor,
} from "./processors/processManager";
import {
  loadExistingCertificates,
  startRenewalMonitor,
  stopRenewalMonitor,
} from "./processors/sslManager";
import {
  startHttpServer,
  startHttpsServer,
  stopServers,
} from "./renderers/proxyServer";
import { startAdminServer, stopAdminServer } from "./renderers/adminServer";

let isShuttingDown = false;

async function main(): Promise<void> {
  logger.info("Starting Dowe Proxy", {
    config: { ...config, adminApiKey: "***" },
  });

  await ensureDirectories();

  await initDomainStorage();
  await initProjectStorage();

  const domains = getAllDomains();
  const sslDomains = domains.filter((d) => d.sslEnabled).map((d) => d.hostname);
  await loadExistingCertificates(sslDomains);

  await startAllProjects();
  startHealthMonitor();

  await startHttpServer();
  await startHttpsServer();
  await startAdminServer();

  startRenewalMonitor();

  setupSignalHandlers();

  logger.info("Dowe Proxy started successfully", {
    domains: domains.length,
    httpPort: config.httpPort,
    httpsPort: config.httpsPort,
    adminPort: config.adminPort,
  });
}

function setupSignalHandlers(): void {
  const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];

  for (const signal of signals) {
    process.on(signal, () => shutdown(signal));
  }

  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception", error);
    shutdown("UNCAUGHT_EXCEPTION");
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", reason);
  });
}

async function shutdown(reason: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn("Shutdown already in progress");
    return;
  }

  isShuttingDown = true;
  logger.info("Shutting down", { reason });

  stopHealthMonitor();
  stopRenewalMonitor();

  await stopServers();
  await stopAdminServer();

  await stopAllProjects();

  await closeDomainStorage();
  await closeProjectStorage();

  logger.info("Shutdown complete");
  process.exit(0);
}

main().catch((error) => {
  logger.error("Failed to start", error);
  process.exit(1);
});
