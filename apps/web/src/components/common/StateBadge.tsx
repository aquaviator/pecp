import React from 'react';
import { CanonicalState, ReviewStatus } from '../../types';

interface CanonicalBadgeProps {
  state: CanonicalState;
  className?: string;
  size?: 'sm' | 'md';
}

export const CanonicalStateBadge: React.FC<CanonicalBadgeProps> = ({ state, className = '', size = 'sm' }) => {
  const configs: Record<CanonicalState, { label: string; bg: string; text: string; border: string }> = {
    MISSING: {
      label: 'MISSING',
      bg: 'bg-rose-950/60',
      text: 'text-rose-300',
      border: 'border-rose-800/80'
    },
    OBSERVED: {
      label: 'OBSERVED',
      bg: 'bg-cyan-950/60',
      text: 'text-cyan-300',
      border: 'border-cyan-800/80'
    },
    MANUAL: {
      label: 'MANUAL',
      bg: 'bg-amber-950/60',
      text: 'text-amber-300',
      border: 'border-amber-800/80'
    },
    IMPORTED: {
      label: 'IMPORTED',
      bg: 'bg-blue-950/60',
      text: 'text-blue-300',
      border: 'border-blue-800/80'
    },
    INFERRED: {
      label: 'INFERRED',
      bg: 'bg-indigo-950/60',
      text: 'text-indigo-300',
      border: 'border-indigo-800/80'
    },
    CALCULATED: {
      label: 'CALCULATED',
      bg: 'bg-teal-950/60',
      text: 'text-teal-300',
      border: 'border-teal-800/80'
    },
    CONFLICTING: {
      label: 'CONFLICTING',
      bg: 'bg-purple-950/60',
      text: 'text-purple-300',
      border: 'border-purple-800/80'
    },
    STALE: {
      label: 'STALE',
      bg: 'bg-stone-900',
      text: 'text-stone-400',
      border: 'border-stone-700/80'
    },
    APPROVED: {
      label: 'APPROVED',
      bg: 'bg-emerald-950/60',
      text: 'text-emerald-300',
      border: 'border-emerald-800/80'
    },
    SUPERSEDED: {
      label: 'SUPERSEDED',
      bg: 'bg-zinc-900',
      text: 'text-zinc-500',
      border: 'border-zinc-800'
    }
  };

  const c = configs[state] || configs.OBSERVED;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-mono font-semibold uppercase tracking-wider rounded border ${c.bg} ${c.text} ${c.border} ${padding} ${className}`}
    >
      {c.label}
    </span>
  );
};

interface ReviewBadgeProps {
  status: ReviewStatus;
  className?: string;
  size?: 'sm' | 'md';
}

export const ReviewStatusBadge: React.FC<ReviewBadgeProps> = ({ status, className = '', size = 'sm' }) => {
  const configs: Record<ReviewStatus, { label: string; bg: string; text: string; border: string }> = {
    FOUND: {
      label: 'FOUND',
      bg: 'bg-sky-950/60',
      text: 'text-sky-300',
      border: 'border-sky-800/80'
    },
    MISSING: {
      label: 'MISSING',
      bg: 'bg-rose-950/60',
      text: 'text-rose-300',
      border: 'border-rose-800/80'
    },
    AMBIGUOUS: {
      label: 'AMBIGUOUS',
      bg: 'bg-amber-950/60',
      text: 'text-amber-300',
      border: 'border-amber-800/80'
    },
    CONFLICTING: {
      label: 'CONFLICTING',
      bg: 'bg-purple-950/60',
      text: 'text-purple-300',
      border: 'border-purple-800/80'
    },
    STALE: {
      label: 'STALE',
      bg: 'bg-stone-900',
      text: 'text-stone-400',
      border: 'border-stone-700/80'
    }
  };

  const c = configs[status] || configs.FOUND;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center font-mono font-semibold uppercase tracking-wider rounded border ${c.bg} ${c.text} ${c.border} ${padding} ${className}`}
    >
      {c.label}
    </span>
  );
};

// Unified helper badge
export const StateBadge: React.FC<{
  state?: CanonicalState;
  status?: ReviewStatus;
  className?: string;
  size?: 'sm' | 'md';
}> = ({ state, status, className = '', size = 'sm' }) => {
  if (status) {
    return <ReviewStatusBadge status={status} className={className} size={size} />;
  }
  if (state) {
    return <CanonicalStateBadge state={state} className={className} size={size} />;
  }
  return null;
};
