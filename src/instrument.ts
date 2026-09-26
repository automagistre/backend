import * as Sentry from '@sentry/nestjs';

// Подключается первым импортом в main.ts; без SENTRY_DSN — no-op (GlitchTip совместим)
Sentry.init({
  dsn: process.env.SENTRY_DSN || undefined,
  environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
  release: process.env.APP_VERSION,
  tracesSampleRate: 0,
});
