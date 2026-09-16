import React from 'react';
import { BookOpen, ShieldCheck, X } from 'lucide-react';

interface ConstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConstitutionModal: React.FC<ConstitutionModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <BookOpen className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold text-white leading-tight">
                PECP Product Constitution v1.0
              </h2>
              <p className="text-xs text-slate-400">
                Authoritative principles, architectural laws, and Sellable MVP boundary
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300 leading-relaxed font-sans">
          {/* Section 1 & 2 */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-sky-400" />
              <span>1. Product Definition & Deployment</span>
            </h3>
            <p>
              PECP is a subscription-based, customer-deployed Performance Engineering Control Plane that converts project intelligence into governed performance models, professional engineering artefacts, executable performance tests, and traceable performance evidence while integrating with the customer's existing AI, ALM, CI/CD, observability and execution ecosystem.
            </p>
            <p className="text-slate-400">
              Production customers run PECP in infrastructure they control. Hosted environments are for demonstration/reference use only.
            </p>
          </div>

          {/* Section 3: BYOAI Principle */}
          <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
            <h3 className="text-sm font-bold text-amber-400">
              3. Bring Your Own AI (BYOAI) Principle
            </h3>
            <p>
              Customers use their approved AI provider, credentials and credits. AI assists interpretation, extraction, drafting, and explanation.
            </p>
            <p className="text-emerald-400 font-medium">
              PECP deterministically owns: canonical state, provenance, workload mathematics, approvals, test definitions, execution orchestration, results, acceptance evaluation, and audit evidence. Humans retain approval for material decisions.
            </p>
          </div>

          {/* Section 6: Engineering Intents */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white">
              6. Performance Engineering Intents
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-sky-400 font-bold block">DISCOVERY</span>
                <span className="text-slate-400">What can this system handle? Breaking point exploration.</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-cyan-400 font-bold block">REPRESENTATIVE</span>
                <span className="text-slate-400">What does the live system actually do? Baseline parity.</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-purple-400 font-bold block">FORECAST</span>
                <span className="text-slate-400">What future workload should we prepare for? Peak sales.</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <span className="text-rose-400 font-bold block">INVESTIGATIVE</span>
                <span className="text-slate-400">Can we reproduce and isolate a performance problem?</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 sm:col-span-2">
                <span className="text-emerald-400 font-bold block">CERTIFICATION</span>
                <span className="text-slate-400">Does this release satisfy agreed contractual performance requirements?</span>
              </div>
            </div>
          </div>

          {/* Section 7: Provenance */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white">
              7. Provenance & Canonical States
            </h3>
            <p>
              Every material value carries provenance (source, location, timestamp, confidence, lineage). Canonical states:
            </p>
            <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
              {['MISSING', 'OBSERVED', 'MANUAL', 'IMPORTED', 'INFERRED', 'CALCULATED', 'CONFLICTING', 'STALE', 'APPROVED', 'SUPERSEDED'].map((st) => (
                <span key={st} className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
                  {st}
                </span>
              ))}
            </div>
          </div>

          {/* Section 13: Sellable MVP boundary */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-white">
              13. Sellable MVP Boundary (19 Steps)
            </h3>
            <p className="text-slate-400">
              PECP 1.0 is commercially viable when a customer can: install in their environment, create project, ingest brief/docs/ADO, extract intelligence, identify gaps/conflicts, resolve and approve, calculate Little's Law workload, create Performance Contract, generate Strategy & Plan, approve artefacts, produce k6 test, execute on customer runner, capture results, evaluate verdict, create findings/defects, generate Evidence Package, and retain full source-to-result traceability.
            </p>
          </div>

          {/* Section 15: 10 Development Laws */}
          <div className="space-y-2 border-t border-slate-800 pt-4">
            <h3 className="text-sm font-bold text-sky-400">
              15. Development Law
            </h3>
            <ol className="list-decimal pl-4 space-y-1 text-slate-300">
              <li>Canonical PE model is authoritative.</li>
              <li>AI Studio does not invent backend architecture.</li>
              <li>AI is optional for core product operation.</li>
              <li>AI-derived material requires provenance and governed approval.</li>
              <li>External products are providers/connectors.</li>
              <li>Every major connector has deterministic mock coverage.</li>
              <li>No feature is complete without reference scenario validation.</li>
              <li>No raw secrets in models/scripts/logs/documents.</li>
              <li>Broad architecture, narrow implementation.</li>
              <li>Sellable MVP scope wins over feature enthusiasm.</li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Close Constitution
          </button>
        </div>
      </div>
    </div>
  );
};
