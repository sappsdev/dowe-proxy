import type { CertificateInfo, TLSConfig } from "../types";
import { config } from "../utils/config";
import { createLogger } from "../utils/logger";
import { join } from "path";

const log = createLogger("sslManager");

const pendingChallenges = new Map<string, string>();
const certificateCache = new Map<string, CertificateInfo>();

export function getChallenge(token: string): string | undefined {
  return pendingChallenges.get(token);
}

export function setChallenge(token: string, keyAuth: string): void {
  pendingChallenges.set(token, keyAuth);
  log.debug("Challenge set", { token });
}

export function clearChallenge(token: string): void {
  pendingChallenges.delete(token);
  log.debug("Challenge cleared", { token });
}

export async function generateCertificate(
  domain: string,
): Promise<CertificateInfo> {
  log.info("Generating certificate", { domain });

  const webroot = join(config.dataDir, "webroot");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(join(webroot, ".well-known", "acme-challenge"), {
    recursive: true,
  });

  const proc = Bun.spawn(
    [
      config.certbotPath,
      "certonly",
      "--webroot",
      "-w",
      webroot,
      "-d",
      domain,
      "--non-interactive",
      "--agree-tos",
      "--email",
      process.env.CERTBOT_EMAIL || "admin@" + domain,
      config.development ? "--staging" : "",
    ].filter(Boolean),
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    log.error("Certbot failed", { domain, stderr });
    throw new Error(`Certificate generation failed: ${stderr}`);
  }

  const certPath = join(config.letsencryptDir, domain, "fullchain.pem");
  const keyPath = join(config.letsencryptDir, domain, "privkey.pem");

  const certInfo: CertificateInfo = {
    domain,
    certPath,
    keyPath,
    expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
  };

  certificateCache.set(domain, certInfo);

  log.info("Certificate generated", { domain, certPath });
  return certInfo;
}

export async function loadCertificate(
  domain: string,
): Promise<TLSConfig | null> {
  const cached = certificateCache.get(domain);

  if (cached) {
    return {
      key: Bun.file(cached.keyPath),
      cert: Bun.file(cached.certPath),
    };
  }

  const certPath = join(config.letsencryptDir, domain, "fullchain.pem");
  const keyPath = join(config.letsencryptDir, domain, "privkey.pem");

  const certExists = await Bun.file(certPath).exists();
  const keyExists = await Bun.file(keyPath).exists();

  if (!certExists || !keyExists) {
    return null;
  }

  const certInfo: CertificateInfo = {
    domain,
    certPath,
    keyPath,
    expiresAt: await getCertificateExpiry(certPath),
  };

  certificateCache.set(domain, certInfo);

  return {
    key: Bun.file(keyPath),
    cert: Bun.file(certPath),
  };
}

export function getCachedCertificate(
  domain: string,
): CertificateInfo | undefined {
  return certificateCache.get(domain);
}

export function getAllCachedCertificates(): CertificateInfo[] {
  return Array.from(certificateCache.values());
}

async function getCertificateExpiry(certPath: string): Promise<number> {
  try {
    const proc = Bun.spawn(
      ["openssl", "x509", "-enddate", "-noout", "-in", certPath],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    await proc.exited;
    const output = await new Response(proc.stdout).text();
    const match = output.match(/notAfter=(.+)/);

    if (match && match[1]) {
      return new Date(match[1]).getTime();
    }
  } catch (error) {
    log.warn("Failed to get certificate expiry", { certPath, error });
  }

  return Date.now() + 90 * 24 * 60 * 60 * 1000;
}

export async function checkRenewals(): Promise<void> {
  log.info("Checking certificate renewals");

  const now = Date.now();
  const renewThreshold = 30 * 24 * 60 * 60 * 1000;

  for (const [domain, certInfo] of certificateCache) {
    if (certInfo.expiresAt - now < renewThreshold) {
      log.info("Certificate needs renewal", { domain });

      try {
        await renewCertificate(domain);
      } catch (error) {
        log.error("Failed to renew certificate", { domain, error });
      }
    }
  }
}

async function renewCertificate(domain: string): Promise<void> {
  log.info("Renewing certificate", { domain });

  const proc = Bun.spawn(
    [config.certbotPath, "renew", "--cert-name", domain, "--non-interactive"],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Certificate renewal failed: ${stderr}`);
  }

  certificateCache.delete(domain);
  await loadCertificate(domain);

  log.info("Certificate renewed", { domain });
}

export async function loadExistingCertificates(
  domains: string[],
): Promise<void> {
  for (const domain of domains) {
    try {
      await loadCertificate(domain);
    } catch (error) {
      log.warn("Failed to load certificate", { domain, error });
    }
  }

  log.info("Loaded existing certificates", { count: certificateCache.size });
}

let renewalTimer: ReturnType<typeof setInterval> | null = null;

export function startRenewalMonitor(): void {
  if (renewalTimer) return;

  renewalTimer = setInterval(
    () => {
      checkRenewals().catch((error) => {
        log.error("Renewal check failed", error);
      });
    },
    12 * 60 * 60 * 1000,
  );

  log.info("Certificate renewal monitoring started");
}

export function stopRenewalMonitor(): void {
  if (renewalTimer) {
    clearInterval(renewalTimer);
    renewalTimer = null;
    log.info("Certificate renewal monitoring stopped");
  }
}
