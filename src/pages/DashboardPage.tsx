import React from 'react';
import {
  Layers,
  FolderGit2,
  AlertTriangle,
  FileSearch,
  Building2,
  ArrowRight,
  Plus,
  ShieldCheck,
  Activity,
  CheckCircle2,
  BookOpen
} from 'lucide-react';
import { ProjectSummary } from '../types';

interface DashboardPageProps {
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
  onOpenConstitution: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  projects,
  onSelectProject,
  onOpenNewProject,
  onOpenConstitution
}) => {
  const totalDocs = projects.reduce((acc, p) => acc + p.documentsCount, 0);
  const totalReqs = projects.reduce((acc, p) => acc + p.requirementsCount, 0);
  const totalConflicts = projects.reduce((acc, p) => acc + p.conflictsCount, 0);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <span className="text-[10px] font-mono uppercase text-sky-400 font-bold tracking-wider">
              Control Plane Dashboard
            </span>
            <h1 className="text-xl font-bold text-white tracking-tight mt-0.5">
              Performance Engineering Operations
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              PECP converts project intelligence into governed performance models, engineering artefacts, executable tests, and traceable evidence.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onOpenConstitution}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span>Product Constitution</span>
            </button>

            <button
              onClick={onOpenNewProject}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>
          </div>
        </div>

        {/* Global Summary KPI Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Active Projects</span>
            <span className="text-2xl font-bold font-mono text-white mt-1 block">{projects.length}</span>
            <span className="text-[10px] text-slate-500 font-mono">Governed workstreams</span>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Analysed Documents</span>
            <span className="text-2xl font-bold font-mono text-white mt-1 block">{totalDocs}</span>
            <span className="text-[10px] text-slate-500 font-mono">HLDs, NFRs, Strategies</span>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Performance NFRs</span>
            <span className="text-2xl font-bold font-mono text-sky-400 mt-1 block">{totalReqs}</span>
            <span className="text-[10px] text-slate-500 font-mono">Model requirements</span>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Unresolved Conflicts</span>
            <span className="text-2xl font-bold font-mono text-purple-400 mt-1 block">{totalConflicts}</span>
            <span className="text-[10px] text-purple-400/80 font-mono">Candidate discrepancies</span>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Current Performance Projects
          </h2>
          <span className="text-xs text-slate-500 font-mono">{projects.length} Total</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((proj) => (
            <div
              key={proj.id}
              onClick={() => onSelectProject(proj.id)}
              className="bg-slate-900 border border-slate-800 hover:border-sky-500/50 rounded-xl p-5 shadow-sm cursor-pointer transition-all flex flex-col justify-between space-y-4 group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{proj.organisation}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-950 text-sky-400 border border-sky-800">
                    INTENT: {proj.intent}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors">
                  {proj.name}
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {proj.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                  <span>{proj.documentsCount} Docs</span>
                  <span>•</span>
                  <span>{proj.requirementsCount} NFRs</span>
                  {proj.conflictsCount > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-purple-400 font-semibold">{proj.conflictsCount} Conflicts</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1 text-sky-400 font-semibold text-xs group-hover:translate-x-0.5 transition-transform">
                  <span>Open Workbench</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
