// TextDocumentParser - Strict UTF-8 text and markdown extraction with line locators
// Defined according to M5.2 Work Package §1 & §4 [I01, I02]

import { randomUUID, createHash } from 'node:crypto';
import { SourceFormat, ExtractedFragment } from '@pecp/pe-domain';
import { IDocumentParser, ParsedDocumentOutput, ParseOptions } from './types.js';

export class TextDocumentParser implements IDocumentParser {
  readonly parserId = 'pecp-text-parser';
  readonly parserVersion = '1.0.0';

  supports(format: SourceFormat): boolean {
    return format === 'PLAIN_TEXT' || format === 'MARKDOWN';
  }

  async parse(
    buffer: Buffer,
    sourceVersionId: string,
    options?: ParseOptions
  ): Promise<ParsedDocumentOutput> {
    const maxBytes = options?.maxExtractedBytes ?? 2 * 1024 * 1024; // 2 MiB default

    if (buffer.length > maxBytes) {
      return {
        status: 'FAILED',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: `Text content exceeds maximum extraction limit of ${maxBytes} bytes`,
        limitations: ['Strict UTF-8 extraction', 'No script execution']
      };
    }

    // Validate UTF-8
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
        diagnostics: 'File content is not valid UTF-8 text',
        limitations: ['UTF-8 encoding required']
      };
    }

    if (text.trim().length === 0) {
      return {
        status: 'NO_EXTRACTABLE_TEXT',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: 'Source text is empty or contains only whitespace',
        limitations: ['Text is inert']
      };
    }

    const lines = text.split(/\r?\n/);
    const fragments: ExtractedFragment[] = [];
    let currentOffset = 0;

    const contentDigest = createHash('sha256').update(buffer).digest('hex');

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const lineLen = lineText.length;
      if (lineText.trim().length > 0) {
        fragments.push({
          id: randomUUID(),
          extractionId: '', // populated by caller
          sourceVersionId,
          segmentIndex: i + 1,
          locator: `char:${currentOffset}-${currentOffset + lineLen}`,
          text: lineText,
          characterOffset: currentOffset,
          length: lineLen
        });
      }
      currentOffset += lineLen + 1; // +1 for newline
    }

    return {
      status: 'SUCCESS',
      parserId: this.parserId,
      parserVersion: this.parserVersion,
      plainText: text,
      fragments,
      contentDigest,
      limitations: [
        'Rendered as inert text in M5.2',
        'No macro, formula, or script interpretation'
      ]
    };
  }
}
