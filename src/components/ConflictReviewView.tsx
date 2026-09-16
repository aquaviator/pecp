import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  GitCompare,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { IntelligenceConflict, IntelligenceItem } from '../types';
import { CanonicalBadge } from './CanonicalBadge';

interface ConflictReviewViewProps {
  conflicts: IntelligenceConflict[];
  items: IntelligenceItem[];
  onResolveConflict: (conflictId: string, choice: 'sourceA' | 'sourceB' | 'CUSTOM', customVal?: number | string, rationale?: string) => void;
  onNavigateToWorkload: () => void;
}

export const ConflictReviewView: React.FC<ConflictReviewViewProps> = ({
  conflicts,
  items,
  onResolveConflict,
  onNavigateToWorkload
}) => {
  const [activeConflictId, setActiveConflictId] = useState<string>(conflicts[0]?.id || '');
  const [customValue, setCustomValue] = useState<string>('');
  const [resolutionRationale, setResolutionRationale] = useState<string>('');

  const activeConflict = conflicts.find((c) => c.id === activeConflictId) || conflicts[0];
  const pendingCount = conflicts.filter((c) => c.status === 'PENDING').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${pendingCount > 0 ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}></span>
              <h2 className="text-base font-semibold text-white">
                Gap, Conflict & Ambiguity Resolution Workbench
              </h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                pendingCount > 0
                  ? 'bg-amber-950/60 text-amber-300 border-amber-800/80'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
              }`}>
                {pendingCount} Pending Resolution
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Deterministic governance (Constitution §7 & §15): AI and automated ingest identify discrepancies between business architecture documents, operational telemetry, and Jira requirements. Humans retain approval and engineering judgement.
            </p>
          </div>

          <button
            id="proceed-to-workload-btn"
            onClick={onNavigateToWorkload}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition-colors whitespace-nowrap"
          >
            <span>Proceed to Workload Engine</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Conflict Workbench: Master/Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Conflict List */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Detected Intelligence Discrepancies
          </h3>

          <div className="space-y-2">
            {conflicts.map((c) => {
              const isSelected = c.id === activeConflict?.id;
              const isResolved = c.status === 'RESOLVED';

              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveConflictId(c.id);
                    setResolutionRationale('');
                    setCustomValue('');
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-slate-800/90 border-sky-500 shadow-md ring-1 ring-sky-500/20'
                      : isResolved
                      ? 'bg-slate-900/60 border-slate-800 hover:bg-slate-800/40 text-slate-400'
                      : 'bg-slate-900 border-amber-900/40 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-white leading-snug">
                      {c.field}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      isResolved
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : c.impact === 'HIGH'
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : 'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      {isResolved ? 'RESOLVED' : `${c.impact} IMPACT`}
                    </span>
                  </div>

                  <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-2">
                    <span className="font-mono text-slate-300">{c.sourceA.value}</span>
                    <span className="text-slate-600 font-bold">vs</span>
                    <span className="font-mono text-slate-300">{c.sourceB.value}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Comparison & Resolution Workspace */}
        {activeConflict && (
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-sky-400 tracking-wider">
                  Conflict Dispute Analysis
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {activeConflict.field}
                </h3>
              </div>

              {activeConflict.status === 'RESOLVED' ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-md border border-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Conflict Resolved & Governed</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-950/60 px-3 py-1 rounded-md border border-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span>Awaiting Engineering Sign-Off</span>
                </div>
              )}
            </div>

            {/* Side-by-Side Comparison Box */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Source A */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Source A</span>
                  <CanonicalBadge state={activeConflict.sourceA.state} />
                </div>
                <div className="text-slate-200 text-sm font-medium">
                  {activeConflict.sourceA.source}
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[11px] block">Extracted Value:</span>
                  <span className="text-2xl font-bold font-mono text-white">
                    {typeof activeConflict.sourceA.value === 'number'
                      ? activeConflict.sourceA.value.toLocaleString()
                      : activeConflict.sourceA.value}
                  </span>{' '}
                  <span className="text-xs text-slate-400 font-mono">{activeConflict.sourceA.unit}</span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Timestamp: {activeConflict.sourceA.timestamp}</span>
                </div>

                {activeConflict.status === 'PENDING' && (
                  <button
                    id="accept-source-a-btn"
                    onClick={() => onResolveConflict(activeConflict.id, 'sourceA', activeConflict.sourceA.value, 'Accepted Source A telemetry observation as authoritative.')}
                    className="w-full mt-2 py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    Accept Source A as Canonical
                  </button>
                )}
              </div>

              {/* Source B */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Source B</span>
                  <CanonicalBadge state={activeConflict.sourceB.state} />
                </div>
                <div className="text-slate-200 text-sm font-medium">
                  {activeConflict.sourceB.source}
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-500 text-[11px] block">Extracted Value:</span>
                  <span className="text-2xl font-bold font-mono text-white">
                    {typeof activeConflict.sourceB.value === 'number'
                      ? activeConflict.sourceB.value.toLocaleString()
                      : activeConflict.sourceB.value}
                  </span>{' '}
                  <span className="text-xs text-slate-400 font-mono">{activeConflict.sourceB.unit}</span>
                </div>
                <div className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Timestamp: {activeConflict.sourceB.timestamp}</span>
                </div>

                {activeConflict.status === 'PENDING' && (
                  <button
                    id="accept-source-b-btn"
                    onClick={() => onResolveConflict(activeConflict.id, 'sourceB', activeConflict.sourceB.value, 'Accepted Source B specification as authoritative.')}
                    className="w-full mt-2 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
                  >
                    Accept Source B as Canonical
                  </button>
                )}
              </div>
            </div>

            {/* AI Assistance & Governance Recommendation */}
            <div className="bg-sky-950/20 border border-sky-900/50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                <Sparkles className="h-4 w-4" />
                <span>PECP Analysis & Engineering Recommendation</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {activeConflict.recommendation}
              </p>
            </div>

            {/* Custom Override Option */}
            {activeConflict.status === 'PENDING' && (
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-300">
                  Or Apply Engineering Override (with Rationale Audit)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-1">
                    <label className="block text-[11px] text-slate-400 mb-1">Override Value:</label>
                    <input
                      type="text"
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      placeholder="e.g. 9430"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Mandatory Governance Rationale:</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={resolutionRationale}
                        onChange={(e) => setResolutionRationale(e.target.value)}
                        placeholder="e.g. Added 15% safety buffer for Black Friday organic surge..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                      />
                      <button
                        onClick={() => {
                          if (customValue && resolutionRationale) {
                            onResolveConflict(activeConflict.id, 'CUSTOM', customValue, resolutionRationale);
                            setCustomValue('');
                            setResolutionRationale('');
                          }
                        }}
                        disabled={!customValue || !resolutionRationale}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
                      >
                        Override & Lock
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
