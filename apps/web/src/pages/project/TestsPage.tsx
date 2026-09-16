import React from 'react';
import { PlaySquare, Terminal, Download, Copy, Check } from 'lucide-react';
import { ProjectSummary } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';

interface TestsPageProps {
  project: ProjectSummary;
}

export const TestsPage: React.FC<TestsPageProps> = ({ project }) => {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <PlaySquare className="w-4 h-4 text-sky-400" />
          <h2 className="text-base font-bold text-white tracking-tight">
            Generated Test Definitions (k6)
          </h2>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Constitution §10: Engine-neutral test definitions compiled into executable k6 scripts with automated threshold assertions.
        </p>
      </div>

      <EmptyState
        icon={PlaySquare}
        title="Test Definition Awaiting Performance Contract Approval"
        description="PECP generates executable tests directly from the approved Performance Contract and Workload Model. In M0, test compilation is held until the canonical model reaches approved status."
        subtext="Primary Execution Engine: Grafana k6 (Local CLI / Docker / Customer CI Runner)"
      />
    </div>
  );
};
