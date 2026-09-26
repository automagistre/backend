import { Throttle } from '@nestjs/throttler';

/** Жёсткий лимит для публичных операций: логин, формы сайта. */
export const StrictThrottle = (limitPerMinute = 10) =>
  Throttle({ default: { limit: limitPerMinute, ttl: 60_000 } });
