import React, { useState } from 'react';
import {
  Calculator,
  ArrowRight,
  TrendingUp,
  Percent,
  Layers,
  Sliders,
  CheckCircle2,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { WorkloadParameters, UserJourney, EngineeringIntent } from '../types';

interface WorkloadModelerViewProps {
  workload: WorkloadParameters;
  journeys: UserJourney[];
  activeIntent: EngineeringIntent;
  onUpdateWorkload: (updated: WorkloadParameters) => void;
  onUpdateJourneys: (journeys: UserJourney[]) => void;
  onNavigateToContract: () => void;
}

export const WorkloadModelerView: React.FC<WorkloadModelerViewProps> = ({
  workload,
  journeys,
  activeIntent,
  onUpdateWorkload,
  onUpdateJourneys,
  onNavigateToContract
}) => {
  const [hourlyOrders, setHourlyOrders] = useState<number>(workload.peakHourlyTransactions);
  const [safetyMargin, setSafetyMargin] = useState<number>(workload.safetyMarginPct);
  const [pacingFactor, setPacingFactor] = useState<number>(1.86);

  // Total mix percentage check
  const totalMix = journeys.reduce((acc, j) => acc + j.mixPercentage, 0);

  // Little's Law computation:
  // Base TPS = (Hourly Orders / 3600) * API calls multiplier per order
  // For e-commerce with 4 journeys, an order typically requires ~138 API interactions
  // Base TPS = (hourlyOrders / 3600) * 138 * (1 + safetyMargin / 100)
  const baseTps = Math.round((hourlyOrders / 3600) * 110 * (1 + safetyMargin / 100));

  // Average session residence time R = sum(mix_i * (p95_i / 1000 + thinkTime_i))
  const weightedResidenceSec = journeys.reduce((acc, j) => {
    const serviceTimeSec = j.p95TargetMs / 1000;
    const sessionPart = (j.mixPercentage / 100) * (serviceTimeSec + j.thinkTimeSec);
    return acc + sessionPart;
  }, 0);

  // Concurrency N = Throughput X * Residence Time R
  const calculatedVus = Math.round(baseTps * weightedResidenceSec);

  const handleApplyCalculations = () => {
    const updated: WorkloadParameters = {
      ...workload,
      peakHourlyTransactions: hourlyOrders,
      safetyMarginPct: safetyMargin,
      targetTps: baseTps,
      calculatedVirtualUsers: calculatedVus,
      littlesLawEquation: `N = X × R → ${calculatedVus.toLocaleString()} VUs = ${baseTps.toLocaleString()} TPS × ${weightedResidenceSec.toFixed(2)}s Residence Time`
    };
    onUpdateWorkload(updated);
  };

  const handleJourneyMixChange = (id: string, newMix: number) => {
    const updated = journeys.map((j) => (j.id === id ? { ...j, mixPercentage: newMix } : j));
    onUpdateJourneys(updated);
  };

  const handleJourneyThinkTimeChange = (id: string, newTime: number) => {
    const updated = journeys.map((j) => (j.id === id ? { ...j, thinkTimeSec: newTime } : j));
    onUpdateJourneys(updated);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-sky-400" />
              <h2 className="text-base font-semibold text-white">
                Deterministic Workload Modeling Engine (Little's Law)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Constitution §3 & §15: PECP deterministically owns workload calculations. Concurrency is not guessed; it is computed mathematically via Little's Law (<span className="font-mono text-sky-300">N = X × R</span>) from approved volume and measured residence times.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleApplyCalculations}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Update Canonical Workload</span>
            </button>
            <button
              id="proceed-to-contract-btn"
              onClick={onNavigateToContract}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              <span>Commit to Performance Contract</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Little's Law Hero Formula Block */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/40 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono text-sky-400 uppercase tracking-wider font-semibold">
              Little's Law Deterministic Formulation
            </span>
            <div className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
              N = X × R
            </div>
            <p className="text-xs text-slate-300 font-mono">
              {calculatedVus.toLocaleString()} Virtual Users = {baseTps.toLocaleString()} TPS × {weightedResidenceSec.toFixed(2)}s Residence (Service + Think)
            </p>
          </div>

          {/* Key Calculated Output Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Target Concurrency</span>
              <span className="text-2xl font-bold font-mono text-sky-400 mt-0.5 block">
                {calculatedVus.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">Virtual Users (VUs)</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Peak Throughput</span>
              <span className="text-2xl font-bold font-mono text-emerald-400 mt-0.5 block">
                {baseTps.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">Req / Sec (TPS)</span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 text-center col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Residence Time</span>
              <span className="text-2xl font-bold font-mono text-amber-400 mt-0.5 block">
                {weightedResidenceSec.toFixed(2)}s
              </span>
              <span className="text-[10px] text-slate-400">Weighted per Req</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Sliders & Journey Mix Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Input Parameters */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Sliders className="h-4 w-4 text-sky-400" />
            <span>Demand & Sizing Controls</span>
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-300 font-medium">Peak Commercial Volume:</span>
                <span className="font-mono font-bold text-white">{hourlyOrders.toLocaleString()} orders/hr</span>
              </div>
              <input
                type="range"
                min="10000"
                max="100000"
                step="1000"
                value={hourlyOrders}
                onChange={(e) => setHourlyOrders(Number(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 font-mono">
                <span>10k</span>
                <span>48k (BF26 Target)</span>
                <span>100k</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-slate-300 font-medium">Engineering Safety Margin:</span>
                <span className="font-mono font-bold text-emerald-400">+{safetyMargin}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="5"
                value={safetyMargin}
                onChange={(e) => setSafetyMargin(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5 font-mono">
                <span>0%</span>
                <span>20% (Standard)</span>
                <span>50%</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Ramp-up Duration:</span>
                <span className="font-mono text-slate-200">10 minutes</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Steady-state Window:</span>
                <span className="font-mono text-slate-200">45 minutes</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Graceful Cooldown:</span>
                <span className="font-mono text-slate-200">5 minutes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: User Journey Mix Table */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-sky-400" />
                <span>User Journey Mix Matrix</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Distribution of transactions across application workflows. Sum must equal 100%.
              </p>
            </div>

            <div className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold ${
              totalMix === 100
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : 'bg-rose-950 text-rose-300 border border-rose-800'
            }`}>
              Total Mix: {totalMix}% {totalMix !== 100 && '(Deficit)'}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-mono text-[10px]">
                <tr>
                  <th className="p-2.5 rounded-l-lg">Journey Workflow</th>
                  <th className="p-2.5">Mix %</th>
                  <th className="p-2.5">Think Time</th>
                  <th className="p-2.5">SLA p95</th>
                  <th className="p-2.5 rounded-r-lg">Critical Path</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {journeys.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-2.5 font-medium text-slate-200">
                      <div>{j.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{j.endpoint}</div>
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={j.mixPercentage}
                          onChange={(e) => handleJourneyMixChange(j.id, Number(e.target.value))}
                          className="w-14 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white focus:outline-none focus:border-sky-500"
                        />
                        <span className="text-slate-500 font-mono">%</span>
                      </div>
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="15"
                          value={j.thinkTimeSec}
                          onChange={(e) => handleJourneyThinkTimeChange(j.id, Number(e.target.value))}
                          className="w-14 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-center font-mono text-white focus:outline-none focus:border-sky-500"
                        />
                        <span className="text-slate-500 font-mono">sec</span>
                      </div>
                    </td>
                    <td className="p-2.5 font-mono text-sky-400">
                      ≤ {j.p95TargetMs}ms
                    </td>
                    <td className="p-2.5">
                      {j.criticalPath ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950/80 text-rose-300 border border-rose-800">
                          CRITICAL GATE
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Standard</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
