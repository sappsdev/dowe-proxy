export interface Domain {
  id: string;
  hostname: string;
  projectId: string;
  sslEnabled: boolean;
  sslCertPath?: string;
  sslKeyPath?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  binaryPath: string;
  socketPath: string;
  port?: number;
  status: ProjectStatus;
  pid?: number;
  createdAt: number;
  updatedAt: number;
}

export type ProjectStatus = "running" | "stopped" | "error" | "starting";

export interface ProcessInfo {
  projectId: string;
  pid: number;
  subprocess: ReturnType<typeof Bun.spawn>;
  socketPath: string;
  startedAt: number;
}

export interface CertificateInfo {
  domain: string;
  certPath: string;
  keyPath: string;
  expiresAt: number;
}

export interface TLSConfig {
  key: ReturnType<typeof Bun.file>;
  cert: ReturnType<typeof Bun.file>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface DomainCreateInput {
  hostname: string;
  projectId: string;
}

export interface DomainUpdateInput {
  hostname?: string;
  projectId?: string;
  sslEnabled?: boolean;
}

export interface ProjectCreateInput {
  name: string;
}

export interface HealthStatus {
  projectId: string;
  healthy: boolean;
  lastCheck: number;
  errorMessage?: string;
}
