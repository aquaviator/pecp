// IAuthenticationProvider Contract (Identity Provider Seam)
// Defined according to M5.1 Work Package §6

import { AuthenticatedPrincipal, User } from '../types.js';

export interface AuthenticationResult {
  success: boolean;
  principal?: AuthenticatedPrincipal;
  user?: User;
  errorMessage?: string;
}

export interface IAuthenticationProvider {
  readonly providerId: string;
  authenticate(credentials: Record<string, any>): Promise<AuthenticationResult>;
}
