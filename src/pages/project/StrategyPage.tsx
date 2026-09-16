import React from 'react';
import { Compass, BookOpen, Layers, CheckCircle2, ShieldAlert } from 'lucide-react';
import { ProjectSummary } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';

interface StrategyPageProps {
  project: ProjectSummary;
}

export const StrategyPage: React.FC<StrategyPageProps> = ({ project }) => {
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-sky-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Performance Strategy Artefact
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Constitution §8: Documents are generated views over the canonical model, not independent or competing sources of truth.
            </p>
          </div>

          <span className="px-2.5 py-1 rounded text-[11px] font-mono bg-slate-950 text-slate-400 border border-slate-800">
            Lifecycle Stage: Generation Pending Model Approval
          </span>
        </div>
      </div>

      {/* Professional Empty State / Preview */}
      <EmptyState
        icon={Compass}
        title="Performance Strategy Generates from the Canonical Model"
        description="PECP treats documents as deterministic generated views over the approved model. In traditional projects, written strategies quickly become obsolete and disconnected from reality. In PECP, the Performance Strategy is compiled directly once upstream intelligence and NFR gates are approved."
        subtext="Generation Target: Azure DevOps Wiki / Confluence Space / Formal PDF / DOCX"
      />

      {/* Target Artefact Structural Outline */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4 max-w-4xl mx-auto">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Compiled Strategy Outline (Generated Sections)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-sky-400 font-mono font-bold block">1. Executive Summary & Intent</span>
            <p className="text-slate-400">
              Commercial objectives for {project.name}, trading peak envelope, and governance scope.
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-sky-400 font-mono font-bold block">2. System Architecture & Boundaries</span>
            <p className="text-slate-400">
              Microservices topology, database pooling, caching layers, and external payment integration points.
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-sky-400 font-mono font-bold block">3. Performance Contract & SLA Gates</span>
            <p className="text-slate-400">
              Non-negotiable response time ceilings, p95 latency thresholds, and error budgets.
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-sky-400 font-mono font-bold block">4. Observability & Saturation Criteria</span>
            <p className="text-slate-400">
              APM distributed tracing topology, server resource utilization limits, and database connection caps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
