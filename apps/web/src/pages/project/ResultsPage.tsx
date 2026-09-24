// PECP Governed Execution Results & Telemetry View (M4.3)
// Defined according to docs/work-packages/M4_3_EXECUTION_TO_EVIDENCE_PORTAL_WORKLOAD_VISUALISATION.md
// Invariant: Read-only projection of canonical results and acceptance evaluation. Zero React-side verdict calculation.

import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Activity,
  FileCheck,
  ShieldAlert,
  ShieldCheck,
  Info,
  Server,
  FileText,
  ExternalLink,
  Hash
} from 'lucide-react';
import { ProjectSummary } from '../../types';
import { useServices } from '../../services/ServiceContext';
import { ExecutionEvidenceState } from '../../services/interfaces/IExecutionEvidenceService';
import { WorkloadProfileChart } from '../../components/workload/WorkloadProfileChart';
import { EmptyState } from '../../components/common/EmptyState';

interface ResultsPageProps {
  project: ProjectSummary;
  initialEvidenceState?: ExecutionEvidenceState;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({ project, initialEvidenceState }) => {
  const { executionEvidenceService } = useServices();
  const [evidenceState, setEvidenceState] = useState<ExecutionEvidenceState | null>(
    initialEvidenceState || null
  );
  const [loading, setLoading] = useState<boolean>(!initialEvidenceState);

  useEffect(() => {
    if (initialEvidenceState) return;
    let isMounted = true;
    setLoading(true);
    executionEvidenceService
      .getExecutionEvidenceState(project.id)
      .then((state) => {
        if (isMounted) {
          setEvidenceState(state);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load execution evidence state:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [project.id, executionEvidenceService, initialEvidenceState]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-slate-900 border border-slate-800 rounded-xl" />
        <div className="h-64 bg-slate-900 border border-slate-800 rounded-xl" />
      </div>
    );
  }

  if (!evidenceState || !evidenceState.hasExecuted || !evidenceState.resultsReport) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Execution Results & Telemetry Analysis
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Constitution §13 steps 14–15: Ingests raw runner telemetry, evaluates latency percentiles against contract gates, and renders deterministic PASS / FAIL / INCONCLUSIVE verdicts.
          </p>
        </div>

        <EmptyState
          icon={CheckCircle2}
          title="No Test Execution Runs Ingested Yet"
          description="Results are ingested when customer-controlled test runners report telemetry streams back to PECP. For project-scoped execution, verify an approved contract and compiled bundle."
          subtext="Acceptance Verdicts: PASS / FAIL / PASS_WITH_OBSERVATION / INCONCLUSIVE"
        />
      </div>
    );
  }

  const { resultsReport, acceptanceEvaluation, executionResult, rawArtifactSummary } = evidenceState;
  const identity = resultsReport.projectExecutionIdentity;
  const attainment = resultsReport.workloadAttainment;
  const overallVerdict = acceptanceEvaluation?.overallVerdict ?? 'NOT_EVALUATED';

  const criteriaList =
    resultsReport.criterionOutcomes ||
    acceptanceEvaluation?.criterionEvaluations ||
    [];

  const iterationCount = executionResult?.metrics.iterations?.count;
  const durationSeconds =
    (executionResult as any)?.timestamps?.durationSeconds ||
    (identity as any)?.durationSeconds;
  const iterPerSec =
    iterationCount != null && durationSeconds && durationSeconds > 0
      ? (iterationCount / durationSeconds).toFixed(2)
      : null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Governed Execution Results & Acceptance Evaluation
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Deterministic projection of canonical execution telemetry, verified against the performance contract. UI does not independently evaluate verdicts.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800">
              Run: {identity?.executionRunId || executionResult?.run?.executionRunId || 'NOT_SUPPLIED'}
            </span>
            <span className="text-xs font-mono px-2 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              {identity?.operationalStatus || executionResult?.run?.operationalStatus || 'NOT_SUPPLIED'}
            </span>
          </div>
        </div>
      </div>

      {/* Acceptance Decision Banner (Crucial M4.3 Governance Display) */}
      <div
        className={`rounded-xl p-5 border shadow-sm space-y-4 ${
          overallVerdict === 'PASS'
            ? 'bg-emerald-950/20 border-emerald-800/80'
            : overallVerdict === 'FAIL'
            ? 'bg-rose-950/20 border-rose-800/80'
            : overallVerdict === 'INCONCLUSIVE'
            ? 'bg-amber-950/20 border-amber-800/80'
            : 'bg-slate-950/40 border-slate-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            {overallVerdict === 'PASS' ? (
              <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            ) : overallVerdict === 'FAIL' ? (
              <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            ) : overallVerdict === 'INCONCLUSIVE' ? (
              <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-6 h-6 text-slate-400 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                  Canonical Acceptance Verdict:
                </span>
                <span
                  className={`text-sm font-bold font-mono px-2.5 py-0.5 rounded border ${
                    overallVerdict === 'PASS'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                      : overallVerdict === 'FAIL'
                      ? 'bg-rose-950 text-rose-300 border-rose-700'
                      : overallVerdict === 'INCONCLUSIVE'
                      ? 'bg-amber-950 text-amber-300 border-amber-700'
                      : 'bg-slate-900 text-slate-300 border-slate-700'
                  }`}
                >
                  {overallVerdict}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {resultsReport.acceptanceVerdict?.reasons?.join('; ') ||
                  acceptanceEvaluation?.verdictReasons?.join('; ') ||
                  'Evaluated by canonical Acceptance Engine against approved Performance Contract.'}
              </p>
            </div>
          </div>

          {/* Workload Prerequisite Status Badge */}
          <div className="bg-slate-950/80 border border-slate-800 p-3 rounded-lg text-xs space-y-1 sm:text-right shrink-0">
            <span className="text-slate-400 block text-[11px] font-mono uppercase">
              Workload Prerequisite:
            </span>
            <span
              className={`font-mono font-bold text-xs inline-block px-2 py-0.5 rounded border ${
                attainment?.status === 'ATTAINED'
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                  : 'bg-amber-950 text-amber-400 border-amber-800'
              }`}
            >
              {attainment?.status || 'NOT_SUPPLIED'}
            </span>
            <span className="text-[10px] text-slate-500 block font-mono">
              {attainment?.derivationStatus || 'NOT_SUPPLIED'}
            </span>
          </div>
        </div>

        {/* Workload Prerequisite Law Educational Callout */}
        <div className="bg-slate-950/90 border border-slate-800/80 rounded-lg p-3 text-xs text-slate-300 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-200">
              Governance Invariant: Workload Prerequisite Law (Constitution §10, §13)
            </p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              A performance test cannot achieve an overall PASS status if steady-state workload attainment is unresolved. If steady-state demand attainment telemetry is not confirmed, the execution cannot be signed off regardless of whether individual response-time and error-rate criteria pass.
            </p>
          </div>
        </div>
      </div>

      {/* Governed Workload Profile & Journey Distribution Chart */}
      <WorkloadProfileChart
        visualisationHook={resultsReport.visualisationHook}
        showBusinessDemandKpi={true}
      />

      {/* Contract Criteria Gate Evaluation Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-sky-400" />
              Contract Performance Criteria Evaluations
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Exact threshold evaluations performed by canonical Acceptance Engine.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {criteriaList.length} Criteria Evaluated
          </span>
        </div>

        {criteriaList.length > 0 ? (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">Criterion ID</th>
                  <th className="p-3">Metric / Scope</th>
                  <th className="p-3">Target Expression</th>
                  <th className="p-3">Observed Telemetry</th>
                  <th className="p-3">Gate Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {criteriaList.map((evalItem: any, idx: number) => (
                  <tr key={evalItem.criterionId || evalItem.key || idx} className="hover:bg-slate-800/30">
                    <td className="p-3 font-mono text-slate-400">{evalItem.criterionId || evalItem.key || `crit-${idx}`}</td>
                    <td className="p-3 font-medium text-white">{evalItem.metric || evalItem.scope || evalItem.key}</td>
                    <td className="p-3 font-mono text-amber-300">{evalItem.target || evalItem.targetExpression || 'NOT_SUPPLIED'}</td>
                    <td className="p-3 font-mono text-sky-300 font-bold">
                      {evalItem.observedValue != null ? `${evalItem.observedValue} ${evalItem.observedUnit || 'NOT_SUPPLIED'}` : 'NOT_SUPPLIED'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 font-mono font-bold text-[11px] px-2 py-0.5 rounded border ${
                          evalItem.status === 'PASS'
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border-rose-800'
                        }`}
                      >
                        {evalItem.status === 'PASS' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                        )}
                        {evalItem.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 font-mono">No criteria evaluations available.</p>
        )}

        <div className="text-[11px] text-slate-500 italic">
          Note: Individual criteria PASS rows verify that the SUT met SLA targets during execution; however, the run cannot be signed off without resolved workload attainment.
        </div>
      </div>

      {/* Execution Telemetry & Corroboration Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Runner & Lab Corroboration */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-emerald-400" />
            Telemetry & Reference Lab Corroboration
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400">Total k6 Iterations:</span>
              <span className="font-mono font-bold text-white">
                {iterationCount != null ? iterationCount.toLocaleString() : 'NOT_SUPPLIED'}
                {iterPerSec != null && ` (${iterPerSec} iter/s)`}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400">Dropped Iterations:</span>
              <span className="font-mono font-bold text-emerald-400">
                {executionResult?.metrics.droppedIterations?.count != null
                  ? String(executionResult.metrics.droppedIterations.count)
                  : 'NOT_SUPPLIED'}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400">SUT Corroborated Orders Created:</span>
              <span className="font-mono font-bold text-sky-400">
                {executionResult?.referenceLabCorroboration?.businessEventCounts.orderCreatedEvents != null
                  ? String(executionResult.referenceLabCorroboration.businessEventCounts.orderCreatedEvents)
                  : 'NOT_SUPPLIED'}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-2.5 rounded border border-slate-800">
              <span className="text-slate-400">Counter Discrepancy:</span>
              <span className="font-mono font-bold text-emerald-400">
                {executionResult?.referenceLabCorroboration?.consistency.discrepancyCount != null ? (
                  <>
                    {executionResult.referenceLabCorroboration.consistency.discrepancyCount}
                    {executionResult.referenceLabCorroboration.consistency.isConsistent && (
                      <span className="text-slate-400 font-normal ml-1">(Corroborated)</span>
                    )}
                  </>
                ) : (
                  'NOT_SUPPLIED'
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Cryptographic Provenance & Lineage */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Hash className="w-4 h-4 text-sky-400" />
            Execution Provenance & Cryptographic Lineage
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800 font-mono">
              <span className="text-slate-400">Runner Engine:</span>
              <span className="text-slate-200">
                {(executionResult as any)?.executionEnvironment?.runnerEngine ||
                  (executionResult as any)?.manifest?.runnerEngine ||
                  rawArtifactSummary?.runnerEngine ||
                  'NOT_SUPPLIED'}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800 font-mono">
              <span className="text-slate-400">Workflow Run ID:</span>
              <span className="text-slate-200">
                {(identity as any)?.workflowRunId || rawArtifactSummary?.workflowRunId || 'NOT_SUPPLIED'}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800 font-mono">
              <span className="text-slate-400">Repository Commit:</span>
              <span className="text-sky-400 truncate max-w-[200px]" title={(identity as any)?.commitSha || rawArtifactSummary?.commitSha || ''}>
                {(identity as any)?.commitSha || rawArtifactSummary?.commitSha || 'NOT_SUPPLIED'}
              </span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-2 rounded border border-slate-800 font-mono">
              <span className="text-slate-400">Results Report Digest:</span>
              <span className="text-emerald-400 truncate max-w-[200px]" title={resultsReport.reportDigest}>
                {resultsReport.reportDigest}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Raw Evidence Artifact Inventory */}
      {rawArtifactSummary && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              Raw Execution Evidence Artifact Inventory (M3.1B)
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Artifact ID: {rawArtifactSummary.artifactId}
            </span>
          </div>
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">File Name</th>
                  <th className="p-3">SHA-256 Checksum</th>
                  <th className="p-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {rawArtifactSummary.files.map((file) => (
                  <tr key={file.name} className="hover:bg-slate-800/30">
                    <td className="p-3 font-mono font-medium text-white">{file.name}</td>
                    <td className="p-3 font-mono text-sky-400 truncate max-w-[220px]" title={file.checksum}>
                      {file.checksum}
                    </td>
                    <td className="p-3 text-slate-400">{file.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
