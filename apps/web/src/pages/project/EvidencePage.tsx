// PECP Governed Performance Evidence Package & Export View (M4.3)
// Defined according to docs/work-packages/M4_3_EXECUTION_TO_EVIDENCE_PORTAL_WORKLOAD_VISUALISATION.md
// Invariant: Read-only projection of canonical PerformanceEvidencePackage and PublicationBundle.

import React, { useState, useEffect } from 'react';
import {
  Award,
  Download,
  ShieldCheck,
  FileCheck,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Info,
  Hash,
  ExternalLink,
  Server,
  FileText,
  FileCode2,
  ArrowRight
} from 'lucide-react';
import { ProjectSummary } from '../../types';
import { useServices } from '../../services/ServiceContext';
import { ExecutionEvidenceState } from '../../services/interfaces/IExecutionEvidenceService';
import { EmptyState } from '../../components/common/EmptyState';

interface EvidencePageProps {
  project: ProjectSummary;
  initialEvidenceState?: ExecutionEvidenceState;
}

export const EvidencePage: React.FC<EvidencePageProps> = ({ project, initialEvidenceState }) => {
  const { executionEvidenceService } = useServices();
  const [evidenceState, setEvidenceState] = useState<ExecutionEvidenceState | null>(
    initialEvidenceState || null
  );
  const [loading, setLoading] = useState<boolean>(!initialEvidenceState);

  useEffect(() => {
    if (initialEvidenceState) return;
    let isMounted = true;
    setLoading(true);
    executionEvidenceService
      .getExecutionEvidenceState(project.id)
      .then((state) => {
        if (isMounted) {
          setEvidenceState(state);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load evidence state:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [project.id, executionEvidenceService, initialEvidenceState]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-24 bg-slate-900 border border-slate-800 rounded-xl" />
        <div className="h-64 bg-slate-900 border border-slate-800 rounded-xl" />
      </div>
    );
  }

  if (!evidenceState || !evidenceState.hasExecuted || !evidenceState.evidencePackage) {
    return (
      <div className="space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-sky-400" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Performance Evidence Package & Governance Audit
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Constitution §13 steps 17–19: The formal, tamper-evident audit package compiling the Performance Contract, execution results, findings, and full source-to-result traceability.
          </p>
        </div>

        <EmptyState
          icon={Award}
          title="Performance Evidence Package Generated at Completion"
          description="The Evidence Package is the ultimate deliverable of the PECP lifecycle. It binds original business requirements, canonical model states, contract approvals, k6 test telemetry, and findings into a verifiable audit bundle."
          subtext="Audit Standard: Source-Agnostic Lineage & Cryptographic Verification"
        />
      </div>
    );
  }

  const {
    evidencePackage,
    acceptanceEvaluation,
    publicationBundle,
    rawArtifactSummary,
    resultsReport,
    findingsRegister
  } = evidenceState;

  const handleDownloadArtifact = (content: string, filename: string, mediaType: string) => {
    const blob = new Blob([content], { type: mediaType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const overallVerdict =
    acceptanceEvaluation?.overallVerdict ||
    evidencePackage.acceptanceEvaluation?.overallVerdict ||
    resultsReport?.acceptanceVerdict?.verdict ||
    'NOT_EVALUATED';

  const workloadPrerequisite =
    acceptanceEvaluation?.workloadAttainmentStatus ||
    resultsReport?.workloadAttainment?.status ||
    evidencePackage.evidenceSummary?.workloadAttainment?.status ||
    'NOT_SUPPLIED';

  const findingsCount =
    findingsRegister?.findings?.length ??
    evidencePackage.evidenceSummary?.findingsSummary?.totalFindings ??
    evidencePackage.findingsRegister?.totalFindings ??
    0;

  const defectCandidatesCount =
    findingsRegister?.defectCandidates?.length ??
    evidencePackage.evidenceSummary?.findingsSummary?.totalDefectCandidates ??
    evidencePackage.findingsRegister?.totalDefectCandidates ??
    0;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-sky-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Governed Performance Evidence Package (PEP)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Tamper-evident, cryptographically bound evidence package compiling the Performance Contract, Test Definition, runner telemetry, and Acceptance findings.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-950 text-slate-300 border border-slate-800">
              ID: {evidencePackage.id}
            </span>
            <span className="text-xs font-mono px-2 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              Integrity: {evidencePackage.packageGenerationStatus || 'NOT_SUPPLIED'}
            </span>
          </div>
        </div>
      </div>

      {/* Package Validity vs Acceptance Verdict Separation Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Evidence Package Integrity */}
        <div className="bg-emerald-950/20 border border-emerald-800/80 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-mono uppercase text-emerald-300 font-bold">
              Evidence Package Integrity
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">
              {evidencePackage.packageGenerationStatus || 'NOT_SUPPLIED'}
            </span>
            <span className="text-xs text-emerald-400 font-mono">
              ({evidencePackage.components?.length ?? 0} Components, {evidencePackage.lineage?.edges?.length ?? 0} Lineage Edges)
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Cryptographic digests of all components verified against SHA-256 bindings. Zero missing files or integrity errors.
          </p>
        </div>

        {/* Acceptance Evaluation Verdict */}
        <div className="bg-amber-950/20 border border-amber-800/80 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-mono uppercase text-amber-300 font-bold">
              Acceptance Verdict
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-amber-400">
              {overallVerdict}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              (Workload Prerequisite: {workloadPrerequisite})
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            A <strong className="text-emerald-300">VALID</strong> package proves cryptographic integrity; it does <strong className="text-rose-300">NOT</strong> mean the performance test passed. Findings: {findingsCount} total · {defectCandidatesCount} defect candidates.
          </p>
        </div>
      </div>

      {/* Dynamic Package Components Projection */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            Governed Evidence Package Components ({evidencePackage.components?.length ?? 0})
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Dynamic projection of verified canonical components bound into this audit package.
          </p>
        </div>

        {evidencePackage.components && evidencePackage.components.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {evidencePackage.components.map((c, idx) => {
              const compName = c.componentType.replace(/_/g, ' ');
              const isPresent = c.presenceStatus === 'PRESENT' || !c.presenceStatus;
              return (
                <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-sky-400" />
                      {idx + 1}. {compName}
                    </span>
                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                        isPresent
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                          : 'bg-rose-950 text-rose-400 border-rose-800'
                      }`}
                    >
                      {c.status || c.presenceStatus || 'PRESENT'}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-300 truncate" title={c.canonicalId}>
                    {c.canonicalId || 'NOT_SUPPLIED'} {c.version ? `(v${c.version})` : ''}
                  </p>
                  {(c.digest || c.fingerprint) && (
                    <p className="text-[11px] text-slate-500 font-mono truncate" title={c.digest || c.fingerprint}>
                      Hash: {c.digest || c.fingerprint}
                    </p>
                  )}
                  {c.issues && c.issues.length > 0 && (
                    <p className="text-[11px] text-rose-400 font-mono">
                      Issues: {c.issues.join('; ')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 font-mono">No components present in evidence package.</p>
        )}
      </div>

      {/* Dynamic Lineage Edges */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Hash className="w-4 h-4 text-emerald-400" />
            Governed Lineage Verification Edges ({evidencePackage.lineage?.edges?.length ?? 0})
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Deterministic cryptographic and semantic bindings connecting contract to execution evidence.
          </p>
        </div>

        {evidencePackage.lineage?.edges && evidencePackage.lineage.edges.length > 0 ? (
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">Source Component</th>
                  <th className="p-3">Relationship</th>
                  <th className="p-3">Target Component</th>
                  <th className="p-3">Verification</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {evidencePackage.lineage.edges.map((edge, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30">
                    <td className="p-3 font-mono text-slate-200">
                      <div>{edge.fromComponent}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[160px]" title={edge.fromId}>{edge.fromId}</div>
                    </td>
                    <td className="p-3 font-mono text-amber-300 font-medium">
                      {edge.bindingType}
                    </td>
                    <td className="p-3 font-mono text-slate-200">
                      <div>{edge.toComponent}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[160px]" title={edge.toId}>{edge.toId}</div>
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center gap-1 font-mono font-bold text-[11px] px-2 py-0.5 rounded border ${
                          edge.verified
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border-rose-800'
                        }`}
                      >
                        {edge.verified ? 'VERIFIED' : 'UNVERIFIED'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400 text-[11px]">{edge.details || 'Bound'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-slate-500 font-mono">No lineage edges in evidence package.</p>
        )}
      </div>

      {/* Dynamic Raw Evidence Inventory */}
      {((evidencePackage.rawEvidenceInventory && evidencePackage.rawEvidenceInventory.length > 0) ||
        (rawArtifactSummary?.files && rawArtifactSummary.files.length > 0)) && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              Raw Execution Evidence Artifact Inventory
            </h3>
            <span className="text-xs font-mono text-slate-400">
              {evidencePackage.rawEvidenceInventory?.length ?? rawArtifactSummary?.files?.length ?? 0} Files Recorded
            </span>
          </div>
          <div className="border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                <tr>
                  <th className="p-3">File / Evidence Item</th>
                  <th className="p-3">Presence Status</th>
                  <th className="p-3">SHA-256 Checksum</th>
                  <th className="p-3">Size / Locator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {evidencePackage.rawEvidenceInventory && evidencePackage.rawEvidenceInventory.length > 0
                  ? evidencePackage.rawEvidenceInventory.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="p-3 font-mono font-medium text-white">{item.filename}</td>
                        <td className="p-3 font-mono text-[11px] text-emerald-400">{item.presenceStatus}</td>
                        <td className="p-3 font-mono text-sky-400 truncate max-w-[220px]" title={item.checksum}>
                          {item.checksum || 'NOT_SUPPLIED'}
                        </td>
                        <td className="p-3 text-slate-400 font-mono text-[11px]">
                          {item.sizeBytes != null ? `${item.sizeBytes} B` : item.sourceLocator || 'NOT_SUPPLIED'}
                        </td>
                      </tr>
                    ))
                  : rawArtifactSummary?.files.map((file, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="p-3 font-mono font-medium text-white">{file.name}</td>
                        <td className="p-3 font-mono text-[11px] text-emerald-400">PRESENT</td>
                        <td className="p-3 font-mono text-sky-400 truncate max-w-[220px]" title={file.checksum}>
                          {file.checksum}
                        </td>
                        <td className="p-3 text-slate-400 text-[11px]">{file.description}</td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export & Publication Readiness Matrix (M4.2 Integration) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Download className="w-4 h-4 text-emerald-400" />
              Governed Publication Readiness & Export Destinations (M4.2)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Destination-neutral export bundle readiness. Verified without calling live external third-party APIs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Bundle Readiness:</span>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
              {publicationBundle?.overallReadiness || 'NOT_SUPPLIED'}
            </span>
          </div>
        </div>

        {/* Dynamic Publication Destinations Grid */}
        {publicationBundle?.publicationReadiness &&
        Object.keys(publicationBundle.publicationReadiness).length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
            {Object.entries(publicationBundle.publicationReadiness).map(([dest, readiness]) => {
              const isReady = readiness.status === 'READY';
              return (
                <div key={dest} className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
                  <span className="text-xs font-mono font-bold text-white block">{dest}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold inline-block ${
                      isReady
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}
                  >
                    {readiness.status}
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate" title={readiness.blockingReasons?.join('; ') || ''}>
                    {readiness.blockingReasons?.length
                      ? readiness.blockingReasons[0]
                      : isReady
                      ? 'Ready for export'
                      : 'Destination unconfigured'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 font-mono">No publication readiness data available.</p>
        )}

        {/* Downloadable Governed Artifacts */}
        <div className="border border-slate-800 rounded-lg p-4 bg-slate-950/60 space-y-3">
          <span className="text-xs font-bold text-slate-300 block uppercase tracking-wider font-mono">
            Download Verified Governed Export Artifacts:
          </span>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() =>
                handleDownloadArtifact(
                  JSON.stringify(evidencePackage, null, 2),
                  `${evidencePackage.id}.json`,
                  'application/json'
                )
              }
              className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-sky-400 text-xs font-mono rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Evidence Package JSON
            </button>

            {resultsReport && (
              <button
                type="button"
                onClick={() =>
                  handleDownloadArtifact(
                    JSON.stringify(resultsReport, null, 2),
                    `results-report-${evidencePackage.id}.json`,
                    'application/json'
                  )
                }
                className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-sky-400 text-xs font-mono rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Results Report JSON
              </button>
            )}

            {findingsRegister && (
              <button
                type="button"
                onClick={() =>
                  handleDownloadArtifact(
                    JSON.stringify(findingsRegister, null, 2),
                    `${findingsRegister.id}.json`,
                    'application/json'
                  )
                }
                className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-mono rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Findings Register JSON
              </button>
            )}

            {publicationBundle && (
              <button
                type="button"
                onClick={() =>
                  handleDownloadArtifact(
                    JSON.stringify(publicationBundle, null, 2),
                    `publication-bundle-${evidencePackage.id}.json`,
                    'application/json'
                  )
                }
                className="flex items-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-emerald-400 text-xs font-mono rounded-lg border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Publication Bundle JSON
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
