// PECP Canonical Export & Publication Engine (M4.2 / M4.2.1)
// Defined according to docs/work-packages/M4_2_CANONICAL_EXPORT_PUBLICATION_CONTRACT.md
// and docs/work-packages/M4_2_1_EXPORT_SEMANTIC_INTEGRITY_CRYPTOGRAPHIC_BINDING_VISUALISATION_FIDELITY_GATE.md
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
  ResultsReportVisualisationStage,
  ResultsReportJourneyDistributionItem,
  PublicationBundle,
  PublicationBundleDigest,
  DestinationPublicationStatus,
  AcceptanceVerdict
} from '@pecp/pe-domain';
import {
  sha256Hex,
  computeTestDefinitionFingerprint
} from './fingerprint.js';
import { verifyPerformanceEvidencePackageDigest } from './evidencePackageGenerator.js';
import { verifyFindingsRegisterDigest } from './findingsGenerator.js';

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
 * Invariant (M4.2.1): Binds complete semantic fields without non-semantic timestamps.
 */
export function buildResultsReportDigestPayload(
  report: Omit<RenderNeutralResultsReport, 'id' | 'reportDigest'>
): any {
  return {
    sourcePackageId: report.sourcePackageId,
    sourcePackageDigest: report.sourcePackageDigest,
    projectExecutionIdentity: {
      contractId: report.projectExecutionIdentity.contractId ?? null,
      contractVersion:
        report.projectExecutionIdentity.contractVersion != null
          ? String(report.projectExecutionIdentity.contractVersion)
          : null,
      testDefinitionId: report.projectExecutionIdentity.testDefinitionId ?? null,
      testDefinitionVersion:
        report.projectExecutionIdentity.testDefinitionVersion != null
          ? String(report.projectExecutionIdentity.testDefinitionVersion)
          : null,
      executionRunId: report.projectExecutionIdentity.executionRunId ?? null,
      executionMode: report.projectExecutionIdentity.executionMode ?? null,
      operationalStatus: report.projectExecutionIdentity.operationalStatus ?? null,
      commitSha: report.projectExecutionIdentity.commitSha ?? null,
      durationSeconds: report.projectExecutionIdentity.durationSeconds ?? null
    },
    workloadDemand: {
      businessDemand: report.workloadDemand.businessDemand ?? null,
      businessDemandUnit: report.workloadDemand.businessDemandUnit ?? null,
      businessDemandMetric: report.workloadDemand.businessDemandMetric ?? null,
      businessDemandTimeBasis: report.workloadDemand.businessDemandTimeBasis ?? null,
      schedulerDemand: report.workloadDemand.schedulerDemand ?? null,
      schedulerDemandUnit: report.workloadDemand.schedulerDemandUnit ?? null,
      schedulerPopulation: report.workloadDemand.schedulerPopulation ?? null,
      executionModel: report.workloadDemand.executionModel ?? null,
      profileType: report.workloadDemand.profileType ?? null
    },
    scheduleTimings: {
      rampUpSeconds: report.scheduleTimings.rampUpSeconds ?? null,
      steadyStateSeconds: report.scheduleTimings.steadyStateSeconds ?? null,
      rampDownSeconds: report.scheduleTimings.rampDownSeconds ?? null,
      totalDurationSeconds: report.scheduleTimings.totalDurationSeconds ?? null
    },
    visualisationHook: {
      scheduler: report.visualisationHook.scheduler ?? null,
      businessTarget: report.visualisationHook.businessTarget ?? null,
      stages: report.visualisationHook.stages.map((st) => ({
        stageIndex: st.stageIndex,
        name: st.name ?? null,
        durationSeconds: st.durationSeconds,
        startTimeSeconds: st.startTimeSeconds,
        endTimeSeconds: st.endTimeSeconds,
        startArrivalRate: st.startArrivalRate,
        targetArrivalRate: st.targetArrivalRate
      })),
      journeyDistribution: report.visualisationHook.journeyDistribution.map((j) => ({
        journeyId: j.journeyId ?? null,
        journeyKey: j.journeyKey ?? null,
        name: j.name,
        percentage: j.percentage ?? null,
        weight: j.weight ?? null,
        description: j.description ?? null
      }))
    },
    workloadAttainment: report.workloadAttainment
      ? {
          status: report.workloadAttainment.status ?? null,
          isPrerequisiteMet: report.workloadAttainment.isPrerequisiteMet ?? null,
          observedValue: report.workloadAttainment.observedValue ?? null,
          targetValue: report.workloadAttainment.targetValue ?? null,
          unit: report.workloadAttainment.unit ?? null,
          derivationStatus: report.workloadAttainment.derivationStatus ?? null,
          rationale: report.workloadAttainment.rationale ?? null
        }
      : null,
    criterionOutcomes: (report.criterionOutcomes || []).map((c) => ({
      criterionId: c.criterionId,
      key: c.key,
      metric: c.metric,
      target: c.target ?? null,
      canonicalThresholdValue: c.canonicalThresholdValue ?? null,
      canonicalUnit: c.canonicalUnit ?? null,
      observedValue: c.observedValue ?? null,
      observedUnit: c.observedUnit ?? null,
      status: c.status,
      rationale: c.rationale ?? null
    })),
    acceptanceVerdict: report.acceptanceVerdict
      ? {
          verdict: report.acceptanceVerdict.verdict ?? null,
          reasons: [...(report.acceptanceVerdict.reasons || [])]
        }
      : null,
    findingsSummary: report.findingsSummary
      ? {
          totalFindings: report.findingsSummary.totalFindings,
          byType: report.findingsSummary.byType,
          byClassification: report.findingsSummary.byClassification,
          totalDefectCandidates: report.findingsSummary.totalDefectCandidates,
          generationStatus: report.findingsSummary.generationStatus ?? null
        }
      : null,
    defectCandidatesSummary: report.defectCandidatesSummary ?? null,
    evidencePackageIntegrity: {
      packageGenerationStatus: report.evidencePackageIntegrity.packageGenerationStatus,
      coreLineageEdgesVerified: report.evidencePackageIntegrity.coreLineageEdgesVerified,
      totalLineageEdges: report.evidencePackageIntegrity.totalLineageEdges,
      generationIssues: [...(report.evidencePackageIntegrity.generationIssues || [])].sort()
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
 * Invariant (M4.2.1): Zero invented engineering defaults when source fields are absent.
 */
export function generateResultsReport(
  evidencePackage: PerformanceEvidencePackage,
  testDefinition?: TestDefinition,
  findingsRegister?: FindingsRegister
): RenderNeutralResultsReport {
  const contractComp = evidencePackage.components.find((c) => c.componentType === 'PERFORMANCE_CONTRACT');
  const testDefComp = evidencePackage.components.find((c) => c.componentType === 'TEST_DEFINITION');

  // Build generic visualisation hook (M4.2.1)
  let visualisationHook: ResultsReportVisualisationHook;

  if (testDefinition?.scenarios && testDefinition.scenarios.length > 0) {
    const scenario = testDefinition.scenarios[0];
    const sched = scenario.workloadSchedule;

    let currentTime = 0;
    let currentRate = sched.startRate !== undefined ? sched.startRate : 0;

    const stages: ResultsReportVisualisationStage[] = (sched.stages || []).map((st, idx) => {
      const startArrivalRate = currentRate;
      const targetArrivalRate = st.targetArrivalRate;
      const startTimeSeconds = currentTime;
      const endTimeSeconds = currentTime + st.durationSeconds;
      currentTime = endTimeSeconds;
      currentRate = targetArrivalRate;
      return {
        stageIndex: idx + 1,
        name: st.description ?? null,
        durationSeconds: st.durationSeconds,
        startTimeSeconds,
        endTimeSeconds,
        startArrivalRate,
        targetArrivalRate
      };
    });

    const journeyDistribution: ResultsReportJourneyDistributionItem[] = [];
    const sourceJourneys =
      scenario.journeyDistribution && scenario.journeyDistribution.length > 0
        ? scenario.journeyDistribution
        : testDefinition.journeys;

    if (sourceJourneys) {
      for (const j of sourceJourneys) {
        journeyDistribution.push({
          journeyId: j.id ?? null,
          journeyKey: j.key ?? null,
          name: j.name,
          percentage: j.percentage ?? null,
          weight: j.weight ?? null,
          description: j.description ?? null
        });
      }
    }

    const businessTarget = scenario.attainmentRequirement
      ? {
          metric: scenario.attainmentRequirement.metric ?? null,
          targetValue: scenario.attainmentRequirement.targetValue ?? null,
          unit: scenario.attainmentRequirement.unit ?? null,
          timeBasis: evidencePackage.evidenceSummary?.workloadDemand?.businessDemand?.timeBasis ?? null
        }
      : evidencePackage.evidenceSummary?.workloadDemand?.businessDemand
      ? {
          metric: evidencePackage.evidenceSummary.workloadDemand.businessDemand.metric ?? null,
          targetValue: evidencePackage.evidenceSummary.workloadDemand.businessDemand.targetValue ?? null,
          unit: evidencePackage.evidenceSummary.workloadDemand.businessDemand.unit ?? null,
          timeBasis: evidencePackage.evidenceSummary.workloadDemand.businessDemand.timeBasis ?? null
        }
      : null;

    visualisationHook = {
      scheduler: {
        executionModel: sched.executionModel ?? null,
        population: sched.arrivalPopulation ?? null,
        rateUnit: sched.rateUnit ?? null,
        startRate: sched.startRate !== undefined ? sched.startRate : 0,
        peakArrivalRate: sched.peakArrivalRate ?? null
      },
      businessTarget,
      stages,
      journeyDistribution
    };
  } else {
    // TestDefinition not supplied: project from evidence package summary without synthesizing defaults
    const peak = evidencePackage.evidenceSummary?.workloadDemand?.schedulerDemand?.peakArrivalRate;
    const stages: ResultsReportVisualisationStage[] = [];
    let t = 0;
    let sIdx = 1;

    const rampUpSec = evidencePackage.evidenceSummary?.workloadDemand?.rampUpSeconds;
    const steadySec = evidencePackage.evidenceSummary?.workloadDemand?.steadyStateSeconds;
    const rampDownSec = evidencePackage.evidenceSummary?.workloadDemand?.rampDownSeconds;

    if (rampUpSec != null && peak != null) {
      stages.push({
        stageIndex: sIdx++,
        name: 'ramp-up',
        durationSeconds: rampUpSec,
        startTimeSeconds: t,
        endTimeSeconds: t + rampUpSec,
        startArrivalRate: 0,
        targetArrivalRate: peak
      });
      t += rampUpSec;
    }
    if (steadySec != null && peak != null) {
      stages.push({
        stageIndex: sIdx++,
        name: 'steady-state',
        durationSeconds: steadySec,
        startTimeSeconds: t,
        endTimeSeconds: t + steadySec,
        startArrivalRate: peak,
        targetArrivalRate: peak
      });
      t += steadySec;
    }
    if (rampDownSec != null) {
      stages.push({
        stageIndex: sIdx++,
        name: 'ramp-down',
        durationSeconds: rampDownSec,
        startTimeSeconds: t,
        endTimeSeconds: t + rampDownSec,
        startArrivalRate: peak ?? 0,
        targetArrivalRate: 0
      });
    }

    const businessTarget = evidencePackage.evidenceSummary?.workloadDemand?.businessDemand
      ? {
          metric: evidencePackage.evidenceSummary.workloadDemand.businessDemand.metric ?? null,
          targetValue: evidencePackage.evidenceSummary.workloadDemand.businessDemand.targetValue ?? null,
          unit: evidencePackage.evidenceSummary.workloadDemand.businessDemand.unit ?? null,
          timeBasis: evidencePackage.evidenceSummary.workloadDemand.businessDemand.timeBasis ?? null
        }
      : null;

    const scheduler = evidencePackage.evidenceSummary?.workloadDemand?.schedulerDemand
      ? {
          executionModel: evidencePackage.evidenceSummary.workloadDemand.schedulerDemand.executionModel ?? null,
          population: evidencePackage.evidenceSummary.workloadDemand.schedulerDemand.population ?? null,
          rateUnit: evidencePackage.evidenceSummary.workloadDemand.schedulerDemand.unit ?? null,
          startRate: null,
          peakArrivalRate: evidencePackage.evidenceSummary.workloadDemand.schedulerDemand.peakArrivalRate ?? null
        }
      : null;

    visualisationHook = {
      scheduler,
      businessTarget,
      stages,
      journeyDistribution: []
    };
  }

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
    : evidencePackage.evidenceSummary?.findingsSummary?.totalDefectCandidates ?? 0;

  const blockedCandidatesCount = totalCandidatesCount - eligibleCandidatesCount;

  const reportBase: Omit<RenderNeutralResultsReport, 'id' | 'reportDigest'> = {
    sourcePackageId: evidencePackage.id,
    sourcePackageDigest: evidencePackage.packageDigest.value,
    projectExecutionIdentity: {
      contractId: contractComp?.canonicalId ?? null,
      contractVersion: contractComp?.version ?? null,
      testDefinitionId: testDefComp?.canonicalId ?? null,
      testDefinitionVersion: testDefComp?.version ?? null,
      executionRunId: evidencePackage.evidenceSummary?.execution?.executionRunId ?? null,
      executionMode: evidencePackage.evidenceSummary?.execution?.executionMode ?? null,
      operationalStatus: evidencePackage.evidenceSummary?.execution?.operationalStatus ?? null,
      commitSha: (evidencePackage.evidenceSummary?.execution as any)?.commitSha ?? null,
      startedAt: evidencePackage.evidenceSummary?.execution?.startedAt ?? null,
      completedAt: evidencePackage.evidenceSummary?.execution?.completedAt ?? null,
      durationSeconds: evidencePackage.evidenceSummary?.execution?.durationSeconds ?? null
    },
    workloadDemand: {
      businessDemand: evidencePackage.evidenceSummary?.workloadDemand?.businessDemand?.targetValue ?? null,
      businessDemandUnit: evidencePackage.evidenceSummary?.workloadDemand?.businessDemand?.unit ?? null,
      businessDemandMetric: evidencePackage.evidenceSummary?.workloadDemand?.businessDemand?.metric ?? null,
      businessDemandTimeBasis: evidencePackage.evidenceSummary?.workloadDemand?.businessDemand?.timeBasis ?? null,
      schedulerDemand: evidencePackage.evidenceSummary?.workloadDemand?.schedulerDemand?.peakArrivalRate ?? null,
      schedulerDemandUnit: evidencePackage.evidenceSummary?.workloadDemand?.schedulerDemand?.unit ?? null,
      schedulerPopulation: evidencePackage.evidenceSummary?.workloadDemand?.schedulerDemand?.population ?? null,
      executionModel: evidencePackage.evidenceSummary?.workloadDemand?.schedulerDemand?.executionModel ?? null,
      profileType: evidencePackage.evidenceSummary?.workloadDemand?.profileType ?? null
    },
    scheduleTimings: {
      rampUpSeconds: evidencePackage.evidenceSummary?.workloadDemand?.rampUpSeconds ?? null,
      steadyStateSeconds: evidencePackage.evidenceSummary?.workloadDemand?.steadyStateSeconds ?? null,
      rampDownSeconds: evidencePackage.evidenceSummary?.workloadDemand?.rampDownSeconds ?? null,
      totalDurationSeconds: evidencePackage.evidenceSummary?.workloadDemand?.totalDurationSeconds ?? null
    },
    visualisationHook,
    workloadAttainment: evidencePackage.evidenceSummary?.workloadAttainment
      ? {
          status: evidencePackage.evidenceSummary.workloadAttainment.status ?? null,
          isPrerequisiteMet: evidencePackage.evidenceSummary.workloadAttainment.isPrerequisiteMet ?? null,
          observedValue: evidencePackage.evidenceSummary.workloadAttainment.observedValue ?? null,
          targetValue: evidencePackage.evidenceSummary.workloadAttainment.targetValue ?? null,
          unit: evidencePackage.evidenceSummary.workloadAttainment.unit ?? null,
          derivationStatus: evidencePackage.evidenceSummary.workloadAttainment.derivationStatus ?? null,
          rationale: evidencePackage.evidenceSummary.workloadAttainment.rationale ?? null
        }
      : null,
    criterionOutcomes: (evidencePackage.evidenceSummary?.criterionOutcomes ?? []).map((c: any) => ({
      criterionId: c.criterionId,
      key: c.key,
      metric: c.metric,
      target: c.target ?? null,
      canonicalThresholdValue: c.canonicalThresholdValue ?? null,
      canonicalUnit: c.canonicalUnit ?? null,
      observedValue: c.observedValue ?? null,
      observedUnit: c.observedUnit ?? null,
      status: c.status,
      rationale: c.rationale ?? null
    })),
    acceptanceVerdict: evidencePackage.evidenceSummary?.acceptanceVerdict
      ? {
          verdict: evidencePackage.evidenceSummary.acceptanceVerdict.verdict ?? null,
          reasons: [...(evidencePackage.evidenceSummary.acceptanceVerdict.reasons ?? [])],
          evaluatedAt: evidencePackage.evidenceSummary.acceptanceVerdict.evaluatedAt ?? null
        }
      : null,
    findingsSummary: evidencePackage.evidenceSummary?.findingsSummary
      ? {
          totalFindings: evidencePackage.evidenceSummary.findingsSummary.totalFindings ?? 0,
          byType: { ...(evidencePackage.evidenceSummary.findingsSummary.byType ?? {}) },
          byClassification: { ...(evidencePackage.evidenceSummary.findingsSummary.byClassification ?? {}) },
          totalDefectCandidates: evidencePackage.evidenceSummary.findingsSummary.totalDefectCandidates ?? 0,
          generationStatus: evidencePackage.evidenceSummary.findingsSummary.generationStatus ?? null
        }
      : null,
    defectCandidatesSummary:
      findingsRegister || evidencePackage.evidenceSummary?.findingsSummary
        ? {
            totalCandidates: totalCandidatesCount,
            eligibleForPublication: eligibleCandidatesCount,
            blockedFromPublication: blockedCandidatesCount
          }
        : null,
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

  const criteriaRows =
    report.criterionOutcomes.length > 0
      ? report.criterionOutcomes
          .map((c) => {
            const threshold =
              c.canonicalThresholdValue != null
                ? `${c.canonicalThresholdValue} ${c.canonicalUnit ?? ''}`.trim()
                : c.target ?? '[GOVERNED ABSENCE]';
            const observed =
              c.observedValue != null ? `${c.observedValue} ${c.observedUnit ?? ''}`.trim() : '[GOVERNED ABSENCE]';
            return `| ${c.criterionId} | ${c.metric} | ${threshold} | ${observed} | ${c.status} | ${c.rationale ?? '[GOVERNED ABSENCE]'} |`;
          })
          .join('\n')
      : '| [GOVERNED ABSENCE] | [GOVERNED ABSENCE] | [GOVERNED ABSENCE] | [GOVERNED ABSENCE] | [GOVERNED ABSENCE] | [GOVERNED ABSENCE] |';

  const verdictStr = report.acceptanceVerdict?.verdict ?? '[GOVERNED ABSENCE]';
  const reasonsList =
    report.acceptanceVerdict && report.acceptanceVerdict.reasons && report.acceptanceVerdict.reasons.length > 0
      ? report.acceptanceVerdict.reasons.map((r) => `- ${r}`).join('\n')
      : '- [GOVERNED ABSENCE]';

  const findingsByType =
    report.findingsSummary && Object.entries(report.findingsSummary.byType).length > 0
      ? Object.entries(report.findingsSummary.byType)
          .map(([k, v]) => `  - ${k}: ${v}`)
          .join('\n')
      : '  - [GOVERNED ABSENCE]';

  const findingsByClass =
    report.findingsSummary && Object.entries(report.findingsSummary.byClassification).length > 0
      ? Object.entries(report.findingsSummary.byClassification)
          .map(([k, v]) => `  - ${k}: ${v}`)
          .join('\n')
      : '  - [GOVERNED ABSENCE]';

  const issuesList =
    report.evidencePackageIntegrity.generationIssues.length > 0
      ? `\n### Integrity Issues\n${report.evidencePackageIntegrity.generationIssues.map((i) => `- ${i}`).join('\n')}`
      : '';

  const businessDemandStr =
    report.workloadDemand.businessDemand != null
      ? `${report.workloadDemand.businessDemand} ${report.workloadDemand.businessDemandUnit ?? ''}`.trim()
      : '[GOVERNED ABSENCE]';

  const schedulerDemandStr =
    report.workloadDemand.schedulerDemand != null
      ? `${report.workloadDemand.schedulerDemand} ${report.workloadDemand.schedulerDemandUnit ?? ''}`.trim()
      : '[GOVERNED ABSENCE]';

  const schedulerPopStr = report.workloadDemand.schedulerPopulation ?? '[GOVERNED ABSENCE]';
  const execModelStr = report.workloadDemand.executionModel ?? '[GOVERNED ABSENCE]';

  const workloadStatusStr = report.workloadAttainment?.status ?? '[GOVERNED ABSENCE]';
  const prereqMetStr =
    report.workloadAttainment?.isPrerequisiteMet != null
      ? report.workloadAttainment.isPrerequisiteMet
        ? 'YES'
        : 'NO'
      : '[GOVERNED ABSENCE]';
  const rationaleStr = report.workloadAttainment?.rationale ?? '[GOVERNED ABSENCE]';

  const totalFindingsStr =
    report.findingsSummary?.totalFindings != null ? String(report.findingsSummary.totalFindings) : '[GOVERNED ABSENCE]';
  const totalCandidatesStr =
    report.defectCandidatesSummary?.totalCandidates != null
      ? String(report.defectCandidatesSummary.totalCandidates)
      : '[GOVERNED ABSENCE]';
  const eligibleStr =
    report.defectCandidatesSummary?.eligibleForPublication != null
      ? String(report.defectCandidatesSummary.eligibleForPublication)
      : '[GOVERNED ABSENCE]';
  const blockedStr =
    report.defectCandidatesSummary?.blockedFromPublication != null
      ? String(report.defectCandidatesSummary.blockedFromPublication)
      : '[GOVERNED ABSENCE]';

  return `# Performance Results Report

## Executive Summary
- **Acceptance Verdict**: ${verdictStr}
- **Package Status**: ${report.evidencePackageIntegrity.packageGenerationStatus}
- **Source Package ID**: \`${report.sourcePackageId}\`
- **Source Package Digest**: \`${report.sourcePackageDigest}\`

## Project & Execution Identity
- **Contract ID**: \`${report.projectExecutionIdentity.contractId ?? '[GOVERNED ABSENCE]'}\` (v${report.projectExecutionIdentity.contractVersion ?? '[GOVERNED ABSENCE]'})
- **Test Definition ID**: \`${report.projectExecutionIdentity.testDefinitionId ?? '[GOVERNED ABSENCE]'}\` (v${report.projectExecutionIdentity.testDefinitionVersion ?? '[GOVERNED ABSENCE]'})
- **Execution Run ID**: \`${report.projectExecutionIdentity.executionRunId ?? '[GOVERNED ABSENCE]'}\`
- **Execution Mode**: ${report.projectExecutionIdentity.executionMode ?? '[GOVERNED ABSENCE]'}
- **Operational Status**: ${report.projectExecutionIdentity.operationalStatus ?? '[GOVERNED ABSENCE]'}
- **Execution Window**: ${report.projectExecutionIdentity.startedAt ?? '[GOVERNED ABSENCE]'} to ${report.projectExecutionIdentity.completedAt ?? '[GOVERNED ABSENCE]'} (${report.projectExecutionIdentity.durationSeconds != null ? `${report.projectExecutionIdentity.durationSeconds}s` : '[GOVERNED ABSENCE]'})

## Workload Demand & Attainment
- **Business Workload Demand**: ${businessDemandStr}
- **Scheduler Demand**: ${schedulerDemandStr} (Population: ${schedulerPopStr}, Execution Model: ${execModelStr})
- **Stage Timings**:
  - Ramp-Up: ${rampUp}
  - Steady-State: ${steady}
  - Ramp-Down: ${rampDown}
  - Total Duration: ${totalDur}
- **Workload Attainment Evaluation**:
  - Status: ${workloadStatusStr}
  - Prerequisite Met: ${prereqMetStr}
  - Rationale: ${rationaleStr}

## Acceptance Evaluation & Governed Verdict
- **Overall Verdict**: **${verdictStr}**
${reasonsList}

### Canonical Criteria Outcomes
| Criterion ID | Metric | Threshold | Observed | Status | Rationale |
| --- | --- | --- | --- | --- | --- |
${criteriaRows}

## Findings Register Summary
- **Total Findings**: ${totalFindingsStr}
${findingsByType}
- **By Classification**:
${findingsByClass}

## Defect Candidates Summary
- **Total Defect Candidates**: ${totalCandidatesStr}
- **Eligible for Publication**: ${eligibleStr}
- **Blocked from Publication**: ${blockedStr}

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

  const criteriaRows =
    report.criterionOutcomes.length > 0
      ? report.criterionOutcomes
          .map((c) => {
            const threshold =
              c.canonicalThresholdValue != null
                ? `${c.canonicalThresholdValue} ${c.canonicalUnit ?? ''}`.trim()
                : c.target ?? '[GOVERNED ABSENCE]';
            const observed =
              c.observedValue != null ? `${c.observedValue} ${c.observedUnit ?? ''}`.trim() : '[GOVERNED ABSENCE]';
            return `<tr><td>${escapeHtml(c.criterionId)}</td><td>${escapeHtml(c.metric)}</td><td>${escapeHtml(threshold)}</td><td>${escapeHtml(observed)}</td><td>${escapeHtml(c.status)}</td><td>${escapeHtml(c.rationale ?? '[GOVERNED ABSENCE]')}</td></tr>`;
          })
          .join('')
      : '<tr><td colspan="6">[GOVERNED ABSENCE]</td></tr>';

  const verdictStr = report.acceptanceVerdict?.verdict ?? '[GOVERNED ABSENCE]';
  const reasonsList =
    report.acceptanceVerdict && report.acceptanceVerdict.reasons && report.acceptanceVerdict.reasons.length > 0
      ? report.acceptanceVerdict.reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join('')
      : '<li>[GOVERNED ABSENCE]</li>';

  const businessDemandStr =
    report.workloadDemand.businessDemand != null
      ? `${report.workloadDemand.businessDemand} ${escapeHtml(report.workloadDemand.businessDemandUnit ?? '')}`.trim()
      : '[GOVERNED ABSENCE]';

  const schedulerDemandStr =
    report.workloadDemand.schedulerDemand != null
      ? `${report.workloadDemand.schedulerDemand} ${escapeHtml(report.workloadDemand.schedulerDemandUnit ?? '')}`.trim()
      : '[GOVERNED ABSENCE]';

  const workloadStatusStr = report.workloadAttainment?.status ?? '[GOVERNED ABSENCE]';
  const prereqMetStr =
    report.workloadAttainment?.isPrerequisiteMet != null
      ? report.workloadAttainment.isPrerequisiteMet
        ? 'YES'
        : 'NO'
      : '[GOVERNED ABSENCE]';

  const totalFindingsStr =
    report.findingsSummary?.totalFindings != null ? String(report.findingsSummary.totalFindings) : '[GOVERNED ABSENCE]';
  const totalCandidatesStr =
    report.defectCandidatesSummary?.totalCandidates != null
      ? String(report.defectCandidatesSummary.totalCandidates)
      : '[GOVERNED ABSENCE]';
  const eligibleStr =
    report.defectCandidatesSummary?.eligibleForPublication != null
      ? String(report.defectCandidatesSummary.eligibleForPublication)
      : '[GOVERNED ABSENCE]';
  const blockedStr =
    report.defectCandidatesSummary?.blockedFromPublication != null
      ? String(report.defectCandidatesSummary.blockedFromPublication)
      : '[GOVERNED ABSENCE]';

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
    <p><strong>Acceptance Verdict:</strong> ${escapeHtml(verdictStr)}</p>
    <p><strong>Package Status:</strong> ${escapeHtml(report.evidencePackageIntegrity.packageGenerationStatus)}</p>
    <p><strong>Source Package ID:</strong> <code>${escapeHtml(report.sourcePackageId)}</code></p>
    <p><strong>Source Package Digest:</strong> <code>${escapeHtml(report.sourcePackageDigest)}</code></p>
  </section>
  <section>
    <h2>Project & Execution Identity</h2>
    <p><strong>Contract ID:</strong> <code>${escapeHtml(report.projectExecutionIdentity.contractId ?? '[GOVERNED ABSENCE]')}</code> (v${escapeHtml(String(report.projectExecutionIdentity.contractVersion ?? '[GOVERNED ABSENCE]'))})</p>
    <p><strong>Test Definition ID:</strong> <code>${escapeHtml(report.projectExecutionIdentity.testDefinitionId ?? '[GOVERNED ABSENCE]')}</code> (v${escapeHtml(String(report.projectExecutionIdentity.testDefinitionVersion ?? '[GOVERNED ABSENCE]'))})</p>
    <p><strong>Execution Run ID:</strong> <code>${escapeHtml(report.projectExecutionIdentity.executionRunId ?? '[GOVERNED ABSENCE]')}</code></p>
    <p><strong>Execution Mode:</strong> ${escapeHtml(report.projectExecutionIdentity.executionMode ?? '[GOVERNED ABSENCE]')}</p>
    <p><strong>Operational Status:</strong> ${escapeHtml(report.projectExecutionIdentity.operationalStatus ?? '[GOVERNED ABSENCE]')}</p>
  </section>
  <section>
    <h2>Workload Demand & Attainment</h2>
    <p><strong>Business Workload Demand:</strong> ${businessDemandStr}</p>
    <p><strong>Scheduler Demand:</strong> ${schedulerDemandStr}</p>
    <p><strong>Stage Timings:</strong> Ramp-Up: ${escapeHtml(rampUp)}, Steady-State: ${escapeHtml(steady)}, Ramp-Down: ${escapeHtml(rampDown)}, Total Duration: ${escapeHtml(totalDur)}</p>
    <p><strong>Workload Attainment:</strong> ${escapeHtml(workloadStatusStr)} (Prerequisite Met: ${escapeHtml(prereqMetStr)})</p>
  </section>
  <section>
    <h2>Acceptance Evaluation & Criteria</h2>
    <p><strong>Overall Verdict:</strong> ${escapeHtml(verdictStr)}</p>
    <ul>${reasonsList}</ul>
    <table>
      <thead><tr><th>Criterion ID</th><th>Metric</th><th>Threshold</th><th>Observed</th><th>Status</th><th>Rationale</th></tr></thead>
      <tbody>${criteriaRows}</tbody>
    </table>
  </section>
  <section>
    <h2>Findings & Defect Candidates</h2>
    <p><strong>Total Findings:</strong> ${escapeHtml(totalFindingsStr)}</p>
    <p><strong>Total Defect Candidates:</strong> ${escapeHtml(totalCandidatesStr)} (Eligible: ${escapeHtml(eligibleStr)}, Blocked: ${escapeHtml(blockedStr)})</p>
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
 * Builds deterministic normalized payload for Defect Candidate export.
 * Invariant (M4.2.1): Target expressions remain exact strings (e.g. 'p95 < 2000ms'); never cast to Number.
 */
export function buildDefectPayloadDigestPayload(payload: {
  sourceFindingId: string;
  sourceCandidateId: string;
  sourceExecutionRunId: string;
  sourceAcceptanceEvaluationId?: string | null;
  sourceEvidencePackageId: string;
  title: string;
  factualProblemStatement: string;
  canonicalCriterionReference: {
    criterionId: string;
    metric: string;
    scope: string;
    target?: string | null;
  };
  observedEvidence: {
    observedValue: number;
    observedUnit: string;
    evidenceSourcePath?: string | null;
  };
  expectedCriterion: {
    target?: string | null;
    operator?: string | null;
    thresholdValue?: number | null;
    unit?: string | null;
  };
  executionRunReference: string;
  evidenceReferences: string[];
  publicationEligibility: boolean;
  blockingReasons: string[];
}): any {
  return {
    sourceFindingId: payload.sourceFindingId,
    sourceCandidateId: payload.sourceCandidateId,
    sourceExecutionRunId: payload.sourceExecutionRunId,
    sourceAcceptanceEvaluationId: payload.sourceAcceptanceEvaluationId ?? null,
    sourceEvidencePackageId: payload.sourceEvidencePackageId,
    title: payload.title,
    factualProblemStatement: payload.factualProblemStatement,
    canonicalCriterionReference: {
      criterionId: payload.canonicalCriterionReference.criterionId,
      metric: payload.canonicalCriterionReference.metric,
      scope: payload.canonicalCriterionReference.scope,
      target: payload.canonicalCriterionReference.target ?? null
    },
    observedEvidence: {
      observedValue: payload.observedEvidence.observedValue,
      observedUnit: payload.observedEvidence.observedUnit,
      evidenceSourcePath: payload.observedEvidence.evidenceSourcePath ?? null
    },
    expectedCriterion: {
      target: payload.expectedCriterion.target ?? null,
      operator: payload.expectedCriterion.operator ?? null,
      thresholdValue: payload.expectedCriterion.thresholdValue ?? null,
      unit: payload.expectedCriterion.unit ?? null
    },
    executionRunReference: payload.executionRunReference,
    evidenceReferences: [...(payload.evidenceReferences || [])].sort(),
    publicationEligibility: payload.publicationEligibility,
    blockingReasons: [...(payload.blockingReasons || [])].sort()
  };
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
    const rawPayload = {
      sourceFindingId: candidate.sourceFindingId,
      sourceCandidateId: candidate.id,
      sourceExecutionRunId: candidate.executionRunReference.executionRunId,
      sourceAcceptanceEvaluationId: findingsRegister.sourceAcceptanceEvaluationId ?? null,
      sourceEvidencePackageId: evidencePackage.id,
      title: candidate.title,
      factualProblemStatement: candidate.factualProblemStatement,
      canonicalCriterionReference: {
        criterionId: candidate.acceptanceCriterionReference.criterionId,
        metric: candidate.acceptanceCriterionReference.metric,
        scope: candidate.acceptanceCriterionReference.scope,
        target: candidate.acceptanceCriterionReference.target ?? null
      },
      observedEvidence: {
        observedValue: candidate.observedEvidenceSummary.observedValue,
        observedUnit: candidate.observedEvidenceSummary.observedUnit,
        evidenceSourcePath: candidate.observedEvidenceSummary.evidenceSourcePath ?? null
      },
      expectedCriterion: {
        target: candidate.expectedGovernedCriterion.target ?? null,
        operator: candidate.expectedGovernedCriterion.operator ?? null,
        thresholdValue: candidate.expectedGovernedCriterion.thresholdValue ?? null,
        unit: candidate.expectedGovernedCriterion.unit ?? null
      },
      executionRunReference: candidate.executionRunReference.executionRunId,
      evidenceReferences: [...candidate.evidenceReferences].sort(),
      publicationEligibility: candidate.publicationEligibility,
      blockingReasons: [...candidate.blockingReasonsToPublication].sort()
    };

    const digestPayload = buildDefectPayloadDigestPayload(rawPayload);
    const payloadDigest = sha256Hex(JSON.stringify(digestPayload));

    return {
      ...rawPayload,
      id: `defect-payload-${payloadDigest.slice(0, 16)}`,
      payloadDigest
    };
  });
}

/**
 * Builds deterministic digest payload for PublicationBundle.
 * Invariant (M4.2.1): Binds complete ExportArtifact semantics including metadata, source identities,
 * mediaType, defect payloads, and destination readiness. Excludes non-semantic timestamps.
 */
export function buildPublicationBundleDigestPayload(bundle: {
  sourceEvidencePackageId: string;
  sourceEvidencePackageDigest: string;
  sourceAcceptanceVerdict?: AcceptanceVerdict | null;
  sourceFindingsRegisterDigest?: string | null;
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
    sourceAcceptanceVerdict: bundle.sourceAcceptanceVerdict ?? null,
    sourceFindingsRegisterDigest: bundle.sourceFindingsRegisterDigest ?? null,
    artifacts: bundle.artifacts
      .map((a) => {
        const sortedMetaKeys = Object.keys(a.metadata || {}).sort();
        const canonicalMeta: Record<string, unknown> = {};
        for (const k of sortedMetaKeys) {
          canonicalMeta[k] = a.metadata[k];
        }
        return {
          id: a.id,
          artifactType: a.artifactType,
          sourceId: a.sourceId,
          sourceVersion: a.sourceVersion != null ? String(a.sourceVersion) : null,
          sourceFingerprint: a.sourceFingerprint ?? null,
          sourceDigest: a.sourceDigest ?? null,
          format: a.format,
          mediaType: a.mediaType,
          contentDigest: a.contentDigest,
          metadata: canonicalMeta,
          publicationEligibility: a.publicationEligibility,
          blockingReasons: [...(a.blockingReasons || [])].sort()
        };
      })
      .sort((a, b) =>
        `${a.artifactType}:${a.format}:${a.sourceId}:${a.id}`.localeCompare(
          `${b.artifactType}:${b.format}:${b.sourceId}:${b.id}`
        )
      ),
    defectPayloads: bundle.defectPayloads
      .map((d) => ({
        id: d.id,
        sourceFindingId: d.sourceFindingId,
        sourceCandidateId: d.sourceCandidateId,
        sourceExecutionRunId: d.sourceExecutionRunId,
        title: d.title,
        factualProblemStatement: d.factualProblemStatement,
        canonicalCriterionReference: d.canonicalCriterionReference,
        expectedCriterion: d.expectedCriterion,
        observedEvidence: d.observedEvidence,
        publicationEligibility: d.publicationEligibility,
        blockingReasons: [...(d.blockingReasons || [])].sort(),
        payloadDigest: d.payloadDigest
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    requestedDestinations: [...bundle.requestedDestinations].sort(),
    overallReadiness: bundle.overallReadiness,
    blockingReasons: [...bundle.blockingReasons].sort(),
    publicationReadiness: Object.keys(bundle.publicationReadiness)
      .sort()
      .reduce((acc: any, k) => {
        acc[k] = {
          status: bundle.publicationReadiness[k as PublicationDestination].status,
          blockingReasons: [...(bundle.publicationReadiness[k as PublicationDestination].blockingReasons || [])].sort()
        };
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
 * Primary M4.2 / M4.2.1 generator: converts verified PerformanceEvidencePackage into an immutable PublicationBundle.
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

  const componentMismatches: string[] = [];

  // M4.2.1: Independently verify supplied FindingsRegister
  let verifiedFindingsRegister: FindingsRegister | undefined = undefined;
  if (findingsRegister) {
    const findingsVerif = verifyFindingsRegisterDigest(findingsRegister);
    if (!findingsVerif.isValid) {
      componentMismatches.push(
        `FindingsRegister cryptographic verification failed: ${findingsVerif.error ?? 'digest mismatch'}.`
      );
    } else {
      const comp = evidencePackage.components.find((c) => c.componentType === 'FINDINGS_REGISTER');
      if (!comp) {
        componentMismatches.push(
          'Independently supplied FindingsRegister has no matching FINDINGS_REGISTER component in Evidence Package.'
        );
      } else if (comp.canonicalId !== findingsRegister.id) {
        componentMismatches.push(
          `FindingsRegister id ${findingsRegister.id} does not match component canonicalId ${comp.canonicalId}.`
        );
      } else if (comp.digest !== findingsRegister.registerDigest?.value) {
        componentMismatches.push(
          `FindingsRegister digest ${findingsRegister.registerDigest?.value} does not match component digest ${comp.digest}.`
        );
      } else {
        verifiedFindingsRegister = findingsRegister;
      }
    }
  }

  // M4.2.1: Fully verify supplied TestDefinition
  let verifiedTestDefinition: TestDefinition | undefined = undefined;
  if (testDefinition) {
    const computedFp = computeTestDefinitionFingerprint(testDefinition);
    if (testDefinition.fingerprint !== computedFp) {
      componentMismatches.push(
        `TestDefinition fingerprint drift: stored '${testDefinition.fingerprint}' does not match computed '${computedFp}'.`
      );
    } else {
      const comp = evidencePackage.components.find((c) => c.componentType === 'TEST_DEFINITION');
      if (!comp) {
        componentMismatches.push(
          'Independently supplied TestDefinition has no matching TEST_DEFINITION component in Evidence Package.'
        );
      } else if (comp.canonicalId !== testDefinition.id) {
        componentMismatches.push(
          `TestDefinition id ${testDefinition.id} does not match component canonicalId ${comp.canonicalId}.`
        );
      } else if (comp.version != null && String(comp.version) !== String(testDefinition.version)) {
        componentMismatches.push(
          `TestDefinition version ${testDefinition.version} does not match component version ${comp.version}.`
        );
      } else if (comp.fingerprint && comp.fingerprint !== computedFp) {
        componentMismatches.push(
          `TestDefinition fingerprint ${computedFp} does not match component fingerprint ${comp.fingerprint}.`
        );
      } else {
        verifiedTestDefinition = testDefinition;
      }
    }
  }

  // M4.2.1: Strengthen optional Strategy binding
  let strategyEligible = false;
  if (strategy) {
    const comp = evidencePackage.components.find((c) => c.componentType === 'PERFORMANCE_STRATEGY');
    if (!comp) {
      componentMismatches.push(
        'Independently supplied Strategy has no matching PERFORMANCE_STRATEGY component in Evidence Package.'
      );
    } else if (comp.canonicalId !== strategy.id) {
      componentMismatches.push(
        `Strategy id ${strategy.id} does not match component canonicalId ${comp.canonicalId}.`
      );
    } else if (comp.version != null && String(comp.version) !== String(strategy.version)) {
      componentMismatches.push(
        `Strategy version ${strategy.version} does not match component version ${comp.version}.`
      );
    } else if (comp.fingerprint && comp.fingerprint !== strategy.sourceContractFingerprint) {
      componentMismatches.push(
        `Strategy sourceContractFingerprint ${strategy.sourceContractFingerprint} does not match component fingerprint ${comp.fingerprint}.`
      );
    } else if (comp.status && comp.status !== strategy.status) {
      componentMismatches.push(
        `Strategy status ${strategy.status} does not match component status ${comp.status}.`
      );
    } else {
      const isStaleOrSuperseded =
        comp.status === 'STALE' ||
        comp.status === 'SUPERSEDED' ||
        comp.status === 'INVALID' ||
        comp.status === 'ABSENT' ||
        strategy.status === 'STALE' ||
        strategy.status === 'SUPERSEDED';
      strategyEligible = !isStaleOrSuperseded;
    }
  }

  // M4.2.1: Strengthen optional TestPlan binding
  let testPlanEligible = false;
  if (testPlan) {
    const comp = evidencePackage.components.find((c) => c.componentType === 'PERFORMANCE_TEST_PLAN');
    if (!comp) {
      componentMismatches.push(
        'Independently supplied TestPlan has no matching PERFORMANCE_TEST_PLAN component in Evidence Package.'
      );
    } else if (comp.canonicalId !== testPlan.id) {
      componentMismatches.push(
        `TestPlan id ${testPlan.id} does not match component canonicalId ${comp.canonicalId}.`
      );
    } else if (comp.version != null && String(comp.version) !== String(testPlan.version)) {
      componentMismatches.push(
        `TestPlan version ${testPlan.version} does not match component version ${comp.version}.`
      );
    } else if (comp.fingerprint && comp.fingerprint !== testPlan.sourceContractFingerprint) {
      componentMismatches.push(
        `TestPlan sourceContractFingerprint ${testPlan.sourceContractFingerprint} does not match component fingerprint ${comp.fingerprint}.`
      );
    } else if (comp.status && comp.status !== testPlan.status) {
      componentMismatches.push(
        `TestPlan status ${testPlan.status} does not match component status ${comp.status}.`
      );
    } else {
      const isStaleOrSuperseded =
        comp.status === 'STALE' ||
        comp.status === 'SUPERSEDED' ||
        comp.status === 'INVALID' ||
        comp.status === 'ABSENT' ||
        testPlan.status === 'STALE' ||
        testPlan.status === 'SUPERSEDED';
      testPlanEligible = !isStaleOrSuperseded;
    }
  }

  const rawVerdict = evidencePackage.evidenceSummary?.acceptanceVerdict?.verdict;
  const sourceAcceptanceVerdict = rawVerdict ? (rawVerdict as AcceptanceVerdict) : undefined;

  const isComponentIntegrityValid = componentMismatches.length === 0;
  // M4.2.1: Normal VALID package requires an authoritative acceptance verdict
  const hasRequiredVerdict = !isPackageStatusValid || Boolean(sourceAcceptanceVerdict);
  const isSourceIntegrityValid = isDigestValid && isPackageIdValid && isPackageStatusValid && hasRequiredVerdict;
  const isFullyValid = isSourceIntegrityValid && isComponentIntegrityValid;

  // Determine publication readiness per destination
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
    if (!isPackageStatusValid)
      baseReasons.push(`Evidence Package status is ${evidencePackage.packageGenerationStatus}, expected VALID.`);
    if (!hasRequiredVerdict) baseReasons.push('Valid Evidence Package is missing authoritative Acceptance verdict.');
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
        const connectorName =
          dest === 'JIRA'
            ? 'Jira'
            : dest === 'AZURE_DEVOPS'
            ? 'Azure DevOps'
            : dest === 'CONFLUENCE'
            ? 'Confluence'
            : 'SharePoint';
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

  // Generate Render-Neutral Results Report (only pass verified companions to prevent unverified drift)
  const resultsReport = generateResultsReport(
    evidencePackage,
    verifiedTestDefinition ?? testDefinition,
    verifiedFindingsRegister ?? findingsRegister
  );

  // Generate Export Artefacts
  const artifacts: ExportArtifact[] = [];

  // Helper to create an ExportArtifact with standard id rule
  const createArtifact = (params: {
    artifactType: ExportArtifactType;
    sourceId: string;
    sourceVersion?: string | number | null;
    sourceFingerprint?: string | null;
    sourceDigest?: string | null;
    format: ExportFormat;
    mediaType: string;
    content: string;
    metadata: Record<string, unknown>;
    publicationEligibility: boolean;
    blockingReasons: string[];
  }): ExportArtifact => {
    const contentDigest = sha256Hex(params.content);
    const id = `art-${params.artifactType.toLowerCase().replace(/_/g, '-')}-${params.format.toLowerCase()}-${contentDigest.slice(0, 16)}`;
    return {
      id,
      artifactType: params.artifactType,
      sourceId: params.sourceId,
      sourceVersion: params.sourceVersion ?? null,
      sourceFingerprint: params.sourceFingerprint ?? null,
      sourceDigest: params.sourceDigest ?? null,
      format: params.format,
      mediaType: params.mediaType,
      content: params.content,
      contentDigest,
      metadata: params.metadata,
      publicationEligibility: params.publicationEligibility,
      blockingReasons: params.blockingReasons
    };
  };

  // 1. Evidence Package (JSON)
  artifacts.push(
    createArtifact({
      artifactType: 'PERFORMANCE_EVIDENCE_PACKAGE',
      sourceId: evidencePackage.id,
      sourceDigest: evidencePackage.packageDigest.value,
      format: 'JSON',
      mediaType: 'application/json',
      content: JSON.stringify(evidencePackage, null, 2),
      metadata: {
        packageGenerationStatus: evidencePackage.packageGenerationStatus,
        totalComponents: evidencePackage.components.length
      },
      publicationEligibility: isFullyValid,
      blockingReasons: isFullyValid ? [] : [...bundleBlockingReasons]
    })
  );

  // 2. Results Report (JSON)
  artifacts.push(
    createArtifact({
      artifactType: 'RESULTS_REPORT',
      sourceId: resultsReport.id,
      sourceDigest: resultsReport.reportDigest,
      format: 'JSON',
      mediaType: 'application/json',
      content: JSON.stringify(resultsReport, null, 2),
      metadata: {
        acceptanceVerdict: resultsReport.acceptanceVerdict?.verdict ?? null
      },
      publicationEligibility: isFullyValid,
      blockingReasons: isFullyValid ? [] : [...bundleBlockingReasons]
    })
  );

  // 3. Results Report (Markdown)
  artifacts.push(
    createArtifact({
      artifactType: 'RESULTS_REPORT',
      sourceId: resultsReport.id,
      sourceDigest: resultsReport.reportDigest,
      format: 'MARKDOWN',
      mediaType: 'text/markdown',
      content: renderResultsReportMarkdown(resultsReport),
      metadata: {
        acceptanceVerdict: resultsReport.acceptanceVerdict?.verdict ?? null
      },
      publicationEligibility: isFullyValid,
      blockingReasons: isFullyValid ? [] : [...bundleBlockingReasons]
    })
  );

  // 4. Results Report (HTML)
  artifacts.push(
    createArtifact({
      artifactType: 'RESULTS_REPORT',
      sourceId: resultsReport.id,
      sourceDigest: resultsReport.reportDigest,
      format: 'HTML',
      mediaType: 'text/html',
      content: renderResultsReportHtml(resultsReport),
      metadata: {
        acceptanceVerdict: resultsReport.acceptanceVerdict?.verdict ?? null
      },
      publicationEligibility: isFullyValid,
      blockingReasons: isFullyValid ? [] : [...bundleBlockingReasons]
    })
  );

  // 5. Findings Register if supplied
  if (findingsRegister) {
    const isRegisterValid = isFullyValid && verifiedFindingsRegister !== undefined;
    artifacts.push(
      createArtifact({
        artifactType: 'FINDINGS_REGISTER',
        sourceId: findingsRegister.id,
        sourceDigest: findingsRegister.registerDigest?.value ?? null,
        format: 'JSON',
        mediaType: 'application/json',
        content: JSON.stringify(findingsRegister, null, 2),
        metadata: {
          totalFindings: findingsRegister.findings?.length ?? 0,
          totalDefectCandidates: findingsRegister.defectCandidates?.length ?? 0
        },
        publicationEligibility: isRegisterValid,
        blockingReasons: isRegisterValid ? [] : [...bundleBlockingReasons]
      })
    );
  }

  // 6. Strategy if supplied
  if (strategy) {
    const isEligible = isFullyValid && strategyEligible;
    const reasons = isEligible
      ? []
      : !strategyEligible
      ? ['Strategy is stale, superseded, or absent from Evidence Package.']
      : [...bundleBlockingReasons];
    artifacts.push(
      createArtifact({
        artifactType: 'PERFORMANCE_STRATEGY',
        sourceId: strategy.id,
        sourceVersion: strategy.version,
        sourceFingerprint: null, // M4.2.1: Do not describe source contract fingerprint as artefact content fingerprint
        format: 'JSON',
        mediaType: 'application/json',
        content: JSON.stringify(strategy, null, 2),
        metadata: {
          title: strategy.title,
          sourceContractFingerprint: strategy.sourceContractFingerprint,
          status: strategy.status
        },
        publicationEligibility: isEligible,
        blockingReasons: reasons
      })
    );
  }

  // 7. Test Plan if supplied
  if (testPlan) {
    const isEligible = isFullyValid && testPlanEligible;
    const reasons = isEligible
      ? []
      : !testPlanEligible
      ? ['TestPlan is stale, superseded, or absent from Evidence Package.']
      : [...bundleBlockingReasons];
    artifacts.push(
      createArtifact({
        artifactType: 'PERFORMANCE_TEST_PLAN',
        sourceId: testPlan.id,
        sourceVersion: testPlan.version,
        sourceFingerprint: null, // M4.2.1: Do not describe source contract fingerprint as artefact content fingerprint
        format: 'JSON',
        mediaType: 'application/json',
        content: JSON.stringify(testPlan, null, 2),
        metadata: {
          title: testPlan.title,
          sourceContractFingerprint: testPlan.sourceContractFingerprint,
          status: testPlan.status
        },
        publicationEligibility: isEligible,
        blockingReasons: reasons
      })
    );
  }

  // Defect Payloads (only generated from verified findings register)
  const defectPayloads =
    isComponentIntegrityValid && verifiedFindingsRegister
      ? generateDefectPayloads(evidencePackage, verifiedFindingsRegister)
      : [];

  const findingsComp = evidencePackage.components.find((c) => c.componentType === 'FINDINGS_REGISTER');

  const bundlePayload = buildPublicationBundleDigestPayload({
    sourceEvidencePackageId: evidencePackage.id,
    sourceEvidencePackageDigest: evidencePackage.packageDigest.value,
    sourceAcceptanceVerdict: sourceAcceptanceVerdict ?? null,
    sourceFindingsRegisterDigest: findingsComp?.digest ?? null,
    artifacts,
    defectPayloads,
    requestedDestinations: destinations,
    overallReadiness,
    blockingReasons: bundleBlockingReasons,
    publicationReadiness
  });

  const bundleDigest = computePublicationBundleDigest(bundlePayload);
  const bundleId = `pub-${bundleDigest.value.slice(0, 16)}`;

  return deepFreeze({
    id: bundleId,
    schemaVersion: 'publication-bundle-v1',
    sourceEvidencePackageId: evidencePackage.id,
    sourceEvidencePackageDigest: evidencePackage.packageDigest.value,
    sourceAcceptanceVerdict,
    sourceFindingsRegisterDigest: findingsComp?.digest ?? null,
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
 * Invariant (M4.2.1): Checks bundle digest algorithm/schema, bundle ID derivation,
 * artifact content digests, artifact ID derivation, defect payload digests and ID derivation,
 * and full bundle semantic identity.
 */
export function verifyPublicationBundleDigest(
  bundle: PublicationBundle
): VerifyPublicationBundleDigestResult {
  const mismatches: string[] = [];

  // 1. Verify bundle digest envelope metadata
  if (!bundle.bundleDigest) {
    mismatches.push('PublicationBundle is missing bundleDigest object.');
    return {
      isValid: false,
      computedDigest: '',
      expectedDigest: '',
      mismatches
    };
  }

  if (bundle.bundleDigest.algorithm !== 'SHA-256') {
    mismatches.push(
      `Unsupported bundle digest algorithm: '${bundle.bundleDigest.algorithm}'. Expected 'SHA-256'.`
    );
  }

  if (bundle.bundleDigest.schemaVersion !== 'publication-bundle-v1') {
    mismatches.push(
      `Unsupported bundle digest schemaVersion: '${bundle.bundleDigest.schemaVersion}'. Expected 'publication-bundle-v1'.`
    );
  }

  // 2. Verify bundle ID derivation
  const expectedBundleId = `pub-${bundle.bundleDigest.value.slice(0, 16)}`;
  if (bundle.id !== expectedBundleId) {
    mismatches.push(
      `PublicationBundle ID mismatch: '${bundle.id}' does not match expected '${expectedBundleId}'.`
    );
  }

  // 3. Verify each artifact content digest and ID derivation
  for (const artifact of bundle.artifacts) {
    const computedContentDigest = sha256Hex(artifact.content);
    if (computedContentDigest !== artifact.contentDigest) {
      mismatches.push(
        `Artifact ${artifact.id} (${artifact.artifactType}:${artifact.format}) content digest mismatch. Expected ${artifact.contentDigest}, computed ${computedContentDigest}`
      );
    }
    const expectedArtifactId = `art-${artifact.artifactType.toLowerCase().replace(/_/g, '-')}-${artifact.format.toLowerCase()}-${artifact.contentDigest.slice(0, 16)}`;
    if (artifact.id !== expectedArtifactId) {
      mismatches.push(
        `Artifact ID mismatch: '${artifact.id}' does not match expected '${expectedArtifactId}'.`
      );
    }
  }

  // 4. Verify each defect payload digest and ID derivation
  for (const defect of bundle.defectPayloads) {
    const digestPayload = buildDefectPayloadDigestPayload(defect);
    const computedDigest = sha256Hex(JSON.stringify(digestPayload));
    if (computedDigest !== defect.payloadDigest) {
      mismatches.push(
        `Defect payload ${defect.id} digest mismatch. Expected ${defect.payloadDigest}, computed ${computedDigest}`
      );
    }
    const expectedDefectId = `defect-payload-${defect.payloadDigest.slice(0, 16)}`;
    if (defect.id !== expectedDefectId) {
      mismatches.push(
        `Defect payload ID mismatch: '${defect.id}' does not match expected '${expectedDefectId}'.`
      );
    }
  }

  // 5. Verify top-level bundle digest
  const payload = buildPublicationBundleDigestPayload({
    sourceEvidencePackageId: bundle.sourceEvidencePackageId,
    sourceEvidencePackageDigest: bundle.sourceEvidencePackageDigest,
    sourceAcceptanceVerdict: bundle.sourceAcceptanceVerdict ?? null,
    sourceFindingsRegisterDigest: bundle.sourceFindingsRegisterDigest ?? null,
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
