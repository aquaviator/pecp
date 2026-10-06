import React, { useEffect, useState, useRef, useMemo } from 'react';
import { ClipboardList, Sparkles, AlertCircle, RefreshCw, FileText, CheckCircle2, Lock } from 'lucide-react';
import { ProjectSummary, IntelligenceItem } from '../../types';
import { useServices } from '../../services/ServiceContext';
import {
  ArtefactDetailResponse,
  PerformanceContractCompilationResult
} from '@pecp/pe-domain';
import { compileDraftPerformanceContract } from '@pecp/workload-engine';
import { generatePerformanceTestPlan } from '@pecp/artefact-engine';
import { ArtefactDocumentViewer } from '../../components/artefacts/ArtefactDocumentViewer';

interface TestPlanPageProps {
  project: ProjectSummary;
  initialItems?: IntelligenceItem[];
}

export const TestPlanPage: React.FC<TestPlanPageProps> = ({ project, initialItems }) => {
  const { artefactService, performanceContractService, authService } = useServices();

  const [detail, setDetail] = useState<ArtefactDetailResponse | null>(null);
  const [selectedRevision, setSelectedRevision] = useState<number | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(!initialItems);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [contractResult, setContractResult] = useState<PerformanceContractCompilationResult | null>(null);
  const [canGenerate, setCanGenerate] = useState<boolean>(true);
  const [canApprove, setCanApprove] = useState<boolean>(true);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState<boolean>(false);
  const [errorActionType, setErrorActionType] = useState<'LOAD' | 'GENERATE' | 'DECISION' | null>(null);

  const activeProjectRef = useRef<string>(project.id);
  const requestCounterRef = useRef<number>(0);
  const activeScopeRef = useRef<{
    projectId: string;
    entityType: string;
    revisionNumber?: number;
  }>({
    projectId: project.id,
    entityType: 'PERFORMANCE_TEST_PLAN',
    revisionNumber: undefined
  });

  // Synchronous fallback for SSR or initial tests that supply initialItems
  const localFallbackArtefact = useMemo(() => {
    if (!initialItems || initialItems.length === 0) return null;
    const contract = compileDraftPerformanceContract({
      projectSummary: project,
      intelligenceItems: initialItems,
      version: 'v0.1-draft'
    });
    return generatePerformanceTestPlan({
      contract,
      intelligenceItems: initialItems,
      projectSummary: project,
      artefactVersion: 'v1.0-draft'
    });
  }, [project, initialItems]);

  // Check user role permission
  useEffect(() => {
    if (authService) {
      authService
        .getCurrentUser()
        .then((res) => {
          const principal = res?.principal;
          if (!principal) return;
          if (principal.platformRole === 'PLATFORM_ADMIN') {
            setCanGenerate(true);
            setCanApprove(true);
            return;
          }
          const membership = principal.memberships?.find(
            (m: { organisationId: string; role: string }) => m.organisationId === project.organisationId
          );
          if (membership) {
            if (membership.role === 'VIEWER') {
              setCanGenerate(false);
              setCanApprove(false);
            } else if (membership.role === 'PERFORMANCE_ENGINEER') {
              setCanGenerate(true);
              setCanApprove(false);
            } else if (membership.role === 'REVIEWER') {
              setCanGenerate(false);
              setCanApprove(true);
            } else {
              setCanGenerate(true);
              setCanApprove(true);
            }
          }
        })
        .catch(() => {
          setCanGenerate(true);
          setCanApprove(true);
        });
    }
  }, [authService, project.organisationId]);

  // Fetch live contract and artefact whenever project changes
  useEffect(() => {
    activeProjectRef.current = project.id;
    activeScopeRef.current = {
      projectId: project.id,
      entityType: 'PERFORMANCE_TEST_PLAN',
      revisionNumber: undefined
    };
    const currentReqId = ++requestCounterRef.current;
    let isCancelled = false;

    setIsLoading(true);
    setError(null);
    setErrorActionType(null);
    setDetail(null);
    setSelectedRevision(undefined);

    // 1. Load contract status
    if (performanceContractService) {
      performanceContractService
        .getPerformanceContract(project.id)
        .then((res) => {
          if (!isCancelled && activeScopeRef.current.projectId === project.id) {
            setContractResult(res);
          }
        })
        .catch((err) => {
          console.warn('Could not fetch contract for test plan page:', err);
        });
    }

    // 2. Load saved artefact
    if (artefactService) {
      artefactService
        .getArtefact(project.id, 'PERFORMANCE_TEST_PLAN')
        .then((res) => {
          if (!isCancelled && activeScopeRef.current.projectId === project.id && requestCounterRef.current === currentReqId) {
            setDetail(res);
            setSelectedRevision(res.currentRevisionNumber);
            activeScopeRef.current.revisionNumber = res.currentRevisionNumber;
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (!isCancelled && activeScopeRef.current.projectId === project.id && requestCounterRef.current === currentReqId) {
            setIsLoading(false);
            if (err?.message?.includes('404') || err?.message?.includes('not found')) {
              setDetail(null);
            } else {
              setError(err.message || 'Failed to load Performance Test Plan');
              setErrorActionType('LOAD');
            }
          }
        });
    } else {
      setIsLoading(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [project.id, artefactService, performanceContractService]);

  const handleGenerate = async () => {
    if (!artefactService) return;
    setIsGenerating(true);
    setError(null);
    setErrorActionType(null);
    const reqId = ++requestCounterRef.current;
    const reqProjectId = project.id;

    try {
      const res = await artefactService.generateArtefact(project.id, {
        artefactType: 'PERFORMANCE_TEST_PLAN',
        expectedContractFingerprint: contractResult?.fingerprint
      });

      if (
        activeScopeRef.current.projectId === reqProjectId &&
        requestCounterRef.current === reqId
      ) {
        setDetail(res);
        setSelectedRevision(res.currentRevisionNumber);
        activeScopeRef.current.revisionNumber = res.currentRevisionNumber;
      }
    } catch (err: any) {
      if (activeScopeRef.current.projectId === reqProjectId) {
        setError(err.message || 'Generation failed');
        setErrorActionType('GENERATE');
      }
    } finally {
      if (activeScopeRef.current.projectId === reqProjectId) {
        setIsGenerating(false);
      }
    }
  };

  const handleSelectRevision = async (revNumber: number) => {
    if (!artefactService) return;
    setIsLoading(true);
    setError(null);
    setErrorActionType(null);
    const reqId = ++requestCounterRef.current;
    const reqProjectId = project.id;
    activeScopeRef.current.revisionNumber = revNumber;

    try {
      const res = await artefactService.getArtefact(
        project.id,
        'PERFORMANCE_TEST_PLAN',
        revNumber
      );
      if (
        activeScopeRef.current.projectId === reqProjectId &&
        activeScopeRef.current.revisionNumber === revNumber &&
        requestCounterRef.current === reqId
      ) {
        setDetail(res);
        setSelectedRevision(revNumber);
      }
    } catch (err: any) {
      if (
        activeScopeRef.current.projectId === reqProjectId &&
        activeScopeRef.current.revisionNumber === revNumber
      ) {
        setError(err.message || `Failed to load revision ${revNumber}`);
        setErrorActionType('LOAD');
      }
    } finally {
      if (
        activeScopeRef.current.projectId === reqProjectId &&
        activeScopeRef.current.revisionNumber === revNumber
      ) {
        setIsLoading(false);
      }
    }
  };

  const handleDownloadMarkdown = async () => {
    if (!artefactService) return;
    try {
      const md = await artefactService.exportArtefactMarkdown(
        project.id,
        'PERFORMANCE_TEST_PLAN',
        selectedRevision
      );
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `performance-test-plan-${project.id}-rev${selectedRevision || 1}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const handleApproveRevision = async (rationale: string) => {
    if (!artefactService?.submitArtefactDecision || !detail) return;
    setIsSubmittingDecision(true);
    setError(null);
    setErrorActionType(null);
    const targetRev = selectedRevision || detail.currentRevisionNumber || 1;
    const reqId = ++requestCounterRef.current;
    const reqProjectId = project.id;

    try {
      const updated = await artefactService.submitArtefactDecision(
        project.id,
        'PERFORMANCE_TEST_PLAN',
        targetRev,
        {
          decisionType: 'APPROVE',
          rationale,
          expectedRevisionNumber: targetRev,
          expectedContentFingerprint: detail.contentFingerprint || detail.artefact.sourceContractFingerprint,
          expectedDecisionRevision: detail.activeDecision?.decisionRevision ?? 0
        }
      );
      if (
        activeScopeRef.current.projectId === reqProjectId &&
        activeScopeRef.current.revisionNumber === targetRev &&
        requestCounterRef.current === reqId
      ) {
        setDetail(updated);
      }
    } catch (err: any) {
      if (
        activeScopeRef.current.projectId === reqProjectId &&
        activeScopeRef.current.revisionNumber === targetRev
      ) {
        setError(err.message || 'Failed to approve Performance Test Plan');
        setErrorActionType('DECISION');
      }
      throw err;
    } finally {
      if (
        activeScopeRef.current.projectId === reqProjectId &&
        activeScopeRef.current.revisionNumber === targetRev
      ) {
        setIsSubmittingDecision(false);
      }
    }
  };

  const handleWithdrawApproval = async (rationale: string) => {
    if (!artefactService?.submitArtefactDecision || !detail) return;
    setIsSubmittingDecision(true);
    setError(null);
    setErrorActionType(null);
    const targetRev = selectedRevision || detail.currentRevisionNumber || 1;
    const reqId = ++requestCounterRef.current;
    const reqProjectId = project.id;

    try {
      const updated = await artefactService.submitArtefactDecision(
        project.id,
        'PERFORMANCE_TEST_PLAN',
        targetRev,
        {
          decisionType: 'WITHDRAW',
          rationale,
          expectedRevisionNumber: targetRev,
          expectedContentFingerprint: detail.contentFingerprint || detail.artefact.sourceContractFingerprint,
          expectedDecisionRevision: detail.activeDecision?.decisionRevision ?? 0
        }
      );
      if (
        activeScopeRef.current.projectId === reqProjectId &&
        activeScopeRef.current.revisionNumber === targetRev
        && requestCounterRef.current === reqId
      ) {
        setDetail(updated);
      }
    } catch (err: any) {
      if (
        activeScopeRef.current.projectId === reqProjectId &&
        activeScopeRef.current.revisionNumber === targetRev
      ) {
        setError(err.message || 'Failed to withdraw approval');
        setErrorActionType('DECISION');
      }
      throw err;
    } finally {
      if (
        activeScopeRef.current.projectId === reqProjectId &&
        activeScopeRef.current.revisionNumber === targetRev
      ) {
        setIsSubmittingDecision(false);
      }
    }
  };

  const handleRetry = () => {
    if (errorActionType === 'GENERATE') {
      handleGenerate();
    } else {
      setError(null);
      setErrorActionType(null);
      const targetRev = selectedRevision || detail?.currentRevisionNumber || 1;
      handleSelectRevision(targetRev).catch(() => {});
    }
  };

  const displayedArtefact = detail?.artefact || localFallbackArtefact;

  if (displayedArtefact) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-xs text-rose-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={handleRetry}
              className="px-3 py-1 bg-rose-900 hover:bg-rose-800 text-rose-200 rounded border border-rose-700 transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        <ArtefactDocumentViewer
          artefact={displayedArtefact}
          icon={ClipboardList}
          accentColor="emerald"
          staleness={detail?.staleness}
          revisions={detail?.revisions}
          currentRevisionNumber={detail?.currentRevisionNumber || 1}
          selectedRevisionNumber={selectedRevision || detail?.currentRevisionNumber || 1}
          onSelectRevision={handleSelectRevision}
          onRegenerate={handleGenerate}
          isRegenerating={isGenerating}
          canRegenerate={canGenerate}
          onDownloadMarkdown={handleDownloadMarkdown}
          activeDecision={detail?.activeDecision}
          approvalValidity={detail?.approvalValidity}
          decisionHistory={detail?.decisionHistory}
          canApprove={canApprove}
          onApproveRevision={handleApproveRevision}
          onWithdrawApproval={handleWithdrawApproval}
          isSubmittingDecision={isSubmittingDecision}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
        <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin mx-auto" />
        <p className="text-xs text-slate-400">Loading Performance Test Plan...</p>
      </div>
    );
  }

  const isContractBlocked = contractResult?.status === 'BLOCKED';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-950/60 border border-emerald-800/60">
            <ClipboardList className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Performance Test Plan
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Deterministic executable verification specification derived from the live Performance Contract.
            </p>
          </div>
        </div>

        {contractResult && (
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold border ${
                isContractBlocked
                  ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              }`}
            >
              Contract: {contractResult.status}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-xs text-rose-200 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-rose-300">Action Required</span>
            <p>{error}</p>
          </div>
        </div>
      )}

      <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 space-y-4 text-xs text-slate-300">
        <h3 className="font-bold text-sm text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <span>No Performance Test Plan Generated Yet</span>
        </h3>
        <p className="leading-relaxed text-slate-400 max-w-2xl">
          The Performance Test Plan translates governed SLA thresholds, workload schedules, pass/fail evaluation rules, and observability requirements into an executable test plan.
        </p>

        {isContractBlocked ? (
          <div className="p-3.5 bg-rose-950/20 border border-rose-900/60 rounded-lg text-rose-200 space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>Governing Contract Has Unresolved Issues</span>
            </div>
            <p className="text-slate-300 text-[11px]">
              The live Performance Contract carries {contractResult?.blockingIssues?.length || 0} unresolved issue(s). Generating now will produce a structured <strong>BLOCKED draft preview</strong> with explicitly flagged blocker sections.
            </p>
          </div>
        ) : (
          <div className="p-3.5 bg-emerald-950/20 border border-emerald-900/60 rounded-lg text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Live contract is ready. Generation will produce a formal reviewable revision.</span>
          </div>
        )}

        <div className="pt-2 flex items-center gap-3">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !canGenerate}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm transition flex items-center gap-2 text-xs"
          >
            {isGenerating ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-white" />
                <span>Generating Test Plan...</span>
              </>
            ) : !canGenerate ? (
              <>
                <Lock className="w-4 h-4 text-slate-400" />
                <span>Generate Test Plan (Insufficient Permission)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-emerald-200" />
                <span>Generate Performance Test Plan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
