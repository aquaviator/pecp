import * as fs from 'node:fs';
import * as path from 'node:path';
import AdmZip from 'adm-zip';

const dir = path.resolve(process.cwd(), 'reference-library/northstar/m5-2');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// 1. Ambiguous brief
const briefContent = `# Northstar Retail Holiday Peak 2027 Engineering Brief

Support 100,000 users and keep checkout fast.
Target system covers web store and mobile checkout flows for holiday campaign.
`;
fs.writeFileSync(path.join(dir, 'brief.md'), briefContent);

// 2. Forecast v1 (24,000 orders)
const forecastV1 = `metric_name,declared_value,unit,time_window,notes
peak_demand_orders,24000,orders/hr,Peak Hour (19:00-20:00 UTC),Forecast model 2027.1
`;
fs.writeFileSync(path.join(dir, 'holiday_peak_forecast_2027_v1.csv'), forecastV1);

// 3. Forecast v2 (36,000 orders)
const forecastV2 = `metric_name,declared_value,unit,time_window,notes
peak_demand_orders,36000,orders/hr,Peak Hour (19:00-20:00 UTC),Updated forecast model 2027.2
`;
fs.writeFileSync(path.join(dir, 'holiday_peak_forecast_2027_v2.csv'), forecastV2);

// 4. Stakeholder statement (30,000 orders)
const statementContent = `Commercial Trading Statement: We anticipate 30,000 completed orders during the peak hour of Holiday Peak 2027 trading.
`;
fs.writeFileSync(path.join(dir, 'commercial_stakeholder_statement.txt'), statementContent);

// 5. JSON NFR spec
const nfrJson = JSON.stringify(
  {
    system: 'Northstar Retail Checkout',
    sla: {
      checkout_latency_p95_ms: 250,
      availability_percentage: 99.95
    }
  },
  null,
  2
);
fs.writeFileSync(path.join(dir, 'nfr_spec.json'), nfrJson);

// 6. Valid synthetic DOCX
const docxZip = new AdmZip();
docxZip.addFile(
  '[Content_Types].xml',
  Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`)
);
docxZip.addFile(
  'word/document.xml',
  Buffer.from(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r><w:t>Northstar Architecture Specification 2027</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Target Peak Throughput: 24000 orders/hr</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`)
);
docxZip.writeZip(path.join(dir, 'sample_architecture.docx'));

// 7. Valid minimal text PDF
// Minimal valid PDF structure with text stream
const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 55 >>
stream
BT
/F1 12 Tf
72 712 Td
(Northstar Peak Requirement: 24000 orders/hr) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000236 00000 n 
0000000305 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
410
%%EOF`;
fs.writeFileSync(path.join(dir, 'sample_specs.pdf'), pdfContent);

// 8. No-text PDF (valid PDF structure but empty content stream)
const noTextPdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 0 >>
stream
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000204 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
254
%%EOF`;
fs.writeFileSync(path.join(dir, 'no_text.pdf'), noTextPdfContent);

// 9. Malformed files
fs.writeFileSync(path.join(dir, 'corrupt.docx'), Buffer.from('NOT A ZIP FILE'));
fs.writeFileSync(path.join(dir, 'corrupt.pdf'), Buffer.from('NOT A PDF FILE'));
fs.writeFileSync(path.join(dir, 'malformed.json'), Buffer.from('{ invalid json'));

console.log('Successfully generated synthetic Northstar M5.2 fixtures in', dir);
