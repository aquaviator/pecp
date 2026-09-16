import React, { useState, useEffect } from 'react';
import {
  PlaySquare,
  Play,
  Copy,
  Check,
  Download,
  Terminal,
  Activity,
  ArrowRight,
  Server,
  StopCircle,
  RefreshCw,
  Clock
} from 'lucide-react';
import { K6TestDefinition, ExecutionRun, EvaluationVerdict } from '../types';

interface K6RunnerViewProps {
  testDefinition: K6TestDefinition;
  activeRun: ExecutionRun | null;
  onStartExecution: () => void;
  onNavigateToEvidence: () => void;
}

export const K6RunnerView: React.FC<K6RunnerViewProps> = ({
  testDefinition,
  activeRun,
  onStartExecution,
  onNavigateToEvidence
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'SCRIPT' | 'RUNNER'>('SCRIPT');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSeconds, setSimSeconds] = useState(0);
  const [liveVus, setLiveVus] = useState(0);
  const [liveTps, setLiveTps] = useState(0);
  const [liveP95, setLiveP95] = useState(0);
  const [liveErrors, setLiveErrors] = useState(0);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([
    '[k6-init] Engine: k6 v0.51.0 (linux/amd64)',
    '[k6-init] Reading PECP Test Definition: RetailCo Peak Workload v1.0',
    '[k6-init] Thresholds mapped: 5 SLA contracts registered',
    '[k6-runner] Awaiting customer runner trigger...'
  ]);

  const handleCopyScript = () => {
    navigator.clipboard.writeText(testDefinition.scriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadScript = () => {
    const blob = new Blob([testDefinition.scriptCode], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pecp_k6_${testDefinition.name.toLowerCase().replace(/\s+/g, '_')}.js`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRunClick = () => {
    setIsSimulating(true);
    setSimSeconds(0);
    setConsoleLogs((prev) => [
      ...prev,
      `[${new Date().toISOString()}] Starting customer-controlled k6 runner execution...`,
      '[k6-exec] Scenario: retailco_peak_certification starting with 0 VUs...',
      '[k6-exec] Ramping VUs toward 3,450 target concurrency...'
    ]);
  };

  // Simulated live execution loop
  useEffect(() => {
    let timer: any = null;
    if (isSimulating) {
      timer = setInterval(() => {
        setSimSeconds((s) => {
          const next = s + 1;
          if (next <= 5) {
            // Ramp up
            setLiveVus(Math.round((next / 5) * 3450));
            setLiveTps(Math.round((next / 5) * 1850));
            setLiveP95(Math.round(100 + (next / 5) * 180));
            setLiveErrors(0);
          } else if (next <= 12) {
            // Steady state
            setLiveVus(3450);
            setLiveTps(1840 + Math.floor(Math.random() * 25));
            setLiveP95(305 + Math.floor(Math.random() * 15));
            if (next === 9) {
              setConsoleLogs((prev) => [
                ...prev,
                '[k6-obs] Observation: Checkout p99 tail latency elevated to 440ms during payment gateway lock.'
              ]);
            }
          } else {
            // Complete
            setIsSimulating(false);
            setConsoleLogs((prev) => [
              ...prev,
              '[k6-exec] Test run completed. 1,887,000 requests processed.',
              '[k6-eval] Threshold evaluation complete: PASS_WITH_OBSERVATION (0 critical failures, 1 observation logged).'
            ]);
            onStartExecution();
            return 12;
          }
          return next;
        });
      }, 700);
    }
    return () => clearInterval(timer);
  }, [isSimulating]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <PlaySquare className="h-4 w-4 text-sky-400" />
              <h2 className="text-base font-semibold text-white">
                Executable k6 Test Suite & Customer Runner Orchestration
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Constitution §10: PECP orchestrates execution rather than replacing customer CI/CD. The canonical test definition generates neutral k6 scripts with SLA thresholds and journey groups.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCopyScript}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Script'}</span>
            </button>

            <button
              onClick={handleDownloadScript}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-sky-400" />
              <span>Download k6 Script</span>
            </button>

            <button
              id="proceed-to-evidence-btn"
              onClick={onNavigateToEvidence}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              <span>View Evidence & Traceability</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex gap-2">
          <button
            onClick={() => setActiveTab('SCRIPT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'SCRIPT' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            k6 Script Specification
          </button>
          <button
            onClick={() => setActiveTab('RUNNER')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'RUNNER' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Live Runner Console & Telemetry
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'SCRIPT' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] font-mono uppercase text-sky-400">Generated k6 Code</span>
              <h3 className="font-bold text-white text-sm">RetailCo Black Friday 2026 Test Harness</h3>
            </div>
            <span className="font-mono text-slate-400 text-[11px]">JavaScript (ES6 Modules)</span>
          </div>

          {/* Script Display */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto text-xs font-mono text-emerald-400 leading-relaxed max-h-[500px] overflow-y-auto">
            <pre>{testDefinition.scriptCode}</pre>
          </div>

          {/* Customer Runner Execution Command Box */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Terminal className="h-4 w-4 text-sky-400" />
                Customer Runner CLI / CI Command
              </span>
              <span className="text-[11px] text-slate-500 font-mono">Docker / Podman / Native</span>
            </div>
            <div className="bg-slate-900 p-2.5 rounded font-mono text-sky-300 text-xs flex items-center justify-between">
              <code>docker run --rm -i -v $PWD:/scripts grafana/k6:latest run /scripts/retailco_peak.js</code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('docker run --rm -i -v $PWD:/scripts grafana/k6:latest run /scripts/retailco_peak.js');
                  alert('Copied execution command to clipboard');
                }}
                className="text-slate-400 hover:text-white text-[11px] pl-2"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* RUNNER CONSOLE TAB */
        <div className="space-y-6">
          {/* Runner Control Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-sky-400">Orchestrator Mode: Customer-Controlled</span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  Local / On-Premise Execution Runner
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Executes the canonical test model against target: <span className="font-mono text-slate-200">{testDefinition.targetUrl}</span>
                </p>
              </div>

              <div>
                {!isSimulating ? (
                  <button
                    id="trigger-k6-execution-btn"
                    onClick={handleRunClick}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-colors"
                  >
                    <Play className="h-4 w-4 fill-white" />
                    <span>Trigger Test Execution Run</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsSimulating(false)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg transition-colors"
                  >
                    <StopCircle className="h-4 w-4" />
                    <span>Abort Execution</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live Metrics Telemetry Tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Active Concurrency</span>
                <span className="text-2xl font-bold font-mono text-sky-400 mt-1 block">
                  {liveVus.toLocaleString()} VUs
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Target: 3,450 VUs</span>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Throughput Rate</span>
                <span className="text-2xl font-bold font-mono text-emerald-400 mt-1 block">
                  {liveTps.toLocaleString()} TPS
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Req / Second</span>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Real-Time p95 Latency</span>
                <span className="text-2xl font-bold font-mono text-amber-400 mt-1 block">
                  {liveP95} ms
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Contract SLA: ≤350ms</span>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Observed Error Rate</span>
                <span className={`text-2xl font-bold font-mono mt-1 block ${liveErrors === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  0.18%
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Gate Ceiling: &lt;1.0%</span>
              </div>
            </div>

            {/* Runner Progress bar */}
            {isSimulating && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>Executing Scenario: retailco_peak_certification</span>
                  <span>{Math.round((simSeconds / 12) * 100)}%</span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-300"
                    style={{ width: `${(simSeconds / 12) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Console Log Feed */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 p-4 font-mono text-xs text-slate-300 space-y-1 max-h-56 overflow-y-auto">
              <div className="text-slate-500 text-[10px] uppercase tracking-wider pb-1 border-b border-slate-900 mb-2">
                Execution Output Stream
              </div>
              {consoleLogs.map((log, index) => (
                <div key={index} className="leading-relaxed">
                  {log.startsWith('[k6-obs]') ? (
                    <span className="text-amber-400 font-semibold">{log}</span>
                  ) : log.startsWith('[k6-eval]') ? (
                    <span className="text-emerald-400 font-bold">{log}</span>
                  ) : (
                    log
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
