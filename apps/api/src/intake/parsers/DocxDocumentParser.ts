// DocxDocumentParser - DOCX body and table extraction with content locators
// Defined according to M5.2 Work Package §1 & §4 [I01, I02]

import { randomUUID, createHash } from 'node:crypto';
import AdmZip from 'adm-zip';
import { SourceFormat, ExtractedFragment } from '@pecp/pe-domain';
import { IDocumentParser, ParsedDocumentOutput, ParseOptions } from './types.js';

export function extractTextFromXml(xml: string): string {
  // Extract all <w:t ...>text</w:t> and <w:t>text</w:t>
  const regex = /<w:t(?:\s+[^>]*)?>([^<]*)<\/w:t>/g;
  let match: RegExpExecArray | null;
  let text = '';
  while ((match = regex.exec(xml)) !== null) {
    text += match[1];
  }
  return text;
}

export class DocxDocumentParser implements IDocumentParser {
  readonly parserId = 'pecp-docx-parser';
  readonly parserVersion = '1.0.0';

  supports(format: SourceFormat): boolean {
    return format === 'DOCX';
  }

  async parse(
    buffer: Buffer,
    sourceVersionId: string,
    options?: ParseOptions
  ): Promise<ParsedDocumentOutput> {
    const maxExpandedBytes = options?.maxExpandedBytes ?? 50 * 1024 * 1024; // 50 MiB default
    const maxExtractedBytes = options?.maxExtractedBytes ?? 2 * 1024 * 1024; // 2 MiB default

    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
    } catch (err: any) {
      return {
        status: 'FAILED',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: `File is not a valid DOCX/ZIP package: ${err.message}`,
        limitations: ['Valid OpenXML DOCX archive required']
      };
    }

    const zipEntries = zip.getEntries();
    const maxEntries = 500;
    if (zipEntries.length > maxEntries) {
      return {
        status: 'FAILED',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: `DOCX archive contains too many entries (${zipEntries.length} > ${maxEntries})`,
        limitations: ['Zip-bomb prevention']
      };
    }

    let totalUncompressedSize = 0;

    for (const entry of zipEntries) {
      totalUncompressedSize += entry.header.size;

      // Check for macros / VBA
      if (
        entry.entryName.toLowerCase().includes('vbaproject.bin') ||
        entry.entryName.toLowerCase().endsWith('.docm')
      ) {
        return {
          status: 'FAILED',
          parserId: this.parserId,
          parserVersion: this.parserVersion,
          plainText: '',
          fragments: [],
          diagnostics: 'Macro-enabled documents (.docm / vbaProject) are not supported',
          limitations: ['No macro or active content execution']
        };
      }

      // Check for encryption
      if (entry.entryName.toLowerCase().includes('encryptedpackage')) {
        return {
          status: 'FAILED',
          parserId: this.parserId,
          parserVersion: this.parserVersion,
          plainText: '',
          fragments: [],
          diagnostics: 'Password-protected or encrypted DOCX documents are not supported',
          limitations: ['Unencrypted documents only']
        };
      }
    }

    if (totalUncompressedSize > maxExpandedBytes) {
      return {
        status: 'FAILED',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: `DOCX expanded content (${totalUncompressedSize} bytes) exceeds limit of ${maxExpandedBytes} bytes`,
        limitations: ['Zip-bomb prevention']
      };
    }

    const docXmlEntry = zip.getEntry('word/document.xml');
    if (!docXmlEntry) {
      return {
        status: 'FAILED',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: 'DOCX archive does not contain word/document.xml',
        limitations: ['Standard WordprocessingML required']
      };
    }

    let docXml: string;
    try {
      docXml = docXmlEntry.getData().toString('utf8');
    } catch (err: any) {
      return {
        status: 'FAILED',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: `Failed to read document.xml: ${err.message}`,
        limitations: ['UTF-8 XML required']
      };
    }

    // Parse paragraphs and tables from document body
    // In OpenXML: <w:body> contains <w:p> and <w:tbl>
    const bodyMatch = docXml.match(/<w:body(?:\s+[^>]*)?>([\s\S]*?)<\/w:body>/);
    const bodyContent = bodyMatch ? bodyMatch[1] : docXml;

    // Split top-level blocks: <w:p>...</w:p> and <w:tbl>...</w:tbl>
    const blockRegex = /(<w:p(?:\s+[^>]*)?>[\s\S]*?<\/w:p>|<w:tbl(?:\s+[^>]*)?>[\s\S]*?<\/w:tbl>)/g;
    let blockMatch: RegExpExecArray | null;

    const fragments: ExtractedFragment[] = [];
    const plainTextLines: string[] = [];
    let pCount = 0;
    let tblCount = 0;
    let segmentIndex = 1;

    while ((blockMatch = blockRegex.exec(bodyContent)) !== null) {
      const blockXml = blockMatch[1];

      if (blockXml.startsWith('<w:p')) {
        pCount++;
        const pText = extractTextFromXml(blockXml);
        if (pText.trim().length > 0) {
          plainTextLines.push(pText);
          fragments.push({
            id: randomUUID(),
            extractionId: '',
            sourceVersionId,
            segmentIndex: segmentIndex++,
            locator: `p:${pCount}`,
            text: pText
          });
        }
      } else if (blockXml.startsWith('<w:tbl')) {
        tblCount++;
        // Parse rows in table
        const rowRegex = /<w:tr(?:\s+[^>]*)?>([\s\S]*?)<\/w:tr>/g;
        let rowMatch: RegExpExecArray | null;
        let rCount = 0;

        while ((rowMatch = rowRegex.exec(blockXml)) !== null) {
          rCount++;
          const rowXml = rowMatch[1];
          // Parse cells in row
          const cellRegex = /<w:tc(?:\s+[^>]*)?>([\s\S]*?)<\/w:tc>/g;
          let cellMatch: RegExpExecArray | null;
          let cCount = 0;

          while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
            cCount++;
            const cellXml = cellMatch[1];
            const cellText = extractTextFromXml(cellXml);
            if (cellText.trim().length > 0) {
              plainTextLines.push(cellText);
              fragments.push({
                id: randomUUID(),
                extractionId: '',
                sourceVersionId,
                segmentIndex: segmentIndex++,
                locator: `tbl:${tblCount}/r:${rCount}/c:${cCount}`,
                text: cellText
              });
            }
          }
        }
      }
    }

    const fullText = plainTextLines.join('\n');
    const contentDigest = createHash('sha256').update(buffer).digest('hex');
    const extractedBytes = Buffer.byteLength(fullText, 'utf8');

    if (extractedBytes > maxExtractedBytes) {
      return {
        status: 'FAILED',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: `Extracted text (${extractedBytes} bytes) exceeds limit of ${maxExtractedBytes} bytes`,
        limitations: ['Text size bounded to 2 MiB']
      };
    }

    if (fullText.trim().length === 0) {
      return {
        status: 'NO_EXTRACTABLE_TEXT',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: 'DOCX document contains no text in body paragraphs or tables',
        limitations: [
          'No page numbers (DOCX flow format does not contain pagination)',
          'Images/diagrams are not OCR-analyzed'
        ]
      };
    }

    return {
      status: 'SUCCESS',
      parserId: this.parserId,
      parserVersion: this.parserVersion,
      plainText: fullText,
      fragments,
      contentDigest,
      limitations: [
        'Body paragraphs and tables indexed with content locators (p:n, tbl:t/r:r/c:c)',
        'Does not invent page numbers (OpenXML flow document has no fixed page boundaries)',
        'No macro or external template execution'
      ]
    };
  }
}
