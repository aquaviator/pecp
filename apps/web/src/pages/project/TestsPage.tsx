import React, { useState, useEffect } from 'react';
import {
  PlaySquare,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Code2,
  Layers,
  Clock,
  Gauge,
  FileCode2,
  Copy,
  Check,
  Download,
  Info,
  ExternalLink,
  ShieldCheck,
  Activity,
  Sliders,
  Sparkles
} from 'lucide-react';
import { ProjectSummary, IntelligenceItem } from '../../types';
import { useServices } from '../../services/ServiceContext';
import { compileDraftPerformanceContract } from '@pecp/workload-engine';
import {
  compileTestDefinition,
  compileK6Bundle,
  computeTestDefinitionFingerprint,
  computeBundleFingerprint
} from '@pecp/test-engine';
import {
  RETAILCO_M3_APPROVED_CONTRACT,
  RETAILCO_M3_EXECUTION_INTELLIGENCE
} from '../../fixtures/retailco/m3ExecutionFixture';

interface TestsPageProps {
  project: ProjectSummary;
  initialItems?: IntelligenceItem[];
}

type ScenarioView = 'CURRENT_PROJECT' | 'M3_REFERENCE_LAB';
type ActiveTab = 'overview' | 'schedule' | 'journeys' | 'criteria' | 'bundle' | 'runtime';

export const TestsPage: React.FC<TestsPageProps> = ({ project, initialItems }) => {
  const { intelligenceService } = useServices();
  const [items, setItems] = useState<IntelligenceItem[]>(initialItems || []);
  const [scenarioView, setScenarioView] = useState<ScenarioView>('M3_REFERENCE_LAB');
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [activeBundleFile, setActiveBundleFile] = useState<string>('config.json');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!initialItems || initialItems.length === 0) {
      intelligenceService.getIntelligenceItems(project.id).then(setItems).catch(console.error);
    }
  }, [project.id, initialItems, intelligenceService]);

  // 1. Current Project (M2 Draft/Blocked Contract)
  const currentContract = compileDraftPerformanceContract({
    projectSummary: project,
    intelligenceItems: items,
    version: 'v0.1-draft'
  });

  const currentTestDef = compileTestDefinition({
    contract: currentContract,
    intelligenceItems: items,
    projectSummary: project,
    version: 'v0.1-draft'
  });

  const currentBundle = compileK6Bundle({
    testDefinition: currentTestDef
  });

  // 2. M3 Reference Lab (Approved Contract + Canonical Execution Intelligence)
  const referenceTestDef = compileTestDefinition({
    contract: RETAILCO_M3_APPROVED_CONTRACT,
    projectSummary: project,
    version: 'v1.0',
    executionIntelligence: RETAILCO_M3_EXECUTION_INTELLIGENCE
  });

  const referenceBundle = compileK6Bundle({
    testDefinition: referenceTestDef
  });

  // Active definition and bundle based on user selection
  const isReferenceLab = scenarioView === 'M3_REFERENCE_LAB';
  const testDef = isReferenceLab ? referenceTestDef : currentTestDef;
  const bundle = isReferenceLab ? referenceBundle : currentBundle;

  const currentFileContent =
    bundle.files.find((f) => f.filename === activeBundleFile)?.content ||
    bundle.files[0]?.content ||
    '';

  const handleCopy = () => {
    navigator.clipboard.writeText(currentFileContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([currentFileContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = activeBundleFile;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Scenario Switcher */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <PlaySquare className="w-5 h-5 text-sky-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Canonical Test Definition & k6 Execution Bundle
              </h2>
              <span className="text-xs px-2 py-0.5 rounded font-mono bg-sky-950 text-sky-400 border border-sky-800">
                M3.0
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Engine-neutral test definition bound to Performance Contract, compiled into deterministic Grafana k6 execution bundles (Constitution §10, §11).
            </p>
          </div>

          {/* Scenario Mode Toggle */}
          <div className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-lg">
            <button
              onClick={() => setScenarioView('M3_REFERENCE_LAB')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                isReferenceLab
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              M3 Reference Lab (Approved)
            </button>
            <button
              onClick={() => setScenarioView('CURRENT_PROJECT')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                !isReferenceLab
                  ? 'bg-amber-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Current Project (Blocked Gate)
            </button>
          </div>
        </div>

        {/* Status Pill Strip */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Execution Status:</span>
            {testDef.isExecutable ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-700/80">
                <CheckCircle2 className="w-3.5 h-3.5" />
                READY_FOR_EXECUTION
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold bg-amber-950/80 text-amber-400 border border-amber-700/80">
                <AlertTriangle className="w-3.5 h-3.5" />
                {testDef.status} (BLOCKED)
              </span>
            )}
          </div>

          <div className="text-slate-600">|</div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Bound Contract:</span>
            <span className="font-mono text-slate-200 bg-slate-800 px-2 py-0.5 rounded">
              {testDef.sourceContractId} ({testDef.sourceContractVersion})
            </span>
          </div>

          <div className="text-slate-600">|</div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Drift Checksum:</span>
            <span className="font-mono text-sky-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800" title="Deterministic non-cryptographic FNV-1a drift checksum">
              {testDef.fingerprint}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">(32-bit FNV-1a)</span>
          </div>

          <div className="text-slate-600">|</div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Execution Engine:</span>
            <span className="font-medium text-slate-300">Grafana k6 (Arrival-Rate)</span>
          </div>
        </div>
      </div>

      {/* Governance Gate Warning Banner (When Blocked) */}
      {!testDef.isExecutable && (
        <div className="bg-amber-950/30 border border-amber-800/80 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-amber-200">
                Governance Gate Enforced: Test Definition is NON-EXECUTABLE
              </h3>
              <p className="text-xs text-amber-300/90 leading-relaxed">
                PECP Authoritative Execution-Input Law prohibits compiling executable tests when upstream governance rules or required canonical execution inputs are unresolved. PECP refuses to inject fabricated schedules, mock URLs, or unapproved thresholds.
              </p>
              <div className="mt-3 bg-slate-950/80 border border-amber-900/60 rounded-lg p-3 space-y-1.5">
                <p className="text-xs font-semibold text-amber-300">Active Blocking Reasons:</p>
                <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                  {testDef.blockingReasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
              <p className="text-[11px] text-slate-400">
                Switch to the <strong>M3 Reference Lab</strong> view above to examine the governed execution-ready state with all canonical parameters approved.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800 flex items-center gap-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Info className="w-4 h-4" />
          Overview & Preconditions
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'schedule'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          Workload Schedule
        </button>
        <button
          onClick={() => setActiveTab('journeys')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'journeys'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          Journeys & Steps ({testDef.journeys.length})
        </button>
        <button
          onClick={() => setActiveTab('criteria')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'criteria'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gauge className="w-4 h-4" />
          Criteria & Thresholds
        </button>
        <button
          onClick={() => setActiveTab('bundle')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'bundle'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Code2 className="w-4 h-4" />
          Generated k6 Bundle ({bundle.files.length})
        </button>
        <button
          onClick={() => setActiveTab('runtime')}
          className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'runtime'
              ? 'border-sky-500 text-sky-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCode2 className="w-4 h-4" />
          Runtime Architecture
        </button>
      </div>

      {/* Tab 1: Overview & Preconditions */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-400">Engineering Intent</p>
              <p className="text-base font-bold text-white mt-1">{testDef.engineeringIntent}</p>
              <p className="text-[11px] text-slate-500 mt-1">Bound to Performance Contract</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-400">Workload Model</p>
              <p className="text-base font-bold text-white mt-1">
                {testDef.scenarios[0]?.workloadSchedule.executionModel || 'OPEN'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Arrival-Rate Driven</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-400">Target Arrival Demand</p>
              <p className="text-base font-bold text-sky-400 mt-1">
                {testDef.workloadAttainment
                  ? `${testDef.workloadAttainment.targetValue} ${testDef.workloadAttainment.unit}`
                  : 'NOT_SUPPLIED'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Prerequisite Attainment Metric</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-400">Total Duration</p>
              <p className="text-base font-bold text-white mt-1">
                {testDef.scenarios[0]?.workloadSchedule.totalDurationSeconds
                  ? `${Math.round(testDef.scenarios[0].workloadSchedule.totalDurationSeconds / 60)} min (${testDef.scenarios[0].workloadSchedule.totalDurationSeconds}s)`
                  : 'NOT_SUPPLIED'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">Ramp + Steady + Cooldown</p>
            </div>
          </div>

          {/* Preconditions Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Execution Preconditions & Verification
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {testDef.preconditions.filter((p) => p.isSatisfied).length} / {testDef.preconditions.length} Verified
              </span>
            </div>

            <div className="divide-y divide-slate-800/60 border border-slate-800 rounded-lg overflow-hidden">
              {testDef.preconditions.map((p) => (
                <div key={p.id} className="p-3 bg-slate-950/40 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {p.isSatisfied ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-medium text-slate-200">{p.statement}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Category: <span className="font-mono text-slate-300">{p.category}</span>
                        {p.verificationMethod && (
                          <span className="ml-2 text-slate-500">• Probe: {p.verificationMethod}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                      p.isSatisfied
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    {p.isSatisfied ? 'SATISFIED' : 'UNSATISFIED'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Credential Reference Boundary (Constitution §11) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-sky-400" />
              Secret Reference Boundary (Constitution §11)
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              PECP strictly isolates sensitive credentials from canonical models, scripts, and repository manifests. No raw API tokens, keys, or passwords exist in generated files.
            </p>
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
              {testDef.credentialReferences.length > 0 ? (
                <div className="space-y-2">
                  {testDef.credentialReferences.map((ref, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-300 font-medium">{ref.purpose}</span>
                        <span className="text-slate-500 ml-2">Provider: {ref.provider}</span>
                      </div>
                      <code className="text-sky-400 bg-slate-900 px-2 py-0.5 rounded font-mono border border-slate-800">
                        __ENV['{ref.referenceId}']
                      </code>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 font-mono">No credential references configured.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Workload Schedule */}
      {activeTab === 'schedule' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-sky-400" />
                  Canonical Workload Schedule Stages
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Arrival-rate execution model (Constitution §10). Schedule reflects explicit canonical stage durations.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400">Peak Demand:</span>
                <span className="text-sm font-bold text-sky-400 ml-2">
                  {testDef.scenarios[0]?.workloadSchedule.peakArrivalRate} req/s
                </span>
              </div>
            </div>

            {testDef.scenarios[0]?.workloadSchedule.stages.length > 0 ? (
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                    <tr>
                      <th className="p-3">Stage #</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3">Target Arrival Rate</th>
                      <th className="p-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {testDef.scenarios[0].workloadSchedule.stages.map((stage, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="p-3 font-mono text-slate-400">Stage {idx + 1}</td>
                        <td className="p-3 font-mono font-medium text-white">
                          {Math.round(stage.durationSeconds / 60)} min ({stage.durationSeconds}s)
                        </td>
                        <td className="p-3 font-mono font-bold text-sky-400">
                          {stage.targetArrivalRate} req/s
                        </td>
                        <td className="p-3 text-slate-400">{stage.description || 'Execution stage'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 bg-slate-950 border border-slate-800 rounded-lg text-center space-y-2">
                <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
                <p className="text-xs font-semibold text-amber-300">
                  No Execution Schedule Supplied in Canonical Intelligence
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  In accordance with the Authoritative Execution-Input Law, PECP will never invent stage durations or arrival targets.
                </p>
              </div>
            )}
          </div>

          {/* Workload Demand Separation Law Banner */}
          <div className="bg-sky-950/30 border border-sky-800/60 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 space-y-1">
              <span className="font-bold text-sky-200">
                Constitution §10 Law: Workload Demand Separation
              </span>
              <p className="text-slate-400 leading-relaxed">
                Workload demand (e.g. 8.75 orders/second) is tracked as an authoritative prerequisite for test validity. It is strictly distinguished from NFR acceptance criteria (latency, error rates) and will never be converted into a false PASS/FAIL threshold.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Journeys & Mix */}
      {activeTab === 'journeys' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-400" />
                Canonical Journey Distribution & Steps
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Transaction paths derived from canonical intelligence. Journeys are executed according to weighted probabilities.
              </p>
            </div>

            {testDef.journeys.length > 0 ? (
              <div className="space-y-4">
                {testDef.journeys.map((journey) => (
                  <div
                    key={journey.id}
                    className="border border-slate-800 rounded-lg p-4 bg-slate-950/40 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{journey.name}</span>
                        <span className="font-mono text-xs text-slate-400">({journey.key})</span>
                      </div>
                      <span className="text-xs font-bold font-mono px-2.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                        Weight: {journey.percentage}% ({journey.weight})
                      </span>
                    </div>

                    <div className="space-y-2">
                      {journey.steps.map((step) => (
                        <div
                          key={step.id}
                          className="bg-slate-900 border border-slate-800/80 rounded p-2.5 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${
                                step.method === 'GET'
                                  ? 'bg-blue-950 text-blue-400'
                                  : step.method === 'POST'
                                  ? 'bg-emerald-950 text-emerald-400'
                                  : 'bg-purple-950 text-purple-400'
                              }`}
                            >
                              {step.method}
                            </span>
                            <span className="font-mono text-slate-200">{step.path}</span>
                            <span className="text-slate-500 font-sans">({step.name})</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
                            <span>Think: {step.thinkTimeSeconds || 1}s</span>
                            <span>Status: {step.expectedStatusCode || 200}</span>
                            {step.credentialReferences && step.credentialReferences.length > 0 && (
                              <span className="flex items-center gap-1 text-amber-400 font-mono text-[10px]">
                                <Lock className="w-3 h-3" />
                                {step.credentialReferences[0].referenceId}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-slate-950 border border-slate-800 rounded-lg text-center space-y-2">
                <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
                <p className="text-xs font-semibold text-amber-300">
                  No Journey Steps Defined in Canonical Intelligence
                </p>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  HTTP routes and step definitions are NOT_SUPPLIED in the current contract state.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Acceptance Criteria & Thresholds */}
      {activeTab === 'criteria' && (
        <div className="space-y-6">
          {/* Executable Criteria */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Defined Acceptance Criteria (k6 Thresholds)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Only unambiguous, defined criteria are compiled into k6 threshold assertions (Constitution §10).
              </p>
            </div>

            {testDef.executableCriteria.length > 0 ? (
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                    <tr>
                      <th className="p-3">Metric</th>
                      <th className="p-3">Target Expression</th>
                      <th className="p-3">Percentile</th>
                      <th className="p-3">Scope</th>
                      <th className="p-3">k6 Threshold Mapping</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {testDef.executableCriteria.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/30">
                        <td className="p-3 font-medium text-white">{c.metric}</td>
                        <td className="p-3 font-mono text-emerald-400">{c.target}</td>
                        <td className="p-3 font-mono">{c.percentile ? `p${c.percentile}` : 'N/A'}</td>
                        <td className="p-3 text-slate-400">{c.scope}</td>
                        <td className="p-3 font-mono text-sky-400 bg-slate-950/40">
                          {c.metric.toLowerCase().includes('error')
                            ? 'http_req_failed: rate < 0.005'
                            : `http_req_duration{journey:${c.scope.toLowerCase().includes('checkout') ? 'checkout' : 'all'}}: p(95)<${c.thresholdValue || 2000}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-mono p-4 bg-slate-950 rounded">
                No executable criteria defined.
              </p>
            )}
          </div>

          {/* Ambiguous Criteria (Excluded) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Ambiguous Criteria (Excluded from Thresholds)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Criteria with missing percentiles or ambiguous units are strictly excluded from automated thresholds.
              </p>
            </div>

            {testDef.ambiguousCriteria.length > 0 ? (
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono">
                    <tr>
                      <th className="p-3">Metric</th>
                      <th className="p-3">Ambiguous Target</th>
                      <th className="p-3">Defect Description</th>
                      <th className="p-3">Governance Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {testDef.ambiguousCriteria.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/30">
                        <td className="p-3 font-medium text-white">{c.metric}</td>
                        <td className="p-3 font-mono text-amber-400">{c.target}</td>
                        <td className="p-3 text-slate-400">
                          {c.ambiguityNotice || 'Missing percentile specification (e.g. p95 or p99)'}
                        </td>
                        <td className="p-3 text-amber-300 font-mono text-[11px]">
                          EXCLUDED_FROM_THRESHOLDS
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400 p-3 bg-slate-950 rounded flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                All acceptance criteria have unambiguous percentiles and thresholds.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Generated k6 Bundle */}
      {activeTab === 'bundle' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {bundle.files.map((file) => (
                <button
                  key={file.filename}
                  onClick={() => setActiveBundleFile(file.filename)}
                  className={`px-3 py-1.5 text-xs font-mono rounded-lg transition-colors flex items-center gap-1.5 ${
                    activeBundleFile === file.filename
                      ? 'bg-sky-600 text-white shadow'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <FileCode2 className="w-3.5 h-3.5" />
                  {file.filename}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 border border-slate-700"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 shadow"
              >
                <Download className="w-3.5 h-3.5" />
                Download {activeBundleFile}
              </button>
            </div>
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner">
            <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-slate-300">{activeBundleFile}</span>
              <span>
                {bundle.files.find((f) => f.filename === activeBundleFile)?.description || 'k6 Bundle File'}
              </span>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-200 overflow-x-auto leading-relaxed max-h-[600px]">
              {currentFileContent}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 6: Runtime Architecture */}
      {activeTab === 'runtime' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileCode2 className="w-4 h-4 text-sky-400" />
                Stable PECP k6 Runtime Architecture
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                PECP decouples the execution runtime from generated bundle configuration to prevent the script-ejection anti-pattern (Work Package M3.0 §5).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">
                  LAYER 1: RUNTIME
                </span>
                <h4 className="text-xs font-bold text-white">Stable Execution Core</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Located in <code className="text-slate-300">execution/k6-runtime/</code>. Standardized runner, arrival-demand metrics, weighted iteration dispatcher, and summary reporters.
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                  LAYER 2: CONFIG
                </span>
                <h4 className="text-xs font-bold text-white">Generated Configuration</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Deterministically generated <code className="text-slate-300">config.json</code> containing scenario stage timings and thresholds mapped strictly from defined acceptance criteria.
                </p>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800">
                  LAYER 3: JOURNEYS
                </span>
                <h4 className="text-xs font-bold text-white">Journey Modules</h4>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Generated <code className="text-slate-300">journeys.js</code> containing modular user journey steps with HTTP methods, tags, think times, and credential references.
                </p>
              </div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
              <h4 className="text-xs font-bold text-white">Execution Command Reference (Reference Lab)</h4>
              <p className="text-[11px] text-slate-400">
                To execute the generated bundle in a local or CI environment with governed credentials:
              </p>
              <pre className="p-3 bg-slate-900 rounded font-mono text-xs text-sky-300 overflow-x-auto">
{`# Execute using stable runtime and generated bundle
k6 run \\
  -e TARGET_BASE_URL="http://reference-lab.retailco.internal:8080" \\
  -e RETAILCO_CHECKOUT_AUTH_TOKEN="$VAULT_CHECKOUT_SECRET" \\
  entrypoint.js`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
