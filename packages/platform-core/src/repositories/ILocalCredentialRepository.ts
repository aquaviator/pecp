// ILocalCredentialRepository Contract
// Defined according to M5.1 Work Package §8

import { LocalCredential } from '../types.js';

export interface ILocalCredentialRepository {
  getByUserId(userId: string): Promise<LocalCredential | null>;
  save(credential: LocalCredential): Promise<void>;
  deleteByUserId(userId: string): Promise<void>;
}
