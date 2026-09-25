// ApiAuthService - Production-shaped API adapter for Authentication
// Defined according to M5.1 Work Package §11 & §17

import { IAuthService, AuthResponse, MeResponse } from '../interfaces/IAuthService';
import { ApiClient, defaultApiClient } from './apiClient';

export class ApiAuthService implements IAuthService {
  constructor(private readonly client: ApiClient = defaultApiClient) {}

  async login(credentials: { email: string; password: string }): Promise<AuthResponse> {
    return this.client.post<AuthResponse>('/api/v1/auth/login', credentials);
  }

  async logout(): Promise<void> {
    await this.client.post('/api/v1/auth/logout');
  }

  async getCurrentUser(): Promise<MeResponse | null> {
    try {
      return await this.client.get<MeResponse>('/api/v1/auth/me');
    } catch (err: any) {
      if (err.status === 401) {
        return null;
      }
      throw err;
    }
  }

  async changePassword(passwords: { currentPassword: string; newPassword: string }): Promise<void> {
    await this.client.post('/api/v1/auth/change-password', passwords);
  }
}
