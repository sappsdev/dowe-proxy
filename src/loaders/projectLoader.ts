import type { Project, ProjectCreateInput, ProjectStatus } from "../types";
import { createStorage, openStorage, type Storage } from "../db";
import { config } from "../utils/config";
import { createLogger } from "../utils/logger";
import { generateUUID, uuidToString } from "../db/utils/uuid";
import { join } from "path";

const log = createLogger("projectLoader");

interface ProjectStore {
  projects: Map<string, Project>;
}

let storage: Storage | null = null;
let store: ProjectStore = {
  projects: new Map(),
};

export async function initProjectStorage(): Promise<void> {
  const exists = await Bun.file(config.projectsDbPath).exists();

  if (exists) {
    storage = await openStorage(config.projectsDbPath);
  } else {
    storage = await createStorage(config.projectsDbPath);
  }

  await loadAllProjects();
  log.info("Project storage initialized", { count: store.projects.size });
}

async function loadAllProjects(): Promise<void> {
  if (!storage) return;

  const indexManager = storage.getIndexManager();
  const entries = Array.from(indexManager.entries());

  for (const [idBytes] of entries) {
    const id = uuidToString(idBytes);
    const project = (await storage.read(id)) as Project | null;

    if (project) {
      project.status = "stopped";
      project.pid = undefined;
      store.projects.set(project.id, project);
    }
  }
}

export function getAllProjects(): Project[] {
  return Array.from(store.projects.values());
}

export function getProjectById(id: string): Project | undefined {
  return store.projects.get(id);
}

export async function createProject(
  input: ProjectCreateInput,
  binaryData: ArrayBuffer,
): Promise<Project> {
  if (!storage) {
    throw new Error("Project storage not initialized");
  }

  const now = Date.now();
  const id = uuidToString(generateUUID());

  const binaryPath = join(config.projectsDir, id);
  const socketPath = join(config.socketsDir, `${id}.sock`);

  await Bun.write(binaryPath, binaryData);

  const { chmod } = await import("node:fs/promises");
  await chmod(binaryPath, 0o755);

  const project: Project = {
    id,
    name: input.name,
    binaryPath,
    socketPath,
    status: "stopped",
    createdAt: now,
    updatedAt: now,
  };

  await storage.write(project);
  await storage.flush();

  store.projects.set(project.id, project);

  log.info("Project created", { name: project.name, id: project.id });
  return project;
}

export async function updateProjectStatus(
  id: string,
  status: ProjectStatus,
  pid?: number,
): Promise<Project> {
  const project = store.projects.get(id);
  if (!project) {
    throw new Error(`Project not found: ${id}`);
  }

  project.status = status;
  project.pid = pid;
  project.updatedAt = Date.now();

  store.projects.set(id, project);

  log.debug("Project status updated", { id, status, pid });
  return project;
}

export async function deleteProject(id: string): Promise<boolean> {
  if (!storage) {
    throw new Error("Project storage not initialized");
  }

  const existing = store.projects.get(id);
  if (!existing) {
    return false;
  }

  if (existing.status === "running") {
    throw new Error("Cannot delete running project. Stop it first.");
  }

  const { unlink } = await import("node:fs/promises");

  try {
    await unlink(existing.binaryPath);
  } catch {
    log.warn("Failed to delete binary file", { path: existing.binaryPath });
  }

  try {
    await unlink(existing.socketPath);
  } catch {
    log.debug("Socket file not found", { path: existing.socketPath });
  }

  await storage.delete(id);
  await storage.flush();

  store.projects.delete(id);

  log.info("Project deleted", { name: existing.name, id });
  return true;
}

export async function closeProjectStorage(): Promise<void> {
  if (storage) {
    await storage.close();
    storage = null;
  }
  store.projects.clear();
}
