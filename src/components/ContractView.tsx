import React, { useState } from 'react';
import {
  FileCheck2,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Stamp,
  Calendar,
  Lock,
  Download
} from 'lucide-react';
import { PerformanceContract, EngineeringIntent } from '../types';

interface ContractViewProps {
  contract: PerformanceContract;
  onApproveContract: (approverName: string) => void;
  onNavigateToArtefacts: () => void;
}

export const ContractView: React.FC<ContractViewProps> = ({
  contract,
  onApproveContract,
  onNavigateToArtefacts
}) => {
  const [approverName, setApproverName] = useState('Lead Performance Architect (H. Jensen)');
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);

  const isApproved = contract.status === 'APPROVED';

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FileCheck2 className="h-4 w-4 text-emerald-400" />
              <h2 className="text-base font-semibold text-white">
                Governed Performance Contract ({contract.version})
              </h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                {contract.status}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Constitution §5 & §8: The Performance Contract is the versioned legal & engineering agreement between Product, Architecture, and Operations. Approvals are strictly version-specific.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {!isApproved ? (
              <button
                onClick={() => setIsSignModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors"
              >
                <Stamp className="h-4 w-4" />
                <span>Formally Sign Contract</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 text-emerald-300 text-xs font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                <span>Locked by Governance</span>
              </div>
            )}

            <button
              id="proceed-to-artefacts-btn"
              onClick={onNavigateToArtefacts}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              <span>View Generated Artefacts</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Formal Contract Document Sheet */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-8 shadow-xl relative overflow-hidden">
        {/* Subtle Watermark Stamp */}
        <div className="absolute top-6 right-6 opacity-10 pointer-events-none text-right">
          <div className="text-6xl font-black uppercase text-emerald-400">PECP</div>
          <div className="text-sm font-mono text-white">GOVERNED SPECIFICATION</div>
        </div>

        {/* Contract Header Metadata */}
        <div className="border-b border-slate-800 pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-sky-400 font-semibold">
                Official Engineering Non-Functional Requirement Contract
              </span>
              <h1 className="text-2xl font-extrabold text-white mt-1">
                {contract.title}
              </h1>
              <p className="text-xs text-slate-400 mt-1">
                Target Envelope: <span className="text-slate-200 font-medium">{contract.targetEnvironment}</span>
              </p>
            </div>

            <div className="text-right text-xs space-y-1">
              <div className="text-slate-500">Contract Version: <span className="font-mono text-white font-bold">{contract.version}</span></div>
              <div className="text-slate-500">Engineering Intent: <span className="font-mono text-sky-400 font-bold">{contract.intent}</span></div>
              {contract.approvedAt && (
                <div className="text-emerald-400 font-mono text-[11px] flex items-center justify-end gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Approved: {contract.approvedAt}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SLA / SLO Failure Gates */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-emerald-400" />
            <span>Section 1: Non-Negotiable SLA/SLO Failure Gates</span>
          </h3>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] uppercase">
                <tr>
                  <th className="p-3">User Journey Workflow</th>
                  <th className="p-3">p95 Latency Ceiling</th>
                  <th className="p-3">Max Allowed Error Rate</th>
                  <th className="p-3">Minimum Throughput</th>
                  <th className="p-3">Enforcement Gate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
                {contract.slaGates.map((gate) => (
                  <tr key={gate.journeyId} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-semibold text-white">
                      {gate.journeyName}
                    </td>
                    <td className="p-3 font-mono text-sky-400 font-bold">
                      ≤ {gate.p95MaxMs} ms
                    </td>
                    <td className="p-3 font-mono text-amber-400 font-bold">
                      &lt; {gate.errorRateMaxPct}%
                    </td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">
                      ≥ {gate.minimumThroughputTps} TPS
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-950 text-rose-300 border border-rose-800">
                        HARD RELEASE GATE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: Concurrency & Circuit Breaker Thresholds */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
              Section 2.1: Concurrency Cap
            </span>
            <div className="text-xl font-bold font-mono text-white">
              {contract.concurrencyCap.toLocaleString()} Concurrent VUs
            </div>
            <p className="text-xs text-slate-400">
              Maximum concurrent virtual users permitted in the performance test harness before load generation throttling is enforced.
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider block">
              Section 2.2: Test Abort Criteria
            </span>
            <div className="text-xl font-bold font-mono text-rose-400">
              &gt; {contract.failureThresholds.overallErrorRatePct}% Overall Errors
            </div>
            <p className="text-xs text-slate-400">
              Immediate execution abort triggered if errors exceed threshold or if {contract.failureThresholds.consecutiveFailedHealthchecks} consecutive probe checks fail.
            </p>
          </div>
        </div>

        {/* Section 3: Formal Sign-off Ledger */}
        <div className="border-t border-slate-800 pt-6 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-sky-400" />
            <span>Section 3: Sign-off & Audit Provenance Ledger</span>
          </h3>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
              <div>
                <span className="text-slate-500">Authorized Signatory:</span>
                <div className="text-white font-semibold mt-0.5">
                  {contract.approvedBy || 'Pending Formal Signature'}
                </div>
              </div>

              <div>
                <span className="text-slate-500">Governance Status:</span>
                <div className="text-emerald-400 font-mono font-semibold mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  VERIFIED & CANONICAL
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for Sign-off */}
      {isSignModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">Formally Sign Performance Contract</h3>
              <button onClick={() => setIsSignModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="text-xs text-slate-300 space-y-2">
              <p>Signing this contract commits the SLA/SLO gates into the canonical execution baseline.</p>
              <div>
                <label className="block text-slate-400 mb-1">Signatory Name & Title:</label>
                <input
                  type="text"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setIsSignModalOpen(false)}
                className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onApproveContract(approverName);
                  setIsSignModalOpen(false);
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm"
              >
                Confirm & Lock Contract
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
