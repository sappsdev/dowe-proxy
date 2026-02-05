import { join } from "path";

const dataDir = process.env.DATA_DIR || "./data";

export const config = {
  httpPort: parseInt(process.env.HTTP_PORT || "80", 10),
  httpsPort: parseInt(process.env.HTTPS_PORT || "443", 10),
  adminPort: parseInt(process.env.ADMIN_PORT || "8080", 10),

  dataDir,
  projectsDir: join(dataDir, "projects"),
  socketsDir: process.env.SOCKETS_DIR || "/tmp/dowe-proxy",
  certsDir: join(dataDir, "certs"),

  domainsDbPath: join(dataDir, "domains.db"),
  projectsDbPath: join(dataDir, "projects.db"),

  certbotPath: process.env.CERTBOT_PATH || "/usr/bin/certbot",
  letsencryptDir: process.env.LETSENCRYPT_DIR || "/etc/letsencrypt/live",

  adminApiKey: process.env.ADMIN_API_KEY || "change-me-in-production",

  healthCheckInterval: parseInt(
    process.env.HEALTH_CHECK_INTERVAL || "30000",
    10,
  ),
  processStartTimeout: parseInt(
    process.env.PROCESS_START_TIMEOUT || "10000",
    10,
  ),

  development: process.env.NODE_ENV !== "production",
};

export async function ensureDirectories(): Promise<void> {
  const { mkdir } = await import("node:fs/promises");
  const dirs = [
    config.dataDir,
    config.projectsDir,
    config.socketsDir,
    config.certsDir,
  ];

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }
}
