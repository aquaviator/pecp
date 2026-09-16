import React, { useState } from 'react';
import {
  EngineeringIntent,
  IntelligenceItem,
  IntelligenceConflict,
  UserJourney,
  WorkloadParameters,
  PerformanceContract,
  EngineeringArtefact,
  K6TestDefinition,
  ExecutionRun,
  PerformanceFinding,
  ProviderConnector
} from './types';
import {
  INITIAL_CONNECTORS,
  INITIAL_INTELLIGENCE_ITEMS,
  INITIAL_CONFLICTS,
  INITIAL_JOURNEYS,
  INITIAL_WORKLOAD,
  INITIAL_CONTRACT,
  INITIAL_ARTEFACTS,
  INITIAL_K6_SCRIPT,
  INITIAL_EXECUTION_RUNS,
  INITIAL_FINDINGS
} from './data/retailCoReference';
import { Header } from './components/Header';
import { Navigation, LifecycleStage } from './components/Navigation';
import { IntelligenceView } from './components/IntelligenceView';
import { ConflictReviewView } from './components/ConflictReviewView';
import { WorkloadModelerView } from './components/WorkloadModelerView';
import { ContractView } from './components/ContractView';
import { ArtefactsView } from './components/ArtefactsView';
import { K6RunnerView } from './components/K6RunnerView';
import { EvidenceView } from './components/EvidenceView';
import { ConstitutionModal } from './components/ConstitutionModal';

export const App: React.FC = () => {
  const [activeIntent, setActiveIntent] = useState<EngineeringIntent>('CERTIFICATION');
  const [currentStage, setCurrentStage] = useState<LifecycleStage>('INTELLIGENCE');
  const [isConstitutionOpen, setIsConstitutionOpen] = useState(false);

  // Core canonical model state
  const [connectors, setConnectors] = useState<ProviderConnector[]>(INITIAL_CONNECTORS);
  const [intelligenceItems, setIntelligenceItems] = useState<IntelligenceItem[]>(INITIAL_INTELLIGENCE_ITEMS);
  const [conflicts, setConflicts] = useState<IntelligenceConflict[]>(INITIAL_CONFLICTS);
  const [journeys, setJourneys] = useState<UserJourney[]>(INITIAL_JOURNEYS);
  const [workload, setWorkload] = useState<WorkloadParameters>(INITIAL_WORKLOAD);
  const [contract, setContract] = useState<PerformanceContract>(INITIAL_CONTRACT);
  const [artefacts, setArtefacts] = useState<EngineeringArtefact[]>(INITIAL_ARTEFACTS);
  const [executionRun, setExecutionRun] = useState<ExecutionRun>(INITIAL_EXECUTION_RUNS[0]);
  const [findings, setFindings] = useState<PerformanceFinding[]>(INITIAL_FINDINGS);

  const [testDefinition, setTestDefinition] = useState<K6TestDefinition>({
    id: 'k6-retailco-bf26',
    name: 'RetailCo Black Friday 2026 Peak Certification',
    version: '1.0',
    targetUrl: 'https://lab.retailco.internal',
    thresholds: {
      http_req_failed: ['rate<0.01'],
      'http_req_duration{journey:browse}': ['p(95)<250'],
      'http_req_duration{journey:search}': ['p(95)<200'],
      'http_req_duration{journey:cart}': ['p(95)<300'],
      'http_req_duration{journey:checkout}': ['p(95)<350']
    },
    scenarios: [
      {
        name: 'retailco_peak_certification',
        executor: 'ramping-vus',
        stages: [
          { duration: '2m', target: 800 },
          { duration: '3m', target: 3450 },
          { duration: '10m', target: 3450 },
          { duration: '2m', target: 0 }
        ],
        gracefulStop: '30s'
      }
    ],
    scriptCode: INITIAL_K6_SCRIPT,
    generatedAt: '2026-08-28T10:00:00Z'
  });

  // Conflict resolution handler
  const handleResolveConflict = (
    conflictId: string,
    choice: 'sourceA' | 'sourceB' | 'CUSTOM',
    customVal?: number | string,
    rationale?: string
  ) => {
    setConflicts((prev) =>
      prev.map((c) => {
        if (c.id === conflictId) {
          return {
            ...c,
            status: 'RESOLVED',
            selectedSource: choice,
            resolutionNote: rationale
          };
        }
        return c;
      })
    );

    const conflict = conflicts.find((c) => c.id === conflictId);
    if (conflict) {
      const resolvedValue =
        choice === 'sourceA'
          ? conflict.sourceA.value
          : choice === 'sourceB'
          ? conflict.sourceB.value
          : customVal || conflict.sourceA.value;

      // Update matching canonical item to APPROVED
      setIntelligenceItems((prev) =>
        prev.map((item) => {
          if (item.id === conflict.itemId) {
            return {
              ...item,
              value: resolvedValue,
              canonicalState: 'APPROVED',
              notes: `Resolved via Conflict Review (${choice}): ${rationale || ''}`,
              provenance: {
                ...item.provenance,
                approvedBy: 'Performance Governance Lead',
                approvalTimestamp: new Date().toISOString(),
                rationale: `Conflict resolved: ${rationale || 'Selected authoritative source'}`
              }
            };
          }
          return item;
        })
      );
    }
  };

  const handleUpdateIntelligenceItem = (updated: IntelligenceItem) => {
    setIntelligenceItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const handleAddIntelligenceItem = (newItem: IntelligenceItem) => {
    setIntelligenceItems((prev) => [newItem, ...prev]);
  };

  const handleApproveContract = (approverName: string) => {
    setContract((prev) => ({
      ...prev,
      status: 'APPROVED',
      approvedAt: new Date().toISOString(),
      approvedBy: approverName
    }));
  };

  const handleExportEvidencePackage = () => {
    const bundle = {
      product: 'PECP — Performance Engineering Control Plane v1.0',
      organisation: 'RetailCo Digital (Reference Organisation)',
      intent: activeIntent,
      exportedAt: new Date().toISOString(),
      contract: {
        id: contract.id,
        version: contract.version,
        approvedBy: contract.approvedBy,
        gates: contract.slaGates
      },
      workload: {
        targetTps: workload.targetTps,
        calculatedVus: workload.calculatedVirtualUsers,
        equation: workload.littlesLawEquation,
        journeys: journeys
      },
      executionResult: {
        runNumber: executionRun.runNumber,
        verdict: executionRun.verdict,
        peakVus: executionRun.peakVus,
        averageTps: executionRun.averageTps,
        p95LatencyMs: executionRun.p95LatencyMs,
        errorRatePct: executionRun.errorRatePct
      },
      findings: findings,
      canonicalModelSnapshot: intelligenceItems
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pecp_evidence_package_retailco_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportFindingToALM = (findingId: string) => {
    setFindings((prev) =>
      prev.map((f) => {
        if (f.id === findingId) {
          return {
            ...f,
            exportedToALM: true,
            ticketRef: `ADO-BUG-${Math.floor(10000 + Math.random() * 90000)}`
          };
        }
        return f;
      })
    );
  };

  const pendingConflictsCount = conflicts.filter((c) => c.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* Top Header */}
      <Header
        activeIntent={activeIntent}
        onIntentChange={setActiveIntent}
        connectors={connectors}
        onOpenConstitution={() => setIsConstitutionOpen(true)}
        onExportPackage={handleExportEvidencePackage}
      />

      {/* Lifecycle Navigation Bar */}
      <Navigation
        currentStage={currentStage}
        onSelectStage={setCurrentStage}
        pendingConflictsCount={pendingConflictsCount}
      />

      {/* Main Lifecycle Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentStage === 'INTELLIGENCE' && (
          <IntelligenceView
            items={intelligenceItems}
            onUpdateItem={handleUpdateIntelligenceItem}
            onAddItem={handleAddIntelligenceItem}
            onNavigateToConflicts={() => setCurrentStage('CONFLICTS')}
          />
        )}

        {currentStage === 'CONFLICTS' && (
          <ConflictReviewView
            conflicts={conflicts}
            items={intelligenceItems}
            onResolveConflict={handleResolveConflict}
            onNavigateToWorkload={() => setCurrentStage('WORKLOAD')}
          />
        )}

        {currentStage === 'WORKLOAD' && (
          <WorkloadModelerView
            workload={workload}
            journeys={journeys}
            activeIntent={activeIntent}
            onUpdateWorkload={setWorkload}
            onUpdateJourneys={setJourneys}
            onNavigateToContract={() => setCurrentStage('CONTRACT')}
          />
        )}

        {currentStage === 'CONTRACT' && (
          <ContractView
            contract={contract}
            onApproveContract={handleApproveContract}
            onNavigateToArtefacts={() => setCurrentStage('ARTEFACTS')}
          />
        )}

        {currentStage === 'ARTEFACTS' && (
          <ArtefactsView
            artefacts={artefacts}
            onNavigateToK6={() => setCurrentStage('K6_RUNNER')}
          />
        )}

        {currentStage === 'K6_RUNNER' && (
          <K6RunnerView
            testDefinition={testDefinition}
            activeRun={executionRun}
            onStartExecution={() => {
              // Ensure completed run is recorded
              setExecutionRun((prev) => ({
                ...prev,
                status: 'COMPLETED',
                verdict: 'PASS_WITH_OBSERVATION'
              }));
            }}
            onNavigateToEvidence={() => setCurrentStage('EVIDENCE')}
          />
        )}

        {currentStage === 'EVIDENCE' && (
          <EvidenceView
            run={executionRun}
            contract={contract}
            findings={findings}
            onExportEvidence={handleExportEvidencePackage}
            onExportFindingToALM={handleExportFindingToALM}
          />
        )}
      </main>

      {/* Product Constitution Modal */}
      <ConstitutionModal
        isOpen={isConstitutionOpen}
        onClose={() => setIsConstitutionOpen(false)}
      />
    </div>
  );
};

export default App;
