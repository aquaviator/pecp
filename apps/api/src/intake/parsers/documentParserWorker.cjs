// documentParserWorker.cjs
// Dedicated worker thread execution context for CPU-bound document parsing and extraction
// Defined according to M5.2 Work Package §1, §3 & §4 [I01, I02]

const { parentPort } = require('node:worker_threads');
const { createHash, randomUUID } = require('node:crypto');
const AdmZip = require('adm-zip');
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

function parseCsvRows(input) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i];
    const nextChar = input[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i += 2;
        continue;
      }
      if (char === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      currentField += char;
      i++;
    } else {
      if (char === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      }
      if (char === '\r' && nextChar === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i += 2;
        continue;
      }
      if (char === '\n' || char === '\r') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      }
      currentField += char;
      i++;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

function traverseJsonPointers(
  obj,
  currentPointer = '',
  depth = 0,
  maxDepth = 20,
  fragments = [],
  sourceVersionId = ''
) {
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
    if (obj.length > 5000) {
      throw new Error(`JSON array length (${obj.length}) exceeds maximum limit of 5000 elements`);
    }
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
    if (keys.length > 2000) {
      throw new Error(`JSON object keys count (${keys.length}) exceeds maximum limit of 2000 keys`);
    }
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

function extractTextFromXml(xml) {
  const regex = /<w:t(?:\s+[^>]*)?>([^<]*)<\/w:t>/g;
  let match;
  let text = '';
  while ((match = regex.exec(xml)) !== null) {
    text += match[1];
  }
  return text;
}

async function parseDocument(format, buffer, sourceVersionId, options) {
  // Check for test simulated non-returning/CPU-bound loop
  if (options && options.simulateInfiniteLoop) {
    while (true) {
      // Deliberate CPU-bound infinite loop to test worker termination
    }
  }

  if (options && options.simulateHangMs) {
    const start = Date.now();
    while (Date.now() - start < options.simulateHangMs) {
      // Busy loop for testing
    }
  }

  const maxBytes = options?.maxExtractedBytes ?? 2 * 1024 * 1024; // 2 MiB default

  // 1. PLAIN_TEXT / MARKDOWN
  if (format === 'PLAIN_TEXT' || format === 'MARKDOWN') {
    if (buffer.length > maxBytes) {
      return {
        status: 'FAILED',
        parserId: 'pecp-text-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: `Text content exceeds maximum extraction limit of ${maxBytes} bytes`,
        limitations: ['Strict UTF-8 extraction', 'No script execution']
      };
    }
    let text;
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      text = decoder.decode(buffer);
    } catch {
      return {
        status: 'FAILED',
        parserId: 'pecp-text-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: 'File content is not valid UTF-8 text',
        limitations: ['UTF-8 encoding required']
      };
    }
    if (text.trim().length === 0) {
      return {
        status: 'NO_EXTRACTABLE_TEXT',
        parserId: 'pecp-text-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: 'Source text is empty or contains only whitespace',
        limitations: ['Text is inert']
      };
    }
    const lines = text.split(/\r?\n/);
    const fragments = [];
    let currentOffset = 0;
    const contentDigest = createHash('sha256').update(buffer).digest('hex');

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const lineLen = lineText.length;
      if (lineText.trim().length > 0) {
        fragments.push({
          id: randomUUID(),
          extractionId: '',
          sourceVersionId,
          segmentIndex: i + 1,
          locator: `char:${currentOffset}-${currentOffset + lineLen}`,
          text: lineText,
          characterOffset: currentOffset,
          length: lineLen
        });
      }
      currentOffset += lineLen + 1;
    }
    return {
      status: 'SUCCESS',
      parserId: 'pecp-text-parser',
      parserVersion: '1.0.0',
      plainText: text,
      fragments,
      contentDigest,
      limitations: ['Rendered as inert text in M5.2', 'No macro, formula, or script interpretation']
    };
  }

  // 2. CSV
  if (format === 'CSV') {
    if (buffer.length > maxBytes) {
      return {
        status: 'FAILED',
        parserId: 'pecp-csv-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: `CSV content exceeds maximum limit of ${maxBytes} bytes`,
        limitations: ['RFC 4180 parsing only', 'No formulas executed']
      };
    }
    let text;
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      text = decoder.decode(buffer);
    } catch {
      return {
        status: 'FAILED',
        parserId: 'pecp-csv-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: 'CSV is not valid UTF-8 text',
        limitations: ['UTF-8 encoding required']
      };
    }
    if (text.trim().length === 0) {
      return {
        status: 'NO_EXTRACTABLE_TEXT',
        parserId: 'pecp-csv-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: 'CSV file is empty',
        limitations: ['No records found']
      };
    }
    let rows;
    try {
      rows = parseCsvRows(text);
    } catch (err) {
      return {
        status: 'FAILED',
        parserId: 'pecp-csv-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: `Failed to parse CSV: ${err.message}`,
        limitations: ['Malformed CSV structure']
      };
    }
    if (rows.length === 0) {
      return {
        status: 'NO_EXTRACTABLE_TEXT',
        parserId: 'pecp-csv-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: 'CSV contains no rows',
        limitations: ['Empty CSV']
      };
    }
    const fragments = [];
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
          metadataJson: JSON.stringify({ row: r, col: c + 1, header: colHeader })
        });
      }
    }
    return {
      status: 'SUCCESS',
      parserId: 'pecp-csv-parser',
      parserVersion: '1.0.0',
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

  // 3. JSON
  if (format === 'JSON') {
    if (buffer.length > maxBytes) {
      return {
        status: 'FAILED',
        parserId: 'pecp-json-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: `JSON content exceeds maximum limit of ${maxBytes} bytes`,
        limitations: ['Size bounded to 2MB']
      };
    }
    let text;
    try {
      const decoder = new TextDecoder('utf-8', { fatal: true });
      text = decoder.decode(buffer);
    } catch {
      return {
        status: 'FAILED',
        parserId: 'pecp-json-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: 'JSON content is not valid UTF-8 text',
        limitations: ['UTF-8 encoding required']
      };
    }
    if (text.trim().length === 0) {
      return {
        status: 'NO_EXTRACTABLE_TEXT',
        parserId: 'pecp-json-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: 'JSON file is empty',
        limitations: ['Empty document']
      };
    }
    let parsedJson;
    try {
      parsedJson = JSON.parse(text);
    } catch (err) {
      return {
        status: 'FAILED',
        parserId: 'pecp-json-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: `Malformed JSON: ${err.message}`,
        limitations: ['Valid JSON required']
      };
    }
    const fragments = [];
    try {
      traverseJsonPointers(parsedJson, '', 0, 20, fragments, sourceVersionId);
    } catch (err) {
      return {
        status: 'FAILED',
        parserId: 'pecp-json-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: `JSON traversal error: ${err.message}`,
        limitations: ['Structural limit exceeded']
      };
    }
    const contentDigest = createHash('sha256').update(buffer).digest('hex');
    return {
      status: 'SUCCESS',
      parserId: 'pecp-json-parser',
      parserVersion: '1.0.0',
      plainText: text,
      fragments,
      contentDigest,
      limitations: [
        'RFC 6901 JSON pointer locators',
        'Flattened key traversal',
        'Primitives only mapped directly'
      ]
    };
  }

  // 4. DOCX
  if (format === 'DOCX') {
    if (buffer.length > maxBytes) {
      return {
        status: 'FAILED',
        parserId: 'pecp-docx-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: `DOCX content exceeds maximum limit of ${maxBytes} bytes`,
        limitations: ['Size bounded to 2MB']
      };
    }
    let zip;
    try {
      zip = new AdmZip(buffer);
    } catch (err) {
      return {
        status: 'FAILED',
        parserId: 'pecp-docx-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: `File is not a valid DOCX/ZIP package: ${err.message}`,
        limitations: ['OpenXML DOCX format required']
      };
    }
    const docXmlEntry = zip.getEntry('word/document.xml');
    if (!docXmlEntry) {
      return {
        status: 'FAILED',
        parserId: 'pecp-docx-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: 'Invalid DOCX: missing word/document.xml entry in ZIP package',
        limitations: ['Malformed OpenXML structure']
      };
    }
    let xmlContent;
    try {
      xmlContent = zip.readAsText(docXmlEntry);
    } catch (err) {
      return {
        status: 'FAILED',
        parserId: 'pecp-docx-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: `Failed to read document.xml: ${err.message}`,
        limitations: ['Unreadable XML entry']
      };
    }
    const paraRegex = /<w:p(?:\s+[^>]*)?>([\s\S]*?)<\/w:p>/g;
    const fragments = [];
    const plainTextParas = [];
    let paraIndex = 1;
    let match;

    while ((match = paraRegex.exec(xmlContent)) !== null) {
      const pXml = match[1];
      const pText = extractTextFromXml(pXml).trim();
      if (pText.length > 0) {
        plainTextParas.push(pText);
        fragments.push({
          id: randomUUID(),
          extractionId: '',
          sourceVersionId,
          segmentIndex: paraIndex,
          locator: `p:${paraIndex}`,
          text: pText
        });
        paraIndex++;
      }
    }
    const fullText = plainTextParas.join('\n\n');
    if (fullText.trim().length === 0) {
      return {
        status: 'NO_EXTRACTABLE_TEXT',
        parserId: 'pecp-docx-parser',
        parserVersion: '1.0.0',
        plainText: '',
        fragments: [],
        diagnostics: 'DOCX file contains no extractable body paragraphs',
        limitations: ['Empty document']
      };
    }
    const contentDigest = createHash('sha256').update(buffer).digest('hex');
    return {
      status: 'SUCCESS',
      parserId: 'pecp-docx-parser',
      parserVersion: '1.0.0',
      plainText: fullText,
      fragments,
      contentDigest,
      limitations: [
        'Body paragraphs only (p:index locators)',
        'Embedded drawings, SmartArt, and shapes ignored',
        'Word macros (.docm) rejected'
      ]
    };
  }

  // 5. PDF
  if (format === 'PDF') {
    const maxPages = 100;
    const maxExtractedBytes = maxBytes;
    const pageTexts = [];

    const pagerender = function (pageData) {
      return pageData.getTextContent().then(function (textContent) {
        let lastY, text = '';
        for (let item of textContent.items) {
          if (lastY == item.transform[5] || !lastY) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }
        pageTexts.push({
          pageNumber: pageData.pageIndex + 1,
          text: text.trim()
        });
        return text;
      });
    };

    let data;
    const contentDigest = createHash('sha256').update(buffer).digest('hex');

    try {
      data = await pdfParse(buffer, {
        pagerender,
        max: maxPages
      });
    } catch (err) {
      const msg = err.message || String(err);
      if (
        msg.toLowerCase().includes('password') ||
        msg.toLowerCase().includes('encrypted') ||
        msg.toLowerCase().includes('bad user password')
      ) {
        return {
          status: 'FAILED',
          parserId: 'pecp-pdf-parser',
          parserVersion: '1.1.1',
          plainText: '',
          fragments: [],
          diagnostics: 'Password-protected or encrypted PDF documents are not supported',
          limitations: ['Unencrypted PDF required']
        };
      }
      return {
        status: 'FAILED',
        parserId: 'pecp-pdf-parser',
        parserVersion: '1.1.1',
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
        parserId: 'pecp-pdf-parser',
        parserVersion: '1.1.1',
        plainText: '',
        fragments: [],
        pageCount: totalPages,
        diagnostics: `PDF page count (${totalPages}) exceeds maximum permitted limit of ${maxPages} pages`,
        limitations: [`Limit: maximum ${maxPages} pages`]
      };
    }

    const fragments = [];
    const plainTextPieces = [];
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
        parserId: 'pecp-pdf-parser',
        parserVersion: '1.1.1',
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
        parserId: 'pecp-pdf-parser',
        parserVersion: '1.1.1',
        plainText: '',
        fragments: [],
        pageCount: totalPages,
        contentDigest,
        diagnostics: 'No extractable text layer found in PDF (scanned/raster document or empty pages)',
        limitations: [
          'Text-based PDF only',
          'No OCR scanning performed',
          'Manual stakeholder assertion can be supplied instead'
        ]
      };
    }

    return {
      status: 'SUCCESS',
      parserId: 'pecp-pdf-parser',
      parserVersion: '1.1.1',
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

  return {
    status: 'FAILED',
    parserId: 'none',
    parserVersion: '1.0.0',
    plainText: '',
    fragments: [],
    diagnostics: `Unsupported format: ${format}`
  };
}

if (parentPort) {
  parentPort.on('message', async (msg) => {
    try {
      const { format, buffer, sourceVersionId, options } = msg;
      const res = await parseDocument(format, Buffer.from(buffer), sourceVersionId, options);
      parentPort.postMessage({ result: res });
    } catch (err) {
      parentPort.postMessage({ error: err.message, status: 'FAILED' });
    }
  });
}
