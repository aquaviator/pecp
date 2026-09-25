// IOrganisationMembershipRepository Contract
// Defined according to M5.1 Work Package §8

import { OrganisationMembership } from '../types.js';

export interface IOrganisationMembershipRepository {
  get(organisationId: string, userId: string): Promise<OrganisationMembership | null>;
  listByOrganisation(organisationId: string): Promise<OrganisationMembership[]>;
  listByUser(userId: string): Promise<OrganisationMembership[]>;
  save(membership: OrganisationMembership): Promise<void>;
  countActiveAdmins(organisationId: string): Promise<number>;
}
