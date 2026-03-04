import { logger } from './logger.js';

export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseMs = 500,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        const delay = baseMs * Math.pow(2, attempt);
        logger.warn({ attempt, delay, err }, 'Retrying after error');
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
