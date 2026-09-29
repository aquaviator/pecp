// IExtractionRepository
// Defined according to M5.2 Work Package §4 & §5 [I02, I03]

import { ExtractionResult, ExtractedFragment } from '@pecp/pe-domain';

export interface IExtractionRepository {
  saveExtraction(result: ExtractionResult): Promise<void>;
  getExtraction(projectId: string, extractionId: string): Promise<ExtractionResult | null>;
  getExtractionByVersion(projectId: string, sourceVersionId: string): Promise<ExtractionResult | null>;
  getFragments(projectId: string, extractionId: string): Promise<ExtractedFragment[]>;
}
