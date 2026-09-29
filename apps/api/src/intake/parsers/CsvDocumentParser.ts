// CsvDocumentParser - RFC 4180 CSV parser with row/column locators
// Defined according to M5.2 Work Package §1 & §4 [I01, I02]

import { randomUUID, createHash } from 'node:crypto';
import { SourceFormat, ExtractedFragment } from '@pecp/pe-domain';
import { IDocumentParser, ParsedDocumentOutput, ParseOptions } from './types.js';

export function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < input.length && input[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (i + 1 < input.length && input[i + 1] === '\n') {
          i++;
        }
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Final field and row if any
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

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
