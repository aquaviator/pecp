import React, { useState, useEffect } from 'react';
import {
  Share2,
  CheckCircle2,
  AlertCircle,
  Settings,
  Shield,
  Layers,
  Cpu,
  FileText,
  Activity,
  Zap,
  Flame,
  Radio
} from 'lucide-react';
import { ProjectSummary, IntegrationDefinition, IntegrationMode } from '../../types';
import { useServices } from '../../services/ServiceContext';

interface IntegrationsPageProps {
  project: ProjectSummary;
}

export const IntegrationsPage: React.FC<IntegrationsPageProps> = ({ project }) => {
  const { integrationService } = useServices();
  const [integrations, setIntegrations] = useState<IntegrationDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntegrations();
  }, [project.id]);

  const loadIntegrations = async () => {
    try {
      const list = await integrationService.getIntegrations(project.id);
      setIntegrations(list);
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = async (integrationId: string, newMode: IntegrationMode) => {
    try {
      const updated = await integrationService.updateIntegrationMode(project.id, integrationId, newMode);
      setIntegrations((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      console.error('Failed to update integration mode:', err);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ALM':
        return Settings;
      case 'DOCUMENTS':
        return FileText;
      case 'AI':
        return Cpu;
      case 'TESTING_ENGINE':
        return Zap;
      case 'OBSERVABILITY':
        return Activity;
      default:
        return Share2;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Share2 className="w-4 h-4 text-sky-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Enterprise Ecosystem Integrations & Providers
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Constitution §3 & §15: External products are providers/connectors, not architectural anchors. PECP functions self-sufficiently with typed mock connectors.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800">
              Provider Mode: MOCK / SANDBOX / LIVE
            </span>
          </div>
        </div>

        {/* Milestone Boundary Notice */}
        <div className="mt-4 p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
          <Shield className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-white">M0 Integration Contract:</span>
            <p className="text-slate-400 leading-relaxed">
              In M0, all connectors currently display <strong className="text-slate-200">Not configured</strong>. The UI is designed to accommodate future modes (<span className="text-emerald-400 font-mono">MOCK</span>, <span className="text-amber-400 font-mono">SANDBOX</span>, <span className="text-sky-400 font-mono">LIVE</span>) without architectural churn. No live network calls or credential storage are executed.
            </p>
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {integrations.map((integ) => {
          const Icon = getCategoryIcon(integ.category);

          return (
            <div
              key={integ.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4 shadow-sm hover:border-slate-700 transition-colors"
            >
              <div>
                {/* Header with Icon and Category */}
                <div className="flex items-center justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-sky-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-400">
                    {integ.category}
                  </span>
                </div>

                {/* Name and Status */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      {integ.name}
                    </h3>
                  </div>

                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-stone-900 text-stone-400 border border-stone-800">
                      <Radio className="w-2.5 h-2.5 text-stone-500" />
                      <span>Not configured</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 pt-2 leading-relaxed">
                    {integ.description}
                  </p>
                </div>
              </div>

              {/* Mode Selector and Status Footer */}
              <div className="pt-3 border-t border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                  <span>Target Mode:</span>
                  <div className="flex items-center gap-1">
                    {integ.availableModes.map((mode) => {
                      const isCurrent = integ.currentMode === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => handleModeChange(integ.id, mode)}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors ${
                            isCurrent
                              ? mode === 'MOCK'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                : mode === 'SANDBOX'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                : 'bg-sky-950 text-sky-300 border border-sky-800'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {mode}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {integ.configSummary && (
                  <div className="text-[10px] font-mono text-slate-500 truncate pt-1">
                    {integ.configSummary}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
