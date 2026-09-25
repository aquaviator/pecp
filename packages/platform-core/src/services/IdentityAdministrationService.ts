// IdentityAdministrationService - User, Credential, and Membership Governance
// Defined according to M5.1 Work Package §8, §12, §13 & §19
import * as crypto from 'node:crypto';
import { IUserRepository } from '../repositories/IUserRepository.js';
import { ILocalCredentialRepository } from '../repositories/ILocalCredentialRepository.js';
import { IOrganisationMembershipRepository } from '../repositories/IOrganisationMembershipRepository.js';
import { ISessionRepository } from '../repositories/ISessionRepository.js';
import { AuditService } from './AuditService.js';
import { PasswordHasher } from './PasswordHasher.js';
import { IUnitOfWork } from '../transactions/IUnitOfWork.js';
import {
  User,
  UserStatus,
  PlatformRole,
  OrganisationRole,
  OrganisationMembership,
  AuthenticatedPrincipal,
  CreateUserInput
} from '../types.js';

export class IdentityAdministrationService {
  constructor(
    private userRepo: IUserRepository,
    private credentialRepo: ILocalCredentialRepository,
    private membershipRepo: IOrganisationMembershipRepository,
    private sessionRepo: ISessionRepository,
    private auditService: AuditService,
    private unitOfWork?: IUnitOfWork
  ) {}

  private async withTransaction<T>(operation: () => Promise<T>): Promise<T> {
    if (this.unitOfWork) {
      return this.unitOfWork.execute(operation);
    }
    return operation();
  }

  async createUser(
    actor: AuthenticatedPrincipal,
    input: CreateUserInput & { password?: string }
  ): Promise<User> {
    if (actor.platformRole !== 'PLATFORM_ADMIN') {
      await this.auditService.record({
        actor,
        action: 'AUTHORIZATION_DENIED',
        targetType: 'USER',
        outcome: 'DENIED',
        reason: 'PLATFORM_ADMIN role required to create users'
      });
      throw new Error('Forbidden: PLATFORM_ADMIN role required');
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.userRepo.getByEmail(normalizedEmail);
    if (existing) {
      throw new Error(`User with email '${input.email}' already exists`);
    }

    if (input.password) {
      PasswordHasher.validatePassword(input.password);
    }

    const now = new Date().toISOString();
    const user: User = {
      id: crypto.randomUUID(),
      email: input.email.trim(),
      normalizedEmail,
      displayName: input.displayName.trim(),
      status: 'ACTIVE',
      platformRole: input.platformRole ?? 'NONE',
      createdAt: now,
      updatedAt: now
    };

    return this.withTransaction(async () => {
      const created = await this.userRepo.create(user);

      if (input.password) {
        const hashResult = await PasswordHasher.hash(input.password);
        await this.credentialRepo.save({
          userId: created.id,
          algorithm: hashResult.algorithm,
          salt: hashResult.salt,
          passwordHash: hashResult.passwordHash,
          paramsJson: hashResult.paramsJson,
          updatedAt: now
        });
      }

      await this.auditService.record({
        actor,
        action: 'USER_CREATE',
        targetType: 'USER',
        targetId: created.id,
        outcome: 'SUCCESS',
        metadata: {
          email: created.email,
          displayName: created.displayName,
          platformRole: created.platformRole
        }
      });

      return created;
    });
  }

  async updateUserStatus(
    actor: AuthenticatedPrincipal,
    userId: string,
    status: UserStatus
  ): Promise<User> {
    if (actor.platformRole !== 'PLATFORM_ADMIN') {
      await this.auditService.record({
        actor,
        action: 'AUTHORIZATION_DENIED',
        targetType: 'USER',
        targetId: userId,
        outcome: 'DENIED',
        reason: 'PLATFORM_ADMIN role required to update user status'
      });
      throw new Error('Forbidden: PLATFORM_ADMIN role required');
    }

    const targetUser = await this.userRepo.getById(userId);
    if (!targetUser) {
      throw new Error('User not found');
    }

    return this.withTransaction(async () => {
      if (status === 'DISABLED') {
        if (targetUser.platformRole === 'PLATFORM_ADMIN') {
          const activeAdmins = await this.userRepo.countActivePlatformAdmins();
          if (activeAdmins <= 1) {
            throw new Error('Cannot disable the only remaining active PLATFORM_ADMIN');
          }
        }
        // Revoke all sessions for disabled user
        await this.sessionRepo.revokeAllForUser(userId, new Date().toISOString());
      }

      const updatedUser: User = {
        ...targetUser,
        status,
        updatedAt: new Date().toISOString()
      };

      const saved = await this.userRepo.update(updatedUser);

      await this.auditService.record({
        actor,
        action: status === 'DISABLED' ? 'USER_DISABLE' : 'USER_ENABLE',
        targetType: 'USER',
        targetId: userId,
        outcome: 'SUCCESS',
        metadata: { previousStatus: targetUser.status, newStatus: status }
      });

      return saved;
    });
  }

  async resetPassword(
    actor: AuthenticatedPrincipal,
    userId: string,
    newPassword: string
  ): Promise<void> {
    if (actor.platformRole !== 'PLATFORM_ADMIN') {
      await this.auditService.record({
        actor,
        action: 'AUTHORIZATION_DENIED',
        targetType: 'USER',
        targetId: userId,
        outcome: 'DENIED',
        reason: 'PLATFORM_ADMIN role required to reset passwords'
      });
      throw new Error('Forbidden: PLATFORM_ADMIN role required');
    }

    const targetUser = await this.userRepo.getById(userId);
    if (!targetUser) {
      throw new Error('User not found');
    }

    PasswordHasher.validatePassword(newPassword);
    const hashResult = await PasswordHasher.hash(newPassword);
    const now = new Date().toISOString();

    await this.withTransaction(async () => {
      await this.credentialRepo.save({
        userId,
        algorithm: hashResult.algorithm,
        salt: hashResult.salt,
        passwordHash: hashResult.passwordHash,
        paramsJson: hashResult.paramsJson,
        updatedAt: now
      });

      // Invalidate existing sessions
      await this.sessionRepo.revokeAllForUser(userId, now);

      await this.auditService.record({
        actor,
        action: 'PASSWORD_RESET',
        targetType: 'USER',
        targetId: userId,
        outcome: 'SUCCESS'
      });
    });
  }

  async changePassword(
    actor: AuthenticatedPrincipal,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const userId = actor.userId;
    const credential = await this.credentialRepo.getByUserId(userId);
    if (!credential) {
      throw new Error('User has no local credentials configured');
    }

    const matches = await PasswordHasher.verify(
      currentPassword,
      credential.salt,
      credential.passwordHash,
      credential.paramsJson
    );

    if (!matches) {
      await this.auditService.record({
        actor,
        action: 'PASSWORD_CHANGE',
        targetType: 'USER',
        targetId: userId,
        outcome: 'FAILURE',
        reason: 'Invalid current password'
      });
      throw new Error('Current password does not match');
    }

    PasswordHasher.validatePassword(newPassword);
    const hashResult = await PasswordHasher.hash(newPassword);
    const now = new Date().toISOString();

    await this.withTransaction(async () => {
      await this.credentialRepo.save({
        userId,
        algorithm: hashResult.algorithm,
        salt: hashResult.salt,
        passwordHash: hashResult.passwordHash,
        paramsJson: hashResult.paramsJson,
        updatedAt: now
      });

      // Revoke all active sessions
      await this.sessionRepo.revokeAllForUser(userId, now);

      await this.auditService.record({
        actor,
        action: 'PASSWORD_CHANGE',
        targetType: 'USER',
        targetId: userId,
        outcome: 'SUCCESS'
      });
    });
  }

  async listUsers(actor: AuthenticatedPrincipal): Promise<User[]> {
    if (actor.platformRole !== 'PLATFORM_ADMIN') {
      throw new Error('Forbidden: PLATFORM_ADMIN role required');
    }
    return this.userRepo.list();
  }

  async getUserById(actor: AuthenticatedPrincipal, userId: string): Promise<User | null> {
    if (actor.platformRole !== 'PLATFORM_ADMIN' && actor.userId !== userId) {
      throw new Error('Forbidden');
    }
    return this.userRepo.getById(userId);
  }

  async addMembership(
    actor: AuthenticatedPrincipal,
    organisationId: string,
    targetUserId: string,
    role: OrganisationRole
  ): Promise<OrganisationMembership> {
    const isPlatformAdmin = actor.platformRole === 'PLATFORM_ADMIN';
    const isOrgAdmin = actor.memberships.some(
      (m) => m.organisationId === organisationId && m.role === 'ORG_ADMIN'
    );

    if (!isPlatformAdmin && !isOrgAdmin) {
      await this.auditService.record({
        actor,
        organisationId,
        action: 'AUTHORIZATION_DENIED',
        targetType: 'MEMBERSHIP',
        outcome: 'DENIED',
        reason: 'ORG_ADMIN or PLATFORM_ADMIN required to manage memberships'
      });
      throw new Error('Forbidden: Admin authority required for organisation');
    }

    const targetUser = await this.userRepo.getById(targetUserId);
    if (!targetUser) {
      throw new Error('Target user does not exist');
    }

    const now = new Date().toISOString();
    const membership: OrganisationMembership = {
      organisationId,
      userId: targetUserId,
      role,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      createdByUserId: actor.userId
    };

    return this.withTransaction(async () => {
      await this.membershipRepo.save(membership);

      await this.auditService.record({
        actor,
        organisationId,
        action: 'MEMBERSHIP_CREATE',
        targetType: 'MEMBERSHIP',
        targetId: `${organisationId}:${targetUserId}`,
        outcome: 'SUCCESS',
        metadata: { targetUserId, role }
      });

      return membership;
    });
  }

  async updateMembershipRole(
    actor: AuthenticatedPrincipal,
    organisationId: string,
    targetUserId: string,
    newRole: OrganisationRole
  ): Promise<OrganisationMembership> {
    const isPlatformAdmin = actor.platformRole === 'PLATFORM_ADMIN';
    const isOrgAdmin = actor.memberships.some(
      (m) => m.organisationId === organisationId && m.role === 'ORG_ADMIN'
    );

    if (!isPlatformAdmin && !isOrgAdmin) {
      throw new Error('Forbidden: Admin authority required for organisation');
    }

    const current = await this.membershipRepo.get(organisationId, targetUserId);
    if (!current || current.status !== 'ACTIVE') {
      throw new Error('Active membership not found');
    }

    if (current.role === 'ORG_ADMIN' && newRole !== 'ORG_ADMIN') {
      const adminCount = await this.membershipRepo.countActiveAdmins(organisationId);
      if (adminCount <= 1) {
        throw new Error('Cannot demote the last ORG_ADMIN for this organisation');
      }
    }

    return this.withTransaction(async () => {
      const updated: OrganisationMembership = {
        ...current,
        role: newRole,
        updatedAt: new Date().toISOString()
      };

      await this.membershipRepo.save(updated);

      await this.auditService.record({
        actor,
        organisationId,
        action: 'MEMBERSHIP_ROLE_CHANGE',
        targetType: 'MEMBERSHIP',
        targetId: `${organisationId}:${targetUserId}`,
        outcome: 'SUCCESS',
        metadata: { targetUserId, previousRole: current.role, newRole }
      });

      return updated;
    });
  }

  async revokeMembership(
    actor: AuthenticatedPrincipal,
    organisationId: string,
    targetUserId: string
  ): Promise<void> {
    const isPlatformAdmin = actor.platformRole === 'PLATFORM_ADMIN';
    const isOrgAdmin = actor.memberships.some(
      (m) => m.organisationId === organisationId && m.role === 'ORG_ADMIN'
    );

    if (!isPlatformAdmin && !isOrgAdmin) {
      throw new Error('Forbidden: Admin authority required for organisation');
    }

    const current = await this.membershipRepo.get(organisationId, targetUserId);
    if (!current || current.status !== 'ACTIVE') {
      throw new Error('Active membership not found');
    }

    if (current.role === 'ORG_ADMIN') {
      const adminCount = await this.membershipRepo.countActiveAdmins(organisationId);
      if (adminCount <= 1) {
        throw new Error('Cannot revoke the last ORG_ADMIN for this organisation');
      }
    }

    await this.withTransaction(async () => {
      const updated: OrganisationMembership = {
        ...current,
        status: 'REVOKED',
        updatedAt: new Date().toISOString()
      };

      await this.membershipRepo.save(updated);

      await this.auditService.record({
        actor,
        organisationId,
        action: 'MEMBERSHIP_REVOKE',
        targetType: 'MEMBERSHIP',
        targetId: `${organisationId}:${targetUserId}`,
        outcome: 'SUCCESS',
        metadata: { targetUserId, revokedRole: current.role }
      });
    });
  }

  async listMemberships(
    actor: AuthenticatedPrincipal,
    organisationId: string
  ): Promise<OrganisationMembership[]> {
    const isPlatformAdmin = actor.platformRole === 'PLATFORM_ADMIN';
    const isOrgAdmin = actor.memberships.some(
      (m) => m.organisationId === organisationId && m.role === 'ORG_ADMIN'
    );

    if (!isPlatformAdmin && !isOrgAdmin) {
      throw new Error('Forbidden: Access denied to organisation memberships');
    }

    return this.membershipRepo.listByOrganisation(organisationId);
  }
}
