import { EngineeringArtefact, ArtefactTable, ArtefactCallout } from '@pecp/pe-domain';

function renderMarkdownTable(table: ArtefactTable): string {
  const lines: string[] = [];
  if (table.caption) {
    lines.push(`*${table.caption}*`);
    lines.push('');
  }

  // Header row
  lines.push(`| ${table.headers.join(' | ')} |`);
  // Separator row
  lines.push(`| ${table.headers.map(() => '---').join(' | ')} |`);

  // Data rows
  table.rows.forEach((row) => {
    const formattedRow = row.map((cell) => {
      if (cell === null || cell === undefined) return '';
      const str = String(cell).replace(/\n/g, '<br/>').replace(/\|/g, '\\|');
      return str;
    });
    lines.push(`| ${formattedRow.join(' | ')} |`);
  });

  lines.push('');
  return lines.join('\n');
}

function renderCallout(callout: ArtefactCallout): string {
  const icon =
    callout.type === 'BLOCKER'
      ? '⛔'
      : callout.type === 'WARNING'
      ? '⚠️'
      : callout.type === 'ASSUMPTION'
      ? '📌'
      : callout.type === 'GUIDANCE'
      ? '💡'
      : 'ℹ️';

  const label = callout.type === 'GUIDANCE' ? 'PECP METHODOLOGY GUIDANCE' : callout.type;
  return `> ${icon} **${label}**: ${callout.text}\n`;
}

/**
 * Pure function converting an EngineeringArtefact into clean, formatted Markdown.
 */
export function exportArtefactToMarkdown(artefact: EngineeringArtefact): string {
  const lines: string[] = [];

  // Title & Header
  lines.push(`# ${artefact.title}`);
  lines.push('');
  lines.push(`**Artefact Type:** \`${artefact.type}\` | **Version:** \`${artefact.version}\` | **Status:** \`${artefact.status}\``);
  lines.push('');
  lines.push(`**Upstream Contract:** \`${artefact.sourceContractId}\` (v\`${artefact.sourceContractVersion}\`) | **Fingerprint:** \`${artefact.sourceContractFingerprint}\``);
  lines.push(`**Engineering Intent:** \`${artefact.engineeringIntent}\` | **Generated:** \`${artefact.generationTimestamp}\``);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Table of Contents
  lines.push('## Table of Contents');
  artefact.sections.forEach((sec) => {
    lines.push(`- [${sec.sectionNumber} ${sec.title}](#${sec.id})`);
  });
  lines.push('');
  lines.push('---');
  lines.push('');

  // Sections
  artefact.sections.forEach((sec) => {
    lines.push(`<a id="${sec.id}"></a>`);
    lines.push(`## ${sec.sectionNumber} ${sec.title}`);
    lines.push('');

    if (sec.summary) {
      lines.push(`*${sec.summary}*`);
      lines.push('');
    }

    if (sec.callouts && sec.callouts.length > 0) {
      sec.callouts.forEach((c) => {
        lines.push(renderCallout(c));
      });
      lines.push('');
    }

    if (sec.paragraphs && sec.paragraphs.length > 0) {
      sec.paragraphs.forEach((p) => {
        lines.push(p);
        lines.push('');
      });
    }

    if (sec.tables && sec.tables.length > 0) {
      sec.tables.forEach((tbl) => {
        lines.push(renderMarkdownTable(tbl));
      });
    }

    lines.push('');
  });

  return lines.join('\n');
}
