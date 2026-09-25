// IAuditRepository Contract
// Defined according to M5.1 Work Package §8

import { AuditEvent, AuditQueryFilter } from '../types.js';

export interface IAuditRepository {
  append(event: AuditEvent): Promise<void>;
  query(filter: AuditQueryFilter): Promise<AuditEvent[]>;
}
