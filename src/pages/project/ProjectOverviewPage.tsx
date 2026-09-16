import React from 'react';
import {
  Activity,
  FileSearch,
  FileCheck2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  Layers
} from 'lucide-react';
import { ProjectSummary } from '../../types';
import { ProjectTab } from '../../components/layout/ProjectSubnav';

interface ProjectOverviewPageProps {
  project: ProjectSummary;
  onNavigateTab: (tab: ProjectTab) => void;
}

export const ProjectOverviewPage: React.FC<ProjectOverviewPageProps> = ({
  project,
  onNavigateTab
}) => {
  return (
    <div className="space-y-6">
      {/* Overview Top Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Project Control Plane Overview
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              {project.description}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigateTab('INTELLIGENCE')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <span>Review Intelligence</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Milestone Metadata Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Organisation</span>
            <span className="text-sm font-bold text-white mt-0.5 block">{project.organisation}</span>
            <span className="text-[10px] text-slate-500 font-mono">Reference Organization</span>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Engineering Intent</span>
            <span className="text-sm font-bold font-mono text-sky-400 mt-0.5 block">{project.intent}</span>
            <span className="text-[10px] text-slate-500 font-mono">Peak Forecast Preparation</span>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Conflicting Data</span>
            <span className="text-sm font-bold font-mono text-purple-400 mt-0.5 block">
              {project.conflictsCount} Candidate Clashes
            </span>
            <span className="text-[10px] text-purple-400/80 font-mono">Requires human resolution</span>
          </div>

          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Target Release Date</span>
            <span className="text-sm font-bold font-mono text-white mt-0.5 block">November 2026</span>
            <span className="text-[10px] text-slate-500 font-mono">Black Friday Trading</span>
          </div>
        </div>
      </div>

      {/* Lifecycle Flow Navigator */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          PECP Engineering Lifecycle Navigation
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div
            onClick={() => onNavigateTab('INTELLIGENCE')}
            className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase text-sky-400">Stage 1</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-white transition-colors" />
            </div>
            <h4 className="font-bold text-white mb-1">Intelligence & Provenance</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Ingest specifications, inspect provenance, and resolve conflicting upstream candidates.
            </p>
          </div>

          <div
            onClick={() => onNavigateTab('WORKLOAD')}
            className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase text-purple-400">Stage 2</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-white transition-colors" />
            </div>
            <h4 className="font-bold text-white mb-1">Workload Modeling</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Little's Law concurrency calculations, arrival rate modeling, and think-time pacing.
            </p>
          </div>

          <div
            onClick={() => onNavigateTab('PERFORMANCE_CONTRACT')}
            className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer transition-all group"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase text-emerald-400">Stage 3</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-white transition-colors" />
            </div>
            <h4 className="font-bold text-white mb-1">Performance Contract</h4>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Versioned machine-readable agreement defining release SLA gates and sign-offs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
