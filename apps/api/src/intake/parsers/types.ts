// Parser Interfaces & Limitations for M5.2 Intake
// Defined according to M5.2 Work Package §4 [I02]

import { SourceFormat, ExtractionStatus, ExtractedFragment } from '@pecp/pe-domain';

export interface ParseOptions {
  timeoutMs?: number;
  maxExtractedBytes?: number;
  maxPages?: number;
  maxExpandedBytes?: number;
  workerUrlOverride?: URL;
  simulateInfiniteLoop?: boolean;
  simulateHangMs?: number;
}

export interface ParsedDocumentOutput {
  status: ExtractionStatus;
  parserId: string;
  parserVersion: string;
  plainText: string;
  fragments: ExtractedFragment[];
  contentDigest?: string;
  pageCount?: number | null;
  diagnostics?: string | null;
  limitations?: string[];
}

export interface IDocumentParser {
  readonly parserId: string;
  readonly parserVersion: string;
  supports(format: SourceFormat): boolean;
  parse(
    buffer: Buffer,
    sourceVersionId: string,
    options?: ParseOptions
  ): Promise<ParsedDocumentOutput>;
}
