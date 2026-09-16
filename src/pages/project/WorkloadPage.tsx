import React from 'react';
import {
  Calculator,
  AlertCircle,
  TrendingUp,
  Shield,
  Clock,
  PieChart,
  Users,
  Repeat,
  Layers,
  ArrowRight
} from 'lucide-react';
import { ProjectSummary } from '../../types';

interface WorkloadPageProps {
  project: ProjectSummary;
}

export const WorkloadPage: React.FC<WorkloadPageProps> = ({ project }) => {
  return (
    <div className="space-y-6">
      {/* Top Banner & M0 Architecture Boundary Statement */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-sky-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Workload Modeling Workspace Shell
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Deterministic mathematical formulation for Open vs. Closed workload models, Little's Law concurrency, pacing equations, and arrival schedules.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded text-[11px] font-mono bg-amber-950/80 text-amber-300 border border-amber-800">
              Status: Workspace Shell (M0 Boundary)
            </span>
          </div>
        </div>

        {/* Explicit Milestone Constraint Notice */}
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-white">M0 Specification Law:</span>
            <p className="text-slate-400 leading-relaxed">
              Deterministic workload calculation is <strong className="text-slate-200">not implemented in M0</strong>. Workload mathematics will be developed by a separate dedicated engine workstream. The sections below define the domain contract and parameter slots without fabricating synthetic calculations.
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Workload Workspace Future Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Business Demand */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
              <span>1. Business Demand</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Uncalculated</span>
          </div>
          <p className="text-xs text-slate-400">
            Target commercial transaction volume, orders per hour, and sales velocity curve.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
            Source item: [peak_hourly_orders]
          </div>
        </div>

        {/* 2. Growth */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>2. Growth</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Uncalculated</span>
          </div>
          <p className="text-xs text-slate-400">
            Year-over-year commercial growth factor and marketing campaign multiplier.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
            Parameter: Baseline + YoY Growth %
          </div>
        </div>

        {/* 3. Engineering Headroom */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span>3. Engineering Headroom</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Uncalculated</span>
          </div>
          <p className="text-xs text-slate-400">
            Safety margin applied over forecasted peak to absorb unpredictable promotional spikes.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
            Buffer factor: Typically +20% to +50%
          </div>
        </div>

        {/* 4. Arrival Rate */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>4. Arrival Rate</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Uncalculated</span>
          </div>
          <p className="text-xs text-slate-400">
            Transactions and HTTP requests per second (λ) arriving at API gateway ingress.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
            Equation: λ = Demand / 3,600 sec
          </div>
        </div>

        {/* 5. Concurrency */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-sky-400" />
              <span>5. Concurrency</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Uncalculated</span>
          </div>
          <p className="text-xs text-slate-400">
            Simultaneous active Virtual Users (N) derived through Little's Law.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
            Formula: N = X × R (Little's Law)
          </div>
        </div>

        {/* 6. Session Duration */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>6. Session Duration</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Imported (8 min)</span>
          </div>
          <p className="text-xs text-slate-400">
            Total elapsed time a user spends traversing the catalog, basket, and checkout.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300">
            Canonical value: 8 minutes (imported)
          </div>
        </div>

        {/* 7. Journey Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-sky-400" />
              <span>7. Journey Distribution</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Imported Mix</span>
          </div>
          <p className="text-xs text-slate-400">
            Percentage weighting of user workflows across transactions.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300">
            Browse 55%, Search 20%, Basket 15%, Checkout 8%, Account 2%
          </div>
        </div>

        {/* 8. Think Time */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>8. Think Time</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Uncalculated</span>
          </div>
          <p className="text-xs text-slate-400">
            Human pauses between interactions modeled via Gaussian or exponential distribution.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
            Parameter: Mean ± standard deviation
          </div>
        </div>

        {/* 9. Pacing */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-purple-400" />
              <span>9. Pacing</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Uncalculated</span>
          </div>
          <p className="text-xs text-slate-400">
            Delay between consecutive scenario iterations to regulate overall throughput.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
            Equation: Pacing = Target Iteration Time - Execution Time
          </div>
        </div>

        {/* 10. Open Workload */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>10. Open Workload</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Uncalculated</span>
          </div>
          <p className="text-xs text-slate-400">
            Arrival-rate driven execution model where request arrivals are independent of system response time.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
            Engine mapping: k6 constant-arrival-rate executor
          </div>
        </div>

        {/* 11. Closed Workload */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>11. Closed Workload</span>
            </h3>
            <span className="text-[10px] font-mono text-slate-500">Uncalculated</span>
          </div>
          <p className="text-xs text-slate-400">
            Concurrency-driven model where new requests are only initiated when preceding requests finish.
          </p>
          <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
            Engine mapping: k6 ramping-vus executor
          </div>
        </div>
      </div>
    </div>
  );
};
