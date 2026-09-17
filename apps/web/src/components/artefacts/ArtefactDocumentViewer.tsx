import React, { useState } from 'react';
import {
  FileText,
  Lock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Download,
  Copy,
  Check,
  Printer,
  FileCode2,
  Layers,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Info,
  Sparkles
} from 'lucide-react';
import {
  EngineeringArtefact,
  ArtefactSection,
  ArtefactTable,
  ArtefactCallout
} from '@pecp/pe-domain';
import { exportArtefactToMarkdown } from '@pecp/artefact-engine';

interface ArtefactDocumentViewerProps {
  artefact: EngineeringArtefact;
  icon?: React.ComponentType<{ className?: string }>;
  accentColor?: 'emerald' | 'sky' | 'indigo';
}

export const ArtefactDocumentViewer: React.FC<ArtefactDocumentViewerProps> = ({
  artefact,
  icon: IconComponent = FileText,
  accentColor = 'sky'
}) => {
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [viewJson, setViewJson] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>(
    artefact.sections[0]?.id || ''
  );

  const isBlocked =
    artefact.status === 'BLOCKED' || !artefact.approvalReadiness.canApprove;

  const handleCopyMarkdown = () => {
    const md = exportArtefactToMarkdown(artefact);
    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const md = exportArtefactToMarkdown(artefact);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${artefact.id}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(artefact, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const scrollToSection = (id: string) => {
    setActiveSectionId(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className={`space-y-6 ${printMode ? 'bg-slate-950 p-6 rounded-xl' : ''}`}>
      {/* Top Banner & Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-sky-950/60 border border-sky-800/60">
                <IconComponent className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  {artefact.title}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
                  <span className="font-mono text-slate-300">
                    Version: {artefact.version}
                  </span>
                  <span>•</span>
                  <span>
                    Upstream Contract:{' '}
                    <strong className="text-slate-200 font-mono">
                      {artefact.sourceContractId}
                    </strong>{' '}
                    (v{artefact.sourceContractVersion})
                  </span>
                  <span>•</span>
                  <span>
                    Fingerprint:{' '}
                    <span className="font-mono text-slate-400">
                      {artefact.sourceContractFingerprint}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-sky-950 text-sky-300 border border-sky-800">
              Intent: {artefact.engineeringIntent}
            </span>
            <span
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold border ${
                artefact.status === 'BLOCKED'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                  : artefact.status === 'APPROVED'
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : artefact.status === 'STALE'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                  : 'bg-sky-950/80 text-sky-300 border-sky-800'
              }`}
            >
              Document Status: {artefact.status}
            </span>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition flex items-center gap-1.5"
              title="Copy formatted Markdown"
            >
              {copiedMd ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied MD</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy Markdown</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition flex items-center gap-1.5"
              title="Download Markdown file"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Export .md</span>
            </button>

            <button
              onClick={() => setViewJson(!viewJson)}
              className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition flex items-center gap-1.5"
            >
              <FileCode2 className="w-3.5 h-3.5 text-slate-400" />
              <span>{viewJson ? 'Hide JSON' : 'View Raw JSON'}</span>
            </button>

            <button
              onClick={() => setPrintMode(!printMode)}
              className={`px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 ${
                printMode
                  ? 'bg-sky-950 text-sky-300 border-sky-800'
                  : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
            >
              <Printer className="w-3.5 h-3.5 text-slate-400" />
              <span>{printMode ? 'Standard Mode' : 'Print / Document Mode'}</span>
            </button>
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            Constitution §5 & §8 Compiled View
          </div>
        </div>

        {/* Approval Readiness Banner */}
        <div
          className={`p-4 rounded-xl border text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
            isBlocked
              ? 'bg-rose-950/30 border-rose-800/80 text-rose-200'
              : 'bg-emerald-950/30 border-emerald-800/80 text-emerald-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {isBlocked ? (
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <span className="font-semibold text-white">
                Approval Readiness:{' '}
                {isBlocked ? 'BLOCKED (Constitution §5 & §8)' : 'READY FOR REVIEW'}
              </span>
              <p className="text-slate-300 leading-relaxed">
                {isBlocked
                  ? `This document carries ${artefact.approvalReadiness.unresolvedIssuesCount} unresolved issue(s) from upstream intelligence. In accordance with PECP Constitution §5 & §8, documents derived from a BLOCKED contract cannot be approved.`
                  : 'All mathematical lineage and acceptance criteria are mathematically unambiguous and ready for formal governance approval.'}
              </p>
            </div>
          </div>

          <button
            disabled={isBlocked}
            className={`px-4 py-2 text-xs font-semibold rounded-lg border whitespace-nowrap flex items-center gap-2 ${
              isBlocked
                ? 'bg-slate-900/90 text-slate-500 border-slate-800 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-sm'
            }`}
          >
            {isBlocked ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Approval Blocked</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Sign-off & Approve</span>
              </>
            )}
          </button>
        </div>

        {/* Blocking reasons bullet list if blocked */}
        {isBlocked && artefact.approvalReadiness.blockingReasons.length > 0 && (
          <div className="p-3 bg-rose-950/20 rounded-lg border border-rose-900/60 text-xs space-y-1.5">
            <span className="font-semibold text-rose-300 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Active Blocking Reasons:
            </span>
            <ul className="list-disc list-inside space-y-1 text-slate-300 pl-1">
              {artefact.approvalReadiness.blockingReasons.map((reason, idx) => (
                <li key={idx} className="leading-relaxed">
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* JSON Viewer Dropdown */}
      {viewJson && (
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 shadow-inner space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
            <span className="font-mono text-slate-300">
              Canonical JSON Artefact Representation
            </span>
            <button
              onClick={handleCopyJson}
              className="hover:text-white flex items-center gap-1 text-[11px]"
            >
              {copiedJson ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copiedJson ? 'Copied' : 'Copy JSON'}
            </button>
          </div>
          <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto max-h-96 p-2 bg-slate-900 rounded">
            {JSON.stringify(artefact, null, 2)}
          </pre>
        </div>
      )}

      {/* Main Document Layout: Sidebar Table of Contents + Document Body */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Table of Contents Sticky Sidebar */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-4 sticky top-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
            <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
              Table of Contents
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              {artefact.sections.length} Sections
            </span>
          </div>

          <nav className="space-y-1 text-xs max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
            {artefact.sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => scrollToSection(sec.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs transition flex items-center justify-between group ${
                  activeSectionId === sec.id
                    ? 'bg-sky-950/80 text-sky-200 font-medium border border-sky-800/60'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <span className="truncate">
                  <span className="font-mono text-slate-500 mr-1.5 group-hover:text-slate-400">
                    {sec.sectionNumber}
                  </span>
                  {sec.title}
                </span>
                {sec.status === 'BLOCKED' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 ml-1" />
                )}
                {sec.status === 'NOT_SUPPLIED' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 ml-1" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Document Content Canvas */}
        <div className="lg:col-span-3 space-y-6">
          {artefact.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4 scroll-mt-6"
            >
              {/* Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                    {section.sectionNumber}
                  </span>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {section.title}
                  </h3>
                </div>

                {section.status && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold tracking-wider self-start sm:self-auto border ${
                      section.status === 'BLOCKED'
                        ? 'bg-rose-950 text-rose-300 border-rose-800'
                        : section.status === 'NOT_SUPPLIED'
                        ? 'bg-amber-950 text-amber-300 border-amber-800'
                        : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    }`}
                  >
                    {section.status.replace('_', ' ')}
                  </span>
                )}
              </div>

              {/* Section Summary */}
              {section.summary && (
                <p className="text-xs text-slate-300 italic leading-relaxed">
                  {section.summary}
                </p>
              )}

              {/* Section Callouts */}
              {section.callouts && section.callouts.length > 0 && (
                <div className="space-y-2">
                  {section.callouts.map((callout, cIdx) => (
                    <div
                      key={cIdx}
                      className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
                        callout.type === 'BLOCKER'
                          ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                          : callout.type === 'WARNING'
                          ? 'bg-amber-950/40 border-amber-800 text-amber-200'
                          : callout.type === 'ASSUMPTION'
                          ? 'bg-indigo-950/40 border-indigo-800 text-indigo-200'
                          : 'bg-sky-950/40 border-sky-800 text-sky-200'
                      }`}
                    >
                      {callout.type === 'BLOCKER' ? (
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      ) : callout.type === 'WARNING' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      ) : callout.type === 'ASSUMPTION' ? (
                        <Layers className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      ) : (
                        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <span className="font-bold uppercase tracking-wider text-[10px]">
                          {callout.type}
                        </span>
                        <p className="leading-relaxed">{callout.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Paragraphs */}
              {section.paragraphs && section.paragraphs.length > 0 && (
                <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
                  {section.paragraphs.map((p, pIdx) => (
                    <p key={pIdx}>{p}</p>
                  ))}
                </div>
              )}

              {/* Tables */}
              {section.tables && section.tables.length > 0 && (
                <div className="space-y-4 pt-1">
                  {section.tables.map((table) => (
                    <div key={table.id} className="space-y-1.5">
                      {table.caption && (
                        <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                          <span>{table.caption}</span>
                        </div>
                      )}
                      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-900 border-b border-slate-800">
                              {table.headers.map((header, hIdx) => (
                                <th
                                  key={hIdx}
                                  className="px-3.5 py-2 text-[11px] font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap"
                                >
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {table.rows.map((row, rIdx) => (
                              <tr
                                key={rIdx}
                                className="hover:bg-slate-900/50 transition-colors"
                              >
                                {row.map((cell, cIdx) => (
                                  <td
                                    key={cIdx}
                                    className="px-3.5 py-2.5 text-slate-300 font-mono text-[11px] leading-relaxed"
                                  >
                                    {String(cell)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
};
