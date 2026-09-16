import React from 'react';
import {
  Layers,
  FolderGit2,
  SlidersHorizontal,
  Plus,
  BookOpen,
  Building2,
  ShieldCheck
} from 'lucide-react';
import { ProjectSummary } from '../../types';

export type MainNavSection = 'DASHBOARD' | 'PROJECTS' | 'ADMINISTRATION';

interface AppHeaderProps {
  activeNav: MainNavSection;
  onSelectNav: (nav: MainNavSection) => void;
  activeProject: ProjectSummary | null;
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
  onOpenNewProjectModal: () => void;
  onOpenConstitution: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  activeNav,
  onSelectNav,
  activeProject,
  projects,
  onSelectProject,
  onOpenNewProjectModal,
  onOpenConstitution
}) => {
  return (
    <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-40">
      {/* Top Application Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo & Product Identity */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400 font-black text-sm tracking-wider font-mono">
                PE
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white tracking-tight">PECP</span>
                  <span className="text-[10px] font-mono uppercase bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded border border-slate-700">
                    M0 Portal
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 -mt-0.5 hidden sm:inline">
                  Performance Engineering Control Plane
                </span>
              </div>
            </div>

            {/* Main Navigation (Dashboard, Projects, Administration) */}
            <nav className="flex items-center space-x-1 border-l border-slate-800 pl-6">
              <button
                onClick={() => onSelectNav('DASHBOARD')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeNav === 'DASHBOARD'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                Dashboard
              </button>

              <button
                onClick={() => onSelectNav('PROJECTS')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeNav === 'PROJECTS'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                Projects
              </button>

              <button
                onClick={() => onSelectNav('ADMINISTRATION')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeNav === 'ADMINISTRATION'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                Administration
              </button>
            </nav>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-3">
            {/* Active Project Switcher Pill */}
            {projects.length > 0 && activeNav === 'PROJECTS' && (
              <div className="hidden md:flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-400 text-[11px]">Project:</span>
                <select
                  value={activeProject?.id || ''}
                  onChange={(e) => onSelectProject(e.target.value)}
                  className="bg-transparent text-white font-medium text-xs focus:outline-none cursor-pointer pr-1"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                      {p.organisation} / {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* New Performance Project Button */}
            <button
              id="new-project-header-btn"
              onClick={onOpenNewProjectModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Project</span>
            </button>

            {/* Product Constitution Link */}
            <button
              onClick={onOpenConstitution}
              title="View PECP Product Constitution v1.0"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden lg:inline">Constitution</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
