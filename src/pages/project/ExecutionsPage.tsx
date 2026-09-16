import React from 'react';
import { Zap, Terminal, Activity, Server } from 'lucide-react';
import { ProjectSummary } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';

interface ExecutionsPageProps {
  project: ProjectSummary;
}

export const ExecutionsPage: React.FC<ExecutionsPageProps> = ({ project }) => {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-sky-400" />
          <h2 className="text-base font-bold text-white tracking-tight">
            Customer-Controlled Test Runner Orchestration
          </h2>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Constitution §10: PECP orchestrates execution rather than replacing customer CI/CD. Tests run in customer-controlled infrastructure.
        </p>
      </div>

      <EmptyState
        icon={Terminal}
        title="Execution Runner Workspace Shell"
        description="The execution workbench orchestrates k6 runners operating inside the customer's private infrastructure (Docker, Podman, Kubernetes, or native runner) and captures telemetry streams."
        subtext="Runner Mode: Customer-Controlled Ingress (No proprietary load-gen cloud required)"
      />
    </div>
  );
};
