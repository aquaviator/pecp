import React from 'react';
import {
  FileCheck2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileCode2
} from 'lucide-react';
import { ProjectSummary } from '../../types';

interface ContractPageProps {
  project: ProjectSummary;
}

export const ContractPage: React.FC<ContractPageProps> = ({ project }) => {
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Governed Performance Contract Workspace
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Constitution §5 & §8: The versioned, machine-readable agreement between Product, Architecture, and Operations defining release gates and non-negotiable performance SLAs.
            </p>
          </div>

          <span className="px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-amber-950/80 text-amber-300 border border-amber-800 self-start lg:self-center">
            Contract Status: PENDING CANONICAL COMPILATION
          </span>
        </div>

        {/* M0 Rule Notice */}
        <div className="mt-4 p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-white">M0 Architectural Principle:</span>
            <p className="text-slate-400 leading-relaxed">
              The Performance Contract is <strong className="text-slate-200">not a static template or fabricated document</strong>. It is the authoritative machine-readable contract compiled deterministically from approved upstream intelligence. In M0, the contract remains uncompiled until conflicting workload candidates and ambiguous NFR percentiles are formally resolved.
            </p>
          </div>
        </div>
      </div>

      {/* Contract Lifecycle Architecture Diagram */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Performance Contract Compilation Pipeline
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 relative">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>INPUT PHASE</span>
              <span className="text-purple-400">Step 1</span>
            </div>
            <h4 className="text-xs font-bold text-white">Approved Canonical Intelligence</h4>
            <p className="text-xs text-slate-400">
              Requires 100% resolution of CONFLICTING items (e.g. peak order volume) and AMBIGUOUS NFRs (e.g. checkout latency percentile).
            </p>
            <div className="pt-2 text-[10px] font-mono text-slate-500">
              Current state: 3 conflicts pending resolution
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-sky-800/80 bg-sky-950/10 space-y-2 relative">
            <div className="flex items-center justify-between text-[11px] font-mono text-sky-400">
              <span>GOVERNANCE GATE</span>
              <span className="text-sky-400">Step 2</span>
            </div>
            <h4 className="text-xs font-bold text-white">Versioned Contract Compilation</h4>
            <p className="text-xs text-slate-400">
              Deterministically compiles SLA/SLO gates, concurrency limits, and circuit breakers into a versioned JSON/YAML contract schema.
            </p>
            <div className="pt-2 text-[10px] font-mono text-sky-400">
              Requires formal cryptographic sign-off
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 relative">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>DOWNSTREAM CONSUMERS</span>
              <span className="text-emerald-400">Step 3</span>
            </div>
            <h4 className="text-xs font-bold text-white">Executable Generation</h4>
            <p className="text-xs text-slate-400">
              Directly generates engineering Strategy, Test Plans, and k6 threshold definitions with zero semantic drift.
            </p>
            <div className="pt-2 text-[10px] font-mono text-slate-500">
              Downstream: Strategy, Test Plan, k6 suite
            </div>
          </div>
        </div>
      </div>

      {/* Target Schema Preview */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <FileCode2 className="w-4 h-4 text-sky-400" />
              <span>Target Machine-Readable Contract Blueprint (Schema Definition)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Authoritative JSON structure to be emitted upon canonical model approval.
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500">JSON Schema v1.0</span>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-400 overflow-x-auto leading-relaxed">
          <pre>{`{
  "$schema": "https://pecp.internal/schemas/v1/performance-contract.json",
  "contractId": "contract-retailco-bf2026",
  "projectRef": "${project.id}",
  "status": "DRAFT_PENDING_APPROVAL",
  "intent": "${project.intent}",
  "slaGates": [
    {
      "journey": "checkout",
      "p95CeilingMs": 350,
      "maxErrorRatePct": 0.5,
      "enforcement": "HARD_RELEASE_BLOCKER"
    }
  ],
  "concurrencyEnvelopes": {
    "targetPeakVUs": "PENDING_LITTLES_LAW_CALCULATION",
    "circuitBreakerErrorPct": 1.0
  }
}`}</pre>
        </div>
      </div>
    </div>
  );
};
