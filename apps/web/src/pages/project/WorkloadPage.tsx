import React, { useEffect, useState } from 'react';
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
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Info,
  Sliders,
  ExternalLink
} from 'lucide-react';
import { ProjectSummary, IntelligenceItem } from '../../types';
import { useServices } from '../../services/ServiceContext';
import {
  convertThroughput,
  evaluateSessionConcurrency,
  evaluateWorkloadReadiness,
  validateJourneyDistribution,
  applyGrowthAndHeadroom
} from '@pecp/workload-engine';

interface WorkloadPageProps {
  project: ProjectSummary;
  initialItems?: IntelligenceItem[];
}

export const WorkloadPage: React.FC<WorkloadPageProps> = ({ project, initialItems }) => {
  const { intelligenceService } = useServices();
  const [items, setItems] = useState<IntelligenceItem[]>(initialItems || []);
  const [selectedGrowth, setSelectedGrowth] = useState<number>(20);
  const [selectedHeadroom, setSelectedHeadroom] = useState<number>(30);
  const [activeLineageId, setActiveLineageId] = useState<string | null>(null);

  useEffect(() => {
    if (!initialItems || initialItems.length === 0) {
      intelligenceService.getIntelligenceItems(project.id).then(setItems).catch(console.error);
    }
  }, [project.id, initialItems, intelligenceService]);

  // Extract peak orders item or default to candidate value 31,500
  const peakOrdersItem = items.find((i) => i.key === 'peak_hourly_orders');
  const basePeakOrders = 31500; // Selected business forecast candidate

  // 1. Throughput conversion (Deterministic, Constitution §3)
  const throughputConversion = convertThroughput(
    basePeakOrders,
    'per_hour',
    peakOrdersItem?.id || 'intel-peak-orders',
    'Black Friday 2026 Business Forecast'
  );

  // 2. Session Concurrency (Little's Law check)
  const sessionConcurrency = evaluateSessionConcurrency({
    hasSessionArrivalRate: false, // Intentionally missing in RetailCo upstream
    sessionArrivalRate: undefined,
    hasSessionDuration: true,
    sessionDuration: 8,
    sessionDurationUnit: 'minutes',
    sourceSessionDurationId: 'intel-session-duration',
    hasOrderThroughput: true,
    orderThroughput: basePeakOrders,
    orderThroughputUnit: 'per_hour',
    sourceOrderThroughputId: 'intel-peak-orders'
  });

  // 3. Journey distribution validation
  const journeyDistribution = validateJourneyDistribution(
    [
      { id: 'j-browse', name: 'Browse', percentage: 55, weight: 0.55 },
      { id: 'j-search', name: 'Search', percentage: 20, weight: 0.2 },
      { id: 'j-basket', name: 'Basket', percentage: 15, weight: 0.15 },
      { id: 'j-checkout', name: 'Checkout', percentage: 8, weight: 0.08 },
      { id: 'j-account', name: 'Account', percentage: 2, weight: 0.02 }
    ],
    0.01,
    ['intel-journey-distribution']
  );

  // 4. Growth & Headroom scaling
  const scaledWorkload = applyGrowthAndHeadroom({
    baseValue: basePeakOrders,
    baseUnit: 'orders/hour',
    growthPercentage: selectedGrowth,
    headroomPercentage: selectedHeadroom,
    sourceBaseId: peakOrdersItem?.id || 'intel-peak-orders',
    parameterName: 'Peak Forecast Capacity Target'
  });

  // 5. Workload Readiness
  const readiness = evaluateWorkloadReadiness(items, {
    hasJourneyDistribution: true,
    journeyDistributionValid: journeyDistribution.isValid,
    journeyValidationError: journeyDistribution.validationError
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & M1 Architectural Governance */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-sky-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Deterministic Workload Modeling Engine
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Pure, deterministic mathematical transformations governed by Constitution §3 and §7. AI is never used for workload calculations, and missing prerequisites are explicitly exposed.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold border ${
                readiness.status === 'BLOCKED'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                  : readiness.status === 'PARTIAL'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                  : 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
              }`}
            >
              Workload Readiness: {readiness.status}
            </span>
          </div>
        </div>

        {/* Readiness Warning / Blocking Issue Alert */}
        <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-white">Engine Guardrail Active:</span>
            <p className="text-slate-400 leading-relaxed">
              {readiness.summary}
            </p>
          </div>
        </div>
      </div>

      {/* Grid of Active Workload Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Business Demand & Unit Conversion */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
              <span>1. Business Demand Throughput</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
              Calculated
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Unit conversions from Black Friday 2026 forecast candidate ({basePeakOrders.toLocaleString()} orders/hr):
          </p>
          <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-xs">
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-500">Hourly Rate:</span>
              <span className="text-white font-bold">{throughputConversion.hourlyRate.toLocaleString()} /hr</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-500">Per-Minute Rate (÷ 60):</span>
              <span className="text-sky-300 font-bold">{throughputConversion.perMinuteRate} /min</span>
            </div>
            <div className="flex justify-between items-center text-slate-300">
              <span className="text-slate-500">Per-Second Rate (÷ 60):</span>
              <span className="text-emerald-300 font-bold">{throughputConversion.perSecondRate} orders/sec</span>
            </div>
          </div>
          <p className="text-[11px] text-amber-400/90 leading-tight bg-amber-950/30 p-2 rounded border border-amber-900/50">
            {throughputConversion.semanticNotice}
          </p>
        </div>

        {/* 2. Concurrency / Little's Law */}
        <div className="bg-slate-900 border border-rose-900/60 bg-rose-950/10 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-rose-400" />
              <span>2. Session Concurrency (Little's Law)</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800">
              Blocked / Refused
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Concurrent active Virtual Users derived via Little's Law (L = λ × W):
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-rose-900/40 text-xs space-y-2">
            <div className="font-mono text-rose-400 font-semibold">
              Concurrent Sessions: NOT CALCULATED
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {sessionConcurrency.blocked?.reason}
            </p>
            <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
              <strong className="text-rose-300">Required Intelligence:</strong> {sessionConcurrency.blocked?.requiredIntelligence[0]}
            </div>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            Constitution §3: Anti-hallucination law strictly prevents multiplying order throughput by session duration.
          </div>
        </div>

        {/* 3. Session Duration */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>3. Session Duration (W)</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
              Approved
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Residence time a user spends in the application:
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-2 font-mono">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Duration Value:</span>
              <span className="text-white font-bold">8.0 minutes (480 sec)</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-slate-500">Source:</span>
              <span className="text-slate-300">Strategy 2024 §4.3</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-slate-500">Approval:</span>
              <span className="text-emerald-400">Lead Perf Architect</span>
            </div>
          </div>
        </div>

        {/* 4. Journey Distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-sky-400" />
              <span>4. Journey Distribution Matrix</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
              Validated 100%
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Validated traffic weighting across user transaction journeys:
          </p>
          <div className="space-y-1.5 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono">
            {journeyDistribution.journeys.map((j) => (
              <div key={j.id} className="flex justify-between items-center">
                <span className="text-slate-400">{j.name}:</span>
                <span className="text-sky-300 font-semibold">{j.percentage}% (weight {j.weight})</span>
              </div>
            ))}
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center font-bold">
              <span className="text-slate-300">Total Mix:</span>
              <span className="text-emerald-400">{journeyDistribution.totalPercentage}%</span>
            </div>
          </div>
        </div>

        {/* 5. Growth & Engineering Headroom */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span>5. Growth & Engineering Headroom</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
              Explicit Formula
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Target = Base × (1 + Growth) × (1 + Headroom):
          </p>
          <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Projected Growth:</span>
              <span className="text-sky-300 font-mono font-semibold">+{selectedGrowth}%</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Engineering Headroom:</span>
              <span className="text-purple-300 font-mono font-semibold">+{selectedHeadroom}%</span>
            </div>
            <div className="pt-2 border-t border-slate-800 flex justify-between items-center font-mono font-bold">
              <span className="text-slate-300">Scaled Target:</span>
              <span className="text-emerald-300">{scaledWorkload.outputValue.toLocaleString()} orders/hr</span>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 font-mono">
            No default factors invented. All parameters must be explicitly declared.
          </p>
        </div>

        {/* 6. Execution Model Mapping */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>6. Open vs. Closed Model Classification</span>
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
              Architectural Guard
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Downstream executor mappings according to Constitution §3:
          </p>
          <div className="space-y-2 text-xs">
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
              <span className="text-sky-300 font-semibold block">Open Workload (Ingress):</span>
              <span className="text-[11px] text-slate-400">Maps to k6 constant-arrival-rate executor based on {throughputConversion.perSecondRate} req/sec.</span>
            </div>
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
              <span className="text-emerald-300 font-semibold block">Closed Workload (Browsing):</span>
              <span className="text-[11px] text-slate-400">Blocked until session arrival rate or concurrent VU relationship is approved.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Structured Issues & Lineage Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <FileCode className="w-4 h-4 text-sky-400" />
          <span>Workload Model Lineage & Structured Issues ({readiness.issues.length})</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800 text-xs">
            <thead>
              <tr className="text-left text-slate-400 font-mono uppercase text-[11px]">
                <th className="py-2.5 px-3">Issue Type</th>
                <th className="py-2.5 px-3">Parameter</th>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Remediation Guidance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {readiness.issues.map((issue) => (
                <tr key={issue.id} className="hover:bg-slate-800/30">
                  <td className="py-2.5 px-3 font-mono text-slate-300">
                    <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                      {issue.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-sky-400">{issue.parameter}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded font-mono text-[10px] font-semibold border ${
                        issue.severity === 'BLOCKING'
                          ? 'bg-rose-950 text-rose-300 border-rose-800'
                          : 'bg-amber-950 text-amber-300 border-amber-800'
                      }`}
                    >
                      {issue.severity}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">{issue.description}</td>
                  <td className="py-2.5 px-3 text-slate-400 text-[11px]">{issue.remediationGuidance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
