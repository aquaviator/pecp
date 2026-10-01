// CsvDocumentParser - RFC 4180 CSV parser with row/column locators
// Defined according to M5.2 Work Package §1 & §4 [I01, I02]

import { randomUUID, createHash } from 'node:crypto';
import { SourceFormat, ExtractedFragment, parseCsvRows } from '@pecp/pe-domain';
import { IDocumentParser, ParsedDocumentOutput, ParseOptions } from './types.js';

export { parseCsvRows };

export class CsvDocumentParser implements IDocumentParser {
  readonly parserId = 'pecp-csv-parser';
  readonly parserVersion = '1.0.0';

  supports(format: SourceFormat): boolean {
    return format === 'CSV';
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
        diagnostics: `CSV content exceeds maximum limit of ${maxBytes} bytes`,
        limitations: ['RFC 4180 parsing only', 'No formulas executed']
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
        diagnostics: 'CSV is not valid UTF-8 text',
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
        diagnostics: 'CSV file is empty',
        limitations: ['No records found']
      };
    }

    let rows: string[][];
    try {
      rows = parseCsvRows(text);
    } catch (err: any) {
      return {
        status: 'FAILED',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: `Failed to parse CSV: ${err.message}`,
        limitations: ['Malformed CSV structure']
      };
    }

    if (rows.length === 0) {
      return {
        status: 'NO_EXTRACTABLE_TEXT',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: 'CSV contains no rows',
        limitations: ['Empty CSV']
      };
    }

    const fragments: ExtractedFragment[] = [];
    const headers = rows[0] || [];
    let segmentIndex = 1;
    const contentDigest = createHash('sha256').update(buffer).digest('hex');

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let c = 0; c < row.length; c++) {
        const val = row[c];
        const colHeader = headers[c] ?? `col_${c + 1}`;
        fragments.push({
          id: randomUUID(),
          extractionId: '',
          sourceVersionId,
          segmentIndex: segmentIndex++,
          locator: r === 0 ? `header:col:${c + 1}` : `row:${r},col:${c + 1}`,
          text: val,
          metadataJson: JSON.stringify({
            row: r,
            col: c + 1,
            header: colHeader
          })
        });
      }
    }

    return {
      status: 'SUCCESS',
      parserId: this.parserId,
      parserVersion: this.parserVersion,
      plainText: text,
      fragments,
      contentDigest,
      limitations: [
        'RFC 4180 parsing',
        'No formula execution or external link resolution',
        'Values preserved as exact strings until explicit mapping'
      ]
    };
  }
}
