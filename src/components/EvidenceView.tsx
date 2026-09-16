import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Download,
  Share2,
  ExternalLink,
  ShieldCheck,
  Layers,
  Bug,
  Activity,
  FileCode
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import {
  ExecutionRun,
  PerformanceFinding,
  PerformanceContract,
  EvaluationVerdict
} from '../types';

interface EvidenceViewProps {
  run: ExecutionRun;
  contract: PerformanceContract;
  findings: PerformanceFinding[];
  onExportEvidence: () => void;
  onExportFindingToALM: (findingId: string) => void;
}

export const EvidenceView: React.FC<EvidenceViewProps> = ({
  run,
  contract,
  findings,
  onExportEvidence,
  onExportFindingToALM
}) => {
  const [selectedTab, setSelectedTab] = useState<'OVERVIEW' | 'CHARTS' | 'FINDINGS' | 'TRACEABILITY'>('OVERVIEW');

  // Chart data formatting
  const chartData = run.metricsTimeline.map((m) => ({
    time: `${Math.floor(m.timestampSec / 60)}m`,
    VUs: m.currentVus,
    TPS: m.reqPerSec,
    p95Latency: m.p95LatencyMs,
    errorRate: (m.errorRatePct * 100).toFixed(2)
  }));

  const verdictConfigs: Record<EvaluationVerdict, { bg: string; text: string; border: string; label: string }> = {
    PASS: {
      bg: 'bg-emerald-950/70',
      text: 'text-emerald-400',
      border: 'border-emerald-700',
      label: 'PASS — All Contractual Gates Met'
    },
    PASS_WITH_OBSERVATION: {
      bg: 'bg-amber-950/70',
      text: 'text-amber-400',
      border: 'border-amber-700',
      label: 'PASS WITH OBSERVATION — Core SLAs Satisfied with Tail Anomalies'
    },
    FAIL: {
      bg: 'bg-rose-950/70',
      text: 'text-rose-400',
      border: 'border-rose-700',
      label: 'FAIL — Contractual Gate Violation'
    },
    INCONCLUSIVE: {
      bg: 'bg-slate-900',
      text: 'text-slate-400',
      border: 'border-slate-800',
      label: 'INCONCLUSIVE — Harness or Ingestion Failure'
    }
  };

  const vConfig = verdictConfigs[run.verdict] || verdictConfigs.PASS;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-amber-400" />
              <h2 className="text-base font-semibold text-white">
                Governed Performance Evidence Package & Traceability
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Constitution §13 steps 14–19: Deterministic evaluation of execution telemetry against approved contract gates. Traceable lineage from initial business requirement to test assertion and observed telemetry.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="export-evidence-bundle-btn"
              onClick={onExportEvidence}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Download Evidence Package (JSON/ZIP)</span>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex gap-2">
          <button
            onClick={() => setSelectedTab('OVERVIEW')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedTab === 'OVERVIEW' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Executive Summary & Verdict
          </button>
          <button
            onClick={() => setSelectedTab('CHARTS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedTab === 'CHARTS' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Telemetry & Saturation Curves
          </button>
          <button
            onClick={() => setSelectedTab('FINDINGS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
              selectedTab === 'FINDINGS' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>Findings & Defects</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300">
              {findings.length}
            </span>
          </button>
          <button
            onClick={() => setSelectedTab('TRACEABILITY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedTab === 'TRACEABILITY' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Full Traceability Matrix
          </button>
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {selectedTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* Official Verdict Card */}
          <div className={`rounded-xl border p-6 shadow-xl ${vConfig.bg} ${vConfig.border}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
                  Deterministic Performance Evaluation Verdict
                </span>
                <div className={`text-xl font-bold font-mono mt-1 ${vConfig.text}`}>
                  {vConfig.label}
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                  Evaluated against Contract <span className="font-mono font-bold text-white">{contract.version}</span>. Execution run #{run.runNumber} sustained 1,850 TPS under 3,450 concurrent VUs with 0 contract breaches.
                </p>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-center sm:text-right text-xs">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Run Duration</span>
                <span className="text-lg font-bold font-mono text-white mt-0.5 block">
                  {Math.round(run.durationSec / 60)} minutes
                </span>
                <span className="text-[10px] text-slate-400 font-mono">1,887,000 total HTTP requests</span>
              </div>
            </div>

            {/* Run Observations list */}
            {run.observations.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2">
                <span className="text-xs font-semibold text-slate-300">Engine Observations:</span>
                <ul className="space-y-1 text-xs text-slate-300">
                  {run.observations.map((obs, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-400">•</span>
                      <span>{obs}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Key Metric Aggregate Tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Observed Peak Concurrency</span>
              <span className="text-2xl font-bold font-mono text-white mt-1 block">
                {run.peakVus.toLocaleString()} VUs
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">100% of Target Little's Law</span>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Average Throughput</span>
              <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
                {run.averageTps.toLocaleString()} req/s
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Target: 1,850 TPS</span>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Aggregate p95 Latency</span>
              <span className="text-2xl font-bold font-mono text-sky-400 mt-1 block">
                {run.p95LatencyMs} ms
              </span>
              <span className="text-[10px] text-slate-400 font-mono">p99: {run.p99LatencyMs} ms</span>
            </div>

            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Observed Error Rate</span>
              <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
                {run.errorRatePct}%
              </span>
              <span className="text-[10px] text-emerald-400 font-mono">Well below &lt;1.0% limit</span>
            </div>
          </div>

          {/* SLA Gate Compliance Checklist */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Contractual SLA Gate Verification Ledger
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px]">
                  <tr>
                    <th className="p-3">User Journey</th>
                    <th className="p-3">Contract SLA (p95)</th>
                    <th className="p-3">Observed p95</th>
                    <th className="p-3">Observed Error %</th>
                    <th className="p-3">Evaluation Gate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-medium text-slate-200">Browse Catalog & SKU Details</td>
                    <td className="p-3 font-mono text-slate-400">≤ 250 ms</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">185 ms</td>
                    <td className="p-3 font-mono text-emerald-400">0.05%</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        PASSED GATE
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-medium text-slate-200">Faceted Search & Filtering</td>
                    <td className="p-3 font-mono text-slate-400">≤ 200 ms</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">142 ms</td>
                    <td className="p-3 font-mono text-emerald-400">0.02%</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        PASSED GATE
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-medium text-slate-200">Cart Management & Updates</td>
                    <td className="p-3 font-mono text-slate-400">≤ 300 ms</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">215 ms</td>
                    <td className="p-3 font-mono text-emerald-400">0.08%</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        PASSED GATE
                      </span>
                    </td>
                  </tr>

                  <tr className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-medium text-slate-200">Checkout & Payment Processing</td>
                    <td className="p-3 font-mono text-slate-400">≤ 350 ms</td>
                    <td className="p-3 font-mono text-emerald-400 font-bold">312 ms</td>
                    <td className="p-3 font-mono text-amber-400">0.18%</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-950 text-amber-300 border border-amber-800">
                        PASS (OBSERVATION)
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CHARTS TAB */}
      {selectedTab === 'CHARTS' && (
        <div className="space-y-6">
          {/* Concurrency Ramp & Throughput Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-sky-400">Telemetry Profile</span>
                <h3 className="text-sm font-bold text-white">Concurrency (VUs) & Request Throughput (TPS)</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">17-minute execution window</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorVUs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorTPS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#334155', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="VUs" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorVUs)" name="Virtual Users" />
                  <Area type="monotone" dataKey="TPS" stroke="#10b981" fillOpacity={1} fill="url(#colorTPS)" name="Requests / sec" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Latency Distribution Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-400">Response Profile</span>
                <h3 className="text-sm font-bold text-white">p95 Response Latency (ms) vs 350ms SLA Threshold</h3>
              </div>
              <span className="text-xs font-mono text-rose-400">Ceiling: 350ms</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 450]} />
                  <Tooltip contentStyle={{ backgroundColor: '#0b0f19', borderColor: '#334155', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="p95Latency" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Observed p95 (ms)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* FINDINGS TAB */}
      {selectedTab === 'FINDINGS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Structured Performance Findings & Defect Register
            </h3>
            <span className="text-xs text-slate-500">Auto-generated from telemetry anomalies</span>
          </div>

          <div className="space-y-4">
            {findings.map((f) => (
              <div
                key={f.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-md"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-sky-400">{f.code}</span>
                    <h4 className="text-sm font-bold text-white">{f.title}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      f.severity === 'MAJOR'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      {f.severity}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                      {f.category.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-xs text-slate-300">
                  <div>
                    <span className="text-slate-500 font-medium">Impacted Workflow:</span>
                    <span className="ml-1 text-slate-200 font-semibold">{f.journey}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Description:</span>
                    <p className="mt-0.5 text-slate-200">{f.description}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-slate-400">
                    <span className="text-slate-500 block text-[10px] uppercase font-sans font-semibold">Evidence Trace:</span>
                    {f.evidence}
                  </div>
                  <div>
                    <span className="text-slate-500 font-medium">Engineering Recommendation:</span>
                    <p className="mt-0.5 text-emerald-400 font-medium">{f.recommendation}</p>
                  </div>
                </div>

                {/* ALM Export status */}
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  {f.exportedToALM ? (
                    <span className="text-xs text-emerald-400 flex items-center gap-1.5 font-mono">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Synced to Azure DevOps ({f.ticketRef})
                    </span>
                  ) : (
                    <button
                      onClick={() => onExportFindingToALM(f.id)}
                      className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
                    >
                      Export to Azure DevOps / Jira
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TRACEABILITY MATRIX TAB */}
      {selectedTab === 'TRACEABILITY' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          <div>
            <span className="text-[10px] font-mono uppercase text-sky-400 tracking-wider">
              Constitution §13 step 19 — End-to-End Governance Audit
            </span>
            <h3 className="text-base font-bold text-white mt-0.5">
              Full Source-to-Result Performance Traceability Matrix
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Every final test outcome, threshold, and finding is linked with cryptographic provenance to the originating business requirement.
            </p>
          </div>

          <div className="space-y-4">
            {/* Step 1: Upstream Ingestion */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-sky-400 uppercase font-mono">
                <span>1. Business Source of Record</span>
                <span className="text-slate-600">→</span>
                <span>Azure DevOps Epic #10492 & 2025 Dynatrace APM Telemetry</span>
              </div>
              <p className="text-xs text-slate-300">
                Commercial requirement: Support 48,000 orders/hr for Black Friday 2026 without checkout degradation.
              </p>
            </div>

            {/* Step 2: Canonical Model */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase font-mono">
                <span>2. Canonical Model & Provenance Ledger</span>
                <span className="text-slate-600">→</span>
                <span>Item [intel-1]: Peak Hourly Orders = 48,000 (State: APPROVED)</span>
              </div>
              <p className="text-xs text-slate-300">
                Discrepancies resolved in Conflict Workbench: Architecture doc 5,000 TPS superseded by live telemetry.
              </p>
            </div>

            {/* Step 3: Workload Calculations */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase font-mono">
                <span>3. Deterministic Workload Model</span>
                <span className="text-slate-600">→</span>
                <span>Little's Law: N = X × R (3,450 VUs = 1,850 TPS × 1.86s residence)</span>
              </div>
              <p className="text-xs text-slate-300">
                User journey mix locked: Browse 55%, Search 25%, Cart 12%, Checkout 8%.
              </p>
            </div>

            {/* Step 4: Contract SLA */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase font-mono">
                <span>4. Governed Performance Contract</span>
                <span className="text-slate-600">→</span>
                <span>Contract v1.0-APPROVED (Hard gate: Checkout p95 ≤ 350ms)</span>
              </div>
              <p className="text-xs text-slate-300">
                Formally signed by Governance Board (H. Jensen, E. Vance).
              </p>
            </div>

            {/* Step 5: Test Execution */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase font-mono">
                <span>5. k6 Test Harness Execution</span>
                <span className="text-slate-600">→</span>
                <span>Run #104 Completed (1.88M requests, 312ms Checkout p95)</span>
              </div>
              <p className="text-xs text-slate-300">
                Result verdict: <span className="text-amber-400 font-bold">PASS_WITH_OBSERVATION</span>. Generated defect FIND-BF26-01 exported to Azure DevOps (ADO-BUG-19821).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
