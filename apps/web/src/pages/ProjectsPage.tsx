import React, { useState } from 'react';
import {
  FolderGit2,
  Plus,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  Search,
  Filter
} from 'lucide-react';
import { ProjectSummary } from '../types';

interface ProjectsPageProps {
  projects: ProjectSummary[];
  onSelectProject: (projectId: string) => void;
  onOpenNewProject: () => void;
}

export const ProjectsPage: React.FC<ProjectsPageProps> = ({
  projects,
  onSelectProject,
  onOpenNewProject
}) => {
  const [search, setSearch] = useState('');

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.organisation.toLowerCase().includes(search.toLowerCase()) ||
      p.intent.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-sky-400" />
              <h1 className="text-lg font-bold text-white tracking-tight">
                Governed Performance Projects
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Active engineering control plane workstreams across reference organizations and client tenants.
            </p>
          </div>

          <button
            onClick={onOpenNewProject}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-colors self-start sm:self-center"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Performance Project</span>
          </button>
        </div>

        {/* Search bar */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
          <div className="w-full max-w-sm relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by project name or organisation..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
            />
          </div>
          <span className="text-xs font-mono text-slate-500">{filtered.length} Projects Listed</span>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3.5">Project Name</th>
                <th className="p-3.5">Organisation</th>
                <th className="p-3.5">Engineering Intent</th>
                <th className="p-3.5">Documents</th>
                <th className="p-3.5">NFRs</th>
                <th className="p-3.5">Conflicts</th>
                <th className="p-3.5">Created Date</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
              {filtered.map((proj) => (
                <tr
                  key={proj.id}
                  onClick={() => onSelectProject(proj.id)}
                  className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="p-3.5 font-bold text-white">
                    <div>{proj.name}</div>
                    <div className="text-[11px] text-slate-400 font-normal truncate max-w-xs">{proj.description}</div>
                  </td>
                  <td className="p-3.5 font-medium text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      {proj.organisation}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-950 text-sky-400 border border-sky-800">
                      {proj.intent}
                    </span>
                  </td>
                  <td className="p-3.5 font-mono text-slate-300">{proj.documentsCount}</td>
                  <td className="p-3.5 font-mono text-slate-300">{proj.requirementsCount}</td>
                  <td className="p-3.5 font-mono">
                    {proj.conflictsCount > 0 ? (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                        {proj.conflictsCount}
                      </span>
                    ) : (
                      <span className="text-slate-500">0</span>
                    )}
                  </td>
                  <td className="p-3.5 font-mono text-slate-400 text-[11px]">{proj.createdDate.slice(0, 10)}</td>
                  <td className="p-3.5 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectProject(proj.id);
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors inline-flex items-center gap-1"
                    >
                      <span>Open</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
