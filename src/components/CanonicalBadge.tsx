import React from 'react';
import { CanonicalState } from '../types';

interface CanonicalBadgeProps {
  state: CanonicalState;
  size?: 'sm' | 'md';
  showTooltip?: boolean;
}

export const CanonicalBadge: React.FC<CanonicalBadgeProps> = ({
  state,
  size = 'sm',
  showTooltip = true
}) => {
  const stateConfigs: Record<CanonicalState, { bg: string; text: string; border: string; desc: string }> = {
    APPROVED: {
      bg: 'bg-emerald-950/60',
      text: 'text-emerald-400',
      border: 'border-emerald-700/60',
      desc: 'Formally reviewed and approved for engineering calculations'
    },
    CALCULATED: {
      bg: 'bg-sky-950/60',
      text: 'text-sky-400',
      border: 'border-sky-700/60',
      desc: 'Derived via deterministic mathematical formula (e.g. Little\'s Law)'
    },
    OBSERVED: {
      bg: 'bg-cyan-950/60',
      text: 'text-cyan-400',
      border: 'border-cyan-700/60',
      desc: 'Direct telemetry measured from live production or load test runs'
    },
    IMPORTED: {
      bg: 'bg-indigo-950/60',
      text: 'text-indigo-400',
      border: 'border-indigo-700/60',
      desc: 'Imported from external source of record (Azure DevOps, Jira, OpenAPI)'
    },
    INFERRED: {
      bg: 'bg-purple-950/60',
      text: 'text-purple-400',
      border: 'border-purple-700/60',
      desc: 'Extracted by AI or heuristic; requires human governance review'
    },
    CONFLICTING: {
      bg: 'bg-rose-950/60',
      text: 'text-rose-400',
      border: 'border-rose-700/60',
      desc: 'Discrepancy detected between multiple independent sources'
    },
    STALE: {
      bg: 'bg-amber-950/60',
      text: 'text-amber-400',
      border: 'border-amber-700/60',
      desc: 'Age or upstream architecture drift exceeds validity TTL'
    },
    MANUAL: {
      bg: 'bg-slate-800',
      text: 'text-slate-300',
      border: 'border-slate-700',
      desc: 'Directly keyed in by human performance engineer'
    },
    MISSING: {
      bg: 'bg-red-950/80',
      text: 'text-red-300',
      border: 'border-red-800',
      desc: 'Required model parameter has not been populated'
    },
    SUPERSEDED: {
      bg: 'bg-slate-900',
      text: 'text-slate-500',
      border: 'border-slate-800',
      desc: 'Replaced by newer version or higher-authority source'
    }
  };

  const config = stateConfigs[state] || stateConfigs.MANUAL;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-mono font-semibold rounded-md border ${padding} ${config.bg} ${config.text} ${config.border}`}
      title={showTooltip ? `Canonical State: ${state} — ${config.desc}` : undefined}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80 mr-1.5" />
      {state}
    </span>
  );
};
