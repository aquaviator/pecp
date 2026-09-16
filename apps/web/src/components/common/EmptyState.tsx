import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  subtext?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  subtext,
  action
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center flex flex-col items-center justify-center max-w-2xl mx-auto shadow-sm my-6">
      <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mb-4">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
      <p className="text-xs text-slate-400 max-w-lg leading-relaxed mb-3">{description}</p>
      {subtext && (
        <p className="text-[11px] font-mono text-slate-500 max-w-md bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 mb-5">
          {subtext}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
