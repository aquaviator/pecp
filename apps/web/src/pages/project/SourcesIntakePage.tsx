// SourcesIntakePage.tsx
// Defined according to M5.2 Work Package §11 [I09]

import React, { useEffect, useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Download,
  RefreshCw,
  Plus,
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Layers,
  FileCheck,
  X,
  Table,
  FileCode,
  ListPlus
} from 'lucide-react';
import {
  SourceMetadata,
  SourceVersion,
  ExtractionResult,
  ExtractedFragment,
  IntakeReviewSummary,
  ProjectChecklist,
  RequiredFieldDefinition,
  StructuredImportFieldMapping,
  StructuredImportPreview,
  ProjectSummary,
  SourceKind,
  SourceFormat,
  IntelligenceCategory
} from '@pecp/pe-domain';
import { useServices } from '../../services/ServiceContext';
import { useAuth } from '../../context/AuthContext';

interface SourcesIntakePageProps {
  project: ProjectSummary;
  onNavigateTab?: (tab: any) => void;
}

export const SourcesIntakePage: React.FC<SourcesIntakePageProps> = ({
  project
}) => {
  const { sourceService } = useServices();
  const { hasPermission } = useAuth();

  const canWriteSource = hasPermission('SOURCE_WRITE' as any, project.organisationId);
  const canWriteIntelligence = hasPermission('INTELLIGENCE_WRITE' as any, project.organisationId);

  // Main state
  const [sources, setSources] = useState<SourceMetadata[]>([]);
  const [selectedSource, setSelectedSource] = useState<SourceMetadata | null>(null);
  const [versions, setVersions] = useState<SourceVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<SourceVersion | null>(null);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [summary, setSummary] = useState<IntakeReviewSummary | null>(null);
  const [checklist, setChecklist] = useState<ProjectChecklist | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'INVENTORY' | 'CHECKLIST' | 'IMPORT' | 'CAPTURE'>('INVENTORY');

  // New Source Modal
  const [showAddSourceModal, setShowAddSourceModal] = useState(false);
  const [addKind, setAddKind] = useState<SourceKind>('BRIEF');
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [speakerName, setSpeakerName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // New Version State
  const [showNewVersionModal, setShowNewVersionModal] = useState(false);
  const [newVersionText, setNewVersionText] = useState('');
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);

  // Capture State
  const [captureKey, setCaptureKey] = useState('');
  const [captureCategory, setCaptureCategory] = useState<IntelligenceCategory>('WORKLOAD');
  const [captureTitle, setCaptureTitle] = useState('');
  const [captureValue, setCaptureValue] = useState('');
  const [captureUnit, setCaptureUnit] = useState('');
  const [selectedFragmentForCapture, setSelectedFragmentForCapture] = useState<ExtractedFragment | null>(null);
  const [captureStatus, setCaptureStatus] = useState<string | null>(null);

  // Structured Import State
  const [importSourceVersionId, setImportSourceVersionId] = useState('');
  const [importMappings, setImportMappings] = useState<StructuredImportFieldMapping[]>([
    {
      sourceColumnOrKey: 'orders',
      targetKey: 'peak_demand_orders',
      category: 'WORKLOAD',
      title: 'Peak Demand Orders',
      valueKind: 'NUMBER',
      unit: 'orders/hr'
    }
  ]);
  const [importDelimiter, setImportDelimiter] = useState(',');
  const [importPreviewResult, setImportPreviewResult] = useState<StructuredImportPreview | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Checklist Editor State
  const [isEditingChecklist, setIsEditingChecklist] = useState(false);
  const [newDefKey, setNewDefKey] = useState('');
  const [newDefCat, setNewDefCat] = useState<IntelligenceCategory>('WORKLOAD');
  const [newDefTitle, setNewDefTitle] = useState('');
  const [newDefUnit, setNewDefUnit] = useState('');
  const [newDefDesc, setNewDefDesc] = useState('');

  // Active Project Reference to cancel stale state on switch
  const activeProjectIdRef = useRef(project.id);

  useEffect(() => {
    activeProjectIdRef.current = project.id;
    // Clear previous project state immediately
    setSources([]);
    setSelectedSource(null);
    setVersions([]);
    setSelectedVersion(null);
    setExtraction(null);
    setSummary(null);
    setChecklist(null);
    setError(null);
    setLoading(true);

    loadProjectIntakeData(project.id);
  }, [project.id]);

  const loadProjectIntakeData = async (projectId: string) => {
    try {
      const [srcList, sumData, chkData] = await Promise.all([
        sourceService.listSources(projectId),
        sourceService.getIntakeSummary(projectId).catch(() => null),
        sourceService.getChecklist(projectId).catch(() => null)
      ]);

      if (activeProjectIdRef.current !== projectId) return;

      setSources(srcList);
      setSummary(sumData);
      setChecklist(chkData);

      if (srcList.length > 0) {
        selectSource(srcList[0], projectId);
      }
    } catch (err: any) {
      if (activeProjectIdRef.current !== projectId) return;
      console.error('Failed to load project intake:', err);
      setError(err.message || 'Failed to load source inventory');
    } finally {
      if (activeProjectIdRef.current === projectId) {
        setLoading(false);
      }
    }
  };

  const selectSource = async (source: SourceMetadata, projectId = project.id) => {
    setSelectedSource(source);
    try {
      const vers = await sourceService.listVersions(projectId, source.id);
      if (activeProjectIdRef.current !== projectId) return;
      setVersions(vers);

      const activeVer = vers.find((v) => v.id === source.currentVersionId) || vers[0] || null;
      if (activeVer) {
        selectVersion(source, activeVer, projectId);
      } else {
        setSelectedVersion(null);
        setExtraction(null);
      }
    } catch (err: any) {
      console.error('Failed to load versions:', err);
    }
  };

  const selectVersion = async (source: SourceMetadata, version: SourceVersion, projectId = project.id) => {
    setSelectedVersion(version);
    try {
      const ext = await sourceService.getExtraction(projectId, source.id, version.id);
      if (activeProjectIdRef.current !== projectId) return;
      setExtraction(ext);
    } catch (err: any) {
      console.error('Failed to load extraction:', err);
      setExtraction(null);
    }
  };

  const handleExtract = async () => {
    if (!selectedSource || !selectedVersion) return;
    setIsExtracting(true);
    try {
      const res = await sourceService.extractVersion(project.id, selectedSource.id, selectedVersion.id);
      setExtraction(res);
      // Reload version status
      const updatedVersions = await sourceService.listVersions(project.id, selectedSource.id);
      setVersions(updatedVersions);
      const updatedVer = updatedVersions.find((v) => v.id === selectedVersion.id);
      if (updatedVer) setSelectedVersion(updatedVer);
    } catch (err: any) {
      setError(`Extraction failed: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDownload = async () => {
    if (!selectedSource || !selectedVersion) return;
    try {
      const { blob, filename } = await sourceService.downloadContent(
        project.id,
        selectedSource.id,
        selectedVersion.id
      );
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || `${selectedSource.title}-v${selectedVersion.versionNumber}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(`Download failed: ${err.message}`);
    }
  };

  const handleCreateSourceSubmit = async () => {
    setModalError(null);
    setModalSubmitting(true);
    try {
      let created: SourceMetadata;
      if (addKind === 'BRIEF') {
        if (!textContent.trim()) throw new Error('Brief content is required');
        created = await sourceService.createBriefSource(project.id, textContent.trim(), textTitle || undefined);
      } else if (addKind === 'MANUAL_ASSERTION') {
        if (!textContent.trim()) throw new Error('Statement assertion text is required');
        if (!speakerName.trim()) throw new Error('Stakeholder author/role is required');
        created = await sourceService.createStatementSource(
          project.id,
          textContent.trim(),
          speakerName.trim(),
          textTitle || undefined
        );
      } else {
        if (!uploadFile) throw new Error('File must be selected');
        if (uploadFile.size > 10 * 1024 * 1024) throw new Error('File exceeds 10 MiB limit');
        created = await sourceService.uploadSource(project.id, uploadFile);
      }

      setShowAddSourceModal(false);
      setTextContent('');
      setTextTitle('');
      setSpeakerName('');
      setUploadFile(null);
      await loadProjectIntakeData(project.id);
      selectSource(created);
    } catch (err: any) {
      setModalError(err.message || 'Failed to capture source');
    } finally {
      setModalSubmitting(false);
    }
  };

  const handleCreateVersionSubmit = async () => {
    if (!selectedSource) return;
    try {
      await sourceService.createVersion(project.id, selectedSource.id, {
        text: newVersionText || undefined,
        file: newVersionFile || undefined
      });
      setShowNewVersionModal(false);
      setNewVersionText('');
      setNewVersionFile(null);
      await selectSource(selectedSource);
    } catch (err: any) {
      setError(`Failed to create version: ${err.message}`);
    }
  };

  const handleCaptureSubmit = async () => {
    if (!captureKey.trim() || !captureTitle.trim() || !captureValue.trim()) {
      setCaptureStatus('Key, title, and value are required');
      return;
    }

    try {
      const binding =
        selectedVersion && selectedFragmentForCapture
          ? {
              sourceVersionId: selectedVersion.id,
              locator: selectedFragmentForCapture.locator,
              confidence: 'EXPLICIT',
              extractedFragmentId: selectedFragmentForCapture.id
            }
          : undefined;

      await sourceService.createIntelligenceItem(project.id, {
        key: captureKey.trim(),
        category: captureCategory,
        title: captureTitle.trim(),
        value: captureValue.trim(),
        unit: captureUnit.trim() || undefined,
        sourceBinding: binding
      });

      setCaptureStatus('Successfully captured unapproved intelligence item');
      setCaptureKey('');
      setCaptureTitle('');
      setCaptureValue('');
      setCaptureUnit('');
      setSelectedFragmentForCapture(null);

      // Refresh summary
      const sum = await sourceService.getIntakeSummary(project.id);
      setSummary(sum);
    } catch (err: any) {
      setCaptureStatus(`Capture failed: ${err.message}`);
    }
  };

  const handleImportPreview = async () => {
    if (!importSourceVersionId) {
      setImportStatus('Select a CSV or JSON source version first');
      return;
    }
    setImportLoading(true);
    setImportStatus(null);
    try {
      const prev = await sourceService.importPreview(project.id, {
        sourceVersionId: importSourceVersionId,
        mappings: importMappings,
        delimiter: importDelimiter
      });
      setImportPreviewResult(prev);
    } catch (err: any) {
      setImportStatus(`Import preview failed: ${err.message}`);
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportApply = async () => {
    if (!importSourceVersionId || !importPreviewResult) return;
    setImportLoading(true);
    try {
      const res = await sourceService.importApply(project.id, {
        sourceVersionId: importSourceVersionId,
        mappings: importMappings,
        delimiter: importDelimiter
      });
      setImportStatus(`Successfully imported ${res.importedCount} items`);
      setImportPreviewResult(null);
      const sum = await sourceService.getIntakeSummary(project.id);
      setSummary(sum);
    } catch (err: any) {
      setImportStatus(`Import apply failed: ${err.message}`);
    } finally {
      setImportLoading(false);
    }
  };

  const handleAddChecklistDefinition = async () => {
    if (!checklist || !newDefKey.trim() || !newDefTitle.trim()) return;
    const existing = checklist.items.filter((d) => d.key !== newDefKey.trim());
    const updatedDefs: RequiredFieldDefinition[] = [
      ...existing,
      {
        key: newDefKey.trim(),
        category: newDefCat,
        title: newDefTitle.trim(),
        expectedUnit: newDefUnit.trim() || undefined,
        required: true,
        description: newDefDesc.trim() || undefined
      }
    ];

    try {
      const updated = await sourceService.updateChecklist(
        project.id,
        updatedDefs,
        checklist.revision
      );
      setChecklist(updated);
      setNewDefKey('');
      setNewDefTitle('');
      setNewDefUnit('');
      setNewDefDesc('');
      setIsEditingChecklist(false);
      const sum = await sourceService.getIntakeSummary(project.id);
      setSummary(sum);
    } catch (err: any) {
      setError(`Failed to update checklist: ${err.message}`);
    }
  };

  const handleDeleteChecklistDefinition = async (key: string) => {
    if (!checklist) return;
    const updatedDefs = checklist.items.filter((d) => d.key !== key);
    try {
      const updated = await sourceService.updateChecklist(
        project.id,
        updatedDefs,
        checklist.revision
      );
      setChecklist(updated);
      const sum = await sourceService.getIntakeSummary(project.id);
      setSummary(sum);
    } catch (err: any) {
      setError(`Failed to update checklist: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3 bg-slate-900 border border-slate-800 rounded-xl">
        <RefreshCw className="w-6 h-6 text-sky-400 animate-spin" />
        <span className="text-xs text-slate-400 font-mono">Loading project sources and provenance...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Intake Status Cards */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase text-sky-400 font-bold tracking-wider">
                M5.2 Intake & Provenance
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-mono text-slate-400">{project.name}</span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">Real Intelligence Intake & Source Inventory</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Original documents and statements are ingested into immutable versions, safely parsed with traceable
              locators, and captured as unapproved intelligence before authorized human review.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canWriteSource && (
              <button
                type="button"
                onClick={() => setShowAddSourceModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ingest New Source</span>
              </button>
            )}
          </div>
        </div>

        {/* Operational Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Sources</span>
            <span className="text-base font-bold font-mono text-white mt-0.5">{sources.length}</span>
            <span className="text-[10px] text-slate-500 font-mono block">Immutable Blobs</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Extracted</span>
            <span className="text-base font-bold font-mono text-emerald-400 mt-0.5">{summary?.extractedSuccessCount ?? 0}</span>
            <span className="text-[10px] text-emerald-500/80 font-mono block">Parsed Locators</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Assertions</span>
            <span className="text-base font-bold font-mono text-sky-400 mt-0.5">{summary?.totalIntelligenceFields ?? 0}</span>
            <span className="text-[10px] text-slate-500 font-mono block">Candidates</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Clashing Conflicts</span>
            <span className="text-base font-bold font-mono text-purple-400 mt-0.5">{summary?.conflictingFieldsCount ?? 0}</span>
            <span className="text-[10px] text-purple-400/80 font-mono block">Needs Resolution</span>
          </div>

          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 uppercase font-semibold block">Checklist Gaps</span>
            <span className="text-base font-bold font-mono text-amber-400 mt-0.5">{summary?.configuredMissingGapsCount ?? 0}</span>
            <span className="text-[10px] text-amber-400/80 font-mono block">Missing Reqs</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab('INVENTORY')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeSubTab === 'INVENTORY'
              ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Source Inventory & Extraction</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('CHECKLIST')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeSubTab === 'CHECKLIST'
              ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FileCheck className="w-3.5 h-3.5" />
          <span>Required Checklist & Gaps ({checklist?.items?.length ?? 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('IMPORT')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeSubTab === 'IMPORT'
              ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Table className="w-3.5 h-3.5" />
          <span>Structured Import (CSV / JSON)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('CAPTURE')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeSubTab === 'CAPTURE'
              ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <ListPlus className="w-3.5 h-3.5" />
          <span>Explicit Capture Form</span>
        </button>
      </div>

      {/* TAB 1: INVENTORY & EXTRACTION */}
      {activeSubTab === 'INVENTORY' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Source List (4 cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                Sources ({sources.length})
              </h3>
            </div>

            {sources.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-2">
                <FileSearch className="w-6 h-6 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">No sources ingested yet</p>
                <p className="text-[11px] text-slate-500">
                  Ingest a brief, stakeholder assertion, or upload documents to start.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {sources.map((src) => {
                  const isSelected = selectedSource?.id === src.id;
                  return (
                    <div
                      key={src.id}
                      onClick={() => selectSource(src)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-slate-800/90 border-sky-500 shadow-md ring-1 ring-sky-500/20'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold text-xs text-white truncate max-w-[200px]">
                          {src.title}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-sky-400 border border-slate-800 shrink-0">
                          {src.kind}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500 font-mono">
                        <span>v{src.currentVersionNumber}</span>
                        <span>•</span>
                        <span>{new Date(src.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Source Inspector (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedSource ? (
              <div className="space-y-4">
                {/* Source Header Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-sky-400 font-bold">
                        {selectedSource.kind}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-0.5">{selectedSource.title}</h3>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Source ID: {selectedSource.id} • Created: {new Date(selectedSource.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors border border-slate-700"
                      >
                        <Download className="w-3.5 h-3.5 text-sky-400" />
                        <span>Download Bytes</span>
                      </button>

                      {canWriteSource && (
                        <button
                          type="button"
                          onClick={() => setShowNewVersionModal(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors border border-slate-700"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-400" />
                          <span>New Version</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Versions Selector */}
                  <div className="flex items-center gap-2 overflow-x-auto py-1">
                    <span className="text-[11px] font-semibold text-slate-400 shrink-0">Versions:</span>
                    {versions.map((ver) => {
                      const isVerSelected = selectedVersion?.id === ver.id;
                      return (
                        <button
                          key={ver.id}
                          type="button"
                          onClick={() => selectVersion(selectedSource, ver)}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all flex items-center gap-1.5 ${
                            isVerSelected
                              ? 'bg-sky-600 text-white font-bold'
                              : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                          }`}
                        >
                          <span>v{ver.versionNumber}</span>
                          <span className="text-[9px] opacity-75">({ver.extractionStatus})</span>
                        </button>
                      );
                    })}
                  </div>

                  {selectedVersion && (
                    <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono text-slate-400">
                      <div>
                        <span className="text-slate-500 block">Version ID:</span>
                        <span className="text-slate-200 truncate block">{selectedVersion.id}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Size:</span>
                        <span className="text-slate-200">{(selectedVersion.byteSize / 1024).toFixed(1)} KiB</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">SHA-256 Digest:</span>
                        <span className="text-slate-200 truncate block">{selectedVersion.sha256.substring(0, 16)}...</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Recorded By:</span>
                        <span className="text-slate-200 truncate block">{selectedVersion.capturedByUserDisplayName}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Extraction Panel */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Extracted Content & Locators
                      </h4>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedVersion?.extractionStatus === 'FAILED' && (
                        <span className="text-[10px] text-rose-400 font-mono bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800">
                          Extraction Failed
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={handleExtract}
                        disabled={isExtracting}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isExtracting ? 'animate-spin text-sky-400' : ''}`} />
                        <span>{isExtracting ? 'Extracting...' : 'Extract / Retry'}</span>
                      </button>
                    </div>
                  </div>

                  {extraction ? (
                    <div className="space-y-4">
                      {/* Plain Text Preview */}
                      <div>
                        <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block mb-1">
                          Extracted Plain Text Preview:
                        </span>
                        <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 max-h-48 overflow-y-auto text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
                          {extraction.plainText || '<Empty or non-text extraction>'}
                        </div>
                      </div>

                      {/* Extracted Fragments */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                            Traceable Fragments ({extraction.fragments.length}):
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Click a fragment to bind to Explicit Capture
                          </span>
                        </div>

                        {extraction.fragments.length === 0 ? (
                          <div className="p-3 bg-slate-950 rounded border border-slate-800 text-xs text-slate-500">
                            No fragments isolated.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {extraction.fragments.map((frag) => {
                              const isCaptured = selectedFragmentForCapture?.id === frag.id;
                              return (
                                <div
                                  key={frag.id}
                                  onClick={() => {
                                    setSelectedFragmentForCapture(frag);
                                    setCaptureValue(frag.text);
                                  }}
                                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                                    isCaptured
                                      ? 'bg-sky-950/40 border-sky-500 ring-1 ring-sky-500/20'
                                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                                    <span className="text-sky-400 font-semibold">
                                      Locator: {frag.locator}
                                    </span>
                                    <span>Segment #{frag.segmentIndex}</span>
                                  </div>
                                  <p className="text-xs text-slate-200 font-mono leading-relaxed truncate">
                                    {frag.text}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-2">
                      <p className="text-xs text-slate-400">Not extracted yet.</p>
                      <button
                        type="button"
                        onClick={handleExtract}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-medium"
                      >
                        Run Safe Document Extraction
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-500">
                Select a source from the inventory to inspect versions, download bytes, and view extracted fragments.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CHECKLIST & GAPS */}
      {activeSubTab === 'CHECKLIST' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Configured Intelligence Checklist (Rev {checklist?.revision ?? 1})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Required performance engineering fields. Missing configured fields become traceable gaps without inventing values.
                </p>
              </div>

              {canWriteIntelligence && (
                <button
                  type="button"
                  onClick={() => setIsEditingChecklist(!isEditingChecklist)}
                  className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold"
                >
                  {isEditingChecklist ? 'Cancel' : 'Add Required Field'}
                </button>
              )}
            </div>

            {isEditingChecklist && (
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-white block">Define New Required Field</span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block font-mono">Key:</label>
                    <input
                      type="text"
                      value={newDefKey}
                      onChange={(e) => setNewDefKey(e.target.value)}
                      placeholder="e.g. peak_demand_orders"
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block font-mono">Category:</label>
                    <select
                      value={newDefCat}
                      onChange={(e) => setNewDefCat(e.target.value as IntelligenceCategory)}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white font-mono"
                    >
                      <option value="WORKLOAD">WORKLOAD</option>
                      <option value="REQUIREMENTS">REQUIREMENTS</option>
                      <option value="ARCHITECTURE">ARCHITECTURE</option>
                      <option value="STRATEGY">STRATEGY</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block font-mono">Title:</label>
                    <input
                      type="text"
                      value={newDefTitle}
                      onChange={(e) => setNewDefTitle(e.target.value)}
                      placeholder="e.g. Peak Hourly Orders"
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block font-mono">Expected Unit (Optional):</label>
                    <input
                      type="text"
                      value={newDefUnit}
                      onChange={(e) => setNewDefUnit(e.target.value)}
                      placeholder="e.g. orders/hr"
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-400 block font-mono">Description:</label>
                  <input
                    type="text"
                    value={newDefDesc}
                    onChange={(e) => setNewDefDesc(e.target.value)}
                    placeholder="e.g. Peak transaction rate expected during seasonal campaign"
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddChecklistDefinition}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                >
                  Save Definition
                </button>
              </div>
            )}

            {/* Checklist Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-500 font-mono text-[10px] uppercase">
                  <tr>
                    <th className="p-3">Field Key</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Title</th>
                    <th className="p-3">Expected Unit</th>
                    <th className="p-3">Status</th>
                    {canWriteIntelligence && <th className="p-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {checklist?.items?.map((def) => {
                    const isGap = summary?.gaps?.some((g) => g.key === def.key);
                    return (
                      <tr key={def.key} className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono font-semibold text-sky-400">{def.key}</td>
                        <td className="p-3 font-mono text-slate-400">{def.category}</td>
                        <td className="p-3 font-medium text-white">{def.title}</td>
                        <td className="p-3 font-mono text-slate-400">{def.expectedUnit || '—'}</td>
                        <td className="p-3">
                          {isGap ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                              <AlertTriangle className="w-3 h-3" />
                              <span>GAP: Missing Value</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Configured</span>
                            </span>
                          )}
                        </td>
                        {canWriteIntelligence && (
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteChecklistDefinition(def.key)}
                              className="text-slate-500 hover:text-rose-400 text-xs"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {(!checklist?.items || checklist.items.length === 0) && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        No required fields configured.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STRUCTURED IMPORT */}
      {activeSubTab === 'IMPORT' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Structured Mapping & Atomic Import
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Map CSV columns or JSON Pointer fields explicitly to intelligence fields. Preview validates the mapping
              without mutating the database. Apply confirms all items atomically.
            </p>
          </div>

          {importStatus && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-sky-400">
              {importStatus}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-slate-400 block font-mono mb-1">
                Select CSV/JSON Source Version:
              </label>
              <select
                value={importSourceVersionId}
                onChange={(e) => setImportSourceVersionId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white font-mono"
              >
                <option value="">-- Select Source Version --</option>
                {sources.map((s) => (
                  <option key={s.currentVersionId} value={s.currentVersionId}>
                    {s.title} (v{s.currentVersionNumber})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block font-mono mb-1">
                CSV Delimiter (for CSV):
              </label>
              <input
                type="text"
                value={importDelimiter}
                onChange={(e) => setImportDelimiter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          {/* Mappings Table */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-white block">Field Mappings</span>
            {importMappings.map((m, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-5 gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-500 font-mono block">Source Field / Column:</span>
                  <input
                    type="text"
                    value={m.sourceColumnOrKey}
                    onChange={(e) => {
                      const copy = [...importMappings];
                      copy[idx].sourceColumnOrKey = e.target.value;
                      setImportMappings(copy);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-mono block">Target Key:</span>
                  <input
                    type="text"
                    value={m.targetKey}
                    onChange={(e) => {
                      const copy = [...importMappings];
                      copy[idx].targetKey = e.target.value;
                      setImportMappings(copy);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-mono block">Category:</span>
                  <select
                    value={m.category}
                    onChange={(e) => {
                      const copy = [...importMappings];
                      copy[idx].category = e.target.value as IntelligenceCategory;
                      setImportMappings(copy);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-xs text-white font-mono"
                  >
                    <option value="WORKLOAD">WORKLOAD</option>
                    <option value="REQUIREMENTS">REQUIREMENTS</option>
                    <option value="ARCHITECTURE">ARCHITECTURE</option>
                  </select>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-mono block">Title:</span>
                  <input
                    type="text"
                    value={m.title}
                    onChange={(e) => {
                      const copy = [...importMappings];
                      copy[idx].title = e.target.value;
                      setImportMappings(copy);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-xs text-white"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-mono block">Unit:</span>
                  <input
                    type="text"
                    value={m.unit || ''}
                    onChange={(e) => {
                      const copy = [...importMappings];
                      copy[idx].unit = e.target.value;
                      setImportMappings(copy);
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-xs text-white font-mono"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={importLoading || !importSourceVersionId}
              onClick={handleImportPreview}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {importLoading ? 'Validating...' : 'Preview Import Mapping'}
            </button>
          </div>

          {importPreviewResult && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">Preview Results</span>
                <span className="text-[10px] font-mono text-slate-500">
                  Digest: {importPreviewResult.mappingDigest.substring(0, 16)}...
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <span>Valid: <strong className="text-emerald-400">{importPreviewResult.validCount}</strong></span>
                <span>Invalid: <strong className="text-rose-400">{importPreviewResult.invalidCount}</strong></span>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {importPreviewResult.proposedItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-slate-900 p-2 rounded border border-slate-800">
                    <span className="font-mono text-sky-400">{item.key}</span>
                    <span className="text-white font-medium">{String(item.value)} {item.unit || ''}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{item.sourceLocation}</span>
                  </div>
                ))}
              </div>

              {canWriteIntelligence && (
                <button
                  type="button"
                  disabled={importLoading || importPreviewResult.invalidCount > 0}
                  onClick={handleImportApply}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  Apply Import ({importPreviewResult.validCount} items)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: EXPLICIT CAPTURE FORM */}
      {activeSubTab === 'CAPTURE' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Explicit Source-Assisted / Manual Capture
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Captures an unapproved intelligence item. Missing data remains missing; zero is preserved as exact numeric zero.
            </p>
          </div>

          {captureStatus && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-sky-400">
              {captureStatus}
            </div>
          )}

          {selectedFragmentForCapture && (
            <div className="p-3 bg-sky-950/40 border border-sky-800 rounded-lg text-xs space-y-1">
              <span className="text-sky-300 font-semibold block">Bound to Extracted Fragment:</span>
              <p className="text-slate-200 font-mono">{selectedFragmentForCapture.text}</p>
              <span className="text-[10px] text-slate-400 font-mono block">
                Locator: {selectedFragmentForCapture.locator}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-slate-400 block font-mono mb-1">Field Key:</label>
              <input
                type="text"
                value={captureKey}
                onChange={(e) => setCaptureKey(e.target.value)}
                placeholder="e.g. peak_demand_orders"
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block font-mono mb-1">Category:</label>
              <select
                value={captureCategory}
                onChange={(e) => setCaptureCategory(e.target.value as IntelligenceCategory)}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white font-mono"
              >
                <option value="WORKLOAD">WORKLOAD</option>
                <option value="REQUIREMENTS">REQUIREMENTS</option>
                <option value="ARCHITECTURE">ARCHITECTURE</option>
                <option value="STRATEGY">STRATEGY</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block font-mono mb-1">Title:</label>
              <input
                type="text"
                value={captureTitle}
                onChange={(e) => setCaptureTitle(e.target.value)}
                placeholder="e.g. Peak Demand Hourly Orders"
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block font-mono mb-1">Value:</label>
              <input
                type="text"
                value={captureValue}
                onChange={(e) => setCaptureValue(e.target.value)}
                placeholder="e.g. 24000"
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block font-mono mb-1">Unit (Optional):</label>
              <input
                type="text"
                value={captureUnit}
                onChange={(e) => setCaptureUnit(e.target.value)}
                placeholder="e.g. orders/hr"
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white font-mono"
              />
            </div>
          </div>

          {canWriteIntelligence && (
            <button
              type="button"
              onClick={handleCaptureSubmit}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
            >
              Capture Unapproved Item
            </button>
          )}
        </div>
      )}

      {/* MODAL: ADD SOURCE */}
      {showAddSourceModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Ingest New Source</h3>
              <button
                type="button"
                onClick={() => setShowAddSourceModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-lg text-xs text-rose-300">
                {modalError}
              </div>
            )}

            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setAddKind('BRIEF')}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  addKind === 'BRIEF' ? 'bg-sky-600 text-white' : 'text-slate-400'
                }`}
              >
                Project Brief
              </button>
              <button
                type="button"
                onClick={() => setAddKind('MANUAL_ASSERTION')}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  addKind === 'MANUAL_ASSERTION' ? 'bg-sky-600 text-white' : 'text-slate-400'
                }`}
              >
                Stakeholder Statement
              </button>
              <button
                type="button"
                onClick={() => setAddKind('UPLOAD')}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  addKind === 'UPLOAD' ? 'bg-sky-600 text-white' : 'text-slate-400'
                }`}
              >
                Upload File
              </button>
            </div>

            <div>
              <label className="text-[10px] text-slate-400 block font-mono mb-1">Source Title:</label>
              <input
                type="text"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="e.g. Architecture Brief or Peak Forecast"
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
              />
            </div>

            {addKind === 'MANUAL_ASSERTION' && (
              <div>
                <label className="text-[10px] text-slate-400 block font-mono mb-1">
                  Stakeholder Speaker / Role:
                </label>
                <input
                  type="text"
                  value={speakerName}
                  onChange={(e) => setSpeakerName(e.target.value)}
                  placeholder="e.g. Jane Doe (Director of Trading)"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                />
              </div>
            )}

            {addKind !== 'UPLOAD' ? (
              <div>
                <label className="text-[10px] text-slate-400 block font-mono mb-1">Exact Text:</label>
                <textarea
                  rows={5}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Paste exact brief or stakeholder assertion text..."
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white font-mono"
                />
              </div>
            ) : (
              <div>
                <label className="text-[10px] text-slate-400 block font-mono mb-1">
                  Select File (Max 10 MiB: PDF, DOCX, CSV, JSON, TXT, MD):
                </label>
                <input
                  type="file"
                  accept=".pdf,.docx,.csv,.json,.txt,.md"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded p-2"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowAddSourceModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalSubmitting}
                onClick={handleCreateSourceSubmit}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                {modalSubmitting ? 'Ingesting...' : 'Ingest Source'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NEW VERSION */}
      {showNewVersionModal && selectedSource && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Create New Version for {selectedSource.title}</h3>
              <button
                type="button"
                onClick={() => setShowNewVersionModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Creating a new source version preserves historical versions and byte provenance. Material changes will
              invalidate prior approvals referencing superseded values.
            </p>

            {selectedSource.kind === 'UPLOAD' ? (
              <div>
                <label className="text-[10px] text-slate-400 block font-mono mb-1">
                  Upload Updated File Version:
                </label>
                <input
                  type="file"
                  accept=".pdf,.docx,.csv,.json,.txt,.md"
                  onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded p-2"
                />
              </div>
            ) : (
              <div>
                <label className="text-[10px] text-slate-400 block font-mono mb-1">
                  Updated Text:
                </label>
                <textarea
                  rows={5}
                  value={newVersionText}
                  onChange={(e) => setNewVersionText(e.target.value)}
                  placeholder="Enter updated brief or statement text..."
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white font-mono"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowNewVersionModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateVersionSubmit}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
              >
                Commit New Version
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
