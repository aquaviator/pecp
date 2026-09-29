// ISourceRepository
// Defined according to M5.2 Work Package §3 & §5 [I01, I03]

import { SourceMetadata, SourceVersion, ExtractionStatus } from '@pecp/pe-domain';

export interface ISourceRepository {
  createSource(
    source: SourceMetadata,
    initialVersion: SourceVersion,
    bytes: Buffer
  ): Promise<{ source: SourceMetadata; version: SourceVersion }>;

  createVersion(version: SourceVersion, bytes: Buffer): Promise<SourceVersion>;

  getSource(projectId: string, sourceId: string): Promise<SourceMetadata | null>;

  listSources(projectId: string): Promise<SourceMetadata[]>;

  getVersion(projectId: string, sourceId: string, versionId: string): Promise<SourceVersion | null>;

  getVersionByNumber(
    projectId: string,
    sourceId: string,
    versionNumber: number
  ): Promise<SourceVersion | null>;

  listVersions(projectId: string, sourceId: string): Promise<SourceVersion[]>;

  getBlob(projectId: string, versionId: string): Promise<Buffer | null>;

  updateSourceCurrentVersion(
    projectId: string,
    sourceId: string,
    versionId: string,
    versionNumber: number
  ): Promise<void>;

  updateVersionExtraction(
    projectId: string,
    versionId: string,
    status: ExtractionStatus,
    extractionId?: string | null,
    diagnostics?: string | null
  ): Promise<void>;

  getAggregateByteSize(projectId: string): Promise<number>;
}
