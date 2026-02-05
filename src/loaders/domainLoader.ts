import type { Domain, DomainCreateInput, DomainUpdateInput } from "../types";
import { createStorage, openStorage, type Storage } from "../db";
import { config } from "../utils/config";
import { createLogger } from "../utils/logger";
import { generateUUID, uuidToString } from "../db/utils/uuid";

const log = createLogger("domainLoader");

interface DomainStore {
  domains: Map<string, Domain>;
  byHostname: Map<string, Domain>;
}

let storage: Storage | null = null;
let store: DomainStore = {
  domains: new Map(),
  byHostname: new Map(),
};

export async function initDomainStorage(): Promise<void> {
  const exists = await Bun.file(config.domainsDbPath).exists();

  if (exists) {
    storage = await openStorage(config.domainsDbPath);
  } else {
    storage = await createStorage(config.domainsDbPath);
  }

  await loadAllDomains();
  log.info("Domain storage initialized", { count: store.domains.size });
}

async function loadAllDomains(): Promise<void> {
  if (!storage) return;

  const indexManager = storage.getIndexManager();
  const entries = Array.from(indexManager.entries());

  for (const [idBytes] of entries) {
    const id = uuidToString(idBytes);
    const domain = (await storage.read(id)) as Domain | null;

    if (domain) {
      store.domains.set(domain.id, domain);
      store.byHostname.set(domain.hostname, domain);
    }
  }
}

export function getAllDomains(): Domain[] {
  return Array.from(store.domains.values());
}

export function getDomainById(id: string): Domain | undefined {
  return store.domains.get(id);
}

export function getDomainByHostname(hostname: string): Domain | undefined {
  return store.byHostname.get(hostname);
}

export async function createDomain(input: DomainCreateInput): Promise<Domain> {
  if (!storage) {
    throw new Error("Domain storage not initialized");
  }

  if (store.byHostname.has(input.hostname)) {
    throw new Error(`Domain already exists: ${input.hostname}`);
  }

  const now = Date.now();
  const id = uuidToString(generateUUID());

  const domain: Domain = {
    id,
    hostname: input.hostname,
    projectId: input.projectId,
    sslEnabled: false,
    createdAt: now,
    updatedAt: now,
  };

  await storage.write(domain);
  await storage.flush();

  store.domains.set(domain.id, domain);
  store.byHostname.set(domain.hostname, domain);

  log.info("Domain created", { hostname: domain.hostname, id: domain.id });
  return domain;
}

export async function updateDomain(
  id: string,
  input: DomainUpdateInput,
): Promise<Domain> {
  if (!storage) {
    throw new Error("Domain storage not initialized");
  }

  const existing = store.domains.get(id);
  if (!existing) {
    throw new Error(`Domain not found: ${id}`);
  }

  if (input.hostname && input.hostname !== existing.hostname) {
    if (store.byHostname.has(input.hostname)) {
      throw new Error(`Domain already exists: ${input.hostname}`);
    }
    store.byHostname.delete(existing.hostname);
  }

  const updated: Domain = {
    ...existing,
    ...input,
    updatedAt: Date.now(),
  };

  await storage.delete(id);
  await storage.write(updated);
  await storage.flush();

  store.domains.set(updated.id, updated);
  store.byHostname.set(updated.hostname, updated);

  log.info("Domain updated", { hostname: updated.hostname, id: updated.id });
  return updated;
}

export async function deleteDomain(id: string): Promise<boolean> {
  if (!storage) {
    throw new Error("Domain storage not initialized");
  }

  const existing = store.domains.get(id);
  if (!existing) {
    return false;
  }

  await storage.delete(id);
  await storage.flush();

  store.domains.delete(id);
  store.byHostname.delete(existing.hostname);

  log.info("Domain deleted", { hostname: existing.hostname, id });
  return true;
}

export async function setDomainSSL(
  id: string,
  certPath: string,
  keyPath: string,
): Promise<Domain> {
  return updateDomain(id, {
    sslEnabled: true,
  });
}

export async function closeDomainStorage(): Promise<void> {
  if (storage) {
    await storage.close();
    storage = null;
  }
  store.domains.clear();
  store.byHostname.clear();
}
