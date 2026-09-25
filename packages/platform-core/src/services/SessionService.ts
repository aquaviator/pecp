// SessionService - Opaque token generation, SHA-256 persistence, lifecycle management
// Defined according to M5.1 Work Package §5 & §8

import * as crypto from 'node:crypto';
import { ISessionRepository } from '../repositories/ISessionRepository.js';
import { IUserRepository } from '../repositories/IUserRepository.js';
import { Session, User } from '../types.js';

export interface CreateSessionResult {
  session: Session;
  rawToken: string;
}

export class SessionService {
  private sessionRepo: ISessionRepository;
  private userRepo: IUserRepository;
  private defaultTtlHours: number;

  constructor(
    sessionRepo: ISessionRepository,
    userRepo: IUserRepository,
    defaultTtlHours: number = 12
  ) {
    this.sessionRepo = sessionRepo;
    this.userRepo = userRepo;
    this.defaultTtlHours = defaultTtlHours;
  }

  static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  static generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static generateCsrfToken(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  async createSession(userId: string, ttlHours?: number): Promise<CreateSessionResult> {
    const rawToken = SessionService.generateToken();
    const tokenHash = SessionService.hashToken(rawToken);
    const now = new Date();
    const ttl = ttlHours ?? this.defaultTtlHours;
    const expiresAt = new Date(now.getTime() + ttl * 60 * 60 * 1000).toISOString();

    const session: Session = {
      id: crypto.randomUUID(),
      userId,
      tokenHash,
      createdAt: now.toISOString(),
      expiresAt,
      authenticatedAt: now.toISOString()
    };

    await this.sessionRepo.save(session);
    return { session, rawToken };
  }

  async validateSession(rawToken: string): Promise<{ session: Session; user: User } | null> {
    if (!rawToken) return null;
    const tokenHash = SessionService.hashToken(rawToken);
    const session = await this.sessionRepo.getByTokenHash(tokenHash);
    if (!session) return null;

    if (session.revokedAt) return null;

    const now = new Date().toISOString();
    if (session.expiresAt <= now) {
      return null;
    }

    const user = await this.userRepo.getById(session.userId);
    if (!user || user.status === 'DISABLED') {
      return null;
    }

    return { session, user };
  }

  async revokeSession(sessionId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.sessionRepo.revoke(sessionId, now);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.sessionRepo.revokeAllForUser(userId, now);
  }
}
