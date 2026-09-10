const DEFAULT_TIMEOUT_MS = 10_000;

// Public civic-data APIs generally ask callers to identify themselves.
// Set CONTACT_EMAIL in the environment before running this against real
// traffic so operators can reach you if something's wrong.
const USER_AGENT = `civic-record-mvp/0.1 (${process.env.CONTACT_EMAIL ?? "no contact email set"})`;

export class SourceFetchError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly url: string
  ) {
    super(message);
    this.name = "SourceFetchError";
  }
}

export async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new SourceFetchError(`${url} responded ${res.status} ${res.statusText}`, res.status, url);
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof SourceFetchError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new SourceFetchError(`${url} failed: ${message}`, null, url);
  } finally {
    clearTimeout(timeout);
  }
}
