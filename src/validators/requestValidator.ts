import type { ApiResponse } from "../types";

export function validateRequired(
  data: Record<string, unknown>,
  fields: string[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of fields) {
    if (
      data[field] === undefined ||
      data[field] === null ||
      data[field] === ""
    ) {
      errors.push(`${field} is required`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateHostname(hostname: string): boolean {
  const hostnameRegex =
    /^(?!:\/\/)([a-zA-Z0-9-_]+\.)*[a-zA-Z0-9][a-zA-Z0-9-_]+\.[a-zA-Z]{2,11}$/;
  return hostnameRegex.test(hostname);
}

export function validateProjectName(name: string): boolean {
  const nameRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_]{0,62}$/;
  return nameRegex.test(name);
}

export function createErrorResponse(message: string, status = 400): Response {
  const body: ApiResponse = {
    success: false,
    error: message,
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function createSuccessResponse<T>(data: T, status = 200): Response {
  const body: ApiResponse<T> = {
    success: true,
    data,
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
