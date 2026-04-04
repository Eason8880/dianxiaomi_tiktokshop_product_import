export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
  timeoutMessage?: string;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  {
    timeoutMs = 20_000,
    timeoutMessage = '请求超时，请稍后重试',
    signal,
    ...init
  }: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;

  const handleAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener('abort', handleAbort, { once: true });
    }
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', handleAbort);
  }
}
