// IEntityRevisionRepository
// Defined according to M5.0 Work Package §3

import { EntityRevision } from '../types';

export interface IEntityRevisionRepository {
  recordRevision(revision: EntityRevision): Promise<void>;
  listByEntity(entityType: string, entityId: string): Promise<EntityRevision[]>;
  getLatestRevisionNumber(entityType: string, entityId: string): Promise<number>;
}
