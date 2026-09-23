// PECP Canonical Export & Publication Engine (M4.2)
// Defined according to docs/work-packages/M4_2_CANONICAL_EXPORT_PUBLICATION_CONTRACT.md
// Invariant: Pure, deterministic export and publication boundary outside UI without external mutation or invented fields.

import {
  PerformanceEvidencePackage,
  FindingsRegister,
  TestDefinition,
  EngineeringArtefact,
  ExportArtifact,
  ExportArtifactType,
  ExportFormat,
  PublicationDestination,
  PublicationReadinessStatus,
  DestinationNeutralDefectPayload,
  RenderNeutralResultsReport,
  ResultsReportVisualisationHook,
  PublicationBundle,
  PublicationBundleDigest,
  DestinationPublicationStatus,
  AcceptanceVerdict
} from '@pecp/pe-domain';
import { sha256Hex } from './fingerprint.js';
import { verifyPerformanceEvidencePackageDigest } from './evidencePackageGenerator.js';

export interface GeneratePublicationBundleInput {
  evidencePackage: PerformanceEvidencePackage;
  findingsRegister?: FindingsRegister;
  testDefinition?: TestDefinition;
  strategy?: EngineeringArtefact;
  testPlan?: EngineeringArtefact;
  destinations?: PublicationDestination[];
  allowAuditOnly?: boolean;
  generatedAt?: string;
}

export interface VerifyPublicationBundleDigestResult {
  isValid: boolean;
  computedDigest: string;
  expectedDigest: string;
  mismatches: string[];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.keys(obj)) {
    const prop = (obj as any)[key];
    if (prop !== null && typeof prop === 'object' && !Object.isFrozen(prop)) {
      deepFreeze(prop);
    }
  }
  return obj;
}

/**
 * Builds the canonical digest payload for a RenderNeutralResultsReport.
 * Invariant: Excludes timestamps to ensure deterministic hashing.
 */
export function buildResultsReportDigestPayload(report: Omit<RenderNeutralResultsReport, 'id' | 'reportDigest'>): any {
  return {
    sourcePackageId: report.sourcePackageId,
    sourcePackageDigest: report.sourcePackageDigest,
    projectExecutionIdentity: {
      contractId: report.projectExecutionIdentity.contractId,
      contractVersion: report.projectExecutionIdentity.contractVersion,
      testDefinitionId: report.projectExecutionIdentity.testDefinitionId,
      testDefinitionVersion: report.projectExecutionIdentity.testDefinitionVersion,
      executionRunId: report.projectExecutionIdentity.executionRunId,
      executionMode: report.projectExecutionIdentity.executionMode ?? null,
      operationalStatus: report.projectExecutionIdentity.operationalStatus ?? null
    },
    workloadDemand: report.workloadDemand,
    scheduleTimings: report.scheduleTimings,
    visualisationHook: {
      totalSchedulerLoadOverTime: report.visualisationHook.totalSchedulerLoadOverTime,
      businessWorkloadTarget: report.visualisationHook.businessWorkloadTarget,
      journeyDistribution: report.visualisationHook.journeyDistribution,
      stages: report.visualisationHook.stages
    },
    workloadAttainment: {
      status: report.workloadAttainment.status,
      isPrerequisiteMet: report.workloadAttainment.isPrerequisiteMet,
      observedValue: report.workloadAttainment.observedValue ?? null,
      targetValue: report.workloadAttainment.targetValue ?? null,
      unit: report.workloadAttainment.unit ?? null,
      derivationStatus: report.workloadAttainment.derivationStatus ?? null,
      rationale: report.workloadAttainment.rationale
    },
    criterionOutcomes: report.criterionOutcomes.map((c) => ({
      criterionId: c.criterionId,
      key: c.key,
      metric: c.metric,
      status: c.status,
      canonicalThresholdValue: c.canonicalThresholdValue ?? null,
      observedValue: c.observedValue ?? null,
      rationale: c.rationale
    })),
    acceptanceVerdict: {
      verdict: report.acceptanceVerdict.verdict,
      reasons: report.acceptanceVerdict.reasons
    },
    findingsSummary: {
      totalFindings: report.findingsSummary.totalFindings,
      byType: report.findingsSummary.byType,
      byClassification: report.findingsSummary.byClassification,
      totalDefectCandidates: report.findingsSummary.totalDefectCandidates
    },
    defectCandidatesSummary: report.defectCandidatesSummary,
    evidencePackageIntegrity: {
      packageGenerationStatus: report.evidencePackageIntegrity.packageGenerationStatus,
      coreLineageEdgesVerified: report.evidencePackageIntegrity.coreLineageEdgesVerified,
      totalLineageEdges: report.evidencePackageIntegrity.totalLineageEdges,
      generationIssues: report.evidencePackageIntegrity.generationIssues
    }
  };
}

/**
 * Computes deterministic SHA-256 digest for Results Report.
 */
export function computeResultsReportDigest(payload: any): string {
  return sha256Hex(JSON.stringify(payload));
}

/**
 * Generates a render-neutral Results Report projection from a PerformanceEvidencePackage.
 */
export function generateResultsReport(
  evidencePackage: PerformanceEvidencePackage,
  testDefinition?: TestDefinition,
  findingsRegister?: FindingsRegister
): RenderNeutralResultsReport {
  const contractComp = evidencePackage.components.find((c) => c.componentType === 'PERFORMANCE_CONTRACT');
  const testDefComp = evidencePackage.components.find((c) => c.componentType === 'TEST_DEFINITION');

  const stages: Array<{
    stageIndex: number;
    stageName: string;
    durationSeconds: number;
    targetArrivalRate: number;
  }> = [];

  let stageIdx = 1;
  if (evidencePackage.evidenceSummary.workloadDemand.rampUpSeconds != null) {
    stages.push({
      stageIndex: stageIdx++,
      stageName: 'ramp-up',
      durationSeconds: evidencePackage.evidenceSummary.workloadDemand.rampUpSeconds,
      targetArrivalRate: evidencePackage.evidenceSummary.workloadDemand.schedulerDemand?.peakArrivalRate ?? 0
    });
  }
  if (evidencePackage.evidenceSummary.workloadDemand.steadyStateSeconds != null) {
    stages.push({
      stageIndex: stageIdx++,
      stageName: 'steady-state',
      durationSeconds: evidencePackage.evidenceSummary.workloadDemand.steadyStateSeconds,
      targetArrivalRate: evidencePackage.evidenceSummary.workloadDemand.schedulerDemand?.peakArrivalRate ?? 0
    });
  }
  if (evidencePackage.evidenceSummary.workloadDemand.rampDownSeconds != null) {
    stages.push({
      stageIndex: stageIdx++,
      stageName: 'ramp-down',
      durationSeconds: evidencePackage.evidenceSummary.workloadDemand.rampDownSeconds,
      targetArrivalRate: 0
    });
  }

  const journeyDistribution: Array<{
    journeyName: string;
    ratioPercentage?: number;
    description?: string;
  }> = [];

  if (testDefinition?.scenarios) {
    for (const s of testDefinition.scenarios) {
      if (s.journeyDistribution && s.journeyDistribution.length > 0) {
        for (const j of s.journeyDistribution) {
          journeyDistribution.push({
            journeyName: j.name,
            ratioPercentage: j.percentage,
            description: j.description
          });
        }
      } else {
        journeyDistribution.push({
          journeyName: s.name,
          description: `Scenario: ${s.name}`
        });
      }
    }
  }

  const visualisationHook: ResultsReportVisualisationHook = {
    totalSchedulerLoadOverTime: {
      unit: evidencePackage.evidenceSummary.workloadDemand.schedulerDemand?.unit ?? 'journey_iterations/second',
      timeBasis: evidencePackage.evidenceSummary.workloadDemand.businessDemand?.timeBasis ?? 'second',
      targetRate: evidencePackage.evidenceSummary.workloadDemand.schedulerDemand?.peakArrivalRate ?? 0
    },
    businessWorkloadTarget: {
      businessMetric: evidencePackage.evidenceSummary.workloadDemand.businessDemand?.metric ?? 'orders',
      targetRate: evidencePackage.evidenceSummary.workloadDemand.businessDemand?.targetValue ?? 0,
      unit: evidencePackage.evidenceSummary.workloadDemand.businessDemand?.unit ?? 'orders/second'
    },
    journeyDistribution,
    stages
  };

  const requiredCoreEdges = [
    { fromComponent: 'PERFORMANCE_CONTRACT', toComponent: 'TEST_DEFINITION' },
    { fromComponent: 'TEST_DEFINITION', toComponent: 'EXECUTION_RUN' },
    { fromComponent: 'EXECUTION_RUN', toComponent: 'RAW_EVIDENCE_INVENTORY' },
    { fromComponent: 'RAW_EVIDENCE_INVENTORY', toComponent: 'CANONICAL_RESULTS' },
    { fromComponent: 'CANONICAL_RESULTS', toComponent: 'ACCEPTANCE_EVALUATION' },
    { fromComponent: 'ACCEPTANCE_EVALUATION', toComponent: 'FINDINGS_REGISTER' }
  ];

  const coreLineageEdgesVerified = requiredCoreEdges.every((req) =>
    evidencePackage.lineage.edges.some(
      (e) =>
        e.fromComponent === req.fromComponent &&
        e.toComponent === req.toComponent &&
        e.verified === true &&
        Boolean(e.fromId) &&
        Boolean(e.toId)
    )
  );

  const eligibleCandidatesCount = findingsRegister?.defectCandidates
    ? findingsRegister.defectCandidates.filter((c) => c.publicationEligibility).length
    : 0;

  const totalCandidatesCount = findingsRegister?.defectCandidates
    ? findingsRegister.defectCandidates.length
    : (evidencePackage.evidenceSummary.findingsSummary?.totalDefectCandidates ?? 0);

  const blockedCandidatesCount = totalCandidatesCount - eligibleCandidatesCount;

  const reportBase: Omit<RenderNeutralResultsReport, 'id' | 'reportDigest'> = {
    sourcePackageId: evidencePackage.id,
    sourcePackageDigest: evidencePackage.packageDigest.value,
    projectExecutionIdentity: {
      contractId: contractComp?.canonicalId ?? '',
      contractVersion: contractComp?.version ?? '',
      testDefinitionId: testDefComp?.canonicalId ?? '',
      testDefinitionVersion: testDefComp?.version ?? '',
      executionRunId: evidencePackage.evidenceSummary.execution.executionRunId ?? '',
      executionMode: evidencePackage.evidenceSummary.execution.executionMode,
      operationalStatus: evidencePackage.evidenceSummary.execution.operationalStatus,
      startedAt: evidencePackage.evidenceSummary.execution.startedAt,
      completedAt: evidencePackage.evidenceSummary.execution.completedAt,
      durationSeconds: evidencePackage.evidenceSummary.execution.durationSeconds
    },
    workloadDemand: {
      businessDemand: evidencePackage.evidenceSummary.workloadDemand.businessDemand?.targetValue ?? 0,
      businessDemandUnit: evidencePackage.evidenceSummary.workloadDemand.businessDemand?.unit ?? 'orders/second',
      schedulerDemand: evidencePackage.evidenceSummary.workloadDemand.schedulerDemand?.peakArrivalRate ?? 0,
      schedulerDemandUnit: evidencePackage.evidenceSummary.workloadDemand.schedulerDemand?.unit ?? 'journey_iterations/second',
      schedulerPopulation: evidencePackage.evidenceSummary.workloadDemand.schedulerDemand?.population ?? 'JOURNEY_ITERATION',
      executionModel: evidencePackage.evidenceSummary.workloadDemand.schedulerDemand?.executionModel ?? 'OPEN'
    },
    scheduleTimings: {
      rampUpSeconds: evidencePackage.evidenceSummary.workloadDemand.rampUpSeconds,
      steadyStateSeconds: evidencePackage.evidenceSummary.workloadDemand.steadyStateSeconds,
      rampDownSeconds: evidencePackage.evidenceSummary.workloadDemand.rampDownSeconds,
      totalDurationSeconds: evidencePackage.evidenceSummary.workloadDemand.totalDurationSeconds
    },
    visualisationHook,
    workloadAttainment: {
      status: evidencePackage.evidenceSummary.workloadAttainment?.status ?? 'UNRESOLVED',
      isPrerequisiteMet: evidencePackage.evidenceSummary.workloadAttainment?.isPrerequisiteMet ?? false,
      observedValue: evidencePackage.evidenceSummary.workloadAttainment?.observedValue,
      targetValue: evidencePackage.evidenceSummary.workloadAttainment?.targetValue,
      unit: evidencePackage.evidenceSummary.workloadAttainment?.unit,
      derivationStatus: evidencePackage.evidenceSummary.workloadAttainment?.derivationStatus,
      rationale: evidencePackage.evidenceSummary.workloadAttainment?.rationale ?? 'Workload attainment evaluation unresolved.'
    },
    criterionOutcomes: (evidencePackage.evidenceSummary.criterionOutcomes ?? []).map((c: any) => ({
      criterionId: c.criterionId,
      key: c.key,
      metric: c.metric,
      target: c.target,
      canonicalThresholdValue: c.canonicalThresholdValue,
      canonicalUnit: c.canonicalUnit,
      observedValue: c.observedValue,
      observedUnit: c.observedUnit,
      status: c.status,
      rationale: c.rationale
    })),
    acceptanceVerdict: {
      verdict: evidencePackage.evidenceSummary.acceptanceVerdict?.verdict ?? 'INCONCLUSIVE',
      reasons: [...(evidencePackage.evidenceSummary.acceptanceVerdict?.reasons ?? [])],
      evaluatedAt: evidencePackage.evidenceSummary.acceptanceVerdict?.evaluatedAt
    },
    findingsSummary: {
      totalFindings: evidencePackage.evidenceSummary.findingsSummary?.totalFindings ?? 0,
      byType: { ...(evidencePackage.evidenceSummary.findingsSummary?.byType ?? {}) },
      byClassification: { ...(evidencePackage.evidenceSummary.findingsSummary?.byClassification ?? {}) },
      totalDefectCandidates: evidencePackage.evidenceSummary.findingsSummary?.totalDefectCandidates ?? 0,
      generationStatus: evidencePackage.evidenceSummary.findingsSummary?.generationStatus
    },
    defectCandidatesSummary: {
      totalCandidates: totalCandidatesCount,
      eligibleForPublication: eligibleCandidatesCount,
      blockedFromPublication: blockedCandidatesCount
    },
    evidencePackageIntegrity: {
      packageGenerationStatus: evidencePackage.packageGenerationStatus,
      coreLineageEdgesVerified,
      totalLineageEdges: evidencePackage.lineage.edges.length,
      generationIssues: [...evidencePackage.generationIssues]
    }
  };

  const digestPayload = buildResultsReportDigestPayload(reportBase);
  const reportDigest = computeResultsReportDigest(digestPayload);

  return deepFreeze({
    ...reportBase,
    id: `results-report-${reportDigest.slice(0, 16)}`,
    reportDigest
  });
}

/**
 * Deterministic human-readable Markdown projection of Results Report.
 * Invariant: Zero AI narrative, zero invented recommendations, governed absence notation for missing values.
 */
export function renderResultsReportMarkdown(report: RenderNeutralResultsReport): string {
  const timings = report.scheduleTimings;
  const rampUp = timings.rampUpSeconds != null ? `${timings.rampUpSeconds}s` : '[GOVERNED ABSENCE]';
  const steady = timings.steadyStateSeconds != null ? `${timings.steadyStateSeconds}s` : '[GOVERNED ABSENCE]';
  const rampDown = timings.rampDownSeconds != null ? `${timings.rampDownSeconds}s` : '[GOVERNED ABSENCE]';
  const totalDur = timings.totalDurationSeconds != null ? `${timings.totalDurationSeconds}s` : '[GOVERNED ABSENCE]';

  const criteriaRows = report.criterionOutcomes
    .map((c) => {
      const threshold = c.canonicalThresholdValue != null ? `${c.canonicalThresholdValue} ${c.canonicalUnit ?? ''}`.trim() : (c.target ?? '[GOVERNED ABSENCE]');
      const observed = c.observedValue != null ? `${c.observedValue} ${c.observedUnit ?? ''}`.trim() : '[GOVERNED ABSENCE]';
      return `| ${c.criterionId} | ${c.metric} | ${threshold} | ${observed} | ${c.status} | ${c.rationale} |`;
    })
    .join('\n');

  const reasonsList = report.acceptanceVerdict.reasons.length > 0
    ? report.acceptanceVerdict.reasons.map((r) => `- ${r}`).join('\n')
    : '- No specific verdict reasons.';

  const findingsByType = Object.entries(report.findingsSummary.byType).length > 0
    ? Object.entries(report.findingsSummary.byType).map(([k, v]) => `  - ${k}: ${v}`).join('\n')
    : '  - None';

  const findingsByClass = Object.entries(report.findingsSummary.byClassification).length > 0
    ? Object.entries(report.findingsSummary.byClassification).map(([k, v]) => `  - ${k}: ${v}`).join('\n')
    : '  - None';

  const issuesList = report.evidencePackageIntegrity.generationIssues.length > 0
    ? `\n### Integrity Issues\n${report.evidencePackageIntegrity.generationIssues.map((i) => `- ${i}`).join('\n')}`
    : '';

  return `# Performance Results Report

## Executive Summary
- **Acceptance Verdict**: ${report.acceptanceVerdict.verdict}
- **Package Status**: ${report.evidencePackageIntegrity.packageGenerationStatus}
- **Source Package ID**: \`${report.sourcePackageId}\`
- **Source Package Digest**: \`${report.sourcePackageDigest}\`

## Project & Execution Identity
- **Contract ID**: \`${report.projectExecutionIdentity.contractId}\` (v${report.projectExecutionIdentity.contractVersion})
- **Test Definition ID**: \`${report.projectExecutionIdentity.testDefinitionId}\` (v${report.projectExecutionIdentity.testDefinitionVersion})
- **Execution Run ID**: \`${report.projectExecutionIdentity.executionRunId}\`
- **Execution Mode**: ${report.projectExecutionIdentity.executionMode ?? '[GOVERNED ABSENCE]'}
- **Operational Status**: ${report.projectExecutionIdentity.operationalStatus ?? '[GOVERNED ABSENCE]'}
- **Execution Window**: ${report.projectExecutionIdentity.startedAt ?? '[GOVERNED ABSENCE]'} to ${report.projectExecutionIdentity.completedAt ?? '[GOVERNED ABSENCE]'} (${report.projectExecutionIdentity.durationSeconds != null ? `${report.projectExecutionIdentity.durationSeconds}s` : '[GOVERNED ABSENCE]'})

## Workload Demand & Attainment
- **Business Workload Demand**: ${report.workloadDemand.businessDemand} ${report.workloadDemand.businessDemandUnit}
- **Scheduler Demand**: ${report.workloadDemand.schedulerDemand} ${report.workloadDemand.schedulerDemandUnit} (Population: ${report.workloadDemand.schedulerPopulation}, Execution Model: ${report.workloadDemand.executionModel})
- **Stage Timings**:
  - Ramp-Up: ${rampUp}
  - Steady-State: ${steady}
  - Ramp-Down: ${rampDown}
  - Total Duration: ${totalDur}
- **Workload Attainment Evaluation**:
  - Status: ${report.workloadAttainment.status}
  - Prerequisite Met: ${report.workloadAttainment.isPrerequisiteMet ? 'YES' : 'NO'}
  - Rationale: ${report.workloadAttainment.rationale}

## Acceptance Evaluation & Governed Verdict
- **Overall Verdict**: **${report.acceptanceVerdict.verdict}**
${reasonsList}

### Canonical Criteria Outcomes
| Criterion ID | Metric | Threshold | Observed | Status | Rationale |
| --- | --- | --- | --- | --- | --- |
${criteriaRows}

## Findings Register Summary
- **Total Findings**: ${report.findingsSummary.totalFindings}
${findingsByType}
- **By Classification**:
${findingsByClass}

## Defect Candidates Summary
- **Total Defect Candidates**: ${report.defectCandidatesSummary.totalCandidates}
- **Eligible for Publication**: ${report.defectCandidatesSummary.eligibleForPublication}
- **Blocked from Publication**: ${report.defectCandidatesSummary.blockedFromPublication}

## Evidence Package & Lineage Integrity
- **Package Generation Status**: ${report.evidencePackageIntegrity.packageGenerationStatus}
- **Core Lineage Verification**: ${report.evidencePackageIntegrity.coreLineageEdgesVerified ? 'ALL 6 CORE EDGES VERIFIED' : 'UNVERIFIED / INCOMPLETE'}
- **Total Lineage Edges**: ${report.evidencePackageIntegrity.totalLineageEdges}${issuesList}
`;
}

/**
 * Deterministic human-readable HTML projection of Results Report.
 */
export function renderResultsReportHtml(report: RenderNeutralResultsReport): string {
  const timings = report.scheduleTimings;
  const rampUp = timings.rampUpSeconds != null ? `${timings.rampUpSeconds}s` : '[GOVERNED ABSENCE]';
  const steady = timings.steadyStateSeconds != null ? `${timings.steadyStateSeconds}s` : '[GOVERNED ABSENCE]';
  const rampDown = timings.rampDownSeconds != null ? `${timings.rampDownSeconds}s` : '[GOVERNED ABSENCE]';
  const totalDur = timings.totalDurationSeconds != null ? `${timings.totalDurationSeconds}s` : '[GOVERNED ABSENCE]';

  const criteriaRows = report.criterionOutcomes
    .map((c) => {
      const threshold = c.canonicalThresholdValue != null ? `${c.canonicalThresholdValue} ${c.canonicalUnit ?? ''}`.trim() : (c.target ?? '[GOVERNED ABSENCE]');
      const observed = c.observedValue != null ? `${c.observedValue} ${c.observedUnit ?? ''}`.trim() : '[GOVERNED ABSENCE]';
      return `<tr><td>${escapeHtml(c.criterionId)}</td><td>${escapeHtml(c.metric)}</td><td>${escapeHtml(threshold)}</td><td>${escapeHtml(observed)}</td><td>${escapeHtml(c.status)}</td><td>${escapeHtml(c.rationale)}</td></tr>`;
    })
    .join('');

  const reasonsList = report.acceptanceVerdict.reasons.length > 0
    ? report.acceptanceVerdict.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join('')
    : '<li>No specific verdict reasons.</li>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Performance Results Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.5; color: #111; max-width: 900px; margin: 0 auto; padding: 2rem; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
    th { background-color: #f4f4f4; }
    code { font-family: monospace; background: #eee; padding: 2px 4px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>Performance Results Report</h1>
  <section>
    <h2>Executive Summary</h2>
    <p><strong>Acceptance Verdict:</strong> ${escapeHtml(report.acceptanceVerdict.verdict)}</p>
    <p><strong>Package Status:</strong> ${escapeHtml(report.evidencePackageIntegrity.packageGenerationStatus)}</p>
    <p><strong>Source Package ID:</strong> <code>${escapeHtml(report.sourcePackageId)}</code></p>
    <p><strong>Source Package Digest:</strong> <code>${escapeHtml(report.sourcePackageDigest)}</code></p>
  </section>
  <section>
    <h2>Project & Execution Identity</h2>
    <p><strong>Contract ID:</strong> <code>${escapeHtml(report.projectExecutionIdentity.contractId)}</code> (v${escapeHtml(String(report.projectExecutionIdentity.contractVersion))})</p>
    <p><strong>Test Definition ID:</strong> <code>${escapeHtml(report.projectExecutionIdentity.testDefinitionId)}</code> (v${escapeHtml(String(report.projectExecutionIdentity.testDefinitionVersion))})</p>
    <p><strong>Execution Run ID:</strong> <code>${escapeHtml(report.projectExecutionIdentity.executionRunId)}</code></p>
    <p><strong>Execution Mode:</strong> ${escapeHtml(report.projectExecutionIdentity.executionMode ?? '[GOVERNED ABSENCE]')}</p>
    <p><strong>Operational Status:</strong> ${escapeHtml(report.projectExecutionIdentity.operationalStatus ?? '[GOVERNED ABSENCE]')}</p>
  </section>
  <section>
    <h2>Workload Demand & Attainment</h2>
    <p><strong>Business Workload Demand:</strong> ${report.workloadDemand.businessDemand} ${escapeHtml(report.workloadDemand.businessDemandUnit)}</p>
    <p><strong>Scheduler Demand:</strong> ${report.workloadDemand.schedulerDemand} ${escapeHtml(report.workloadDemand.schedulerDemandUnit)}</p>
    <p><strong>Stage Timings:</strong> Ramp-Up: ${escapeHtml(rampUp)}, Steady-State: ${escapeHtml(steady)}, Ramp-Down: ${escapeHtml(rampDown)}, Total Duration: ${escapeHtml(totalDur)}</p>
    <p><strong>Workload Attainment:</strong> ${escapeHtml(report.workloadAttainment.status)} (Prerequisite Met: ${report.workloadAttainment.isPrerequisiteMet ? 'YES' : 'NO'})</p>
  </section>
  <section>
    <h2>Acceptance Evaluation & Criteria</h2>
    <p><strong>Overall Verdict:</strong> ${escapeHtml(report.acceptanceVerdict.verdict)}</p>
    <ul>${reasonsList}</ul>
    <table>
      <thead><tr><th>Criterion ID</th><th>Metric</th><th>Threshold</th><th>Observed</th><th>Status</th><th>Rationale</th></tr></thead>
      <tbody>${criteriaRows}</tbody>
    </table>
  </section>
  <section>
    <h2>Findings & Defect Candidates</h2>
    <p><strong>Total Findings:</strong> ${report.findingsSummary.totalFindings}</p>
    <p><strong>Total Defect Candidates:</strong> ${report.defectCandidatesSummary.totalCandidates} (Eligible: ${report.defectCandidatesSummary.eligibleForPublication}, Blocked: ${report.defectCandidatesSummary.blockedFromPublication})</p>
  </section>
  <section>
    <h2>Evidence Package & Lineage Integrity</h2>
    <p><strong>Status:</strong> ${escapeHtml(report.evidencePackageIntegrity.packageGenerationStatus)}</p>
    <p><strong>Core Lineage:</strong> ${report.evidencePackageIntegrity.coreLineageEdgesVerified ? 'ALL 6 CORE EDGES VERIFIED' : 'UNVERIFIED / INCOMPLETE'}</p>
  </section>
</body>
</html>`;
}

/**
 * Derives destination-neutral defect payloads from FindingsRegister defect candidates.
 * Invariant: Never contains priority, severity, assignee, team/component, sprint, due date, or root cause.
 */
export function generateDefectPayloads(
  evidencePackage: PerformanceEvidencePackage,
  findingsRegister?: FindingsRegister
): DestinationNeutralDefectPayload[] {
  if (!findingsRegister?.defectCandidates || findingsRegister.defectCandidates.length === 0) {
    return [];
  }

  return findingsRegister.defectCandidates.map((candidate) => {
    const normalizedPayload = {
      sourceFindingId: candidate.sourceFindingId,
      sourceCandidateId: candidate.id,
      sourceExecutionRunId: candidate.executionRunReference.executionRunId,
      sourceAcceptanceEvaluationId: findingsRegister.sourceAcceptanceEvaluationId,
      sourceEvidencePackageId: evidencePackage.id,
      title: candidate.title,
      factualProblemStatement: candidate.factualProblemStatement,
      canonicalCriterionReference: {
        criterionId: candidate.acceptanceCriterionReference.criterionId,
        metric: candidate.acceptanceCriterionReference.metric,
        scope: candidate.acceptanceCriterionReference.scope,
        target: candidate.acceptanceCriterionReference.target ? Number(candidate.acceptanceCriterionReference.target) : null
      },
      observedEvidence: {
        observedValue: candidate.observedEvidenceSummary.observedValue,
        observedUnit: candidate.observedEvidenceSummary.observedUnit,
        evidenceSourcePath: candidate.observedEvidenceSummary.evidenceSourcePath ?? null
      },
      expectedCriterion: {
        target: candidate.expectedGovernedCriterion.target ? Number(candidate.expectedGovernedCriterion.target) : null,
        operator: candidate.expectedGovernedCriterion.operator,
        thresholdValue: candidate.expectedGovernedCriterion.thresholdValue,
        unit: candidate.expectedGovernedCriterion.unit
      },
      executionRunReference: candidate.executionRunReference.executionRunId,
      evidenceReferences: [...candidate.evidenceReferences].sort(),
      publicationEligibility: candidate.publicationEligibility,
      blockingReasons: [...candidate.blockingReasonsToPublication].sort()
    };

    const payloadDigest = sha256Hex(JSON.stringify(normalizedPayload));

    return {
      ...normalizedPayload,
      id: `defect-payload-${payloadDigest.slice(0, 16)}`,
      payloadDigest
    };
  });
}

/**
 * Builds deterministic digest payload for PublicationBundle.
 * Invariant: Excludes timestamps to guarantee cryptographic identity reproducibility.
 */
export function buildPublicationBundleDigestPayload(bundle: {
  sourceEvidencePackageId: string;
  sourceEvidencePackageDigest: string;
  sourceAcceptanceVerdict: AcceptanceVerdict;
  sourceFindingsRegisterDigest?: string;
  artifacts: ExportArtifact[];
  defectPayloads: DestinationNeutralDefectPayload[];
  requestedDestinations: PublicationDestination[];
  overallReadiness: PublicationReadinessStatus;
  blockingReasons: string[];
  publicationReadiness: Record<PublicationDestination, DestinationPublicationStatus>;
}): any {
  return {
    schemaVersion: 'publication-bundle-v1',
    sourceEvidencePackageId: bundle.sourceEvidencePackageId,
    sourceEvidencePackageDigest: bundle.sourceEvidencePackageDigest,
    sourceAcceptanceVerdict: bundle.sourceAcceptanceVerdict,
    sourceFindingsRegisterDigest: bundle.sourceFindingsRegisterDigest ?? null,
    artifacts: bundle.artifacts
      .map((a) => ({
        artifactType: a.artifactType,
        format: a.format,
        sourceId: a.sourceId,
        contentDigest: a.contentDigest,
        publicationEligibility: a.publicationEligibility
      }))
      .sort((a, b) => `${a.artifactType}:${a.format}:${a.sourceId}`.localeCompare(`${b.artifactType}:${b.format}:${b.sourceId}`)),
    defectPayloads: bundle.defectPayloads.map((d) => d.payloadDigest).sort(),
    requestedDestinations: [...bundle.requestedDestinations].sort(),
    overallReadiness: bundle.overallReadiness,
    blockingReasons: [...bundle.blockingReasons].sort(),
    publicationReadiness: Object.keys(bundle.publicationReadiness)
      .sort()
      .reduce((acc: any, k) => {
        acc[k] = bundle.publicationReadiness[k as PublicationDestination];
        return acc;
      }, {})
  };
}

/**
 * Computes deterministic SHA-256 PublicationBundleDigest.
 */
export function computePublicationBundleDigest(payload: any): PublicationBundleDigest {
  const digestValue = sha256Hex(JSON.stringify(payload));
  return {
    algorithm: 'SHA-256',
    schemaVersion: 'publication-bundle-v1',
    value: digestValue
  };
}

/**
 * Primary M4.2 generator: converts verified PerformanceEvidencePackage into an immutable PublicationBundle.
 */
export function generatePublicationBundle(input: GeneratePublicationBundleInput): PublicationBundle {
  const {
    evidencePackage,
    findingsRegister,
    testDefinition,
    strategy,
    testPlan,
    destinations = ['DOWNLOAD', 'API'],
    allowAuditOnly = false,
    generatedAt
  } = input;

  const packageVerification = verifyPerformanceEvidencePackageDigest(evidencePackage);

  // Validate package digest and ID derivation
  const isDigestValid = packageVerification.isValid;
  const isPackageIdValid = evidencePackage.id === `pep-${evidencePackage.packageDigest.value.slice(0, 16)}`;
  const isPackageStatusValid = evidencePackage.packageGenerationStatus === 'VALID';

  const isSourceIntegrityValid = isDigestValid && isPackageIdValid && isPackageStatusValid;

  // Verify independently supplied objects against package component references
  const componentMismatches: string[] = [];
  if (findingsRegister) {
    const comp = evidencePackage.components.find((c) => c.componentType === 'FINDINGS_REGISTER');
    if (!comp) {
      componentMismatches.push('Independently supplied FindingsRegister has no matching FINDINGS_REGISTER component in Evidence Package.');
    } else if (comp.canonicalId !== findingsRegister.id) {
      componentMismatches.push(`FindingsRegister id ${findingsRegister.id} does not match component canonicalId ${comp.canonicalId}.`);
    } else if (comp.digest !== findingsRegister.registerDigest?.value) {
      componentMismatches.push(`FindingsRegister digest ${findingsRegister.registerDigest?.value} does not match component digest ${comp.digest}.`);
    }
  }

  if (testDefinition) {
    const comp = evidencePackage.components.find((c) => c.componentType === 'TEST_DEFINITION');
    if (!comp) {
      componentMismatches.push('Independently supplied TestDefinition has no matching TEST_DEFINITION component in Evidence Package.');
    } else if (comp.canonicalId !== testDefinition.id) {
      componentMismatches.push(`TestDefinition id ${testDefinition.id} does not match component canonicalId ${comp.canonicalId}.`);
    }
  }

  if (strategy) {
    const comp = evidencePackage.components.find((c) => c.componentType === 'PERFORMANCE_STRATEGY');
    if (!comp) {
      componentMismatches.push('Independently supplied Strategy has no matching PERFORMANCE_STRATEGY component in Evidence Package.');
    } else if (comp.canonicalId !== strategy.id) {
      componentMismatches.push(`Strategy id ${strategy.id} does not match component canonicalId ${comp.canonicalId}.`);
    }
  }

  if (testPlan) {
    const comp = evidencePackage.components.find((c) => c.componentType === 'PERFORMANCE_TEST_PLAN');
    if (!comp) {
      componentMismatches.push('Independently supplied TestPlan has no matching PERFORMANCE_TEST_PLAN component in Evidence Package.');
    } else if (comp.canonicalId !== testPlan.id) {
      componentMismatches.push(`TestPlan id ${testPlan.id} does not match component canonicalId ${comp.canonicalId}.`);
    }
  }

  const isComponentIntegrityValid = componentMismatches.length === 0;
  const isFullyValid = isSourceIntegrityValid && isComponentIntegrityValid;

  // Determine publication readiness per requested destination
  const allDestinations: PublicationDestination[] = [
    'DOWNLOAD',
    'API',
    'CONFLUENCE',
    'SHAREPOINT',
    'JIRA',
    'AZURE_DEVOPS'
  ];

  const publicationReadiness: Record<PublicationDestination, DestinationPublicationStatus> = {} as any;
  const bundleBlockingReasons: string[] = [];

  if (!isFullyValid) {
    const baseReasons: string[] = [];
    if (!isDigestValid) baseReasons.push('Evidence Package cryptographic digest is invalid or tampered.');
    if (!isPackageIdValid) baseReasons.push('Evidence Package ID does not derive from package digest.');
    if (!isPackageStatusValid) baseReasons.push(`Evidence Package status is ${evidencePackage.packageGenerationStatus}, expected VALID.`);
    baseReasons.push(...componentMismatches);

    const destStatus: PublicationReadinessStatus = allowAuditOnly
      ? 'AUDIT_ONLY_NOT_PUBLISHABLE'
      : 'BLOCKED_INVALID_SOURCE';

    for (const dest of allDestinations) {
      publicationReadiness[dest] = {
        status: destStatus,
        blockingReasons: [...baseReasons]
      };
    }
    bundleBlockingReasons.push(...baseReasons);
  } else {
    for (const dest of allDestinations) {
      if (dest === 'DOWNLOAD' || dest === 'API') {
        publicationReadiness[dest] = {
          status: 'READY',
          blockingReasons: []
        };
      } else {
        // External connectors (Jira, ADO, Confluence, SharePoint) are governed boundary types without live config in M4.2
        const connectorName = dest === 'JIRA' ? 'Jira' : dest === 'AZURE_DEVOPS' ? 'Azure DevOps' : dest === 'CONFLUENCE' ? 'Confluence' : 'SharePoint';
        const reason = `${connectorName} destination connector configuration (target workspace/project, credentials) is not configured.`;
        publicationReadiness[dest] = {
          status: 'BLOCKED_MISSING_DESTINATION_CONFIGURATION',
          blockingReasons: [reason]
        };
        if (destinations.includes(dest)) {
          bundleBlockingReasons.push(reason);
        }
      }
    }
  }

  let overallReadiness: PublicationReadinessStatus;
  if (!isFullyValid) {
    overallReadiness = allowAuditOnly ? 'AUDIT_ONLY_NOT_PUBLISHABLE' : 'BLOCKED_INVALID_SOURCE';
  } else {
    const requestedStatuses = destinations.map((d) => publicationReadiness[d].status);
    if (requestedStatuses.every((s) => s === 'READY')) {
      overallReadiness = 'READY';
    } else {
      overallReadiness = 'BLOCKED_MISSING_DESTINATION_CONFIGURATION';
    }
  }

  // Generate Render-Neutral Results Report
  const resultsReport = generateResultsReport(evidencePackage, testDefinition, findingsRegister);

  // Generate Export Artefacts
  const artifacts: ExportArtifact[] = [];

  // 1. Evidence Package (JSON)
  const pkgJsonContent = JSON.stringify(evidencePackage, null, 2);
  const pkgJsonDigest = sha256Hex(pkgJsonContent);
  artifacts.push({
    id: `export-pkg-json-${pkgJsonDigest.slice(0, 16)}`,
    artifactType: 'PERFORMANCE_EVIDENCE_PACKAGE',
    sourceId: evidencePackage.id,
    sourceDigest: evidencePackage.packageDigest.value,
    format: 'JSON',
    mediaType: 'application/json',
    content: pkgJsonContent,
    contentDigest: pkgJsonDigest,
    metadata: {
      packageGenerationStatus: evidencePackage.packageGenerationStatus,
      totalComponents: evidencePackage.components.length
    },
    publicationEligibility: isFullyValid,
    blockingReasons: isFullyValid ? [] : [...bundleBlockingReasons]
  });

  // 2. Results Report (JSON)
  const reportJsonContent = JSON.stringify(resultsReport, null, 2);
  const reportJsonDigest = sha256Hex(reportJsonContent);
  artifacts.push({
    id: `export-report-json-${reportJsonDigest.slice(0, 16)}`,
    artifactType: 'RESULTS_REPORT',
    sourceId: resultsReport.id,
    sourceDigest: resultsReport.reportDigest,
    format: 'JSON',
    mediaType: 'application/json',
    content: reportJsonContent,
    contentDigest: reportJsonDigest,
    metadata: {
      acceptanceVerdict: resultsReport.acceptanceVerdict.verdict
    },
    publicationEligibility: isFullyValid,
    blockingReasons: isFullyValid ? [] : [...bundleBlockingReasons]
  });

  // 3. Results Report (Markdown)
  const reportMdContent = renderResultsReportMarkdown(resultsReport);
  const reportMdDigest = sha256Hex(reportMdContent);
  artifacts.push({
    id: `export-report-md-${reportMdDigest.slice(0, 16)}`,
    artifactType: 'RESULTS_REPORT',
    sourceId: resultsReport.id,
    sourceDigest: resultsReport.reportDigest,
    format: 'MARKDOWN',
    mediaType: 'text/markdown',
    content: reportMdContent,
    contentDigest: reportMdDigest,
    metadata: {
      acceptanceVerdict: resultsReport.acceptanceVerdict.verdict
    },
    publicationEligibility: isFullyValid,
    blockingReasons: isFullyValid ? [] : [...bundleBlockingReasons]
  });

  // 4. Results Report (HTML)
  const reportHtmlContent = renderResultsReportHtml(resultsReport);
  const reportHtmlDigest = sha256Hex(reportHtmlContent);
  artifacts.push({
    id: `export-report-html-${reportHtmlDigest.slice(0, 16)}`,
    artifactType: 'RESULTS_REPORT',
    sourceId: resultsReport.id,
    sourceDigest: resultsReport.reportDigest,
    format: 'HTML',
    mediaType: 'text/html',
    content: reportHtmlContent,
    contentDigest: reportHtmlDigest,
    metadata: {
      acceptanceVerdict: resultsReport.acceptanceVerdict.verdict
    },
    publicationEligibility: isFullyValid,
    blockingReasons: isFullyValid ? [] : [...bundleBlockingReasons]
  });

  // 5. Findings Register if supplied
  if (findingsRegister) {
    const findingsJsonContent = JSON.stringify(findingsRegister, null, 2);
    const findingsJsonDigest = sha256Hex(findingsJsonContent);
    artifacts.push({
      id: `export-findings-json-${findingsJsonDigest.slice(0, 16)}`,
      artifactType: 'FINDINGS_REGISTER',
      sourceId: findingsRegister.id,
      sourceDigest: findingsRegister.registerDigest.value,
      format: 'JSON',
      mediaType: 'application/json',
      content: findingsJsonContent,
      contentDigest: findingsJsonDigest,
      metadata: {
        totalFindings: findingsRegister.findings.length,
        totalDefectCandidates: findingsRegister.defectCandidates.length
      },
      publicationEligibility: isFullyValid,
      blockingReasons: isFullyValid ? [] : [...bundleBlockingReasons]
    });
  }

  // 6. Strategy if supplied
  if (strategy) {
    const strategyJsonContent = JSON.stringify(strategy, null, 2);
    const strategyJsonDigest = sha256Hex(strategyJsonContent);
    artifacts.push({
      id: `export-strategy-json-${strategyJsonDigest.slice(0, 16)}`,
      artifactType: 'PERFORMANCE_STRATEGY',
      sourceId: strategy.id,
      sourceVersion: strategy.version,
      sourceFingerprint: strategy.sourceContractFingerprint,
      format: 'JSON',
      mediaType: 'application/json',
      content: strategyJsonContent,
      contentDigest: strategyJsonDigest,
      metadata: {
        title: strategy.title
      },
      publicationEligibility: isFullyValid,
      blockingReasons: isFullyValid ? [] : [...bundleBlockingReasons]
    });
  }

  // 7. Test Plan if supplied
  if (testPlan) {
    const planJsonContent = JSON.stringify(testPlan, null, 2);
    const planJsonDigest = sha256Hex(planJsonContent);
    artifacts.push({
      id: `export-testplan-json-${planJsonDigest.slice(0, 16)}`,
      artifactType: 'PERFORMANCE_TEST_PLAN',
      sourceId: testPlan.id,
      sourceVersion: testPlan.version,
      sourceFingerprint: testPlan.sourceContractFingerprint,
      format: 'JSON',
      mediaType: 'application/json',
      content: planJsonContent,
      contentDigest: planJsonDigest,
      metadata: {
        title: testPlan.title
      },
      publicationEligibility: isFullyValid,
      blockingReasons: isFullyValid ? [] : [...bundleBlockingReasons]
    });
  }

  // Defect Payloads
  const defectPayloads = generateDefectPayloads(evidencePackage, findingsRegister);

  // Compute top-level bundle digest
  const sourceAcceptanceVerdict = (evidencePackage.evidenceSummary.acceptanceVerdict?.verdict ?? 'INCONCLUSIVE') as AcceptanceVerdict;
  const findingsComp = evidencePackage.components.find((c) => c.componentType === 'FINDINGS_REGISTER');

  const bundlePayload = buildPublicationBundleDigestPayload({
    sourceEvidencePackageId: evidencePackage.id,
    sourceEvidencePackageDigest: evidencePackage.packageDigest.value,
    sourceAcceptanceVerdict,
    sourceFindingsRegisterDigest: findingsComp?.digest,
    artifacts,
    defectPayloads,
    requestedDestinations: destinations,
    overallReadiness,
    blockingReasons: bundleBlockingReasons,
    publicationReadiness
  });

  const bundleDigest = computePublicationBundleDigest(bundlePayload);
  const bundleId = `publication-bundle-${bundleDigest.value.slice(0, 16)}`;

  return deepFreeze({
    id: bundleId,
    schemaVersion: 'publication-bundle-v1',
    sourceEvidencePackageId: evidencePackage.id,
    sourceEvidencePackageDigest: evidencePackage.packageDigest.value,
    sourceAcceptanceVerdict,
    sourceFindingsRegisterDigest: findingsComp?.digest,
    artifacts,
    defectPayloads,
    requestedDestinations: destinations,
    publicationReadiness,
    overallReadiness,
    blockingReasons: bundleBlockingReasons,
    bundleDigest,
    generatedAt
  });
}

/**
 * Cryptographically verifies a PublicationBundle.
 */
export function verifyPublicationBundleDigest(bundle: PublicationBundle): VerifyPublicationBundleDigestResult {
  const mismatches: string[] = [];

  // Check each artifact content digest
  for (const artifact of bundle.artifacts) {
    const computedDigest = sha256Hex(artifact.content);
    if (computedDigest !== artifact.contentDigest) {
      mismatches.push(
        `Artifact ${artifact.id} (${artifact.artifactType}:${artifact.format}) content digest mismatch. Expected ${artifact.contentDigest}, computed ${computedDigest}`
      );
    }
  }

  // Check each defect payload digest
  for (const defect of bundle.defectPayloads) {
    const normalized = {
      sourceFindingId: defect.sourceFindingId,
      sourceCandidateId: defect.sourceCandidateId,
      sourceExecutionRunId: defect.sourceExecutionRunId,
      sourceAcceptanceEvaluationId: defect.sourceAcceptanceEvaluationId,
      sourceEvidencePackageId: defect.sourceEvidencePackageId,
      title: defect.title,
      factualProblemStatement: defect.factualProblemStatement,
      canonicalCriterionReference: defect.canonicalCriterionReference,
      observedEvidence: defect.observedEvidence,
      expectedCriterion: defect.expectedCriterion,
      executionRunReference: defect.executionRunReference,
      evidenceReferences: defect.evidenceReferences,
      publicationEligibility: defect.publicationEligibility,
      blockingReasons: defect.blockingReasons
    };
    const computedDigest = sha256Hex(JSON.stringify(normalized));
    if (computedDigest !== defect.payloadDigest) {
      mismatches.push(
        `Defect payload ${defect.id} digest mismatch. Expected ${defect.payloadDigest}, computed ${computedDigest}`
      );
    }
  }

  // Check bundle digest
  const payload = buildPublicationBundleDigestPayload({
    sourceEvidencePackageId: bundle.sourceEvidencePackageId,
    sourceEvidencePackageDigest: bundle.sourceEvidencePackageDigest,
    sourceAcceptanceVerdict: bundle.sourceAcceptanceVerdict,
    sourceFindingsRegisterDigest: bundle.sourceFindingsRegisterDigest,
    artifacts: bundle.artifacts,
    defectPayloads: bundle.defectPayloads,
    requestedDestinations: bundle.requestedDestinations,
    overallReadiness: bundle.overallReadiness,
    blockingReasons: bundle.blockingReasons,
    publicationReadiness: bundle.publicationReadiness
  });

  const computedBundleDigest = computePublicationBundleDigest(payload);
  if (computedBundleDigest.value !== bundle.bundleDigest.value) {
    mismatches.push(
      `PublicationBundle digest mismatch. Expected ${bundle.bundleDigest.value}, computed ${computedBundleDigest.value}`
    );
  }

  return {
    isValid: mismatches.length === 0,
    computedDigest: computedBundleDigest.value,
    expectedDigest: bundle.bundleDigest.value,
    mismatches
  };
}
