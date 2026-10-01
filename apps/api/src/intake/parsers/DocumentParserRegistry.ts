// DocumentParserRegistry - Format detection, parser dispatch, and operational limit enforcement
// Defined according to M5.2 Work Package §1, §3 & §4 [I01, I02]

import { createHash } from 'node:crypto';
import * as path from 'node:path';
import { Worker } from 'node:worker_threads';
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
    if (['.exe', '.dll', '.so', '.dylib', '.bin', '.sh', '.bat', '.cmd', '.py', '.js', '.ts'].includes(ext)) {
      return {
        format: 'UNSUPPORTED',
        mediaType: declaredMime || 'application/octet-stream',
        isSupported: false,
        rejectionReason: 'Executable or script files are not permitted for intake.'
      };
    }

    // PDF format check: strictly check header
    if (ext === '.pdf' || declaredMime === 'application/pdf') {
      if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
        return {
          format: 'PDF',
          mediaType: 'application/pdf',
          isSupported: true
        };
      }
      return {
        format: 'PDF',
        mediaType: 'application/pdf',
        isSupported: false,
        rejectionReason: 'File declared as PDF does not match PDF structure (missing %PDF- header).'
      };
    }

    // DOCX format check: strictly check PK zip signature
    if (
      ext === '.docx' ||
      declaredMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      if (
        buffer.length >= 4 &&
        buffer[0] === 0x50 &&
        buffer[1] === 0x4b &&
        buffer[2] === 0x03 &&
        buffer[3] === 0x04
      ) {
        return {
          format: 'DOCX',
          mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          isSupported: true
        };
      }
      return {
        format: 'DOCX',
        mediaType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        isSupported: false,
        rejectionReason: 'File declared as DOCX is not a valid OpenXML ZIP package.'
      };
    }

    // Extension and text check for supported text formats
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

    if (ext === '.txt' || declaredMime === 'text/plain') {
      return {
        format: 'PLAIN_TEXT',
        mediaType: 'text/plain',
        isSupported: true
      };
    }

    // If extension is empty and declared MIME starts with text/
    if (!ext && declaredMime?.startsWith('text/')) {
      return {
        format: 'PLAIN_TEXT',
        mediaType: declaredMime,
        isSupported: true
      };
    }

    // Do not quietly accept unknown file formats as plain text!
    return {
      format: 'UNSUPPORTED',
      mediaType: declaredMime || 'application/octet-stream',
      isSupported: false,
      rejectionReason: `Unsupported file format or extension: '${ext || 'unknown'}'`
    };
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

    // Bounded server-side execution mechanism with dedicated worker thread and termination on timeout (§3 [I01, I02])
    const workerUrl = options?.workerUrlOverride ?? new URL('./documentParserWorker.cjs', import.meta.url);

    return new Promise<ParsedDocumentOutput>((resolve) => {
      let settled = false;
      let timer: NodeJS.Timeout | null = null;
      let worker: Worker | null = null;

      const cleanup = async () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (worker) {
          try {
            await worker.terminate();
          } catch {
            // ignore termination error
          }
          worker = null;
        }
      };

      timer = setTimeout(async () => {
        if (settled) return;
        settled = true;
        await cleanup();
        resolve({
          status: 'FAILED',
          parserId: parser.parserId,
          parserVersion: parser.parserVersion,
          plainText: '',
          fragments: [],
          diagnostics: `Extraction timed out after ${timeoutMs}ms deadline and parser worker was terminated`
        });
      }, timeoutMs);

      try {
        worker = new Worker(workerUrl);

        worker.on('message', async (msg) => {
          if (settled) return;
          settled = true;
          await cleanup();
          if (msg.error) {
            resolve({
              status: msg.status || 'FAILED',
              parserId: parser.parserId,
              parserVersion: parser.parserVersion,
              plainText: '',
              fragments: [],
              diagnostics: `Extraction error: ${msg.error}`
            });
          } else {
            resolve(msg.result);
          }
        });

        worker.on('error', async (err) => {
          if (settled) return;
          settled = true;
          await cleanup();
          // Fail safely with deterministic FAILED result; no unbounded main-thread execution (§3 [I01, I02])
          resolve({
            status: 'FAILED',
            parserId: parser.parserId,
            parserVersion: parser.parserVersion,
            plainText: '',
            fragments: [],
            diagnostics: `Extraction worker execution failure: ${err.message}`
          });
        });

        worker.postMessage({
          format,
          buffer,
          sourceVersionId,
          options
        });
      } catch (err: any) {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve({
          status: 'FAILED',
          parserId: parser.parserId,
          parserVersion: parser.parserVersion,
          plainText: '',
          fragments: [],
          diagnostics: `Extraction worker startup failure: ${err.message}`
        });
      }
    });
  }
}
