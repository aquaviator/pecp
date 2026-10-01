// PdfDocumentParser - Text-based PDF extraction with verified page-level locators
// Defined according to M5.2 Work Package §1, §3 & §4 [I01, I02]

import { randomUUID, createHash } from 'node:crypto';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { SourceFormat, ExtractedFragment } from '@pecp/pe-domain';
import { IDocumentParser, ParsedDocumentOutput, ParseOptions } from './types.js';

export class PdfDocumentParser implements IDocumentParser {
  readonly parserId = 'pecp-pdf-parser';
  readonly parserVersion = '1.1.1';

  supports(format: SourceFormat): boolean {
    return format === 'PDF';
  }

  async parse(
    buffer: Buffer,
    sourceVersionId: string,
    options?: ParseOptions
  ): Promise<ParsedDocumentOutput> {
    const maxPages = options?.maxPages ?? 200;
    const maxExtractedBytes = options?.maxExtractedBytes ?? 2 * 1024 * 1024; // 2 MiB default
    const contentDigest = createHash('sha256').update(buffer).digest('hex');

    // Validate magic bytes (%PDF-)
    if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return {
        status: 'FAILED',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: 'File header does not match PDF format (%PDF-)',
        limitations: ['Valid PDF format required']
      };
    }

    const pageTexts: Array<{ pageNumber: number; text: string }> = [];

    // Custom pagerender to capture text per page strictly from verified document structure
    const renderPage = (pageData: any): Promise<string> => {
      const renderOptions = {
        normalizeWhitespace: false,
        disableCombineTextItems: false
      };
      return pageData.getTextContent(renderOptions).then((textContent: any) => {
        let lastY: any;
        let text = '';
        for (const item of textContent.items) {
          if (lastY === item.transform[5] || !lastY) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }
        pageTexts.push({
          pageNumber: pageTexts.length + 1,
          text
        });
        return text;
      });
    };

    let data: any;
    try {
      data = await pdfParse(buffer, {
        pagerender: renderPage
      });
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('encrypt')) {
        return {
          status: 'FAILED',
          parserId: this.parserId,
          parserVersion: this.parserVersion,
          plainText: '',
          fragments: [],
          diagnostics: 'Password-protected or encrypted PDF documents are not supported',
          limitations: ['Unencrypted PDF required']
        };
      }
      return {
        status: 'FAILED',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        diagnostics: `PDF parsing failed: ${msg}`,
        limitations: ['Corrupt or unsupported PDF structure']
      };
    }

    const totalPages = data.numpages || pageTexts.length;

    if (totalPages > maxPages) {
      return {
        status: 'FAILED',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        pageCount: totalPages,
        diagnostics: `PDF page count (${totalPages}) exceeds maximum permitted limit of ${maxPages} pages`,
        limitations: [`Limit: maximum ${maxPages} pages`]
      };
    }

    const fragments: ExtractedFragment[] = [];
    const plainTextPieces: string[] = [];
    let segmentIndex = 1;

    for (const page of pageTexts) {
      const trimmed = page.text.trim();
      if (trimmed.length > 0) {
        plainTextPieces.push(`--- Page ${page.pageNumber} ---\n${page.text}`);
        fragments.push({
          id: randomUUID(),
          extractionId: '',
          sourceVersionId,
          segmentIndex: segmentIndex++,
          locator: `page:${page.pageNumber}`,
          text: page.text
        });
      }
    }

    const fullText = plainTextPieces.join('\n\n');
    const extractedBytes = Buffer.byteLength(fullText, 'utf8');

    if (extractedBytes > maxExtractedBytes) {
      return {
        status: 'FAILED',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        pageCount: totalPages,
        diagnostics: `Extracted PDF text (${extractedBytes} bytes) exceeds limit of ${maxExtractedBytes} bytes`,
        limitations: ['Extracted text bounded to 2 MiB']
      };
    }

    if (fullText.trim().length === 0) {
      return {
        status: 'NO_EXTRACTABLE_TEXT',
        parserId: this.parserId,
        parserVersion: this.parserVersion,
        plainText: '',
        fragments: [],
        pageCount: totalPages,
        contentDigest,
        diagnostics:
          'No extractable text layer found in PDF (scanned/raster document or empty pages)',
        limitations: [
          'Text-based PDF only',
          'No OCR scanning performed',
          'Manual stakeholder assertion can be supplied instead'
        ]
      };
    }

    return {
      status: 'SUCCESS',
      parserId: this.parserId,
      parserVersion: this.parserVersion,
      plainText: fullText,
      fragments,
      pageCount: totalPages,
      contentDigest,
      limitations: [
        'Text-based PDF extraction only (page index locators: page:n)',
        'Diagrams, flowcharts, and embedded graphics are not interpreted',
        'Flattened reading order; no assumption of multi-column layout fidelity'
      ]
    };
  }
}
