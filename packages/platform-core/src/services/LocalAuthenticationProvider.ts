// LocalAuthenticationProvider - Embedded Local Scrypt Identity Provider
// Defined according to M5.1 Work Package §5 & §6
import { IAuthenticationProvider, AuthenticationResult } from './IAuthenticationProvider.js';
import { IUserRepository } from '../repositories/IUserRepository.js';
import { ILocalCredentialRepository } from '../repositories/ILocalCredentialRepository.js';
import { IOrganisationMembershipRepository } from '../repositories/IOrganisationMembershipRepository.js';
import { PasswordHasher } from './PasswordHasher.js';
import { AuthenticatedPrincipal, PrincipalMembership } from '../types.js';

export class LocalAuthenticationProvider implements IAuthenticationProvider {
  readonly providerId = 'LOCAL';

  constructor(
    private userRepo: IUserRepository,
    private credentialRepo: ILocalCredentialRepository,
    private membershipRepo: IOrganisationMembershipRepository
  ) {}

  async authenticate(credentials: Record<string, any>): Promise<AuthenticationResult> {
    const { email, password } = credentials;
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return { success: false, errorMessage: 'Invalid email or password' };
    }

    const user = await this.userRepo.getByEmail(email);
    if (!user || user.status === 'DISABLED') {
      return { success: false, errorMessage: 'Invalid email or password' };
    }

    const credential = await this.credentialRepo.getByUserId(user.id);
    if (!credential) {
      return { success: false, errorMessage: 'Invalid email or password' };
    }

    const isValid = await PasswordHasher.verify(
      password,
      credential.salt,
      credential.passwordHash,
      credential.paramsJson
    );
    if (!isValid) {
      return { success: false, errorMessage: 'Invalid email or password' };
    }

    const allMemberships = await this.membershipRepo.listByUser(user.id);
    const activeMemberships: PrincipalMembership[] = allMemberships
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => ({ organisationId: m.organisationId, role: m.role }));

    const principal: AuthenticatedPrincipal = {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      platformRole: user.platformRole,
      memberships: activeMemberships,
      sessionId: '', // Bound upon session creation
      authenticatedAt: new Date().toISOString()
    };

    return {
      success: true,
      principal,
      user
    };
  }

  async buildPrincipal(
    userId: string,
    sessionId: string,
    authenticatedAt?: string
  ): Promise<AuthenticatedPrincipal | null> {
    const user = await this.userRepo.getById(userId);
    if (!user || user.status === 'DISABLED') {
      return null;
    }

    const allMemberships = await this.membershipRepo.listByUser(user.id);
    const activeMemberships: PrincipalMembership[] = allMemberships
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => ({ organisationId: m.organisationId, role: m.role }));

    return {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      platformRole: user.platformRole,
      memberships: activeMemberships,
      sessionId,
      authenticatedAt: authenticatedAt ?? new Date().toISOString()
    };
  }
}
