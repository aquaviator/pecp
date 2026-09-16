import React from 'react';
import { CheckCircle2, Award, AlertTriangle, Layers, Download } from 'lucide-react';
import { ProjectSummary } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';

interface ResultsPageProps {
  project: ProjectSummary;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({ project }) => {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <h2 className="text-base font-bold text-white tracking-tight">
            Execution Results & Telemetry Analysis
          </h2>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Constitution §13 steps 14–15: Ingests raw runner telemetry, evaluates latency percentiles against contract gates, and renders deterministic PASS / FAIL verdicts.
        </p>
      </div>

      <EmptyState
        icon={CheckCircle2}
        title="No Test Execution Runs Recorded Yet"
        description="Results are ingested when customer-controlled test runners report telemetry streams back to PECP. In M0, execution ingestion is unpopulated until test execution occurs."
        subtext="Acceptance Verdicts: PASS / FAIL / PASS_WITH_OBSERVATION / INCONCLUSIVE"
      />
    </div>
  );
};
