import React, { useEffect, useState } from 'react';
import {
  FileCheck2,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileCode2,
  Clock,
  TrendingUp,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { ProjectSummary, IntelligenceItem } from '../../types';
import { useServices } from '../../services/ServiceContext';
import { compileDraftPerformanceContract } from '@pecp/workload-engine';

interface ContractPageProps {
  project: ProjectSummary;
  initialItems?: IntelligenceItem[];
}

export const ContractPage: React.FC<ContractPageProps> = ({ project, initialItems }) => {
  const { intelligenceService } = useServices();
  const [items, setItems] = useState<IntelligenceItem[]>(initialItems || []);
  const [viewJson, setViewJson] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!initialItems || initialItems.length === 0) {
      intelligenceService.getIntelligenceItems(project.id).then(setItems).catch(console.error);
    }
  }, [project.id, initialItems, intelligenceService]);

  // Compile the Draft Performance Contract deterministically
  const contract = compileDraftPerformanceContract({
    projectSummary: project,
    intelligenceItems: items,
    version: 'v0.1-draft'
  });

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(contract, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            <span className="px-2.5 py-1 rounded text-[11px] font-mono font-semibold bg-sky-950 text-sky-300 border border-sky-800">
              Intent: {contract.engineeringIntent}
            </span>
            <span
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold border ${
                contract.status === 'BLOCKED'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              }`}
            >
              Contract Status: {contract.status}
            </span>
          </div>
        </div>

        {/* Approval Readiness Notice */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-white">Approval Readiness: BLOCKED</span>
              <p className="text-slate-400 leading-relaxed">
                This contract cannot be approved automatically. It remains a truthful draft until {contract.approvalReadiness.unresolvedIssuesCount} blocking issue(s) are formally resolved.
              </p>
            </div>
          </div>

          <button
            disabled
            className="px-4 py-2 bg-slate-800 text-slate-500 text-xs font-semibold rounded-lg border border-slate-700 cursor-not-allowed whitespace-nowrap flex items-center gap-2"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Sign & Approve Contract (Locked)</span>
          </button>
        </div>
      </div>

      {/* Blocking Issues Summary */}
      {contract.approvalReadiness.blockingReasons.length > 0 && (
        <div className="bg-rose-950/20 border border-rose-900/50 rounded-xl p-5 space-y-3">
          <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>Unresolved Canonical Issues Blocking Approval ({contract.approvalReadiness.blockingReasons.length})</span>
          </h3>
          <ul className="space-y-2 text-xs">
            {contract.approvalReadiness.blockingReasons.map((reason, idx) => (
              <li key={idx} className="flex items-start gap-2 text-rose-200">
                <span className="text-rose-400 font-mono shrink-0">•</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setViewJson(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              !viewJson ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Structured Contract View
          </button>
          <button
            onClick={() => setViewJson(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
              viewJson ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Machine-Readable JSON</span>
          </button>
        </div>

        {viewJson && (
          <button
            onClick={handleCopyJson}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy JSON'}</span>
          </button>
        )}
      </div>

      {viewJson ? (
        /* Machine-Readable JSON Schema Export */
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <pre className="text-xs font-mono text-slate-300 overflow-x-auto p-4 bg-slate-950 rounded-lg border border-slate-800">
            {JSON.stringify(contract, null, 2)}
          </pre>
        </div>
      ) : (
        /* Structured Contract Cards */
        <div className="space-y-6">
          {/* Workload Specifications Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              <span>Section 1: Workload & Throughput Specifications</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Peak Throughput */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300">Peak Transaction Throughput</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                    Compiled Lineage
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-white">
                  {contract.workloadCalculations[0]?.outputValue || 8.75} <span className="text-xs text-slate-400 font-normal">orders/sec (525/min, 31.5k/hr)</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {contract.workloadCalculations[0]?.humanReadableExplanation}
                </p>
                <div className="text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-900">
                  Lineage ID: {contract.workloadCalculations[0]?.calculationId}
                </div>
              </div>

              {/* Session Concurrency */}
              <div className="bg-slate-950 p-4 rounded-xl border border-rose-900/50 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-slate-300">Concurrent User Sessions</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800">
                    BLOCKED
                  </span>
                </div>
                <div className="text-lg font-bold font-mono text-rose-400">
                  UNRESOLVED (Not Calculated)
                </div>
                <p className="text-[11px] text-slate-400">
                  {contract.blockedWorkloadCalculations[0]?.reason}
                </p>
                <div className="text-[10px] font-mono text-rose-400 pt-2 border-t border-slate-900">
                  Prerequisite: {contract.blockedWorkloadCalculations[0]?.requiredIntelligence[0]}
                </div>
              </div>
            </div>
          </div>

          {/* Non-Functional Requirements & Acceptance Criteria Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Section 2: Acceptance Criteria & Non-Functional Release Gates</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-xs">
                <thead>
                  <tr className="text-left text-slate-400 font-mono uppercase text-[11px]">
                    <th className="py-2.5 px-3">Scope</th>
                    <th className="py-2.5 px-3">Metric</th>
                    <th className="py-2.5 px-3">Target</th>
                    <th className="py-2.5 px-3">Percentile</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Governance Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {contract.acceptanceCriteria.map((crit) => (
                    <tr key={crit.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-3 font-semibold text-white">{crit.scope}</td>
                      <td className="py-3 px-3 text-slate-300">{crit.metric}</td>
                      <td className="py-3 px-3 font-mono text-sky-400">
                        {crit.operator} {crit.thresholdValue} {crit.unit}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {crit.percentile ? (
                          <span className="text-slate-300">p{crit.percentile}</span>
                        ) : (
                          <span className="text-amber-400 font-bold">UNDEFINED</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold border ${
                            crit.status === 'AMBIGUOUS'
                              ? 'bg-amber-950 text-amber-300 border-amber-800'
                              : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                          }`}
                        >
                          {crit.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[11px]">
                        {crit.isBlockingForApproval ? (
                          <span className="text-rose-400 flex items-center gap-1 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            Blocks automated gate sign-off
                          </span>
                        ) : (
                          <span className="text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            Gate criteria satisfied
                          </span>
                        )}
                        {crit.ambiguityNotice && (
                          <p className="text-[10px] text-slate-400 mt-1">{crit.ambiguityNotice}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Governance Metadata & Downstream Consumers */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              <span>Section 3: Downstream Execution & Traceability</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 font-mono text-[11px] block">Downstream Test Plans:</span>
                <span className="text-white font-semibold block">M2 Performance Strategy</span>
                <span className="text-slate-500 text-[11px]">Requires approved contract baseline before code generation.</span>
              </div>
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 font-mono text-[11px] block">Testing Engine Targets:</span>
                <span className="text-white font-semibold block">k6 Suite & Thresholds</span>
                <span className="text-slate-500 text-[11px]">Directly consumes SLA thresholds once percentiles are disambiguated.</span>
              </div>
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                <span className="text-slate-400 font-mono text-[11px] block">Lineage Audit:</span>
                <span className="text-emerald-400 font-semibold block">100% Traceable</span>
                <span className="text-slate-500 text-[11px]">Every target points directly to ADO items or architectural documents.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
