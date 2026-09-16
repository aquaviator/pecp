import React from 'react';
import {
  Activity,
  FileSearch,
  Network,
  ListFilter,
  Calculator,
  FileCheck2,
  Compass,
  FileText,
  PlaySquare,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Award,
  Share2
} from 'lucide-react';

export type ProjectTab =
  | 'OVERVIEW'
  | 'INTELLIGENCE'
  | 'ARCHITECTURE'
  | 'REQUIREMENTS'
  | 'WORKLOAD'
  | 'PERFORMANCE_CONTRACT'
  | 'STRATEGY'
  | 'TEST_PLAN'
  | 'TESTS'
  | 'EXECUTIONS'
  | 'RESULTS'
  | 'FINDINGS'
  | 'EVIDENCE'
  | 'INTEGRATIONS';

interface ProjectSubnavProps {
  activeTab: ProjectTab;
  onSelectTab: (tab: ProjectTab) => void;
  conflictsCount?: number;
}

export const ProjectSubnav: React.FC<ProjectSubnavProps> = ({
  activeTab,
  onSelectTab,
  conflictsCount = 0
}) => {
  const tabs: { id: ProjectTab; label: string; icon: React.FC<{ className?: string }>; badge?: number }[] = [
    { id: 'OVERVIEW', label: 'Overview', icon: Activity },
    { id: 'INTELLIGENCE', label: 'Intelligence', icon: FileSearch, badge: conflictsCount },
    { id: 'ARCHITECTURE', label: 'Architecture', icon: Network },
    { id: 'REQUIREMENTS', label: 'Requirements', icon: ListFilter },
    { id: 'WORKLOAD', label: 'Workload', icon: Calculator },
    { id: 'PERFORMANCE_CONTRACT', label: 'Performance Contract', icon: FileCheck2 },
    { id: 'STRATEGY', label: 'Strategy', icon: Compass },
    { id: 'TEST_PLAN', label: 'Test Plan', icon: FileText },
    { id: 'TESTS', label: 'Tests', icon: PlaySquare },
    { id: 'EXECUTIONS', label: 'Executions', icon: Zap },
    { id: 'RESULTS', label: 'Results', icon: CheckCircle2 },
    { id: 'FINDINGS', label: 'Findings', icon: AlertTriangle },
    { id: 'EVIDENCE', label: 'Evidence', icon: Award },
    { id: 'INTEGRATIONS', label: 'Integrations', icon: Share2 }
  ];

  return (
    <div className="bg-slate-900 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-1 overflow-x-auto py-2 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium transition-all ${
                  isActive
                    ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-sky-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
