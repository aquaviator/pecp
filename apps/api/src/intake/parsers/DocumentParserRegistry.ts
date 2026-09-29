// DocumentParserRegistry - Format detection, parser dispatch, and operational limit enforcement
// Defined according to M5.2 Work Package §1, §3 & §4 [I01, I02]

import { createHash, randomUUID } from 'node:crypto';
import * as path from 'node:path';
import {
  SourceFormat,
  ExtractionResult,
  ExtractionStatus
} from '@pecp/pe-domain';
import { IDocumentParser, ParsedDocumentOutput, ParseOptions } from './types.js';
import { TextDocumentParser } from './TextDocumentParser.js';
import { CsvDocumentParser } from './CsvDocumentParser.js';
import { JsonDocumentParser } from './JsonDocumentParser.js';
import { DocxDocumentParser } from './DocxDocumentParser.js';
import { PdfDocumentParser } from './PdfDocumentParser.js';

export interface FormatDetectionResult {
  format: SourceFormat;
  mediaType: string;
  isSupported: boolean;
  rejectionReason?: string;
}

export class DocumentParserRegistry {
  private parsers: IDocumentParser[] = [
    new TextDocumentParser(),
    new CsvDocumentParser(),
    new JsonDocumentParser(),
    new DocxDocumentParser(),
    new PdfDocumentParser()
  ];

  detectFormat(filename: string, buffer: Buffer, declaredMime?: string): FormatDetectionResult {
    const ext = path.extname(filename).toLowerCase();

    // Check unsupported legacy / binary formats explicitly
    if (ext === '.xlsx' || ext === '.xls') {
      return {
        format: 'UNSUPPORTED',
        mediaType: declaredMime || 'application/vnd.ms-excel',
        isSupported: false,
        rejectionReason: 'Excel spreadsheets (.xlsx/.xls) are not supported in M5.2. Please export and upload as CSV.'
      };
    }
    if (ext === '.doc') {
      return {
        format: 'UNSUPPORTED',
        mediaType: declaredMime || 'application/msword',
        isSupported: false,
        rejectionReason: 'Legacy Word documents (.doc) are not supported. Please upload OpenXML .docx or plain text.'
      };
    }
    if (ext === '.docm') {
      return {
        format: 'UNSUPPORTED',
        mediaType: declaredMime || 'application/vnd.ms-word.document.macroEnabled.12',
        isSupported: false,
        rejectionReason: 'Macro-enabled Word documents (.docm) are rejected for security.'
      };
    }
    if (ext === '.pptx' || ext === '.ppt') {
      return {
        format: 'UNSUPPORTED',
        mediaType: declaredMime || 'application/vnd.ms-powerpoint',
        isSupported: false,
        rejectionReason: 'Slide decks (.pptx/.ppt) are not supported.'
      };
    }
    if (['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'].includes(ext)) {
      return {
        format: 'UNSUPPORTED',
        mediaType: declaredMime || 'image/png',
        isSupported: false,
        rejectionReason: 'Image files and OCR scanning are not supported in M5.2.'
      };
    }
    if (['.zip', '.tar', '.gz', '.7z', '.rar'].includes(ext)) {
      return {
        format: 'UNSUPPORTED',
        mediaType: declaredMime || 'application/zip',
        isSupported: false,
        rejectionReason: 'Arbitrary archive files are not supported.'
      };
    }

    // Content-based magic bytes detection
    if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
      return {
        format: 'PDF',
        mediaType: 'application/pdf',
        isSupported: true
      };
    }

    // PK zip signature (0x50, 0x4B, 0x03, 0x04)
    if (
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    ) {
      if (ext === '.docx') {
        return {
          format: 'DOCX',
          mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          isSupported: true
        };
      }
      return {
        format: 'UNSUPPORTED',
        mediaType: declaredMime || 'application/zip',
        isSupported: false,
        rejectionReason: 'Generic ZIP archives are not supported. Only valid .docx files are permitted.'
      };
    }

    // Extension and text check
    if (ext === '.csv' || declaredMime === 'text/csv') {
      return {
        format: 'CSV',
        mediaType: 'text/csv',
        isSupported: true
      };
    }

    if (ext === '.json' || declaredMime === 'application/json') {
      return {
        format: 'JSON',
        mediaType: 'application/json',
        isSupported: true
      };
    }

    if (ext === '.md' || declaredMime === 'text/markdown') {
      return {
        format: 'MARKDOWN',
        mediaType: 'text/markdown',
        isSupported: true
      };
    }

    if (ext === '.txt' || declaredMime?.startsWith('text/')) {
      return {
        format: 'PLAIN_TEXT',
        mediaType: 'text/plain',
        isSupported: true
      };
    }

    // Try parsing as JSON first
    const trimmed = buffer.subarray(0, 50).toString('utf8').trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        JSON.parse(buffer.toString('utf8'));
        return {
          format: 'JSON',
          mediaType: 'application/json',
          isSupported: true
        };
      } catch {
        // Not JSON
      }
    }

    // Default to plain text if valid UTF-8
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      return {
        format: 'PLAIN_TEXT',
        mediaType: 'text/plain',
        isSupported: true
      };
    } catch {
      return {
        format: 'UNSUPPORTED',
        mediaType: declaredMime || 'application/octet-stream',
        isSupported: false,
        rejectionReason: 'Unsupported binary or unknown file format.'
      };
    }
  }

  calculateDigest(plainText: string): string {
    return createHash('sha256').update(plainText).digest('hex');
  }

  async parse(
    format: SourceFormat,
    buffer: Buffer,
    sourceVersionId: string,
    options?: ParseOptions
  ): Promise<ParsedDocumentOutput> {
    const parser = this.parsers.find((p) => p.supports(format));
    const timeoutMs = options?.timeoutMs ?? 30000; // 30s deadline

    if (!parser) {
      return {
        status: 'FAILED',
        parserId: 'none',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: `No parser available for format: ${format}`
      };
    }

    let parsedOutput: ParsedDocumentOutput;

    // Timeout execution wrapper
    const parsePromise = parser.parse(buffer, sourceVersionId, options);
    let timer: NodeJS.Timeout | null = null;
    const timeoutPromise = new Promise<ParsedDocumentOutput>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Extraction timed out after ${timeoutMs}ms deadline`));
      }, timeoutMs);
    });

    try {
      parsedOutput = await Promise.race([parsePromise, timeoutPromise]);
    } catch (err: any) {
      parsedOutput = {
        status: 'FAILED',
        parserId: parser.parserId,
        parserVersion: parser.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: `Extraction error: ${err.message}`
      };
    } finally {
      if (timer) clearTimeout(timer);
    }

    return parsedOutput;
  }
}

