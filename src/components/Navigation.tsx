import React from 'react';
import {
  Database,
  AlertTriangle,
  Calculator,
  FileCheck2,
  FileText,
  PlaySquare,
  Award
} from 'lucide-react';

export type LifecycleStage =
  | 'INTELLIGENCE'
  | 'CONFLICTS'
  | 'WORKLOAD'
  | 'CONTRACT'
  | 'ARTEFACTS'
  | 'K6_RUNNER'
  | 'EVIDENCE';

interface NavigationProps {
  currentStage: LifecycleStage;
  onSelectStage: (stage: LifecycleStage) => void;
  pendingConflictsCount: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentStage,
  onSelectStage,
  pendingConflictsCount
}) => {
  const stages: { id: LifecycleStage; label: string; stepNumber: number; icon: React.ElementType; badge?: number }[] = [
    { id: 'INTELLIGENCE', label: 'Intelligence & Provenance', stepNumber: 1, icon: Database },
    { id: 'CONFLICTS', label: 'Gap & Conflict Review', stepNumber: 2, icon: AlertTriangle, badge: pendingConflictsCount },
    { id: 'WORKLOAD', label: 'Workload Engine (Little\'s Law)', stepNumber: 3, icon: Calculator },
    { id: 'CONTRACT', label: 'Performance Contract', stepNumber: 4, icon: FileCheck2 },
    { id: 'ARTEFACTS', label: 'Engineering Artefacts', stepNumber: 5, icon: FileText },
    { id: 'K6_RUNNER', label: 'k6 Test & Execution', stepNumber: 6, icon: PlaySquare },
    { id: 'EVIDENCE', label: 'Evidence & Traceability', stepNumber: 7, icon: Award }
  ];

  return (
    <div className="border-b border-slate-800 bg-slate-900/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2.5 scrollbar-none" aria-label="Lifecycle Stages">
          {stages.map((stage) => {
            const Icon = stage.icon;
            const isActive = currentStage === stage.id;
            return (
              <button
                key={stage.id}
                id={`nav-stage-${stage.id.toLowerCase()}`}
                onClick={() => onSelectStage(stage.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <span className={`flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  {stage.stepNumber}
                </span>
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{stage.label}</span>
                {typeof stage.badge === 'number' && stage.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    {stage.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
