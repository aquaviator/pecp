// JsonDocumentParser - Bounded JSON parser with JSON Pointer (RFC 6901) locators
// Defined according to M5.2 Work Package §1 & §4 [I01, I02]

import { randomUUID, createHash } from 'node:crypto';
import { SourceFormat, ExtractedFragment } from '@pecp/pe-domain';
import { IDocumentParser, ParsedDocumentOutput, ParseOptions } from './types.js';

export function traverseJsonPointers(
  obj: any,
  currentPointer: string = '',
  depth: number = 0,
  maxDepth: number = 20,
  fragments: ExtractedFragment[] = [],
  sourceVersionId: string = ''
): void {
  if (depth > maxDepth) {
    throw new Error(`JSON nesting exceeds maximum depth of ${maxDepth}`);
  }

  if (obj === null || obj === undefined) {
    fragments.push({
      id: randomUUID(),
      extractionId: '',
      sourceVersionId,
      segmentIndex: fragments.length + 1,
      locator: currentPointer || '/',
      text: 'null'
    });
    return;
  }

  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    fragments.push({
      id: randomUUID(),
      extractionId: '',
      sourceVersionId,
      segmentIndex: fragments.length + 1,
      locator: currentPointer || '/',
      text: String(obj)
    });
    return;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      fragments.push({
        id: randomUUID(),
        extractionId: '',
        sourceVersionId,
        segmentIndex: fragments.length + 1,
        locator: currentPointer || '/',
        text: '[]'
      });
      return;
    }
    for (let i = 0; i < obj.length; i++) {
      traverseJsonPointers(
        obj[i],
        `${currentPointer}/${i}`,
        depth + 1,
        maxDepth,
        fragments,
        sourceVersionId
      );
    }
    return;
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj);
    if (keys.length === 0) {
      fragments.push({
        id: randomUUID(),
        extractionId: '',
        sourceVersionId,
        segmentIndex: fragments.length + 1,
        locator: currentPointer || '/',
        text: '{}'
      });
      return;
    }
    for (const key of keys) {
      // RFC 6901 escape: '~' -> '~0', '/' -> '~1'
      const escapedKey = key.replace(/~/g, '~0').replace(/\//g, '~1');
      traverseJsonPointers(
        obj[key],
        `${currentPointer}/${escapedKey}`,
        depth + 1,
        maxDepth,
        fragments,
        sourceVersionId
      );
    }
    return;
  }
}

export class JsonDocumentParser implements IDocumentParser {
  readonly parserId = 'pecp-json-parser';
  readonly parserVersion = '1.0.0';

  supports(format: SourceFormat): boolean {
    return format === 'JSON';
  }

  async parse(
    buffer: Buffer,
    sourceVersionId: string,
    options?: ParseOptions
  ): Promise<ParsedDocumentOutput> {
    const maxBytes = options?.maxExtractedBytes ?? 2 * 1024 * 1024;

    if (buffer.length > maxBytes) {
      return {
        status: 'FAILED',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: `JSON content exceeds maximum limit of ${maxBytes} bytes`,
        limitations: ['Size bounded to 2MB']
      };
    }

    let text: string;
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      text = decoder.decode(buffer);
    } catch {
      return {
        status: 'FAILED',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: 'JSON is not valid UTF-8 text',
        limitations: ['UTF-8 encoding required']
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (err: any) {
      return {
        status: 'FAILED',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: `Invalid JSON syntax: ${err.message}`,
        limitations: ['Valid JSON required']
      };
    }

    const fragments: ExtractedFragment[] = [];
    try {
      traverseJsonPointers(parsed, '', 0, 20, fragments, sourceVersionId);
    } catch (err: any) {
      return {
        status: 'FAILED',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: err.message,
        limitations: ['Maximum nesting depth 20']
      };
    }

    const contentDigest = createHash('sha256').update(buffer).digest('hex');

    return {
      status: 'SUCCESS',
      parserId: this.parserId,
      parserVersion: this.parserVersion,
      plainText: JSON.stringify(parsed, null, 2),
      fragments,
      contentDigest,
      limitations: [
        'RFC 6901 JSON Pointer locators',
        'Strict JSON schema validation on import',
        'No executable code evaluation'
      ]
    };
  }
}
