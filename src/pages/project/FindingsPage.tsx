import React from 'react';
import { AlertTriangle, Bug, CheckCircle2, ShieldCheck, Share2 } from 'lucide-react';
import { ProjectSummary } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';

interface FindingsPageProps {
  project: ProjectSummary;
}

export const FindingsPage: React.FC<FindingsPageProps> = ({ project }) => {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <h2 className="text-base font-bold text-white tracking-tight">
            Performance Findings & Defect Register
          </h2>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Constitution §13 steps 16–17: Structured performance observations, bottleneck classifications, and synchronized ALM defect tickets (Azure DevOps / Jira).
        </p>
      </div>

      <EmptyState
        icon={AlertTriangle}
        title="Findings Register Ready for Telemetry Evaluation"
        description="When execution results or APM metrics breach SLA gates or demonstrate non-linear saturation, PECP generates structured findings with evidence traces and links them to Azure DevOps or Jira."
        subtext="Categories: Latency Degradation / Resource Contention / Thread Starvation / Error Spikes"
      />
    </div>
  );
};
