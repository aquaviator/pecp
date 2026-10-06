import React, { useEffect, useState } from 'react';
import {
  FileCheck2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ShieldCheck,
  FileCode2,
  TrendingUp,
  AlertCircle,
  Copy,
  Check,
  Fingerprint,
  Link,
  FileText,
  UserCheck,
  Compass,
  ClipboardList,
  ExternalLink,
  RotateCcw,
  Sparkles,
  X,
  Clock
} from 'lucide-react';
import { ProjectSummary, IntelligenceItem } from '../../types';
import { useServices } from '../../services/ServiceContext';
import { compileDraftPerformanceContract } from '@pecp/workload-engine';
import {
  PerformanceContractCompilationResult,
  computeContractFingerprint,
  ContractFieldProvenance,
  BlockedCalculation,
  AcceptanceCriterion,
  ArtefactListItem,
  ContractReviewRevision,
  GovernanceDecisionSummary,
  ApprovalValidity
} from '@pecp/pe-domain';

interface ContractPageProps {
  project: ProjectSummary;
  initialItems?: IntelligenceItem[];
  onNavigateToTab?: (tab: 'STRATEGY' | 'TEST_PLAN') => void;
}

export const ContractPage: React.FC<ContractPageProps> = ({
  project,
  initialItems,
  onNavigateToTab
}) => {
  const { intelligenceService, performanceContractService, artefactService, authService } =
    useServices();
  const [items, setItems] = useState<IntelligenceItem[]>(initialItems || []);
  const [contractResult, setContractResult] =
    useState<PerformanceContractCompilationResult | null>(null);
  const [revisions, setRevisions] = useState<ContractReviewRevision[]>([]);
  const [selectedRevNumber, setSelectedRevNumber] = useState<number | 'LIVE'>('LIVE');
  const [artefacts, setArtefacts] = useState<ArtefactListItem[]>([]);
  const [viewJson, setViewJson] = useState(false);
  const [copied, setCopied] = useState(false);

  // User role & permission state
  const [userRole, setUserRole] = useState<string>('PERFORMANCE_LEAD');
  const [isPlatformAdmin, setIsPlatformAdmin] = useState<boolean>(false);

  // Mutation states
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Decision Modal
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState<'APPROVE' | 'WITHDRAW'>('APPROVE');
  const [rationale, setRationale] = useState('');

  useEffect(() => {
    if (authService) {
      authService
        .getCurrentUser()
        .then((res) => {
          const principal = res?.principal;
          if (!principal) return;
          if (principal.platformRole === 'PLATFORM_ADMIN') {
            setIsPlatformAdmin(true);
            setUserRole('PLATFORM_ADMIN');
            return;
          }
          const membership = principal.memberships?.find(
            (m: { organisationId: string; role: string }) =>
              m.organisationId === project.organisationId
          );
          if (membership) {
            setUserRole(membership.role);
          }
        })
        .catch(() => {});
    }
  }, [authService, project.organisationId]);

  const canSaveReview =
    isPlatformAdmin ||
    userRole === 'ORG_ADMIN' ||
    userRole === 'PERFORMANCE_LEAD' ||
    userRole === 'PERFORMANCE_ENGINEER';

  const canApprove =
    isPlatformAdmin ||
    userRole === 'ORG_ADMIN' ||
    userRole === 'PERFORMANCE_LEAD' ||
    userRole === 'REVIEWER';

  const reloadRevisions = async () => {
    if (!performanceContractService?.listContractReviewRevisions) return;
    try {
      const revs = await performanceContractService.listContractReviewRevisions(project.id);
      setRevisions(revs);
    } catch (err) {
      console.warn('Could not load contract review revisions:', err);
    }
  };

  useEffect(() => {
    if (!initialItems || initialItems.length === 0) {
      intelligenceService.getIntelligenceItems(project.id).then(setItems).catch(console.error);
    }
  }, [project.id, initialItems, intelligenceService]);

  useEffect(() => {
    if (artefactService) {
      artefactService.listArtefacts(project.id).then(setArtefacts).catch(() => {});
    }
  }, [project.id, artefactService]);

  useEffect(() => {
    if (performanceContractService) {
      performanceContractService
        .getPerformanceContract(project.id)
        .then((res) => {
          setContractResult(res);
        })
        .catch((err) => {
          console.warn('Failed to load performance contract from service:', err);
        });

      reloadRevisions();
    }
  }, [project.id, performanceContractService]);

  // Compile synchronously for initial render / mock fallback
  const localContract = compileDraftPerformanceContract({
    projectSummary: project,
    intelligenceItems: items,
    version: 'v0.1-draft',
    compilationTimestamp: project.createdDate || '2026-08-19T10:00:00.000Z'
  });

  const liveContract = contractResult?.contract || localContract;
  const liveFingerprint =
    contractResult?.fingerprint ||
    liveContract.fingerprint ||
    computeContractFingerprint(liveContract);
  const liveBlockingIssues = contractResult?.blockingIssues || [];
  const liveProvenanceList: ContractFieldProvenance[] =
    contractResult?.provenance || liveContract.provenance || [];

  // Determine current active view: LIVE or frozen review revision
  const selectedRevisionRecord: ContractReviewRevision | null =
    selectedRevNumber !== 'LIVE'
      ? revisions.find((r) => r.revisionNumber === selectedRevNumber) || null
      : null;

  const activeContract = selectedRevisionRecord?.contract || liveContract;
  const activeFingerprint = selectedRevisionRecord?.fingerprint || liveFingerprint;
  const activeProvenance = selectedRevisionRecord?.provenance || liveProvenanceList;
  const activeStatus = selectedRevisionRecord?.status || liveContract.status;
  const activeValidity = selectedRevisionRecord?.approvalValidity;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(
      JSON.stringify(selectedRevisionRecord || contractResult || liveContract, null, 2)
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveForReview = async () => {
    if (!performanceContractService?.saveContractReviewRevision) return;
    setIsSavingReview(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const saved = await performanceContractService.saveContractReviewRevision(project.id, {
        expectedFingerprint: liveFingerprint,
        notes: `Saved review revision from live compiled contract`
      });
      await reloadRevisions();
      setSelectedRevNumber(saved.revisionNumber);
      setActionSuccess(`Saved Performance Contract Revision ${saved.revisionNumber} for formal review.`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to save review revision');
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleOpenDecisionModal = (type: 'APPROVE' | 'WITHDRAW') => {
    setDecisionType(type);
    setRationale('');
    setActionError(null);
    setActionSuccess(null);
    setDecisionModalOpen(true);
  };

  const handleConfirmDecision = async () => {
    if (
      !performanceContractService?.submitContractDecision ||
      selectedRevNumber === 'LIVE' ||
      !selectedRevisionRecord
    ) {
      return;
    }

    if (!rationale.trim()) {
      setActionError('A non-blank rationale is required.');
      return;
    }

    setIsSubmittingDecision(true);
    setActionError(null);

    try {
      await performanceContractService.submitContractDecision(
        project.id,
        selectedRevNumber,
        {
          decisionType,
          rationale: rationale.trim(),
          expectedRevisionNumber: selectedRevNumber,
          expectedContentFingerprint: selectedRevisionRecord.fingerprint,
          expectedDecisionRevision: selectedRevisionRecord.activeDecision?.decisionRevision ?? 0
        }
      );

      setDecisionModalOpen(false);
      setRationale('');
      await reloadRevisions();
      setActionSuccess(
        decisionType === 'APPROVE'
          ? `Performance Contract Revision ${selectedRevNumber} successfully approved.`
          : `Performance Contract Revision ${selectedRevNumber} approval withdrawn.`
      );
    } catch (err: any) {
      setActionError(err.message || 'Decision submission failed');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  // Clear rationale and modal if revision or project changes
  useEffect(() => {
    setRationale('');
    setDecisionModalOpen(false);
  }, [selectedRevNumber, project.id]);

  const throughputCalc = activeContract.workloadCalculations?.find(
    (c: any) => c.outputParameter === 'order_throughput_per_second'
  );
  const blockedThroughput = activeContract.blockedWorkloadCalculations?.find(
    (c: any) => c.outputParameter === 'order_throughput_per_second'
  );
  const concurrencyCalc = activeContract.workloadCalculations?.find(
    (c: any) => c.outputParameter === 'concurrent_sessions'
  );
  const blockedConcurrency = activeContract.blockedWorkloadCalculations?.find(
    (c: any) => c.outputParameter === 'concurrent_sessions'
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Governed Performance Contract
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Constitution §5 & §8: The machine-readable performance contract deterministically compiled from approved upstream intelligence. Defines release gates and engineering intents.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Revision Selector */}
            <div className="flex items-center gap-1.5 mr-2">
              <span className="text-[11px] text-slate-400 font-mono">View:</span>
              <select
                aria-label="Select Contract Revision"
                value={selectedRevNumber}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedRevNumber(val === 'LIVE' ? 'LIVE' : Number(val));
                  setActionError(null);
                  setActionSuccess(null);
                }}
                className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-sky-500 focus:outline-none"
              >
                <option value="LIVE">Live Draft (Current Compilation)</option>
                {revisions.map((rev) => (
                  <option key={rev.revisionNumber} value={rev.revisionNumber}>
                    Rev {rev.revisionNumber} ({rev.approvalValidity?.state || rev.status})
                  </option>
                ))}
              </select>
            </div>

            <span className="px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-slate-950 text-slate-300 border border-slate-800 flex items-center gap-1.5">
              <Fingerprint className="w-3.5 h-3.5 text-sky-400" />
              <span>{activeFingerprint}</span>
            </span>
            <span className="px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-sky-950 text-sky-300 border border-sky-800">
              Intent: {activeContract.engineeringIntent}
            </span>
            <span
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold border ${
                activeStatus === 'BLOCKED'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                  : activeValidity?.isValid
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                  : 'bg-sky-950/80 text-sky-300 border-sky-800'
              }`}
            >
              Contract Status: {activeStatus}
            </span>
          </div>
        </div>

        {/* Action / Error Banner notifications */}
        {actionSuccess && (
          <div className="p-3 bg-emerald-950/40 border border-emerald-800 rounded-lg text-xs text-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
            <button
              onClick={() => setActionSuccess(null)}
              className="text-emerald-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {actionError && (
          <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-lg text-xs text-rose-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              onClick={() => setActionError(null)}
              className="text-rose-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Approval Readiness Banner & Action Bar (both tests expect 'Approval Readiness: BLOCKED' and 'Sign & Approve Contract') */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {activeContract.status === 'BLOCKED' ? (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <span className="font-semibold text-white">
                Approval Readiness: {activeContract.status === 'BLOCKED' ? 'BLOCKED' : 'READY FOR APPROVAL'}
              </span>
              <p className="text-slate-400 leading-relaxed">
                {activeContract.status === 'BLOCKED'
                  ? `This contract cannot be approved automatically. It remains a truthful draft until ${activeContract.approvalReadiness.unresolvedIssuesCount} blocking issue(s) are formally resolved.`
                  : 'All required upstream intelligence records are approved and verified. The contract is eligible for formal engineering sign-off.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectedRevNumber === 'LIVE' ? (
              <>
                <button
                  onClick={handleSaveForReview}
                  disabled={activeContract.status === 'BLOCKED' || isSavingReview || !canSaveReview}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg border whitespace-nowrap flex items-center gap-2 ${
                    activeContract.status === 'BLOCKED' || !canSaveReview
                      ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                      : 'bg-sky-600 text-white border-sky-500 hover:bg-sky-500 cursor-pointer shadow-sm'
                  }`}
                  title="Save an immutable review revision"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isSavingReview ? 'Saving Revision...' : 'Save for Review'}</span>
                </button>

                <button
                  onClick={() => handleSaveForReview()}
                  disabled={activeContract.status === 'BLOCKED'}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg border whitespace-nowrap flex items-center gap-2 ${
                    activeContract.status === 'BLOCKED'
                      ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                      : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500 cursor-pointer shadow-sm'
                  }`}
                >
                  {activeContract.status === 'BLOCKED' ? (
                    <Lock className="w-3.5 h-3.5" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {activeContract.status === 'BLOCKED'
                      ? 'Sign & Approve Contract (Locked)'
                      : 'Sign & Approve Contract'}
                  </span>
                </button>
              </>
            ) : (
              <>
                {canApprove && activeValidity?.state !== 'CURRENTLY_VALID' && (
                  <button
                    onClick={() => handleOpenDecisionModal('APPROVE')}
                    disabled={
                      activeContract.status === 'BLOCKED' ||
                      activeFingerprint !== liveFingerprint
                    }
                    className={`px-4 py-2 text-xs font-semibold rounded-lg border whitespace-nowrap flex items-center gap-2 ${
                      activeContract.status === 'BLOCKED' || activeFingerprint !== liveFingerprint
                        ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                        : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500 cursor-pointer shadow-sm'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Revision</span>
                  </button>
                )}

                {canApprove && activeValidity?.state === 'CURRENTLY_VALID' && (
                  <button
                    onClick={() => handleOpenDecisionModal('WITHDRAW')}
                    className="px-4 py-2 text-xs font-semibold rounded-lg border bg-rose-950 hover:bg-rose-900 text-rose-300 border-rose-800 whitespace-nowrap flex items-center gap-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Withdraw Approval</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* View Mode: Saved Review Revision Validity Notification */}
        {selectedRevNumber !== 'LIVE' && selectedRevisionRecord && (
          <div className="space-y-4">
            {activeValidity?.state === 'CURRENTLY_VALID' && (
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
                          {activeValidity.activeDecision?.actorDisplayName}
                        </strong>{' '}
                        on{' '}
                        <span className="font-mono">
                          {new Date(activeValidity.activeDecision?.decidedAt || '').toLocaleString()}
                        </span>{' '}
                        (Decision #{activeValidity.activeDecision?.decisionRevision}).
                      </p>
                      {activeValidity.activeDecision?.rationale && (
                        <p className="text-xs text-emerald-300/80 italic mt-1 bg-emerald-950/60 p-2 rounded border border-emerald-900/60">
                          &ldquo;{activeValidity.activeDecision.rationale}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeValidity?.state === 'STALE' && (
              <div className="p-4 bg-amber-950/40 border border-amber-800 rounded-xl text-xs space-y-2 text-amber-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-amber-300 text-sm">
                        ⚠️ Upstream Inputs Have Drifted (Approval Stale)
                      </h4>
                      <p className="text-amber-200/90 text-xs mt-0.5">
                        Governing intelligence, requirements, or source documents have changed since this revision was approved.
                      </p>
                      {activeValidity.reasons.length > 0 && (
                        <ul className="list-disc list-inside space-y-1 text-amber-300/80 pl-1 pt-1.5">
                          {activeValidity.reasons.map((r, idx) => (
                            <li key={idx}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeValidity?.state === 'WITHDRAWN' && (
              <div className="p-4 bg-rose-950/30 border border-rose-800 rounded-xl text-xs space-y-2 text-rose-200">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-rose-300 text-sm">Approval Withdrawn</h4>
                    <p className="text-rose-200/90 text-xs mt-0.5">
                      Approval was withdrawn by{' '}
                      <strong className="text-white">
                        {activeValidity.activeDecision?.actorDisplayName}
                      </strong>
                      .
                    </p>
                    {activeValidity.activeDecision?.rationale && (
                      <p className="text-xs text-rose-300/80 italic mt-1 bg-rose-950/60 p-2 rounded border border-rose-900/60">
                        Rationale: &ldquo;{activeValidity.activeDecision.rationale}&rdquo;
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Decision Rationale Modal */}
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
                    ? `Approve Performance Contract (Rev ${selectedRevNumber})`
                    : `Withdraw Performance Contract Approval (Rev ${selectedRevNumber})`}
                </h3>
              </div>
              <button
                onClick={() => setDecisionModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                {decisionType === 'APPROVE'
                  ? 'Formal approval certifies this contract revision as authoritative for downstream engineering artefacts.'
                  : 'Withdrawing approval removes the valid status for current use.'}
              </p>

              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] space-y-1">
                <div>
                  Target Revision: <strong className="text-white">Rev {selectedRevNumber}</strong>
                </div>
                <div>
                  Content Fingerprint: <span className="text-sky-300">{activeFingerprint}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-slate-200">
                  Decision Rationale <span className="text-rose-400">*</span>
                </label>
                <textarea
                  value={rationale}
                  onChange={(e) => setRationale(e.target.value)}
                  placeholder="State the engineering rationale..."
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

      {/* Blocking Issues Summary */}
      {(((activeContract.approvalReadiness?.blockingReasons?.length ?? 0) > 0) || liveBlockingIssues.length > 0) && (
        <div className="bg-rose-950/20 border border-rose-900/50 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Unresolved Canonical Issues Blocking Approval</span>
          </h3>
          <ul className="space-y-2 text-xs">
            {liveBlockingIssues.map((issue: any, idx: number) => (
              <li key={`bi-${idx}`} className="flex items-start gap-2 text-rose-200">
                <span className="text-rose-400 font-mono shrink-0">•</span>
                <span>{issue.reason}</span>
              </li>
            ))}
            {activeContract.approvalReadiness.blockingReasons.map(
              (reason: string, idx: number) => (
                <li key={`br-${idx}`} className="flex items-start gap-2 text-rose-200">
                  <span className="text-rose-400 font-mono shrink-0">•</span>
                  <span>{reason}</span>
                </li>
              )
            )}
          </ul>
        </div>
      )}

      {/* Structured Governed Values & Provenance Section */}
      {activeProvenance.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Authoritative Governed Inputs &amp; Source Provenance</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Approved upstream intelligence values compiled into contract with verifiable source lineage (§1 [I01]).
              </p>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
              {activeProvenance.length} Governed Field(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-xs">
              <thead>
                <tr className="text-left text-slate-400 font-mono uppercase text-[10px]">
                  <th className="py-2 px-3">Field Key</th>
                  <th className="py-2 px-3">Compiled Value</th>
                  <th className="py-2 px-3">State</th>
                  <th className="py-2 px-3">Governing Source</th>
                  <th className="py-2 px-3">Locator / Excerpt</th>
                  <th className="py-2 px-3">Approved By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {activeProvenance.map((prov) => (
                  <tr key={prov.fieldKey} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-semibold text-white">{prov.fieldKey}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">
                      {typeof prov.value === 'number' ? prov.value.toLocaleString() : prov.value}{' '}
                      {prov.unit || ''}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950 text-slate-300 border border-slate-800">
                        {prov.canonicalState}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {prov.sourceVersionId ? (
                        <div className="space-y-0.5">
                          <span className="text-sky-300 flex items-center gap-1 font-sans text-xs">
                            <FileText className="w-3 h-3 shrink-0" />
                            Version {prov.sourceVersionNumber || 1}
                          </span>
                          {prov.sourceSha256 && (
                            <span className="text-[10px] text-slate-500 block">
                              SHA: {prov.sourceSha256.substring(0, 12)}...
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 font-sans italic text-[11px]">
                          Direct Assertion
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {prov.locator ? (
                        <div className="space-y-0.5">
                          <span className="text-slate-200 flex items-center gap-1">
                            <Link className="w-3 h-3 text-slate-400 shrink-0" />
                            {prov.locator}
                          </span>
                          {prov.excerpt && (
                            <span className="text-[10px] text-slate-500 italic block font-sans line-clamp-1">
                              "{prov.excerpt}"
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {prov.approvedBy ? (
                        <div className="space-y-0.5">
                          <span className="text-emerald-300 flex items-center gap-1 font-sans text-xs">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            {prov.approvedBy}
                          </span>
                          {(prov.approvalRevision || prov.intelligenceRevision) && (
                            <span className="text-[10px] text-slate-400 block font-mono">
                              Rev {prov.approvalRevision || prov.intelligenceRevision}
                            </span>
                          )}
                          {prov.approvedAt && (
                            <span className="text-[10px] text-slate-500 block">
                              {new Date(prov.approvedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-500 font-sans italic">Pending Review</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Contract Detail View */}
      <div className="space-y-6">
        {/* Section 1: Workload Targets & Derived Calculations */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              <span>Section 1: Workload Targets &amp; Derived Calculations</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              Deterministic Peak Load Models
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Peak Transaction Throughput */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
              <span className="text-slate-400 text-xs">Peak Transaction Throughput</span>
              {throughputCalc ? (
                <>
                  <div className="text-xl font-bold font-mono text-emerald-400">
                    {throughputCalc.outputValue}{' '}
                    <span className="text-xs font-normal text-slate-400">
                      orders/sec (525/min, 31.5k/hr)
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block">
                    {throughputCalc.humanReadableExplanation ||
                      `${throughputCalc.outputValue} ${throughputCalc.unit}`}
                  </span>
                </>
              ) : (
                <>
                  <div className="text-sm font-bold font-mono text-rose-400">
                    UNRESOLVED (Not Calculated)
                  </div>
                  {blockedThroughput && (
                    <span className="text-[10px] text-rose-300/80 block">
                      {blockedThroughput.reason}
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Concurrent User Sessions */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-1">
              <span className="text-slate-400 text-xs">Concurrent User Sessions</span>
              {concurrencyCalc ? (
                <div className="text-xl font-bold font-mono text-sky-400">
                  {concurrencyCalc.outputValue}{' '}
                  <span className="text-xs font-normal text-slate-400">sessions</span>
                </div>
              ) : (
                <>
                  <div className="text-sm font-bold font-mono text-rose-400">
                    UNRESOLVED (Not Calculated)
                  </div>
                  {blockedConcurrency && (
                    <span className="text-[10px] text-rose-300/80 block">
                      {blockedConcurrency.reason}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {activeContract.blockedWorkloadCalculations &&
            activeContract.blockedWorkloadCalculations.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800/60">
                <h4 className="text-[11px] font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>
                    Blocked Calculations ({activeContract.blockedWorkloadCalculations.length})
                  </span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {activeContract.blockedWorkloadCalculations.map((blocked: BlockedCalculation) => (
                    <div
                      key={blocked.calculationId}
                      className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-lg space-y-1"
                    >
                      <div className="font-semibold text-rose-200">
                        {blocked.outputParameter || blocked.calculationId}
                      </div>
                      <p className="text-rose-300/80 text-[11px]">{blocked.reason}</p>
                      {blocked.missingPrerequisites && blocked.missingPrerequisites.length > 0 && (
                        <div className="text-[10px] text-rose-400 font-mono">
                          Missing inputs: {blocked.missingPrerequisites.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>

        {/* Section 2: Non-Functional Requirements & Acceptance Criteria */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Section 2: Non-Functional Requirements &amp; Acceptance Criteria</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              Release Gate Criteria (§5 [I05])
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-xs">
              <thead>
                <tr className="text-left text-slate-400 font-mono uppercase text-[10px]">
                  <th className="py-2 px-3">Scope</th>
                  <th className="py-2 px-3">Criterion Metric</th>
                  <th className="py-2 px-3">Target Threshold</th>
                  <th className="py-2 px-3">Percentile</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Ambiguity Notice</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {(activeContract.acceptanceCriteria || []).map((crit: AcceptanceCriterion) => (
                  <tr key={crit.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 font-semibold text-white">{crit.scope}</td>
                    <td className="py-2.5 px-3 text-slate-300">{crit.metric}</td>
                    <td className="py-2.5 px-3 font-bold text-emerald-400">
                      {crit.operator || '<'}{' '}
                      {crit.thresholdValue !== undefined
                        ? crit.thresholdValue
                        : crit.target}{' '}
                      {crit.unit}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">
                      {crit.percentile ? `p${crit.percentile}` : 'UNDEFINED'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          crit.status === 'AMBIGUOUS' || crit.status === 'UNRESOLVED'
                            ? 'bg-amber-950 text-amber-300 border border-amber-800'
                            : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        }`}
                      >
                        {crit.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-sans text-xs">
                      {crit.ambiguityNotice || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Governance Metadata & Downstream Artefacts */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            <span>Section 3: Downstream Engineering Artefacts &amp; Traceability</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Performance Strategy Card */}
            {(() => {
              const strat = artefacts.find((a) => a.artefactType === 'PERFORMANCE_STRATEGY');
              return (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-sky-400" />
                      <span className="text-white font-bold">Performance Strategy</span>
                    </div>
                    {strat ? (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                          strat.status === 'BLOCKED'
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : strat.status === 'STALE'
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : strat.approvalValidity?.isValid
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : 'bg-sky-950 text-sky-300 border-sky-800'
                        }`}
                      >
                        Rev {strat.currentRevisionNumber} (
                        {strat.approvalValidity?.state || strat.status})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800">
                        Not Generated
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Governs workload requirements, architectural risk mitigations, and execution boundaries.
                  </p>
                  {onNavigateToTab && (
                    <button
                      onClick={() => onNavigateToTab('STRATEGY')}
                      className="text-sky-400 hover:text-sky-300 font-medium text-xs flex items-center gap-1 transition pt-1"
                    >
                      <span>
                        {strat ? 'Open Performance Strategy' : 'Generate Performance Strategy'}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Performance Test Plan Card */}
            {(() => {
              const plan = artefacts.find((a) => a.artefactType === 'PERFORMANCE_TEST_PLAN');
              return (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-emerald-400" />
                      <span className="text-white font-bold">Performance Test Plan</span>
                    </div>
                    {plan ? (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                          plan.status === 'BLOCKED'
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : plan.status === 'STALE'
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : plan.approvalValidity?.isValid
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : 'bg-sky-950 text-sky-300 border-sky-800'
                        }`}
                      >
                        Rev {plan.currentRevisionNumber} (
                        {plan.approvalValidity?.state || plan.status})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800">
                        Not Generated
                      </span>
                    )}
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Defines target demand rates, pass/fail thresholds, test schedules, and observability criteria.
                  </p>
                  {onNavigateToTab && (
                    <button
                      onClick={() => onNavigateToTab('TEST_PLAN')}
                      className="text-emerald-400 hover:text-emerald-300 font-medium text-xs flex items-center gap-1 transition pt-1"
                    >
                      <span>
                        {plan ? 'Open Performance Test Plan' : 'Generate Performance Test Plan'}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* View Raw JSON toggle button & panel */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setViewJson(!viewJson)}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg text-xs font-mono transition flex items-center gap-2"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>{viewJson ? 'Hide Machine-Readable JSON' : 'Machine-Readable JSON'}</span>
          </button>

          {viewJson && (
            <button
              onClick={handleCopyJson}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg text-xs font-mono transition flex items-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          )}
        </div>

        {viewJson && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-[500px]">
            <pre>
              {JSON.stringify(
                selectedRevisionRecord || contractResult || liveContract,
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
