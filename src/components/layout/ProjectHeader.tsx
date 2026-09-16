import React from 'react';
import { Building2, Calendar, Target, FileText, AlertCircle } from 'lucide-react';
import { ProjectSummary } from '../../types';

interface ProjectHeaderProps {
  project: ProjectSummary;
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({ project }) => {
  return (
    <div className="bg-slate-950 border-b border-slate-800 py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-1">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{project.organisation}</span>
              </span>
              <span>/</span>
              <span className="text-slate-300 font-semibold">{project.name}</span>
            </div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>{project.name}</span>
              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-sky-950/80 text-sky-400 border border-sky-800">
                INTENT: {project.intent}
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                {project.status}
              </span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              {project.description}
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-slate-400 self-start md:self-center bg-slate-900/80 border border-slate-800 px-3 py-2 rounded-lg">
            <div className="text-center">
              <span className="block text-[10px] text-slate-500 uppercase">Documents</span>
              <span className="font-bold text-white">{project.documentsCount}</span>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div className="text-center">
              <span className="block text-[10px] text-slate-500 uppercase">Requirements</span>
              <span className="font-bold text-white">{project.requirementsCount}</span>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div className="text-center">
              <span className="block text-[10px] text-slate-500 uppercase">Conflicts</span>
              <span className="font-bold text-purple-400">{project.conflictsCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
