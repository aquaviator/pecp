// IIdempotencyRepository
// Defined according to M5.2 Work Package §5 [I03]

export interface IdempotencyRecord {
  key: string;
  projectId: string;
  actorUserId: string;
  operation: string;
  payloadSha256: string;
  responseStatus: number;
  responseJson: string;
  createdAt: string;
}

export interface IIdempotencyRepository {
  get(key: string): Promise<IdempotencyRecord | null>;
  save(record: IdempotencyRecord): Promise<void>;
}
