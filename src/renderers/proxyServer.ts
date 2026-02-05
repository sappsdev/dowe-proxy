import { config } from "../utils/config";
import { createLogger } from "../utils/logger";
import { routeRequest } from "../processors/proxyRouter";
import {
  getChallenge,
  loadCertificate,
  getAllCachedCertificates,
} from "../processors/sslManager";
import { getAllDomains } from "../loaders/domainLoader";
import { join } from "path";

const log = createLogger("proxyServer");

let httpServer: ReturnType<typeof Bun.serve> | null = null;
let httpsServer: ReturnType<typeof Bun.serve> | null = null;

export async function startHttpServer(): Promise<void> {
  httpServer = Bun.serve({
    port: config.httpPort,
    fetch: handleHttpRequest,
  });

  log.info("HTTP server started", { port: config.httpPort });
}

async function handleHttpRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/.well-known/acme-challenge/")) {
    return handleAcmeChallenge(request, url);
  }

  const hostname = url.hostname;
  const redirectUrl = `https://${hostname}${url.pathname}${url.search}`;

  return Response.redirect(redirectUrl, 301);
}

async function handleAcmeChallenge(
  request: Request,
  url: URL,
): Promise<Response> {
  const token = url.pathname.split("/").pop();

  if (!token) {
    return new Response("Not found", { status: 404 });
  }

  const keyAuth = getChallenge(token);
  if (keyAuth) {
    return new Response(keyAuth, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  const webroot = join(config.dataDir, "webroot");
  const challengePath = join(webroot, ".well-known", "acme-challenge", token);
  const file = Bun.file(challengePath);

  if (await file.exists()) {
    return new Response(file, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response("Not found", { status: 404 });
}

export async function startHttpsServer(): Promise<void> {
  const tlsConfig = await buildTLSConfig();

  if (!tlsConfig) {
    log.warn("No TLS certificates available, HTTPS server not started");
    return;
  }

  httpsServer = Bun.serve({
    port: config.httpsPort,
    tls: tlsConfig,
    fetch: handleHttpsRequest,
  });

  log.info("HTTPS server started", { port: config.httpsPort });
}

async function handleHttpsRequest(request: Request): Promise<Response> {
  try {
    return await routeRequest(request);
  } catch (error) {
    log.error("Request handling failed", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

async function buildTLSConfig(): Promise<object | null> {
  const domains = getAllDomains().filter((d) => d.sslEnabled);

  if (domains.length === 0) {
    return null;
  }

  const tlsConfigs: Array<{
    serverName: string;
    key: ReturnType<typeof Bun.file>;
    cert: ReturnType<typeof Bun.file>;
  }> = [];

  for (const domain of domains) {
    const cert = await loadCertificate(domain.hostname);
    if (cert) {
      tlsConfigs.push({
        serverName: domain.hostname,
        ...cert,
      });
    }
  }

  if (tlsConfigs.length === 0) {
    return null;
  }

  if (tlsConfigs.length === 1) {
    return tlsConfigs[0] ?? null;
  }

  return tlsConfigs;
}

export async function reloadHttpsServer(): Promise<void> {
  if (!httpsServer) {
    await startHttpsServer();
    return;
  }

  const tlsConfig = await buildTLSConfig();

  if (!tlsConfig) {
    log.warn("No TLS certificates available for reload");
    return;
  }

  httpsServer.reload({
    tls: tlsConfig,
    fetch: handleHttpsRequest,
  });

  log.info("HTTPS server reloaded with updated TLS configuration");
}

export async function stopServers(): Promise<void> {
  if (httpServer) {
    await httpServer.stop();
    httpServer = null;
    log.info("HTTP server stopped");
  }

  if (httpsServer) {
    await httpsServer.stop();
    httpsServer = null;
    log.info("HTTPS server stopped");
  }
}

export function getServerStatus(): { http: boolean; https: boolean } {
  return {
    http: httpServer !== null,
    https: httpsServer !== null,
  };
}
