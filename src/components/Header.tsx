import React from 'react';
import {
  ShieldCheck,
  Server,
  Activity,
  Cpu,
  FileCode2,
  BookOpen,
  ChevronDown,
  ExternalLink,
  Download
} from 'lucide-react';
import { EngineeringIntent, ProviderConnector } from '../types';

interface HeaderProps {
  activeIntent: EngineeringIntent;
  onIntentChange: (intent: EngineeringIntent) => void;
  connectors: ProviderConnector[];
  onOpenConstitution: () => void;
  onExportPackage: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeIntent,
  onIntentChange,
  connectors,
  onOpenConstitution,
  onExportPackage
}) => {
  const [intentDropdownOpen, setIntentDropdownOpen] = React.useState(false);

  const intents: { key: EngineeringIntent; label: string; desc: string }[] = [
    { key: 'CERTIFICATION', label: 'CERTIFICATION', desc: 'Verify release against agreed contract and SLA gates' },
    { key: 'REPRESENTATIVE', label: 'REPRESENTATIVE', desc: 'Model live production baseline behavior' },
    { key: 'FORECAST', label: 'FORECAST', desc: 'Predict capacity for upcoming peak commercial windows' },
    { key: 'DISCOVERY', label: 'DISCOVERY', desc: 'Explore system limits and find breaking points' },
    { key: 'INVESTIGATIVE', label: 'INVESTIGATIVE', desc: 'Reproduce and isolate known bottlenecks' }
  ];

  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Project Title */}
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-sky-600 flex items-center justify-center text-white font-bold shadow-lg shadow-sky-600/20">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">PECP</span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-sky-400 font-mono border border-slate-700">
                  v1.0 Control Plane
                </span>
                <span className="text-xs text-slate-400 border-l border-slate-700 pl-2">
                  Customer-Deployed
                </span>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <span className="font-medium text-slate-300">RetailCo Digital</span>
                <span className="text-slate-600">•</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Black Friday 2026 Readiness (Reference Org)
                </span>
              </div>
            </div>
          </div>

          {/* Right Action Controls: Intent Selector, Connectors, Constitution, Export */}
          <div className="flex items-center gap-3">
            {/* Engineering Intent Picker */}
            <div className="relative">
              <button
                id="intent-picker-button"
                onClick={() => setIntentDropdownOpen(!intentDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 rounded-md text-xs transition-colors"
                title="Performance Engineering Intent (Constitution §6)"
              >
                <span className="text-slate-400 font-medium">Intent:</span>
                <span className="text-sky-400 font-bold tracking-wide">{activeIntent}</span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {intentDropdownOpen && (
                <div className="absolute right-0 mt-1 w-64 rounded-md shadow-xl bg-slate-900 border border-slate-700 py-1 z-50">
                  <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    Engineering Intents (Constitution §6)
                  </div>
                  {intents.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        onIntentChange(item.key);
                        setIntentDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors ${
                        activeIntent === item.key ? 'bg-sky-950/50 text-sky-300 border-l-2 border-sky-500' : 'text-slate-200'
                      }`}
                    >
                      <div className="font-semibold">{item.label}</div>
                      <div className="text-[11px] text-slate-400 leading-tight mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Provider connectors indicator pills */}
            <div className="hidden lg:flex items-center gap-1.5 bg-slate-950/60 p-1 rounded-md border border-slate-800 text-[11px]">
              <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 flex items-center gap-1" title="Azure DevOps Connector (Mock)">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                ADO: Mock
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 flex items-center gap-1" title="Production Telemetry (Dynatrace)">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                APM: Synced
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 flex items-center gap-1" title="k6 Execution Engine">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-400"></span>
                k6: Live
              </span>
            </div>

            {/* Constitution Modal Trigger */}
            <button
              id="view-constitution-btn"
              onClick={onOpenConstitution}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5 text-amber-400" />
              <span>Constitution</span>
            </button>

            {/* Export Evidence Package */}
            <button
              id="export-evidence-package-btn"
              onClick={onExportPackage}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 shadow-sm transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Evidence</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
