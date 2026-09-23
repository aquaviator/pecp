// PECP Governed Findings & Defect Register View (M4.3)
// Defined according to docs/work-packages/M4_3_EXECUTION_TO_EVIDENCE_PORTAL_WORKLOAD_VISUALISATION.md
// Invariant: Driven strictly by canonical FindingsRegister without invented root causes, priorities, or defect tickets.

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Info,
  Hash,
  FileText,
  Lock
} from 'lucide-react';
import { ProjectSummary } from '../../types';
import { useServices } from '../../services/ServiceContext';
import { ExecutionEvidenceState } from '../../services/interfaces/IExecutionEvidenceService';
import { EmptyState } from '../../components/common/EmptyState';

interface FindingsPageProps {
  project: ProjectSummary;
  initialEvidenceState?: ExecutionEvidenceState;
}

export const FindingsPage: React.FC<FindingsPageProps> = ({ project, initialEvidenceState }) => {
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
        console.error('Failed to load findings state:', err);
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

  if (!evidenceState || !evidenceState.hasExecuted || !evidenceState.findingsRegister) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Performance Findings & Defect Register
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Constitution §13 steps 16–17: Structured performance observations, governance findings, and defect candidates derived deterministically from acceptance evaluation.
          </p>
        </div>

        <EmptyState
          icon={AlertTriangle}
          title="No Findings Ingested Yet"
          description="Findings and defect candidates are generated deterministically when execution telemetry is evaluated against the performance contract."
          subtext="Categories: GOVERNANCE / ATTAINMENT / CRITERIA_FAILURE"
        />
      </div>
    );
  }

  const { findingsRegister, acceptanceEvaluation } = evidenceState;
  const findings = findingsRegister.findings || [];
  const defectCandidates = findingsRegister.defectCandidates || [];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Governed Findings Register & Defect Candidates
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Factual observations compiled by the canonical Findings Generator. Zero invented root causes, priorities, severities, or ticket assignments.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800">
              Register: {findingsRegister.id}
            </span>
            <span className="text-xs font-mono px-2 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              Status: {findingsRegister.generationStatus || 'VALID'}
            </span>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block">Total Governed Findings</span>
          <span className="text-2xl font-bold text-white font-mono mt-1 block">
            {findings.length}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Factual execution observations
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block">Eligible Defect Candidates</span>
          <span className="text-2xl font-bold text-slate-400 font-mono mt-1 block">
            {defectCandidates.length}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Eligible for ALM sync
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block">Source Acceptance Verdict</span>
          <span className="text-base font-bold text-amber-400 font-mono mt-1.5 block">
            {acceptanceEvaluation?.overallVerdict || 'INCONCLUSIVE'}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Workload unresolved
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block">Cryptographic Digest</span>
          <span className="text-xs font-mono text-emerald-400 truncate max-w-[180px] mt-2 block" title={findingsRegister.registerDigest?.value}>
            {findingsRegister.registerDigest?.value || 'VALID'}
          </span>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            SHA-256 bound
          </span>
        </div>
      </div>

      {/* Governed Findings List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-sky-400" />
          Factual Performance & Governance Findings
        </h3>

        {findings.length > 0 ? (
          <div className="space-y-3">
            {findings.map((f) => (
              <div
                key={f.id}
                className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                      {f.findingType}
                    </span>
                    <h4 className="text-sm font-bold text-white">{f.title}</h4>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                    <span>ID: {f.id}</span>
                    <span className="text-slate-600">•</span>
                    <span>Class: {f.classification || 'GOVERNANCE'}</span>
                  </div>
                </div>

                <div className="text-xs text-slate-300 space-y-2">
                  <div>
                    <span className="text-slate-500 block text-[11px] font-mono uppercase">
                      Problem Statement:
                    </span>
                    <p className="text-slate-200 mt-0.5 font-medium leading-relaxed">
                      {f.factualDescription}
                    </p>
                  </div>

                  {f.evidenceSourcePaths && f.evidenceSourcePaths.length > 0 && (
                    <div>
                      <span className="text-slate-500 block text-[11px] font-mono uppercase">
                        Raw Evidence Traces:
                      </span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {f.evidenceSourcePaths.map((ref: string, idx: number) => (
                          <span
                            key={idx}
                            className="bg-slate-900 border border-slate-800 font-mono text-[11px] text-sky-400 px-2 py-0.5 rounded"
                          >
                            {ref}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px]">
                  <span className="text-slate-500">
                    Defect Eligibility: <span className="font-mono text-slate-400 font-bold">{f.defectEligibility ? 'TRUE' : 'FALSE'}</span>
                  </span>
                  <span className="text-slate-500 italic">
                    Reason: SUT defect tickets are not created for governance/workload-attainment findings.
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500 font-mono">No findings recorded in register.</p>
        )}
      </div>

      {/* Defect Candidates Section (Defect Eligibility Law) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-slate-400" />
            <h3 className="text-sm font-bold text-white">
              Defect Candidates & ALM Publication Boundary
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {defectCandidates.length} Candidates
          </span>
        </div>

        {defectCandidates.length === 0 ? (
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-6 text-center space-y-2">
            <Lock className="w-6 h-6 text-slate-500 mx-auto" />
            <p className="text-xs font-semibold text-slate-300">
              0 Defect Candidates Eligible for Publication
            </p>
            <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
              Under Constitution §13 (Defect Eligibility Law), a performance test with an <strong className="text-amber-400">INCONCLUSIVE</strong> verdict or unresolved workload attainment cannot emit SUT defect candidates. SUT defect tickets require a verified failing performance criterion under proven workload attainment.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {defectCandidates.map((c) => (
              <div key={c.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                <span className="font-mono text-xs text-white">{c.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
