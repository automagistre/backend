import type { NestFastifyApplication } from '@nestjs/platform-fastify';

type CorsOptions = NonNullable<
  Parameters<NestFastifyApplication['enableCors']>[0]
>;

const DEFAULT_CORS_ORIGINS = [
  'https://automagistre.ru',
  'https://www.automagistre.ru',
  'https://crm.automagistre.ru',
];

const isDevelopment = () => process.env.NODE_ENV === 'development';

/**
 * Падает при старте, если вне development включены флаги, отключающие защиту.
 */
export function assertSafeRuntimeConfig(): void {
  if (isDevelopment()) return;

  const problems: string[] = [];
  if (process.env.AUTH_SKIP_CHECK === 'true') {
    problems.push('AUTH_SKIP_CHECK=true отключает проверку токенов');
  }
  if (!process.env.JWT_SECRET) {
    if (process.env.PASSWORD_AUTH_ENABLED === 'true') {
      problems.push('PASSWORD_AUTH_ENABLED=true требует JWT_SECRET');
    }
    if (process.env.KEYCLOAK_ENABLED !== 'true') {
      problems.push('без Keycloak (KEYCLOAK_ENABLED!=true) нужен JWT_SECRET');
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Небезопасная конфигурация (NODE_ENV=${process.env.NODE_ENV ?? 'не задан'}): ${problems.join('; ')}`,
    );
  }
}

/**
 * В development — любой origin. Иначе allowlist из CORS_ORIGINS (через запятую).
 */
export function corsOptions(): CorsOptions {
  if (isDevelopment()) {
    return { origin: true, credentials: true };
  }
  const fromEnv = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return {
    origin: fromEnv.length > 0 ? fromEnv : DEFAULT_CORS_ORIGINS,
    credentials: true,
  };
}
