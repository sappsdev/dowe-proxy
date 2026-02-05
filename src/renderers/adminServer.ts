import type {
  ApiResponse,
  DomainCreateInput,
  ProjectCreateInput,
} from "../types";
import { config } from "../utils/config";
import { createLogger } from "../utils/logger";
import {
  getAllDomains,
  getDomainById,
  createDomain,
  updateDomain,
  deleteDomain,
  setDomainSSL,
} from "../loaders/domainLoader";
import {
  getAllProjects,
  getProjectById,
  createProject,
  deleteProject,
} from "../loaders/projectLoader";
import {
  getRunningProcesses,
  startProject,
  stopProject,
  restartProject,
} from "../processors/processManager";
import { generateCertificate } from "../processors/sslManager";
import { reloadHttpsServer } from "./proxyServer";

const log = createLogger("adminServer");

let server: ReturnType<typeof Bun.serve> | null = null;

export async function startAdminServer(): Promise<void> {
  server = Bun.serve({
    port: config.adminPort,
    fetch: handleAdminRequest,
  });

  log.info("Admin server started", { port: config.adminPort });
}

async function handleAdminRequest(request: Request): Promise<Response> {
  if (!validateApiKey(request)) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  try {
    if (path === "/api/domains" && method === "GET") {
      return handleGetDomains();
    }

    if (path === "/api/domains" && method === "POST") {
      return handleCreateDomain(request);
    }

    if (path.match(/^\/api\/domains\/[\w-]+$/) && method === "GET") {
      const id = path.split("/").pop()!;
      return handleGetDomain(id);
    }

    if (path.match(/^\/api\/domains\/[\w-]+$/) && method === "PUT") {
      const id = path.split("/").pop()!;
      return handleUpdateDomain(id, request);
    }

    if (path.match(/^\/api\/domains\/[\w-]+$/) && method === "DELETE") {
      const id = path.split("/").pop()!;
      return handleDeleteDomain(id);
    }

    if (path === "/api/projects" && method === "GET") {
      return handleGetProjects();
    }

    if (path === "/api/projects" && method === "POST") {
      return handleCreateProject(request);
    }

    if (path.match(/^\/api\/projects\/[\w-]+$/) && method === "GET") {
      const id = path.split("/").pop()!;
      return handleGetProject(id);
    }

    if (path.match(/^\/api\/projects\/[\w-]+$/) && method === "DELETE") {
      const id = path.split("/").pop()!;
      return handleDeleteProject(id);
    }

    if (path === "/api/processes" && method === "GET") {
      return handleGetProcesses();
    }

    if (path.match(/^\/api\/processes\/[\w-]+\/start$/) && method === "POST") {
      const id = path.split("/")[3] ?? "";
      return handleStartProcess(id);
    }

    if (path.match(/^\/api\/processes\/[\w-]+\/stop$/) && method === "POST") {
      const id = path.split("/")[3] ?? "";
      return handleStopProcess(id);
    }

    if (
      path.match(/^\/api\/processes\/[\w-]+\/restart$/) &&
      method === "POST"
    ) {
      const id = path.split("/")[3] ?? "";
      return handleRestartProcess(id);
    }

    if (path.match(/^\/api\/ssl\/[\w.-]+\/generate$/) && method === "POST") {
      const domain = path.split("/")[3] ?? "";
      return handleGenerateSSL(domain);
    }

    if (path === "/api/health" && method === "GET") {
      return handleHealthCheck();
    }

    return jsonResponse({ success: false, error: "Not found" }, 404);
  } catch (error) {
    log.error("Admin request failed", error);
    const message = error instanceof Error ? error.message : "Internal error";
    return jsonResponse({ success: false, error: message }, 500);
  }
}

function validateApiKey(request: Request): boolean {
  const apiKey = request.headers.get("x-api-key");
  return apiKey === config.adminApiKey;
}

function jsonResponse<T>(data: ApiResponse<T>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function handleGetDomains(): Response {
  const domains = getAllDomains();
  return jsonResponse({ success: true, data: domains });
}

async function handleCreateDomain(request: Request): Promise<Response> {
  const input = (await request.json()) as DomainCreateInput;

  if (!input.hostname || !input.projectId) {
    return jsonResponse(
      { success: false, error: "hostname and projectId required" },
      400,
    );
  }

  const domain = await createDomain(input);
  return jsonResponse({ success: true, data: domain }, 201);
}

function handleGetDomain(id: string): Response {
  const domain = getDomainById(id);

  if (!domain) {
    return jsonResponse({ success: false, error: "Domain not found" }, 404);
  }

  return jsonResponse({ success: true, data: domain });
}

async function handleUpdateDomain(
  id: string,
  request: Request,
): Promise<Response> {
  const input = (await request.json()) as import("../types").DomainUpdateInput;
  const domain = await updateDomain(id, input);
  return jsonResponse({ success: true, data: domain });
}

async function handleDeleteDomain(id: string): Promise<Response> {
  const deleted = await deleteDomain(id);

  if (!deleted) {
    return jsonResponse({ success: false, error: "Domain not found" }, 404);
  }

  return jsonResponse({ success: true });
}

function handleGetProjects(): Response {
  const projects = getAllProjects();
  return jsonResponse({ success: true, data: projects });
}

async function handleCreateProject(request: Request): Promise<Response> {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const binary = formData.get("binary") as Blob;

  if (!name || !binary) {
    return jsonResponse(
      { success: false, error: "name and binary required" },
      400,
    );
  }

  const binaryData = await binary.arrayBuffer();
  const project = await createProject({ name }, binaryData);

  return jsonResponse({ success: true, data: project }, 201);
}

function handleGetProject(id: string): Response {
  const project = getProjectById(id);

  if (!project) {
    return jsonResponse({ success: false, error: "Project not found" }, 404);
  }

  return jsonResponse({ success: true, data: project });
}

async function handleDeleteProject(id: string): Promise<Response> {
  const deleted = await deleteProject(id);

  if (!deleted) {
    return jsonResponse({ success: false, error: "Project not found" }, 404);
  }

  return jsonResponse({ success: true });
}

function handleGetProcesses(): Response {
  const processes = getRunningProcesses().map((p) => ({
    projectId: p.projectId,
    pid: p.pid,
    socketPath: p.socketPath,
    startedAt: p.startedAt,
  }));

  return jsonResponse({ success: true, data: processes });
}

async function handleStartProcess(id: string): Promise<Response> {
  const processInfo = await startProject(id);

  return jsonResponse({
    success: true,
    data: {
      projectId: processInfo.projectId,
      pid: processInfo.pid,
      socketPath: processInfo.socketPath,
    },
  });
}

async function handleStopProcess(id: string): Promise<Response> {
  await stopProject(id);
  return jsonResponse({ success: true });
}

async function handleRestartProcess(id: string): Promise<Response> {
  const processInfo = await restartProject(id);

  return jsonResponse({
    success: true,
    data: {
      projectId: processInfo.projectId,
      pid: processInfo.pid,
      socketPath: processInfo.socketPath,
    },
  });
}

async function handleGenerateSSL(hostname: string): Promise<Response> {
  const domains = getAllDomains();
  const domain = domains.find((d) => d.hostname === hostname);

  if (!domain) {
    return jsonResponse({ success: false, error: "Domain not found" }, 404);
  }

  const certInfo = await generateCertificate(hostname);
  await setDomainSSL(domain.id, certInfo.certPath, certInfo.keyPath);
  await reloadHttpsServer();

  return jsonResponse({ success: true, data: certInfo });
}

function handleHealthCheck(): Response {
  return jsonResponse({
    success: true,
    data: {
      status: "healthy",
      domains: getAllDomains().length,
      projects: getAllProjects().length,
      processes: getRunningProcesses().length,
    },
  });
}

export async function stopAdminServer(): Promise<void> {
  if (server) {
    await server.stop();
    server = null;
    log.info("Admin server stopped");
  }
}
