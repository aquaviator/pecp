import React, { useState } from 'react';
import {
  X,
  FileText,
  Upload,
  Link2,
  Activity,
  ArrowRight,
  ShieldAlert,
  Building2,
  Sparkles
} from 'lucide-react';
import { ProjectCreationMethod, EngineeringIntent, ProjectSummary } from '../../types';
import { useServices } from '../../services/ServiceContext';

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: ProjectSummary) => void;
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated
}) => {
  const { projectService } = useServices();

  const [step, setStep] = useState<'METHOD' | 'DETAILS'>('METHOD');
  const [selectedMethod, setSelectedMethod] = useState<ProjectCreationMethod>('UPLOAD_DOCUMENTS');
  const [organisation, setOrganisation] = useState('RetailCo');
  const [name, setName] = useState('');
  const [intent, setIntent] = useState<EngineeringIntent>('FORECAST');
  const [description, setDescription] = useState('');
  const [briefText, setBriefText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const creationOptions: {
    id: ProjectCreationMethod;
    title: string;
    description: string;
    icon: React.FC<{ className?: string }>;
    tag?: string;
  }[] = [
    {
      id: 'BRIEF',
      title: '1. Write a Brief',
      description: 'Tell PECP what is being built or tested.',
      icon: FileText
    },
    {
      id: 'UPLOAD_DOCUMENTS',
      title: '2. Upload Documents',
      description: 'HLD, LLD, requirements, NFRs, strategies, spreadsheets, reports.',
      icon: Upload
    },
    {
      id: 'CONNECT_EXISTING',
      title: '3. Connect Existing Project',
      description: 'Placeholder for future Azure DevOps / Jira providers.',
      icon: Link2,
      tag: 'Future Provider'
    },
    {
      id: 'ANALYSE_EXISTING',
      title: '4. Analyse Existing System',
      description: 'Placeholder for future production telemetry/APM providers.',
      icon: Activity,
      tag: 'Future Provider'
    }
  ];

  const handleNext = () => {
    if (!name.trim()) {
      if (selectedMethod === 'BRIEF') {
        setName('Peak Checkout Resiliency Assessment');
      } else if (selectedMethod === 'UPLOAD_DOCUMENTS') {
        setName('Core Platform Migration 2026');
      } else {
        setName('Platform Telemetry Audit');
      }
    }
    setStep('DETAILS');
  };

  const handleCreate = async () => {
    if (!name.trim() || !organisation.trim()) return;

    setIsSubmitting(true);
    try {
      const created = await projectService.createProject({
        name,
        organisation,
        intent,
        description: description || `Created via ${selectedMethod} flow.`,
        creationMethod: selectedMethod,
        briefText: selectedMethod === 'BRIEF' ? briefText : undefined,
        uploadedDocumentNames: selectedMethod === 'UPLOAD_DOCUMENTS' ? ['Architecture-HLD.pdf', 'NFR-Matrix.xlsx'] : undefined
      });

      onProjectCreated(created);
      onClose();
      // Reset
      setStep('METHOD');
      setName('');
      setDescription('');
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <span className="text-[10px] font-mono uppercase text-sky-400 font-bold tracking-wider">
              Project Initiation
            </span>
            <h2 className="text-base font-bold text-white mt-0.5">
              New Performance Project
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {step === 'METHOD' ? (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">
                  How would you like to start?
                </h3>
                <p className="text-xs text-slate-400">
                  Select an ingestion vector to establish the project canonical model.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {creationOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = selectedMethod === opt.id;

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedMethod(opt.id)}
                      className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-slate-800/90 border-sky-500 shadow-md ring-1 ring-sky-500/20'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Icon className={`w-5 h-5 ${isSelected ? 'text-sky-400' : 'text-slate-400'}`} />
                          {opt.tag && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {opt.tag}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-white">{opt.title}</h4>
                        <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          {opt.description}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-end">
                        <span className={`text-[10px] font-mono ${isSelected ? 'text-sky-400 font-bold' : 'text-slate-500'}`}>
                          {isSelected ? 'Selected' : 'Select'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedMethod === 'BRIEF' && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Project Brief Summary:
                  </label>
                  <textarea
                    rows={3}
                    value={briefText}
                    onChange={(e) => setBriefText(e.target.value)}
                    placeholder="Describe target system, expected volumes, primary commercial concerns, and key deadlines..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-sans"
                  />
                </div>
              )}

              {selectedMethod === 'UPLOAD_DOCUMENTS' && (
                <div className="p-4 bg-slate-950 rounded-xl border border-dashed border-slate-800 text-center space-y-2">
                  <Upload className="w-6 h-6 text-slate-500 mx-auto" />
                  <p className="text-xs text-slate-300 font-medium">
                    Upload Architecture, NFR, and Strategy Documents
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Supported: PDF, DOCX, XLSX, Markdown (Mock ingestion in M0)
                  </p>
                </div>
              )}

              {(selectedMethod === 'CONNECT_EXISTING' || selectedMethod === 'ANALYSE_EXISTING') && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                  <span className="text-amber-400 font-semibold block">M0 Specification Note:</span>
                  <p>
                    External provider connection will be implemented in subsequent connector milestones. Creating this project initializes typed mock provider stubs.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">Project Details</h3>
                <p className="text-xs text-slate-400">
                  Configure organisation, project identity, and primary engineering intent.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Organisation Name:
                  </label>
                  <input
                    type="text"
                    value={organisation}
                    onChange={(e) => setOrganisation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-medium"
                    placeholder="e.g. RetailCo"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Performance Engineering Intent:
                  </label>
                  <select
                    value={intent}
                    onChange={(e) => setIntent(e.target.value as EngineeringIntent)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                  >
                    <option value="DISCOVERY">DISCOVERY (Capacity Breaking Point)</option>
                    <option value="REPRESENTATIVE">REPRESENTATIVE (Baseline Parity)</option>
                    <option value="FORECAST">FORECAST (Future Peak Surge)</option>
                    <option value="INVESTIGATIVE">INVESTIGATIVE (Root Cause Isolation)</option>
                    <option value="CERTIFICATION">CERTIFICATION (Release Gate Sign-off)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Project Name:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-medium"
                  placeholder="e.g. Black Friday 2026 Readiness"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Scope & Scope Description:
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  placeholder="Describe target envelope, architecture boundaries, and critical objectives..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          {step === 'DETAILS' ? (
            <button
              type="button"
              onClick={() => setStep('METHOD')}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
            >
              Back
            </button>
          ) : (
            <span className="text-[11px] text-slate-500 font-mono">
              Consumes typed IProjectService
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
            >
              Cancel
            </button>

            {step === 'METHOD' ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting || !name.trim()}
                onClick={handleCreate}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                <span>{isSubmitting ? 'Creating...' : 'Initialize Project'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
