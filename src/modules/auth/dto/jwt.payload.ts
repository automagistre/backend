export interface JwtPayload {
  /**
   * Subject (user ID)
   */
  sub: string;

  /**
   * User email
   */
  email: string;

  /**
   * Add any other user-related properties you want in the token
   */
} 
