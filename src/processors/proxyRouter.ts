import { getDomainByHostname } from "../loaders/domainLoader";
import { getProjectById } from "../loaders/projectLoader";
import { getProcessByProjectId } from "./processManager";
import { createLogger } from "../utils/logger";

const log = createLogger("proxyRouter");

export async function routeRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const hostname = url.hostname;

  const domain = getDomainByHostname(hostname);
  if (!domain) {
    log.debug("Domain not found", { hostname });
    return new Response("Domain not found", { status: 404 });
  }

  const project = getProjectById(domain.projectId);
  if (!project) {
    log.warn("Project not found for domain", {
      hostname,
      projectId: domain.projectId,
    });
    return new Response("Project not found", { status: 502 });
  }

  const processInfo = getProcessByProjectId(project.id);
  if (!processInfo) {
    log.warn("Project not running", {
      hostname,
      projectId: project.id,
    });
    return new Response("Service unavailable", { status: 503 });
  }

  return forwardToUnixSocket(processInfo.socketPath, request, url.pathname);
}

async function forwardToUnixSocket(
  socketPath: string,
  request: Request,
  pathname: string,
): Promise<Response> {
  try {
    const forwardUrl = `http://localhost${pathname}${new URL(request.url).search}`;

    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.set("X-Forwarded-For", getClientIP(request));
    forwardHeaders.set(
      "X-Forwarded-Proto",
      new URL(request.url).protocol.slice(0, -1),
    );
    forwardHeaders.set("X-Forwarded-Host", new URL(request.url).host);

    const response = await fetch(forwardUrl, {
      unix: socketPath,
      method: request.method,
      headers: forwardHeaders,
      body: request.body,
      redirect: "manual",
    } as RequestInit);

    const responseHeaders = new Headers(response.headers);
    responseHeaders.delete("transfer-encoding");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    log.error("Failed to forward request", { socketPath, error });
    return new Response("Bad Gateway", { status: 502 });
  }
}

function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0];
    return firstIp?.trim() ?? "unknown";
  }
  return "unknown";
}

export async function handleWebSocketUpgrade(
  request: Request,
  server: ReturnType<typeof Bun.serve>,
): Promise<Response> {
  const url = new URL(request.url);
  const hostname = url.hostname;

  const domain = getDomainByHostname(hostname);
  if (!domain) {
    return new Response("Domain not found", { status: 404 });
  }

  const project = getProjectById(domain.projectId);
  if (!project) {
    return new Response("Project not found", { status: 502 });
  }

  const processInfo = getProcessByProjectId(project.id);
  if (!processInfo) {
    return new Response("Service unavailable", { status: 503 });
  }

  const upgraded = server.upgrade(request, {
    data: {
      socketPath: processInfo.socketPath,
      pathname: url.pathname,
    },
  });

  if (!upgraded) {
    return new Response("WebSocket upgrade failed", { status: 400 });
  }

  return new Response(null, { status: 101 });
}
