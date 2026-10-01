import { apiErrorSchema, type FieldErrors } from '@flashcards/shared';
import type { z } from 'zod';

/**
 * Thin fetch wrapper. TanStack Query already handles retries, caching and cancellation,
 * so axios would only add bundle size.
 * The base URL comes from build-time env: "/api" behind the dev proxy or a
 * same-site deploy, or a full URL when the API lives on another host.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

/** The server answered with an error status. Its body is parsed with the shared apiErrorSchema. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: FieldErrors,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The request never got an answer (server down, offline, DNS, CORS). Raised ONLY around fetch itself. */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Network request failed', { cause });
    this.name = 'NetworkError';
  }
}

/** The server answered 2xx, but the body doesn't match the shared response contract. */
export class ContractError extends Error {
  constructor(
    public path: string,
    public issues: z.core.$ZodIssue[],
  ) {
    const first = issues[0];
    super(`Unexpected response from ${path}: ${first ? `${first.path.join('.') || '(root)'} ${first.message}` : 'invalid'}`);
    this.name = 'ContractError';
  }
}

async function request(path: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      credentials: 'include', // send the httpOnly auth cookie
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err; // cancelled, not offline
    throw new NetworkError(err);
  }
  if (!res.ok) {
    // Even error bodies are checked: a proxy's HTML error page shouldn't become `undefined.message`.
    const parsed = apiErrorSchema.safeParse(await res.json().catch(() => null));
    const body = parsed.success ? parsed.data : { message: res.statusText || `Request failed (${res.status})` };
    throw new ApiError(res.status, body.message, body.details);
  }
  return res;
}

/**
 * Calls the API and PARSES the response with a shared schema. The returned value is exactly
 * what the schema promises, not a `body as T` cast that trusts the server.
 */
export async function api<S extends z.ZodType>(path: string, schema: S, init: RequestInit = {}): Promise<z.output<S>> {
  const res = await request(path, init);
  const body: unknown = await res.json().catch(() => undefined);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    if (import.meta.env.DEV) console.error(`[api] ${path} response failed its contract`, parsed.error.issues, body);
    throw new ContractError(path, parsed.error.issues);
  }
  return parsed.data;
}

/**
 * For endpoints whose contract is "204 No Content" (deletes, logout). That's validated too:
 * any other success status, or a body, means the server and client disagree about the contract.
 */
export async function apiVoid(path: string, init: RequestInit = {}): Promise<void> {
  const res = await request(path, init);
  const body = await res.text();
  if (res.status !== 204 || body !== '') {
    const issue = { code: 'custom', path: [], message: `Expected 204 with no body, got ${res.status}${body ? ' with a body' : ''}`, input: body } as unknown as z.core.$ZodIssue;
    throw new ContractError(path, [issue]);
  }
}
