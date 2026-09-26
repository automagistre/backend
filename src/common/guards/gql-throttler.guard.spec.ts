import { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { GqlThrottlerGuard } from './gql-throttler.guard';

class TestGuard extends GqlThrottlerGuard {
  tracker(req: Record<string, any>) {
    return this.getTracker(req);
  }
}

describe('GqlThrottlerGuard.getTracker', () => {
  const guard = new TestGuard([], {} as ThrottlerStorage, new Reflector());

  it('аноним — по IP', async () => {
    await expect(guard.tracker({ ip: '1.2.3.4', headers: {} })).resolves.toBe(
      'ip:1.2.3.4',
    );
  });

  it('сотрудник — по sub', async () => {
    await expect(
      guard.tracker({ ip: '1.2.3.4', headers: {}, user: { sub: 'u1' } }),
    ).resolves.toBe('user:u1');
  });

  it('service-account ЛК — по клиенту и телефону', async () => {
    await expect(
      guard.tracker({
        headers: { 'x-me-customer-phone': '+79990000000' },
        user: {
          sub: 's1',
          clientId: 'automagistre-edge',
          isServiceAccount: true,
        },
      }),
    ).resolves.toBe('svc:automagistre-edge:+79990000000');
  });
});
