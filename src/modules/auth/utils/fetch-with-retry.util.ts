const RETRYABLE_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ENOTFOUND',
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

function isTransientNetworkError(error: unknown): boolean {
  // undici бросает TypeError: fetch failed с причиной в error.cause
  const cause = (error as { cause?: { code?: string } })?.cause;
  const code = cause?.code ?? (error as { code?: string })?.code;
  return Boolean(code && RETRYABLE_ERROR_CODES.has(code));
}

/**
 * fetch с повтором при транзиентных сетевых ошибках (DNS EAI_AGAIN, обрыв
 * соединения). Используется для запросов к Keycloak, чтобы кратковременный
 * сбой сети/резолвера не приводил к ошибке запроса пользователя.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 2,
  baseDelayMs = 200,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isTransientNetworkError(error)) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * (attempt + 1)),
      );
    }
  }
  throw lastError;
}
