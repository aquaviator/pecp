import React, { useState } from 'react';
import {
  Plus,
  FileText,
  Clock,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Info,
  Filter,
  Check,
  Upload,
  ArrowRight
} from 'lucide-react';
import { IntelligenceItem, CanonicalState } from '../types';
import { CanonicalBadge } from './CanonicalBadge';

interface IntelligenceViewProps {
  items: IntelligenceItem[];
  onUpdateItem: (updated: IntelligenceItem) => void;
  onAddItem: (newItem: IntelligenceItem) => void;
  onNavigateToConflicts: () => void;
}

export const IntelligenceView: React.FC<IntelligenceViewProps> = ({
  items,
  onUpdateItem,
  onAddItem,
  onNavigateToConflicts
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedState, setSelectedState] = useState<string>('ALL');
  const [activeItemForProvenance, setActiveItemForProvenance] = useState<IntelligenceItem | null>(null);
  const [isIngestModalOpen, setIsIngestModalOpen] = useState(false);

  // Ingestion form state
  const [ingestType, setIngestType] = useState<'MANUAL' | 'BRIEF' | 'ALM' | 'TELEMETRY'>('BRIEF');
  const [briefText, setBriefText] = useState('');
  const [manualTitle, setManualTitle] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [manualCategory, setManualCategory] = useState<IntelligenceItem['category']>('VOLUME');
  const [manualValue, setManualValue] = useState('');
  const [manualUnit, setManualUnit] = useState('');

  const categories = [
    { key: 'ALL', label: 'All Domains' },
    { key: 'VOLUME', label: 'Volume & Throughput' },
    { key: 'LATENCY_SLA', label: 'Latency & SLAs' },
    { key: 'BUSINESS_MIX', label: 'Business Mix' },
    { key: 'CONCURRENCY', label: 'Concurrency' },
    { key: 'INFRASTRUCTURE', label: 'Infrastructure' }
  ];

  const states = ['ALL', 'APPROVED', 'CONFLICTING', 'STALE', 'INFERRED', 'OBSERVED', 'MANUAL'];

  const filteredItems = items.filter((item) => {
    const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesState = selectedState === 'ALL' || item.canonicalState === selectedState;
    return matchesCat && matchesState;
  });

  const handleApprove = (item: IntelligenceItem) => {
    const updated: IntelligenceItem = {
      ...item,
      canonicalState: 'APPROVED',
      provenance: {
        ...item.provenance,
        approvedBy: 'Current Lead Engineer (Governed Sign-off)',
        approvalTimestamp: new Date().toISOString()
      }
    };
    onUpdateItem(updated);
  };

  const handleIngestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ingestType === 'BRIEF') {
      // Parse sample brief intelligence
      const newItem: IntelligenceItem = {
        id: `intel-${Date.now()}`,
        key: 'extracted_brief_parameter',
        category: 'VOLUME',
        title: 'Extracted Demand Parameter from Project Brief',
        value: 12500,
        unit: 'req/min',
        canonicalState: 'INFERRED',
        provenance: {
          source: 'Project Brief Upload / Intake',
          sourceRef: 'BRIEF-INPUT-INTAKE',
          sourceType: 'AI_EXTRACT',
          timestamp: new Date().toISOString(),
          confidencePct: 88,
          rationale: `Extracted from text: "${briefText.slice(0, 100)}..."`
        },
        notes: 'AI candidate extraction — review before workload calculations.'
      };
      onAddItem(newItem);
    } else {
      const newItem: IntelligenceItem = {
        id: `intel-${Date.now()}`,
        key: manualKey || manualTitle.toLowerCase().replace(/\s+/g, '_'),
        category: manualCategory,
        title: manualTitle,
        value: isNaN(Number(manualValue)) ? manualValue : Number(manualValue),
        unit: manualUnit,
        canonicalState: 'MANUAL',
        provenance: {
          source: 'Human Performance Engineer Input',
          sourceRef: 'PECP-MANUAL-ENTRY',
          sourceType: 'MANUAL',
          timestamp: new Date().toISOString(),
          confidencePct: 100,
          approvedBy: 'Performance Architect'
        }
      };
      onAddItem(newItem);
    }
    setIsIngestModalOpen(false);
    setBriefText('');
    setManualTitle('');
    setManualValue('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Canonical Model & Provenance Law */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sky-400"></span>
              <h2 className="text-base font-semibold text-white">
                Canonical Intelligence Model & Provenance Ledger
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Source-agnostic repository (Constitution §4 & §7). Every metric answers where it came from, its canonical state, and confidence level. AI assistance extracts candidates; deterministic engineering governance decides authority.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="ingest-intelligence-btn"
              onClick={() => setIsIngestModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Ingest Source Intelligence</span>
            </button>

            <button
              id="go-to-conflicts-btn"
              onClick={onNavigateToConflicts}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
            >
              <span>Review Conflicts</span>
              <ArrowRight className="h-3.5 w-3.5 text-amber-400" />
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Categories */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-500 font-medium mr-1 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Domain:
            </span>
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  selectedCategory === cat.key
                    ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Canonical States */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-500 font-medium mr-1">State:</span>
            {states.map((st) => (
              <button
                key={st}
                onClick={() => setSelectedState(st)}
                className={`px-2 py-0.5 rounded font-mono text-[11px] transition-colors ${
                  selectedState === st
                    ? 'bg-slate-700 text-white font-bold border border-slate-600'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Intelligence Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const hasConflict = item.canonicalState === 'CONFLICTING';
          const isApproved = item.canonicalState === 'APPROVED';

          return (
            <div
              key={item.id}
              className={`bg-slate-900 border rounded-xl p-4 flex flex-col justify-between transition-all ${
                hasConflict
                  ? 'border-rose-900/60 shadow-lg shadow-rose-950/20'
                  : item.canonicalState === 'STALE'
                  ? 'border-amber-900/50'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Header: Title & Canonical State */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                      {item.category.replace('_', ' ')}
                    </span>
                    <h3 className="text-sm font-semibold text-white mt-0.5 leading-snug">
                      {item.title}
                    </h3>
                  </div>
                  <CanonicalBadge state={item.canonicalState} />
                </div>

                {/* Primary Metric Value */}
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-white">
                    {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                  </span>
                  <span className="text-xs font-mono text-slate-400">{item.unit}</span>
                </div>

                {/* Conflict warning if present */}
                {hasConflict && (
                  <div className="mt-2.5 p-2 rounded-lg bg-rose-950/40 border border-rose-900/50 text-[11px] text-rose-300">
                    <span className="font-semibold">Conflict:</span> Competing value of{' '}
                    <span className="font-mono font-bold">{item.conflictingValue} {item.unit}</span> in{' '}
                    <span className="underline decoration-dotted">{item.conflictingSource}</span>.
                  </div>
                )}

                {/* Provenance Snippet */}
                <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Source of Record:</span>
                    <span className="font-mono text-[10px] text-slate-400">{item.provenance.sourceType}</span>
                  </div>
                  <div className="text-slate-300 truncate" title={item.provenance.source}>
                    {item.provenance.source}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-500">Confidence:</span>
                    <span className={`font-mono font-semibold ${
                      item.provenance.confidencePct > 90 ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {item.provenance.confidencePct}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  id={`inspect-provenance-${item.id}`}
                  onClick={() => setActiveItemForProvenance(item)}
                  className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium transition-colors"
                >
                  <Info className="h-3.5 w-3.5" />
                  <span>Inspect Provenance</span>
                </button>

                {!isApproved && (
                  <button
                    id={`approve-intel-${item.id}`}
                    onClick={() => handleApprove(item)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-emerald-900/40 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-700 text-[11px] font-medium transition-colors"
                    title="Formally approve this value into canonical authority"
                  >
                    <Check className="h-3 w-3" />
                    <span>Approve</span>
                  </button>
                )}

                {isApproved && (
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="h-3 w-3" /> Governed
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Provenance Detail Modal / Inspector */}
      {activeItemForProvenance && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-xl w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400">
                  PECP Provenance Lineage (Constitution §7)
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {activeItemForProvenance.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveItemForProvenance(null)}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div>
                  <div className="text-slate-500">Canonical Value:</div>
                  <div className="text-base font-bold font-mono text-white mt-0.5">
                    {activeItemForProvenance.value} {activeItemForProvenance.unit}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Current Canonical State:</div>
                  <div className="mt-1">
                    <CanonicalBadge state={activeItemForProvenance.canonicalState} size="md" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <span className="text-slate-500 font-medium">Source:</span>
                  <p className="text-slate-200 mt-0.5 font-medium">{activeItemForProvenance.provenance.source}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Reference Identifier:</span>
                  <p className="font-mono text-slate-300 mt-0.5">{activeItemForProvenance.provenance.sourceRef}</p>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Capture Timestamp:</span>
                  <p className="font-mono text-slate-300 mt-0.5">{activeItemForProvenance.provenance.timestamp}</p>
                </div>
                {activeItemForProvenance.provenance.rationale && (
                  <div>
                    <span className="text-slate-500 font-medium">Extraction Rationale / Context:</span>
                    <p className="text-slate-300 mt-0.5 bg-slate-950 p-2.5 rounded border border-slate-800 leading-relaxed">
                      {activeItemForProvenance.provenance.rationale}
                    </p>
                  </div>
                )}
                {activeItemForProvenance.provenance.approvedBy && (
                  <div className="p-2.5 rounded bg-emerald-950/30 border border-emerald-800/40">
                    <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4" /> Governed Approval Record
                    </span>
                    <p className="text-slate-300 mt-1">
                      Approved by: <span className="font-medium text-white">{activeItemForProvenance.provenance.approvedBy}</span>
                    </p>
                    {activeItemForProvenance.provenance.approvalTimestamp && (
                      <p className="text-slate-500 font-mono text-[11px] mt-0.5">
                        Date: {activeItemForProvenance.provenance.approvalTimestamp}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setActiveItemForProvenance(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ingest Intelligence Modal */}
      {isIngestModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">Ingest Source Intelligence</h3>
                <p className="text-xs text-slate-400">All sources populate the same canonical PE model (Constitution §4).</p>
              </div>
              <button
                onClick={() => setIsIngestModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Source Tab Selector */}
            <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setIngestType('BRIEF')}
                className={`py-1.5 rounded text-center font-medium transition-colors ${
                  ingestType === 'BRIEF' ? 'bg-sky-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Project Brief / Doc
              </button>
              <button
                type="button"
                onClick={() => setIngestType('ALM')}
                className={`py-1.5 rounded text-center font-medium transition-colors ${
                  ingestType === 'ALM' ? 'bg-sky-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Azure DevOps / Jira
              </button>
              <button
                type="button"
                onClick={() => setIngestType('MANUAL')}
                className={`py-1.5 rounded text-center font-medium transition-colors ${
                  ingestType === 'MANUAL' ? 'bg-sky-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Manual Parameter
              </button>
            </div>

            <form onSubmit={handleIngestSubmit} className="space-y-3 text-xs">
              {ingestType === 'BRIEF' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Paste Project Brief / Architecture Doc Snippet:
                  </label>
                  <textarea
                    rows={4}
                    value={briefText}
                    onChange={(e) => setBriefText(e.target.value)}
                    placeholder="e.g. Black Friday 2026 Peak target: We anticipate 12,500 requests per minute with p95 latency under 250ms for cart operations..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500 font-sans"
                    required
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    AI assists extraction into INFERRED candidate state; deterministic model requires your approval.
                  </p>
                </div>
              )}

              {(ingestType === 'MANUAL' || ingestType === 'ALM') && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Parameter Title:</label>
                    <input
                      type="text"
                      value={manualTitle}
                      onChange={(e) => setManualTitle(e.target.value)}
                      placeholder="e.g. Peak Concurrent Mobile Sessions"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Category:</label>
                      <select
                        value={manualCategory}
                        onChange={(e) => setManualCategory(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
                      >
                        <option value="VOLUME">VOLUME</option>
                        <option value="LATENCY_SLA">LATENCY_SLA</option>
                        <option value="CONCURRENCY">CONCURRENCY</option>
                        <option value="BUSINESS_MIX">BUSINESS_MIX</option>
                        <option value="INFRASTRUCTURE">INFRASTRUCTURE</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Unit:</label>
                      <input
                        type="text"
                        value={manualUnit}
                        onChange={(e) => setManualUnit(e.target.value)}
                        placeholder="e.g. req/sec, ms, VUs"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Numerical Value:</label>
                    <input
                      type="text"
                      value={manualValue}
                      onChange={(e) => setManualValue(e.target.value)}
                      placeholder="e.g. 4500"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-sky-500"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsIngestModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-sm transition-colors"
                >
                  Ingest & Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
