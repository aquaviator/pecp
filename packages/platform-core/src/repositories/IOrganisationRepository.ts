// IOrganisationRepository
// Defined according to M5.0 Work Package §2

import { Organisation, OrganisationStatus } from '../types';

export interface IOrganisationRepository {
  list(): Promise<Organisation[]>;
  getById(id: string): Promise<Organisation | null>;
  getByName(name: string): Promise<Organisation | null>;
  create(org: Organisation): Promise<Organisation>;
  updateStatus(id: string, status: OrganisationStatus): Promise<Organisation | null>;
}
