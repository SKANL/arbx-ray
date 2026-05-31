export type PublicFetchOptions = {
  timeoutMs?: number;
  userAgent?: string;
  headers?: HeadersInit;
};

export type PublicFetchError = {
  url: string;
  message: string;
  status?: number;
};

const DEFAULT_TIMEOUT_MS = 8_000;

export async function fetchPublicJson(
  url: string,
  errors: string[] = [],
  options: PublicFetchOptions = {},
): Promise<unknown> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: buildHeaders(options),
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw publicFetchError(url, `${response.status} ${response.statusText}`, response.status);
    }
    return response.json() as Promise<unknown>;
  } catch (error) {
    const normalized = normalizePublicFetchError(url, error);
    errors.push(formatPublicFetchError(normalized));
    return undefined;
  }
}

export function formatPublicFetchError(error: PublicFetchError): string {
  return `${error.url}: ${error.message}`;
}

function buildHeaders(options: PublicFetchOptions): HeadersInit | undefined {
  if (!options.userAgent && !options.headers) return undefined;
  return {
    ...(options.headers ?? {}),
    ...(options.userAgent ? { "User-Agent": options.userAgent } : {}),
  };
}

function publicFetchError(url: string, message: string, status?: number): PublicFetchError {
  return { url, message, status };
}

function normalizePublicFetchError(url: string, error: unknown): PublicFetchError {
  if (isPublicFetchError(error)) return error;
  return {
    url,
    message: error instanceof Error ? error.message : "unknown error",
  };
}

function isPublicFetchError(error: unknown): error is PublicFetchError {
  return (
    typeof error === "object" &&
    error !== null &&
    "url" in error &&
    "message" in error &&
    typeof (error as PublicFetchError).url === "string" &&
    typeof (error as PublicFetchError).message === "string"
  );
}
