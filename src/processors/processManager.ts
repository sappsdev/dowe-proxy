import type { ProcessInfo, Project, HealthStatus } from "../types";
import { config } from "../utils/config";
import { createLogger } from "../utils/logger";
import {
  getAllProjects,
  getProjectById,
  updateProjectStatus,
} from "../loaders/projectLoader";

const log = createLogger("processManager");

const processes = new Map<string, ProcessInfo>();
let healthCheckTimer: ReturnType<typeof setInterval> | null = null;

export function getRunningProcesses(): ProcessInfo[] {
  return Array.from(processes.values());
}

export function getProcessByProjectId(
  projectId: string,
): ProcessInfo | undefined {
  return processes.get(projectId);
}

export async function startProject(projectId: string): Promise<ProcessInfo> {
  const project = getProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  if (processes.has(projectId)) {
    throw new Error(`Project already running: ${projectId}`);
  }

  await updateProjectStatus(projectId, "starting");

  await cleanupSocket(project.socketPath);

  const subprocess = Bun.spawn([project.binaryPath], {
    cwd: config.projectsDir,
    env: {
      ...process.env,
      SOCKET_PATH: project.socketPath,
      PROJECT_ID: projectId,
    },
    stdout: "pipe",
    stderr: "pipe",
    onExit: (proc, exitCode, signalCode, error) => {
      handleProcessExit(
        projectId,
        exitCode,
        signalCode as string | null,
        error ? (error as Error) : null,
      );
    },
  });

  const processInfo: ProcessInfo = {
    projectId,
    pid: subprocess.pid,
    subprocess,
    socketPath: project.socketPath,
    startedAt: Date.now(),
  };

  processes.set(projectId, processInfo);

  const socketReady = await waitForSocket(project.socketPath);
  if (!socketReady) {
    log.warn("Socket not ready after timeout", { projectId });
  }

  await updateProjectStatus(projectId, "running", subprocess.pid);

  log.info("Project started", {
    projectId,
    pid: subprocess.pid,
    socketPath: project.socketPath,
  });

  return processInfo;
}

export async function stopProject(projectId: string): Promise<void> {
  const processInfo = processes.get(projectId);
  if (!processInfo) {
    throw new Error(`Project not running: ${projectId}`);
  }

  log.info("Stopping project", { projectId, pid: processInfo.pid });

  processInfo.subprocess.kill("SIGTERM");

  const exited = await Promise.race([
    processInfo.subprocess.exited,
    new Promise((resolve) => setTimeout(() => resolve(false), 5000)),
  ]);

  if (exited === false) {
    log.warn("Project did not exit gracefully, forcing kill", { projectId });
    processInfo.subprocess.kill("SIGKILL");
    await processInfo.subprocess.exited;
  }

  processes.delete(projectId);
  await updateProjectStatus(projectId, "stopped");
  await cleanupSocket(processInfo.socketPath);

  log.info("Project stopped", { projectId });
}

export async function restartProject(projectId: string): Promise<ProcessInfo> {
  if (processes.has(projectId)) {
    await stopProject(projectId);
  }
  return startProject(projectId);
}

export async function startAllProjects(): Promise<void> {
  const projects = getAllProjects();

  for (const project of projects) {
    try {
      await startProject(project.id);
    } catch (error) {
      log.error(`Failed to start project: ${project.name}`, error);
    }
  }
}

export async function stopAllProjects(): Promise<void> {
  const projectIds = Array.from(processes.keys());

  await Promise.all(
    projectIds.map(async (projectId) => {
      try {
        await stopProject(projectId);
      } catch (error) {
        log.error(`Failed to stop project: ${projectId}`, error);
      }
    }),
  );
}

function handleProcessExit(
  projectId: string,
  exitCode: number | null,
  signalCode: string | null,
  error: Error | null,
): void {
  const processInfo = processes.get(projectId);
  if (!processInfo) return;

  log.warn("Process exited unexpectedly", {
    projectId,
    exitCode,
    signalCode,
    error: error?.message,
  });

  processes.delete(projectId);
  updateProjectStatus(projectId, "error").catch((err) => {
    log.error("Failed to update project status", err);
  });

  setTimeout(() => {
    const project = getProjectById(projectId);
    if (project && project.status === "error") {
      log.info("Attempting to restart crashed project", { projectId });
      startProject(projectId).catch((err) => {
        log.error("Failed to restart project", err);
      });
    }
  }, 5000);
}

export async function checkHealth(): Promise<HealthStatus[]> {
  const results: HealthStatus[] = [];

  for (const [projectId, processInfo] of processes) {
    const healthy = await checkSocketHealth(processInfo.socketPath);

    results.push({
      projectId,
      healthy,
      lastCheck: Date.now(),
      errorMessage: healthy ? undefined : "Socket not responding",
    });

    if (!healthy) {
      log.warn("Unhealthy project detected", { projectId });
    }
  }

  return results;
}

async function checkSocketHealth(socketPath: string): Promise<boolean> {
  try {
    const response = await fetch("http://localhost/health", {
      unix: socketPath,
    } as RequestInit);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForSocket(socketPath: string): Promise<boolean> {
  const { access } = await import("node:fs/promises");
  const maxWait = config.processStartTimeout;
  const interval = 100;
  let elapsed = 0;

  while (elapsed < maxWait) {
    try {
      await access(socketPath);
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, interval));
      elapsed += interval;
    }
  }

  return false;
}

async function cleanupSocket(socketPath: string): Promise<void> {
  const { unlink } = await import("node:fs/promises");
  try {
    await unlink(socketPath);
  } catch {
    // Socket doesn't exist, which is fine
  }
}

export function startHealthMonitor(): void {
  if (healthCheckTimer) return;

  healthCheckTimer = setInterval(() => {
    checkHealth().catch((error) => {
      log.error("Health check failed", error);
    });
  }, config.healthCheckInterval);

  log.info("Health monitoring started", {
    interval: config.healthCheckInterval,
  });
}

export function stopHealthMonitor(): void {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
    log.info("Health monitoring stopped");
  }
}
