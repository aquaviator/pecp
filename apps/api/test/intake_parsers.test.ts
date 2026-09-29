// M5.2 Document Parsers & Extractor Unit Tests
// Defined according to M5.2 Work Package §1, §4, §13 [I01, I02, I11]

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TextDocumentParser } from '../src/intake/parsers/TextDocumentParser.js';
import { CsvDocumentParser } from '../src/intake/parsers/CsvDocumentParser.js';
import { JsonDocumentParser } from '../src/intake/parsers/JsonDocumentParser.js';
import { DocxDocumentParser } from '../src/intake/parsers/DocxDocumentParser.js';
import { PdfDocumentParser } from '../src/intake/parsers/PdfDocumentParser.js';
import { DocumentParserRegistry } from '../src/intake/parsers/DocumentParserRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixtureDir = path.resolve(__dirname, '../../../reference-library/northstar/m5-2');

describe('M5.2 Document Parsers and Traceable Extraction', () => {
  const textParser = new TextDocumentParser();
  const csvParser = new CsvDocumentParser();
  const jsonParser = new JsonDocumentParser();
  const docxParser = new DocxDocumentParser();
  const pdfParser = new PdfDocumentParser();
  const registry = new DocumentParserRegistry();

  it('1. TextDocumentParser extracts plain text with char-range locators and preserves content fidelity', async () => {
    const briefBuffer = fs.readFileSync(path.join(fixtureDir, 'brief.md'));
    const result = await textParser.parse(briefBuffer, 'ver-brief-1');

    expect(result.status).toBe('SUCCESS');
    expect(result.plainText).toContain('Support 100,000 users and keep checkout fast.');
    expect(result.fragments.length).toBeGreaterThan(0);
    expect(result.fragments[0].locator).toMatch(/^char:\d+-\d+$/);
    expect(result.contentDigest).toBeDefined();
  });

  it('2. CsvDocumentParser extracts cells with row, col and header locators', async () => {
    const csvBuffer = fs.readFileSync(path.join(fixtureDir, 'holiday_peak_forecast_2027_v1.csv'));
    const result = await csvParser.parse(csvBuffer, 'ver-csv-1');

    expect(result.status).toBe('SUCCESS');
    expect(result.plainText).toContain('peak_demand_orders');
    expect(result.plainText).toContain('24000');

    const valueFragment = result.fragments.find((f) => f.text === '24000');
    expect(valueFragment).toBeDefined();
    expect(valueFragment?.locator).toBe('row:1,col:2');
  });

  it('3. JsonDocumentParser parses structured JSON with JSON Pointer locators', async () => {
    const jsonBuffer = fs.readFileSync(path.join(fixtureDir, 'nfr_spec.json'));
    const result = await jsonParser.parse(jsonBuffer, 'ver-json-1');

    expect(result.status).toBe('SUCCESS');
    expect(result.plainText).toContain('checkout_latency_p95_ms');
    expect(result.plainText).toContain('250');

    const latencyFragment = result.fragments.find((f) => f.text === '250');
    expect(latencyFragment).toBeDefined();
    expect(latencyFragment?.locator).toBe('/sla/checkout_latency_p95_ms');
  });

  it('4. JsonDocumentParser safely handles malformed JSON without crashing', async () => {
    const malformed = Buffer.from('{ invalid json syntax:');
    const result = await jsonParser.parse(malformed, 'ver-json-malformed');

    expect(result.status).toBe('FAILED');
    expect(result.diagnostics).toMatch(/JSON/i);
    expect(result.plainText).toBe('');
    expect(result.fragments).toEqual([]);
  });

  it('5. DocxDocumentParser extracts paragraphs with index locators from valid DOCX', async () => {
    const docxBuffer = fs.readFileSync(path.join(fixtureDir, 'sample_architecture.docx'));
    const result = await docxParser.parse(docxBuffer, 'ver-docx-1');

    expect(result.status).toBe('SUCCESS');
    expect(result.plainText).toContain('Northstar Architecture Specification 2027');
    expect(result.plainText).toContain('Target Peak Throughput: 24000 orders/hr');
    expect(result.fragments.length).toBe(2);
    expect(result.fragments[0].locator).toBe('p:1');
    expect(result.fragments[1].locator).toBe('p:2');
  });

  it('6. DocxDocumentParser rejects corrupted DOCX packages safely', async () => {
    const corruptBuffer = fs.readFileSync(path.join(fixtureDir, 'corrupt.docx'));
    const result = await docxParser.parse(corruptBuffer, 'ver-docx-corrupt');

    expect(result.status).toBe('FAILED');
    expect(result.diagnostics).toContain('File is not a valid DOCX/ZIP package');
  });

  it('7. PdfDocumentParser extracts text with page locators from valid PDF', async () => {
    const pdfBuffer = fs.readFileSync(path.join(fixtureDir, 'sample_specs.pdf'));
    const result = await pdfParser.parse(pdfBuffer, 'ver-pdf-1');

    expect(result.status).toBe('SUCCESS');
    expect(result.plainText).toContain('Northstar Peak Requirement: 24000 orders/hr');
    expect(result.fragments.length).toBeGreaterThan(0);
    expect(result.fragments[0].locator).toContain('page:1');
    expect(result.pageCount).toBe(1);
  });

  it('8. PdfDocumentParser handles corrupt and no-text PDFs with explicit diagnostics', async () => {
    const corruptPdf = fs.readFileSync(path.join(fixtureDir, 'corrupt.pdf'));
    const corruptResult = await pdfParser.parse(corruptPdf, 'ver-pdf-corrupt');
    expect(corruptResult.status).toBe('FAILED');
    expect(corruptResult.diagnostics).toContain('PDF');

    const noTextPdf = fs.readFileSync(path.join(fixtureDir, 'no_text.pdf'));
    const noTextResult = await pdfParser.parse(noTextPdf, 'ver-pdf-notext');
    expect(noTextResult.status).toBe('NO_EXTRACTABLE_TEXT');
    expect(noTextResult.diagnostics).toContain('No extractable text');
  });

  it('9. DocumentParserRegistry accurately detects formats and media types by filename and magic bytes', () => {
    const csvDet = registry.detectFormat('metrics.csv', Buffer.from('a,b,c'));
    expect(csvDet.format).toBe('CSV');
    expect(csvDet.mediaType).toBe('text/csv');
    expect(csvDet.isSupported).toBe(true);

    const jsonDet = registry.detectFormat('config.json', Buffer.from('{"a":1}'));
    expect(jsonDet.format).toBe('JSON');
    expect(jsonDet.mediaType).toBe('application/json');
    expect(jsonDet.isSupported).toBe(true);

    const docxDet = registry.detectFormat('specs.docx', Buffer.from('PK\x03\x04'));
    expect(docxDet.format).toBe('DOCX');
    expect(docxDet.isSupported).toBe(true);

    const pdfDet = registry.detectFormat('doc.pdf', Buffer.from('%PDF-1.4'));
    expect(pdfDet.format).toBe('PDF');
    expect(pdfDet.isSupported).toBe(true);

    const unsupported = registry.detectFormat('presentation.pptx', Buffer.from('PK'));
    expect(unsupported.format).toBe('UNSUPPORTED');
    expect(unsupported.isSupported).toBe(false);
  });
});
