import { assertSafeRuntimeConfig, corsOptions } from './runtime-safety';

describe('runtime-safety', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  function setEnv(env: Record<string, string | undefined>) {
    process.env = { ...original };
    for (const key of [
      'NODE_ENV',
      'AUTH_SKIP_CHECK',
      'PASSWORD_AUTH_ENABLED',
      'JWT_SECRET',
      'KEYCLOAK_ENABLED',
      'CORS_ORIGINS',
    ]) {
      delete process.env[key];
    }
    Object.assign(process.env, env);
  }

  it('в development разрешает AUTH_SKIP_CHECK', () => {
    setEnv({ NODE_ENV: 'development', AUTH_SKIP_CHECK: 'true' });
    expect(() => assertSafeRuntimeConfig()).not.toThrow();
  });

  it('вне development запрещает AUTH_SKIP_CHECK', () => {
    setEnv({
      NODE_ENV: 'production',
      AUTH_SKIP_CHECK: 'true',
      KEYCLOAK_ENABLED: 'true',
    });
    expect(() => assertSafeRuntimeConfig()).toThrow(/AUTH_SKIP_CHECK/);
  });

  it('без NODE_ENV считается продом', () => {
    setEnv({ AUTH_SKIP_CHECK: 'true', KEYCLOAK_ENABLED: 'true' });
    expect(() => assertSafeRuntimeConfig()).toThrow(/AUTH_SKIP_CHECK/);
  });

  it('password auth без JWT_SECRET запрещён', () => {
    setEnv({
      NODE_ENV: 'production',
      PASSWORD_AUTH_ENABLED: 'true',
      KEYCLOAK_ENABLED: 'true',
    });
    expect(() => assertSafeRuntimeConfig()).toThrow(/JWT_SECRET/);
  });

  it('прод с Keycloak без опасных флагов стартует', () => {
    setEnv({ NODE_ENV: 'production', KEYCLOAK_ENABLED: 'true' });
    expect(() => assertSafeRuntimeConfig()).not.toThrow();
  });

  it('CORS вне development — allowlist из env', () => {
    setEnv({
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://a.ru, https://b.ru',
    });
    expect(corsOptions().origin).toEqual(['https://a.ru', 'https://b.ru']);
  });

  it('CORS вне development без env — дефолтный allowlist', () => {
    setEnv({ NODE_ENV: 'production' });
    expect(corsOptions().origin).toContain('https://automagistre.ru');
  });

  it('CORS в development — любой origin', () => {
    setEnv({ NODE_ENV: 'development' });
    expect(corsOptions().origin).toBe(true);
  });
});
