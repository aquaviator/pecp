// PECP Governed Customer-Controlled Execution Runner View (M4.3)
// Defined according to docs/work-packages/M4_3_EXECUTION_TO_EVIDENCE_PORTAL_WORKLOAD_VISUALISATION.md
// Invariant: Factual execution runner status. PECP orchestrates customer-controlled runners.

import React, { useState, useEffect } from 'react';
import {
  Zap,
  Terminal,
  Activity,
  Server,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  Hash,
  FileCheck
} from 'lucide-react';
import { ProjectSummary } from '../../types';
import { useServices } from '../../services/ServiceContext';
import { ExecutionEvidenceState } from '../../services/interfaces/IExecutionEvidenceService';
import { EmptyState } from '../../components/common/EmptyState';

interface ExecutionsPageProps {
  project: ProjectSummary;
  initialEvidenceState?: ExecutionEvidenceState;
}

export const ExecutionsPage: React.FC<ExecutionsPageProps> = ({ project, initialEvidenceState }) => {
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
        console.error('Failed to load execution state:', err);
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
        <div className="h-48 bg-slate-900 border border-slate-800 rounded-xl" />
      </div>
    );
  }

  if (!evidenceState || !evidenceState.hasExecuted || !evidenceState.executionResult) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-sky-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Governed Execution Record & Ingress
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Constitution §10: Recorded customer-controlled runner execution. Telemetry streams ingested and corroborated with target systems.
          </p>
        </div>

        <EmptyState
          icon={Terminal}
          title="Execution Evidence & Ingress Shell"
          description="Recorded customer-controlled runner execution telemetry and evidence capture from customer infrastructure."
          subtext="Runner Mode: Customer-Controlled Ingress (Recorded Telemetry)"
        />
      </div>
    );
  }

  const { executionResult, rawArtifactSummary, verifiedTestDefinition } = evidenceState;
  const run = executionResult.run;

  const formatSec = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-sky-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Governed Execution Record
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Factual record of executed test runner session. Telemetry streams ingested and corroborated with target systems.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800">
              Run: {run.executionRunId}
            </span>
            <span className="text-xs font-mono px-2 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              {run.operationalStatus || 'NOT_SUPPLIED'}
            </span>
          </div>
        </div>
      </div>

      {/* Execution Run Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-mono text-slate-400 block">Execution Run Identifier</span>
            <h3 className="text-base font-bold font-mono text-white mt-0.5">{run.executionRunId}</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-sky-400 border border-slate-800">
              Engine: {run.engine?.name || 'NOT_SUPPLIED'}{run.engine?.version ? ` v${run.engine.version}` : ''}
            </span>
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              Exit Code: {run.engineExitCode != null ? String(run.engineExitCode) : 'NOT_SUPPLIED'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <span className="text-slate-400 block">Workflow Run ID</span>
            <span className="font-mono font-bold text-white mt-1 block">
              {run.workflowRunId || 'NOT_SUPPLIED'}
            </span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <span className="text-slate-400 block">Execution Duration</span>
            <span className="font-mono font-bold text-white mt-1 block">
              {run.timestamps?.durationSeconds != null
                ? `${run.timestamps.durationSeconds}s (${formatSec(run.timestamps.durationSeconds)})`
                : (run as any)?.durationSeconds != null
                  ? `${(run as any).durationSeconds}s (${formatSec((run as any).durationSeconds)})`
                  : 'NOT_SUPPLIED'}
            </span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <span className="text-slate-400 block">Completed Iterations</span>
            <span className="font-mono font-bold text-sky-400 mt-1 block">
              {executionResult.metrics.iterations?.count?.toLocaleString() || 'NOT_SUPPLIED'}
            </span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
            <span className="text-slate-400 block">Business Events Observed</span>
            <span className="font-mono font-bold text-amber-400 mt-1 block">
              {executionResult.metrics.pecpBusinessAttainmentEvents?.count?.toLocaleString() || 'NOT_SUPPLIED'}
            </span>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-1 font-mono text-xs">
          <div className="flex justify-between items-center text-slate-400">
            <span>Repository Commit SHA:</span>
            <span className="text-sky-400 truncate max-w-[280px]" title={run.repositoryCommitSha || ''}>
              {run.repositoryCommitSha || 'NOT_SUPPLIED'}
            </span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Evidence Artifact ID:</span>
            <span className="text-slate-200">{run.executionArtifact?.id || rawArtifactSummary?.artifactId || 'NOT_SUPPLIED'}</span>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span>Source Test Definition:</span>
            <span className="text-slate-200">{verifiedTestDefinition?.id || (run as any)?.testDefinitionId || 'NOT_SUPPLIED'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
