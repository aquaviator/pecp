import React, { useState } from 'react';
import {
  X,
  FileText,
  Upload,
  Link2,
  Activity,
  ArrowRight,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  FileUp
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
  const { projectService, sourceService } = useServices();

  const [step, setStep] = useState<'METHOD' | 'DETAILS'>('METHOD');
  const [selectedMethod, setSelectedMethod] = useState<ProjectCreationMethod>('UPLOAD_DOCUMENTS');
  const [organisation, setOrganisation] = useState('RetailCo');
  const [name, setName] = useState('');
  const [intent, setIntent] = useState<EngineeringIntent>('FORECAST');
  const [description, setDescription] = useState('');
  const [briefText, setBriefText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [createdProject, setCreatedProject] = useState<ProjectSummary | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFilesCount, setUploadedFilesCount] = useState<number>(0);
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
      description: 'Tell PECP what is being built or tested with an immutable brief source.',
      icon: FileText
    },
    {
      id: 'UPLOAD_DOCUMENTS',
      title: '2. Upload Documents',
      description: 'PDF, DOCX, CSV, JSON, TXT, or Markdown sources.',
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...filesArray]);
      setUploadError(null);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!name.trim() || !organisation.trim()) return;

    setIsSubmitting(true);
    setUploadError(null);

    let project = createdProject;

    try {
      // 1. Create project if not already created
      if (!project) {
        project = await projectService.createProject({
          name,
          organisation,
          intent,
          description: description || `Created via ${selectedMethod} flow.`,
          creationMethod: selectedMethod,
          briefText: selectedMethod === 'BRIEF' ? briefText : undefined,
          uploadedDocumentNames:
            selectedMethod === 'UPLOAD_DOCUMENTS'
              ? selectedFiles.map((f) => f.name)
              : undefined
        });
        setCreatedProject(project);
      }

      // 2. Real brief source intake
      if (selectedMethod === 'BRIEF' && briefText.trim()) {
        try {
          await sourceService.createBriefSource(project.id, briefText.trim(), `${name} Brief`);
        } catch (err: any) {
          console.error('Failed to create brief source:', err);
          // Non-fatal warning: project was created
        }
      }

      // 3. Real file upload intake
      if (selectedMethod === 'UPLOAD_DOCUMENTS' && selectedFiles.length > 0) {
        let count = uploadedFilesCount;
        for (let i = count; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];
          try {
            await sourceService.uploadSource(project.id, file);
            count++;
            setUploadedFilesCount(count);
          } catch (uploadErr: any) {
            console.error(`Failed to upload ${file.name}:`, uploadErr);
            setUploadError(
              `Project "${project.name}" was successfully created, but uploading "${file.name}" failed: ${uploadErr.message || 'Upload error'}. You can retry or proceed directly to the project.`
            );
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Success: notify parent and close
      onProjectCreated(project);
      handleClose();
    } catch (err: any) {
      console.error('Failed to create project:', err);
      setUploadError(err.message || 'Failed to initialize project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('METHOD');
    setName('');
    setDescription('');
    setBriefText('');
    setSelectedFiles([]);
    setCreatedProject(null);
    setUploadError(null);
    setUploadedFilesCount(0);
    onClose();
  };

  const handleProceedWithPartial = () => {
    if (createdProject) {
      onProjectCreated(createdProject);
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
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
            onClick={handleClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {uploadError && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">Intake Notice</span>
                <p className="leading-relaxed">{uploadError}</p>
                {createdProject && (
                  <button
                    type="button"
                    onClick={handleProceedWithPartial}
                    className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 bg-rose-900 hover:bg-rose-800 text-white rounded text-[11px] font-medium transition-colors"
                  >
                    Proceed to Project anyway
                  </button>
                )}
              </div>
            </div>
          )}

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
                    rows={4}
                    value={briefText}
                    onChange={(e) => setBriefText(e.target.value)}
                    placeholder="Describe target system, expected volumes, primary commercial concerns, and key deadlines..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-sans"
                  />
                  <p className="text-[11px] text-slate-500">
                    Brief text will be captured as an immutable Markdown source version upon creation.
                  </p>
                </div>
              )}

              {selectedMethod === 'UPLOAD_DOCUMENTS' && (
                <div className="space-y-3">
                  <div className="p-4 bg-slate-950 rounded-xl border border-dashed border-slate-800 text-center space-y-2">
                    <Upload className="w-6 h-6 text-slate-500 mx-auto" />
                    <p className="text-xs text-slate-300 font-medium">
                      Select Architecture, Requirements, and Strategy Documents
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Supported: PDF, DOCX, CSV, JSON, TXT, Markdown (Max 10 MiB per file)
                    </p>
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium cursor-pointer transition-colors mt-2">
                      <FileUp className="w-3.5 h-3.5" />
                      <span>Browse Files</span>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.docx,.csv,.json,.txt,.md"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="bg-slate-950 rounded-xl border border-slate-800 p-3 space-y-2">
                      <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
                        Files to Ingest ({selectedFiles.length})
                      </span>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {selectedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800 text-slate-300"
                          >
                            <span className="truncate max-w-[300px] font-medium">{file.name}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-slate-500">
                                {(file.size / 1024).toFixed(1)} KiB
                              </span>
                              <button
                                type="button"
                                onClick={() => removeFile(idx)}
                                className="text-slate-500 hover:text-rose-400"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(selectedMethod === 'CONNECT_EXISTING' || selectedMethod === 'ANALYSE_EXISTING') && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
                  <span className="text-amber-400 font-semibold block">Specification Note:</span>
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
                    <option value="FORECAST">FORECAST (Holiday/Seasonal Peak)</option>
                    <option value="REGRESSION">REGRESSION (Continuous Assurance)</option>
                    <option value="SOAK_RESILIENCE">SOAK_RESILIENCE (Memory/Leak Analysis)</option>
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
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500 font-semibold"
                  placeholder="e.g. Peak Checkout Resiliency Assessment"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Description / Context:
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-sky-500 font-sans"
                  placeholder="Describe target envelope, architecture boundaries, and critical objectives..."
                />
              </div>

              {selectedFiles.length > 0 && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                  <span>Pending uploads: <strong className="text-white">{selectedFiles.length} files</strong></span>
                  <span className="text-[10px] text-sky-400 font-mono">Will be uploaded upon creation</span>
                </div>
              )}
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
              Consumes typed IProjectService & ISourceService
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleClose}
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
                <span>
                  {isSubmitting
                    ? uploadedFilesCount > 0
                      ? `Uploading files (${uploadedFilesCount}/${selectedFiles.length})...`
                      : 'Initializing Project...'
                    : createdProject && uploadError
                      ? 'Retry Upload'
                      : 'Initialize Project'}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
