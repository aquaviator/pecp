// ISessionRepository Contract
// Defined according to M5.1 Work Package §8

import { Session } from '../types.js';

export interface ISessionRepository {
  getById(id: string): Promise<Session | null>;
  getByTokenHash(tokenHash: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
  revoke(id: string, revokedAt: string): Promise<void>;
  revokeAllForUser(userId: string, revokedAt: string): Promise<void>;
}
