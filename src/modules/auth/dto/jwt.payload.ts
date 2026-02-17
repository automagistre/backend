export interface JwtPayload {
  /**
   * Subject (user ID в Keycloak)
   */
  sub: string;

  /**
   * Email пользователя
   */
  email: string;

  /**
   * Отображаемое имя
   */
  name?: string;

  /**
   * preferred_username из Keycloak
   */
  preferred_username?: string;

  /**
   * Роли из resource_access (api-oauth и др.)
   */
  roles?: string[];

  /**
   * realm_access roles
   */
  realm_roles?: string[];
}
