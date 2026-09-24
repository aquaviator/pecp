// Governed Workload Profile & Journey Distribution Visualisation (M4.3)
// Defined according to docs/work-packages/M4_3_EXECUTION_TO_EVIDENCE_PORTAL_WORKLOAD_VISUALISATION.md
// Invariant: Driven strictly by governed ResultsReportVisualisationHook without UI-level invention.

import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import {
  Clock,
  Layers,
  Activity,
  AlertTriangle,
  Info,
  Table as TableIcon,
  LineChart as ChartIcon
} from 'lucide-react';
import { ResultsReportVisualisationHook } from '@pecp/pe-domain';
import {
  buildWorkloadVisualisationSeries,
  WorkloadVisualisationData
} from './workloadVisualisationAdapter';

export interface WorkloadProfileChartProps {
  visualisationHook?: ResultsReportVisualisationHook | null;
  showBusinessDemandKpi?: boolean;
  className?: string;
  populationRelationshipText?: string | null;
  initialView?: VisualisationView;
}

type VisualisationView = 'SCHEDULER' | 'JOURNEY_STACKED' | 'TABLE';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  return remSec === 0 ? `${mins}m (${seconds}s)` : `${mins}m ${remSec}s`;
}

export const WorkloadProfileChart: React.FC<WorkloadProfileChartProps> = ({
  visualisationHook,
  showBusinessDemandKpi = true,
  className = '',
  populationRelationshipText = null,
  initialView = 'SCHEDULER'
}) => {
  const [activeView, setActiveView] = useState<VisualisationView>(initialView);
  const data: WorkloadVisualisationData = buildWorkloadVisualisationSeries(visualisationHook);

  if (!data.hasData) {
    return (
      <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-2 ${className}`}>
        <Clock className="w-6 h-6 text-slate-500 mx-auto" />
        <p className="text-xs font-semibold text-slate-300">
          No Governed Workload Schedule Available to Visualise
        </p>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          In accordance with the Authoritative Execution-Input Law, PECP never fabricates synthetic load profiles when authoritative test definition companion is absent or unverified.
        </p>
      </div>
    );
  }

  const { summary, journeyMetadata, schedulerPoints, journeySeriesPoints, validationIssues } = data;
  const rateUnit = summary.rateUnit || null;

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-5 ${className}`}>
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-sky-400" />
            Governed Workload Profile & Schedule Visualisation
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic stage boundaries and journey mix derived directly from verified Test Definition.
          </p>
        </div>

        {/* View Segmented Controls */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setActiveView('SCHEDULER')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeView === 'SCHEDULER'
                ? 'bg-sky-950 text-sky-300 border border-sky-800/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ChartIcon className="w-3.5 h-3.5" />
            Scheduler Profile
          </button>
          {journeyMetadata.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveView('JOURNEY_STACKED')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'JOURNEY_STACKED'
                  ? 'bg-sky-950 text-sky-300 border border-sky-800/80 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Journey Mix (Stacked)
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveView('TABLE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeView === 'TABLE'
                ? 'bg-sky-950 text-sky-300 border border-sky-800/80 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            Schedule Table
          </button>
        </div>
      </div>

      {/* Validation Issues / Governance Warnings */}
      {validationIssues.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-lg p-3 space-y-1">
          {validationIssues.map((issue, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{issue}</span>
            </div>
          ))}
        </div>
      )}

      {/* Business Demand vs Scheduler Demand Separation KPIs (Constitution §10, Population Separation Law) */}
      {showBusinessDemandKpi && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950 border border-slate-800/90 rounded-lg p-4">
          <div>
            <span className="text-[11px] text-slate-400 block uppercase font-mono tracking-wider">
              Business Target Demand
            </span>
            <span className="text-base font-bold text-amber-400 font-mono mt-0.5 block">
              {summary.businessTarget?.targetValue != null
                ? `${summary.businessTarget.targetValue} ${summary.businessTarget.unit || 'NOT_SUPPLIED'}`
                : 'NOT_SUPPLIED'}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Required Business Outcome
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block uppercase font-mono tracking-wider">
              Scheduler Peak Demand
            </span>
            <span className="text-base font-bold text-sky-400 font-mono mt-0.5 block">
              {summary.peakArrivalRate != null
                ? `${summary.peakArrivalRate} ${rateUnit || 'NOT_SUPPLIED'}`
                : 'NOT_SUPPLIED'}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              k6 Arrival Rate Schedule
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block uppercase font-mono tracking-wider">
              Population & Execution Model
            </span>
            <span className="text-xs font-semibold text-slate-200 mt-1 block">
              {summary.population || 'NOT_SUPPLIED'} · {summary.executionModel || 'NOT_SUPPLIED'}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              Start Rate: {summary.startRate != null ? `${summary.startRate} ${rateUnit || 'NOT_SUPPLIED'}` : 'absent'}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-slate-400 block uppercase font-mono tracking-wider">
              Total Governed Duration
            </span>
            <span className="text-base font-bold text-white font-mono mt-0.5 block">
              {summary.totalDurationSeconds != null
                ? formatDuration(summary.totalDurationSeconds)
                : 'NOT_SUPPLIED'}
            </span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">
              {schedulerPoints.length > 0 ? `${schedulerPoints.length - 1} Stages` : 'Unstaged'}
            </span>
          </div>
        </div>
      )}

      {/* Governed Population Relationship Lineage Callout */}
      {(populationRelationshipText || summary.populationRelationshipText) && (
        <div className="bg-sky-950/20 border border-sky-900/40 rounded-lg p-3 flex items-start gap-2.5 text-xs text-slate-300">
          <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5 leading-relaxed">
            <span className="font-semibold text-sky-200">
              Population Relationship Law (Constitution §10, M3.0.3):
            </span>
            <p className="text-slate-400">
              {populationRelationshipText || summary.populationRelationshipText}
              <span className="text-slate-300 ml-1">
                Scheduler arrivals do not automatically prove business event creation. Attainment must be proven through steady-state telemetry.
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Chart Views */}
      {activeView === 'SCHEDULER' && (
        <div className="space-y-3">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={schedulerPoints} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="schedulerFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="elapsedSeconds"
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(val) => `${val}s`}
                  label={{ value: 'Elapsed Time (seconds)', position: 'insideBottom', offset: -12, fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                  label={{
                    value: rateUnit ? `Scheduler Rate (${rateUnit})` : 'Scheduler Rate',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#94a3b8',
                    fontSize: 11,
                    style: { textAnchor: 'middle' }
                  }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const pt = payload[0].payload as (typeof schedulerPoints)[0];
                      return (
                        <div className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg shadow-xl text-xs space-y-1">
                          <p className="font-mono text-slate-400">Elapsed Time: <span className="text-white font-bold">{label}s</span> ({formatDuration(Number(label))})</p>
                          <p className="font-mono text-sky-400 font-bold">
                            Arrival Rate: {pt.rate != null ? `${pt.rate}${rateUnit ? ` ${rateUnit}` : ''}` : 'absent'}
                          </p>
                          {pt.label && <p className="text-[11px] text-slate-500">{pt.label}</p>}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="linear"
                  dataKey="rate"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#schedulerFill)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 font-mono">
            <span>t=0s {summary.startRate != null ? `(${summary.startRate} ${rateUnit || 'NOT_SUPPLIED'})` : ''}</span>
            <span>Steady Peak: {summary.peakArrivalRate != null ? `${summary.peakArrivalRate} ${rateUnit || 'NOT_SUPPLIED'}` : 'NOT_SUPPLIED'}</span>
            <span>Total: {summary.totalDurationSeconds != null ? `${summary.totalDurationSeconds}s` : 'absent'}</span>
          </div>
        </div>
      )}

      {activeView === 'JOURNEY_STACKED' && journeyMetadata.length > 0 && (
        <div className="space-y-4">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={journeySeriesPoints} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis
                  dataKey="elapsedSeconds"
                  stroke="#64748b"
                  fontSize={11}
                  tickFormatter={(val) => `${val}s`}
                  label={{ value: 'Elapsed Time (seconds)', position: 'insideBottom', offset: -12, fill: '#94a3b8', fontSize: 11 }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                  label={{
                    value: rateUnit ? `Stacked Journey Rates (${rateUnit})` : 'Stacked Journey Rates',
                    angle: -90,
                    position: 'insideLeft',
                    fill: '#94a3b8',
                    fontSize: 11,
                    style: { textAnchor: 'middle' }
                  }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const pt = payload[0].payload as (typeof journeySeriesPoints)[0];
                      return (
                        <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg shadow-xl text-xs space-y-1.5 min-w-[200px]">
                          <p className="font-mono text-slate-400 border-b border-slate-800 pb-1">
                            Elapsed: <span className="text-white font-bold">{label}s</span> ({formatDuration(Number(label))})
                          </p>
                          <p className="font-mono text-white text-[11px]">
                            Total Arrival: <span className="font-bold text-sky-400">{pt.totalSchedulerRate != null ? `${pt.totalSchedulerRate}${rateUnit ? ` ${rateUnit}` : ''}` : 'absent'}</span>
                          </p>
                          <div className="space-y-1 pt-1">
                            {journeyMetadata.map((meta) => {
                              const val = pt[meta.key];
                              return (
                                <div key={meta.key} className="flex items-center justify-between text-[11px]">
                                  <span className="flex items-center gap-1.5 text-slate-300">
                                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: meta.color }} />
                                    {meta.name} ({meta.percentage}%):
                                  </span>
                                  <span className="font-mono font-medium text-slate-200">
                                    {val != null ? `${val}${rateUnit ? ` ${rateUnit}` : ''}` : 'absent'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {journeyMetadata.map((meta) => (
                  <Area
                    key={meta.key}
                    type="linear"
                    dataKey={meta.key}
                    name={meta.name}
                    stackId="1"
                    stroke={meta.color}
                    fill={meta.color}
                    fillOpacity={0.65}
                    isAnimationActive={false}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Journey Mix Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {journeyMetadata.map((meta) => (
              <div key={meta.key} className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: meta.color }} />
                  <span className="text-xs font-medium text-slate-200 truncate">{meta.name}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-white font-mono">{meta.percentage}%</span>
                  <span className="text-[11px] font-mono text-sky-400">{meta.peakRate != null ? `${meta.peakRate}${rateUnit ? ` ${rateUnit}` : ''}` : 'absent'}</span>
                </div>
                <span className="text-[10px] text-slate-500 block font-mono">weight: {meta.weight}</span>
              </div>
            ))}
          </div>

          <div className="text-[11px] text-slate-400 font-mono text-right bg-slate-950/60 p-2 rounded border border-slate-800/60">
            Journey distribution total: <span className="text-emerald-400 font-bold">{summary.journeySumPercentage != null ? `${summary.journeySumPercentage}%` : 'absent'}</span>
            {summary.peakArrivalRate != null && (
              <span className="ml-2 text-slate-500">
                (Peak arrival rate: <span className="text-sky-300 font-bold">{summary.peakArrivalRate}{rateUnit ? ` ${rateUnit}` : ''}</span>)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Accessible Table View (WCAG AA Compliance) */}
      {activeView === 'TABLE' && (
        <div className="space-y-4">
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">Timeline Event</th>
                  <th className="p-3">Elapsed Time</th>
                  <th className="p-3">Target Rate{rateUnit ? ` (${rateUnit})` : ''}</th>
                  <th className="p-3">Stage Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {schedulerPoints.map((pt, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="p-3 font-mono text-slate-400">
                      {idx === 0 ? 'Schedule Start' : `Stage ${idx} End`}
                    </td>
                    <td className="p-3 font-mono font-medium text-white">
                      {formatDuration(pt.elapsedSeconds)}
                    </td>
                    <td className="p-3 font-mono font-bold text-sky-400">
                      {pt.rate != null ? `${pt.rate}${rateUnit ? ` ${rateUnit}` : ''}` : 'absent'}
                    </td>
                    <td className="p-3 text-slate-400">{pt.label || 'Governed stage'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Journey breakdown table */}
          {journeyMetadata.length > 0 && (
            <div className="border border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                  <tr>
                    <th className="p-3">Journey Name</th>
                    <th className="p-3">Key</th>
                    <th className="p-3">Governed Share</th>
                    <th className="p-3">Weight</th>
                    <th className="p-3">Peak Scheduler Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {journeyMetadata.map((j) => (
                    <tr key={j.key} className="hover:bg-slate-800/30">
                      <td className="p-3 font-medium text-white flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: j.color }} />
                        {j.name}
                      </td>
                      <td className="p-3 font-mono text-slate-400">{j.key}</td>
                      <td className="p-3 font-mono font-bold text-amber-400">{j.percentage}%</td>
                      <td className="p-3 font-mono text-slate-300">{j.weight}</td>
                      <td className="p-3 font-mono font-bold text-sky-400">{j.peakRate != null ? `${j.peakRate}${rateUnit ? ` ${rateUnit}` : ''}` : 'absent'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
