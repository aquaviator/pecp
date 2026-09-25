// AuditService - Immutable, Append-Only Governed Audit Trail
// Defined according to M5.1 Work Package §7, §9 & §14

import * as crypto from 'node:crypto';
import { IAuditRepository } from '../repositories/IAuditRepository.js';
import {
  AuditEvent,
  AuditAction,
  AuditOutcome,
  AuditQueryFilter,
  AuthenticatedPrincipal
} from '../types.js';

export interface RecordAuditEventInput {
  actor?: AuthenticatedPrincipal | null;
  actorUserId?: string | null;
  actorDisplayName?: string | null;
  organisationId?: string | null;
  projectId?: string | null;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  outcome: AuditOutcome;
  reason?: string | null;
  metadata?: Record<string, any> | null;
}

export class AuditService {
  constructor(private auditRepo: IAuditRepository) {}

  async record(input: RecordAuditEventInput): Promise<AuditEvent> {
    // Sanitization: Ensure metadata NEVER contains password, token, hash, secret or csrf
    let metadataJson: string | null = null;
    if (input.metadata) {
      const cleanMetadata: Record<string, any> = {};
      for (const [key, val] of Object.entries(input.metadata)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('password') ||
          lowerKey.includes('token') ||
          lowerKey.includes('hash') ||
          lowerKey.includes('secret') ||
          lowerKey.includes('csrf')
        ) {
          continue; // strictly exclude/redact
        }
        cleanMetadata[key] = val;
      }
      metadataJson = JSON.stringify(cleanMetadata);
    }

    const event: AuditEvent = {
      id: crypto.randomUUID(),
      occurredAt: new Date().toISOString(),
      actorUserId: input.actor ? input.actor.userId : (input.actorUserId ?? null),
      actorDisplayName: input.actor ? input.actor.displayName : (input.actorDisplayName ?? null),
      organisationId: input.organisationId ?? null,
      projectId: input.projectId ?? null,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      outcome: input.outcome,
      reason: input.reason ?? null,
      metadataJson
    };

    await this.auditRepo.append(event);
    return event;
  }

  async query(filter: AuditQueryFilter): Promise<AuditEvent[]> {
    return this.auditRepo.query(filter);
  }
}
