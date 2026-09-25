// IUserRepository Contract
// Defined according to M5.1 Work Package §8

import { User } from '../types.js';

export interface IUserRepository {
  getById(id: string): Promise<User | null>;
  getByEmail(email: string): Promise<User | null>;
  create(user: User): Promise<User>;
  update(user: User): Promise<User>;
  list(): Promise<User[]>;
  countActivePlatformAdmins(): Promise<number>;
}
