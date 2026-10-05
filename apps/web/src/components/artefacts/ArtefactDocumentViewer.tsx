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
  Sparkles,
  Lightbulb,
  RotateCcw,
  X,
  Clock,
  History
} from 'lucide-react';
import {
  EngineeringArtefact,
  ArtefactSection,
  ArtefactTable,
  ArtefactCallout,
  ArtefactStalenessResult,
  ArtefactRevisionSummary,
  GovernanceDecisionSummary,
  ApprovalValidity
} from '@pecp/pe-domain';
import { exportArtefactToMarkdown } from '@pecp/artefact-engine';

interface ArtefactDocumentViewerProps {
  artefact: EngineeringArtefact;
  icon?: React.ComponentType<{ className?: string }>;
  accentColor?: 'emerald' | 'sky' | 'indigo';
  staleness?: ArtefactStalenessResult;
  revisions?: ArtefactRevisionSummary[];
  currentRevisionNumber?: number;
  selectedRevisionNumber?: number;
  onSelectRevision?: (rev: number) => void;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  canRegenerate?: boolean;
  onDownloadMarkdown?: () => void;
  // Approval workflow props
  activeDecision?: GovernanceDecisionSummary | null;
  approvalValidity?: ApprovalValidity;
  decisionHistory?: GovernanceDecisionSummary[];
  canApprove?: boolean;
  onApproveRevision?: (rationale: string) => Promise<void>;
  onWithdrawApproval?: (rationale: string) => Promise<void>;
  isSubmittingDecision?: boolean;
}

export const ArtefactDocumentViewer: React.FC<ArtefactDocumentViewerProps> = ({
  artefact,
  icon: IconComponent = FileText,
  accentColor = 'sky',
  staleness,
  revisions,
  currentRevisionNumber,
  selectedRevisionNumber,
  onSelectRevision,
  onRegenerate,
  isRegenerating = false,
  canRegenerate = false,
  onDownloadMarkdown,
  activeDecision,
  approvalValidity,
  decisionHistory = [],
  canApprove = true,
  onApproveRevision,
  onWithdrawApproval,
  isSubmittingDecision = false
}) => {
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [viewJson, setViewJson] = useState(false);
  const [printMode, setPrintMode] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>(
    artefact.sections[0]?.id || ''
  );

  // Decision Modal State
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<'APPROVE' | 'WITHDRAW'>('APPROVE');
  const [rationale, setRationale] = useState('');
  const [decisionError, setDecisionError] = useState<string | null>(null);

  const isBlocked =
    artefact.status === 'BLOCKED' || !artefact.approvalReadiness.canApprove;

  const effectiveRevNumber = selectedRevisionNumber || currentRevisionNumber || 1;

  const handleOpenDecisionModal = (type: 'APPROVE' | 'WITHDRAW') => {
    setDecisionType(type);
    setRationale('');
    setDecisionError(null);
    setDecisionModalOpen(true);
  };

  const handleConfirmDecision = async () => {
    if (!rationale.trim()) {
      setDecisionError('A non-blank rationale is required.');
      return;
    }
    setDecisionError(null);
    try {
      if (decisionType === 'APPROVE' && onApproveRevision) {
        await onApproveRevision(rationale.trim());
      } else if (decisionType === 'WITHDRAW' && onWithdrawApproval) {
        await onWithdrawApproval(rationale.trim());
      }
      setDecisionModalOpen(false);
      setRationale('');
    } catch (err: any) {
      setDecisionError(err.message || 'Failed to submit decision');
    }
  };

  const handleCopyMarkdown = () => {
    const md = exportArtefactToMarkdown(artefact);
    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (onDownloadMarkdown) {
      onDownloadMarkdown();
      return;
    }
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
            {revisions && revisions.length > 1 && (
              <div className="flex items-center gap-1.5 mr-2">
                <span className="text-[11px] text-slate-400 font-mono">Revision:</span>
                <select
                  aria-label="Select Artefact Revision"
                  value={selectedRevisionNumber || currentRevisionNumber || revisions[0]?.revisionNumber}
                  onChange={(e) => onSelectRevision && onSelectRevision(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                >
                  {revisions.map((rev) => (
                    <option key={rev.revisionNumber} value={rev.revisionNumber}>
                      Rev {rev.revisionNumber} ({rev.status})
                    </option>
                  ))}
                </select>
              </div>
            )}
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

            {canRegenerate && onRegenerate && (
              <button
                onClick={onRegenerate}
                disabled={isRegenerating}
                className="px-3 py-1.5 bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800 rounded-lg transition disabled:opacity-50 flex items-center gap-1.5 font-medium"
                title="Regenerate document revision from live contract"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
              </button>
            )}

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

        {/* Staleness Notice Banner if Upstream Contract or Intelligence Drifted */}
        {staleness?.isStale && (
          <div className="p-4 bg-amber-950/30 border border-amber-800/80 rounded-xl text-xs space-y-2 text-amber-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-300 text-sm">
                    ⚠️ Upstream Contract Drift Detected (Stale Artefact)
                  </h4>
                  <p className="text-amber-200/90 text-xs mt-0.5">
                    Governing intelligence, approved decisions, or source documents have changed since this revision was generated.
                  </p>
                </div>
              </div>
              {canRegenerate && onRegenerate && (
                <button
                  onClick={onRegenerate}
                  disabled={isRegenerating}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition disabled:opacity-50 text-xs shrink-0 flex items-center gap-1.5 shadow"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isRegenerating ? 'Regenerating...' : 'Regenerate Current Revision'}</span>
                </button>
              )}
            </div>
            {staleness.reasons.length > 0 && (
              <ul className="list-disc list-inside space-y-1 text-amber-300/80 pl-1 pt-1 border-t border-amber-900/60">
                {staleness.reasons.map((r, idx) => (
                  <li key={idx}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Historical Revision Notice Banner */}
        {selectedRevisionNumber && currentRevisionNumber && selectedRevisionNumber < currentRevisionNumber && (
          <div className="p-3.5 bg-slate-950 border border-sky-900/60 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-slate-300">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-sky-400 shrink-0" />
              <span>
                Viewing historical revision <strong className="text-white">v{selectedRevisionNumber}.0</strong> (Latest: <strong className="text-white">v{currentRevisionNumber}.0</strong>). This historical document is read-only.
              </span>
            </div>
            {onSelectRevision && (
              <button
                onClick={() => onSelectRevision(currentRevisionNumber)}
                className="px-3 py-1 bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800 rounded-lg text-xs font-medium transition shrink-0"
              >
                Switch to Latest Revision (v{currentRevisionNumber}.0)
              </button>
            )}
          </div>
        )}

        {/* Approval Validity & Decision Actions */}
        {approvalValidity?.state === 'CURRENTLY_VALID' && (
          <div className="p-4 bg-emerald-950/40 border border-emerald-800 rounded-xl text-xs space-y-2 text-emerald-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-300 text-sm">
                    ✓ Approved &amp; Valid for Current Use
                  </h4>
                  <p className="text-emerald-200/90 text-xs mt-0.5">
                    Approved by{' '}
                    <strong className="text-white">
                      {activeDecision?.actorDisplayName || 'Authorized Reviewer'}
                    </strong>{' '}
                    on{' '}
                    <span className="font-mono">
                      {new Date(activeDecision?.decidedAt || '').toLocaleString()}
                    </span>{' '}
                    (Decision #{activeDecision?.decisionRevision || 1}).
                    {approvalValidity.approvedContractRevisionNumber && (
                      <span className="ml-2 font-mono text-sky-300">
                        [Bound to Performance Contract Rev {approvalValidity.approvedContractRevisionNumber}]
                      </span>
                    )}
                  </p>
                  {activeDecision?.rationale && (
                    <p className="text-xs text-emerald-300/80 italic mt-1 bg-emerald-950/60 p-2 rounded border border-emerald-900/60">
                      &ldquo;{activeDecision.rationale}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {canApprove && onWithdrawApproval && (
                <button
                  onClick={() => handleOpenDecisionModal('WITHDRAW')}
                  disabled={isSubmittingDecision}
                  className="px-3.5 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-lg text-xs font-semibold shrink-0 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Withdraw Approval</span>
                </button>
              )}
            </div>
          </div>
        )}

        {approvalValidity?.state === 'PARENT_UNAPPROVED' && (
          <div className="p-4 bg-rose-950/30 border border-rose-800/80 rounded-xl text-xs space-y-2 text-rose-200">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-rose-300 text-sm">
                  ⚠️ Upstream Performance Contract Approval Required
                </h4>
                <p className="text-rose-200/90 text-xs mt-0.5">
                  In accordance with PECP Constitution §5 &amp; §8, engineering artefacts (Strategy &amp; Test Plan) cannot be approved until their governing Performance Contract review revision has been formally approved and remains currently valid.
                </p>
                {approvalValidity.reasons.length > 0 && (
                  <ul className="list-disc list-inside space-y-1 text-rose-300/80 pl-1 pt-1.5">
                    {approvalValidity.reasons.map((r, idx) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {approvalValidity?.state === 'WITHDRAWN' && (
          <div className="p-4 bg-rose-950/30 border border-rose-800 rounded-xl text-xs space-y-2 text-rose-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-rose-300 text-sm">Document Approval Withdrawn</h4>
                  <p className="text-rose-200/90 text-xs mt-0.5">
                    Approval was withdrawn by{' '}
                    <strong className="text-white">
                      {activeDecision?.actorDisplayName || 'Reviewer'}
                    </strong>
                    .
                  </p>
                  {activeDecision?.rationale && (
                    <p className="text-xs text-rose-300/80 italic mt-1 bg-rose-950/60 p-2 rounded border border-rose-900/60">
                      Rationale: &ldquo;{activeDecision.rationale}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {canApprove && onApproveRevision && (
                <button
                  onClick={() => handleOpenDecisionModal('APPROVE')}
                  disabled={isBlocked || staleness?.isStale || isSubmittingDecision}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs shrink-0 transition shadow disabled:opacity-50"
                >
                  Re-approve Revision
                </button>
              )}
            </div>
          </div>
        )}

        {(!approvalValidity || approvalValidity.state === 'NOT_APPROVED') && (
          <div
            className={`p-4 rounded-xl border text-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
              isBlocked
                ? 'bg-rose-950/30 border-rose-800/80 text-rose-200'
                : 'bg-slate-950 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-start gap-3">
              {isBlocked ? (
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              ) : (
                <Clock className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <span className="font-semibold text-white">
                  Revision {effectiveRevNumber}:{' '}
                  {isBlocked ? 'BLOCKED (Constitution §5 & §8)' : 'Saved Revision (Awaiting Approval)'}
                </span>
                <p className="text-slate-300 leading-relaxed">
                  {isBlocked
                    ? `This document carries ${artefact.approvalReadiness.unresolvedIssuesCount} unresolved issue(s) from upstream intelligence. Documents derived from a BLOCKED contract cannot be approved.`
                    : 'This document revision is saved and awaiting formal engineering sign-off.'}
                </p>
              </div>
            </div>

            {canApprove && onApproveRevision ? (
              <button
                onClick={() => handleOpenDecisionModal('APPROVE')}
                disabled={isBlocked || staleness?.isStale || isSubmittingDecision}
                className={`px-4 py-2 text-xs font-semibold rounded-lg border whitespace-nowrap flex items-center gap-2 ${
                  isBlocked || staleness?.isStale
                    ? 'bg-slate-900/90 text-slate-500 border-slate-800 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-sm cursor-pointer'
                }`}
                title={
                  isBlocked
                    ? 'Cannot approve: document has blocking issues'
                    : staleness?.isStale
                    ? 'Cannot approve: document is stale'
                    : 'Sign-off and formally approve this document revision'
                }
              >
                {isBlocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Approval Blocked</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Revision</span>
                  </>
                )}
              </button>
            ) : !canApprove ? (
              <span className="text-[11px] text-slate-500 italic">
                Requires REVIEWER, PERFORMANCE_LEAD or ORG_ADMIN role to approve
              </span>
            ) : null}
          </div>
        )}

        {/* Decision Modal */}
        {decisionModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  {decisionType === 'APPROVE' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <RotateCcw className="w-5 h-5 text-rose-400" />
                  )}
                  <h3 className="font-bold text-white text-sm">
                    {decisionType === 'APPROVE'
                      ? `Approve ${artefact.title} (Rev ${effectiveRevNumber})`
                      : `Withdraw ${artefact.title} Approval (Rev ${effectiveRevNumber})`}
                  </h3>
                </div>
                <button
                  onClick={() => setDecisionModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {decisionError && (
                <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-xs text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{decisionError}</span>
                </div>
              )}

              <div className="space-y-3 text-xs text-slate-300">
                <p>
                  {decisionType === 'APPROVE'
                    ? 'Formal approval certifies this document revision for engineering execution.'
                    : 'Withdrawing approval removes the valid status for current use.'}
                </p>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1">
                  <div>
                    Document: <strong className="text-white">{artefact.title}</strong>
                  </div>
                  <div>
                    Target Revision:{' '}
                    <strong className="text-white">Rev {effectiveRevNumber}</strong>
                  </div>
                  <div>
                    Upstream Contract:{' '}
                    <span className="text-sky-300 font-mono">{artefact.sourceContractId}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-200">
                    Decision Rationale <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    value={rationale}
                    onChange={(e) => setRationale(e.target.value)}
                    placeholder={
                      decisionType === 'APPROVE'
                        ? 'State the engineering rationale for approving this document revision...'
                        : 'State the rationale for withdrawing approval...'
                    }
                    rows={3}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-sky-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setDecisionModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg text-xs font-medium border border-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDecision}
                  disabled={isSubmittingDecision || !rationale.trim()}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white transition disabled:opacity-50 ${
                    decisionType === 'APPROVE'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {isSubmittingDecision
                    ? 'Recording...'
                    : decisionType === 'APPROVE'
                    ? 'Confirm Approval'
                    : 'Confirm Withdrawal'}
                </button>
              </div>
            </div>
          </div>
        )}

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
                          : callout.type === 'GUIDANCE'
                          ? 'bg-violet-950/40 border-violet-800 text-violet-200'
                          : 'bg-sky-950/40 border-sky-800 text-sky-200'
                      }`}
                    >
                      {callout.type === 'BLOCKER' ? (
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      ) : callout.type === 'WARNING' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      ) : callout.type === 'ASSUMPTION' ? (
                        <Layers className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                      ) : callout.type === 'GUIDANCE' ? (
                        <Lightbulb className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                      ) : (
                        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <span className="font-bold uppercase tracking-wider text-[10px]">
                          {callout.type === 'GUIDANCE' ? 'PECP Methodology Guidance' : callout.type}
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
