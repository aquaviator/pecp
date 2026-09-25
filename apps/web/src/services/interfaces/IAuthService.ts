// IAuthService Interface
// Defined according to M5.1 Work Package §11 & §17

import { UserSummary, AuthenticatedPrincipal } from '../../types/auth';

export interface AuthResponse {
  user: UserSummary;
  principal: AuthenticatedPrincipal;
  csrfToken: string;
}

export interface MeResponse {
  user: UserSummary;
  principal: AuthenticatedPrincipal;
  permissions: string[];
}

export interface IAuthService {
  login(credentials: { email: string; password: string }): Promise<AuthResponse>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<MeResponse | null>;
  changePassword(passwords: { currentPassword: string; newPassword: string }): Promise<void>;
}
