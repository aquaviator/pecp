import React, { useEffect, useState } from 'react';
import {
  FileSearch,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Clock,
  Search,
  Check,
  X,
  History,
  Info,
  ShieldCheck
} from 'lucide-react';
import {
  ProjectSummary,
  IntelligenceItem,
  IntelligenceReviewSummary,
  ReviewStatus,
  CanonicalState,
  IntelligenceCandidate
} from '../../types';
import { useServices } from '../../services/ServiceContext';
import { CanonicalStateBadge, ReviewStatusBadge } from '../../components/common/StateBadge';

interface IntelligencePageProps {
  project: ProjectSummary;
}

export const IntelligencePage: React.FC<IntelligencePageProps> = ({ project }) => {
  const { intelligenceService } = useServices();

  const [summary, setSummary] = useState<IntelligenceReviewSummary | null>(null);
  const [items, setItems] = useState<IntelligenceItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<IntelligenceItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [resolutionRationale, setResolutionRationale] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [approvalName, setApprovalName] = useState('Lead Performance Architect');

  // Load intelligence data on mount or project change
  useEffect(() => {
    loadData();
  }, [project.id]);

  const loadData = async () => {
    try {
      const [sum, itms] = await Promise.all([
        intelligenceService.getIntelligenceSummary(project.id),
        intelligenceService.getIntelligenceItems(project.id)
      ]);
      setSummary(sum);
      setItems(itms);
    } catch (err) {
      console.error('Failed to load intelligence data:', err);
    }
  };

  const handleSelectCandidate = async (candidate: IntelligenceCandidate) => {
    if (!selectedItem) return;
    setIsResolving(true);
    try {
      const updated = await intelligenceService.resolveIntelligenceConflict(
        project.id,
        selectedItem.id,
        candidate.id,
        resolutionRationale || `Selected authoritative candidate from ${candidate.source}`
      );
      // Update local state from service response
      setSelectedItem(updated);
      setResolutionRationale('');
      await loadData();
    } catch (err) {
      console.error('Failed to resolve conflict:', err);
    } finally {
      setIsResolving(false);
    }
  };

  const handleApproveItem = async () => {
    if (!selectedItem) return;
    try {
      const updated = await intelligenceService.approveIntelligenceItem(
        project.id,
        selectedItem.id,
        approvalName
      );
      setSelectedItem(updated);
      await loadData();
    } catch (err) {
      console.error('Failed to approve item:', err);
    }
  };

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesFilter =
      activeFilter === 'ALL' ||
      item.reviewStatus === activeFilter ||
      item.canonicalState === activeFilter ||
      (activeFilter === 'ATTENTION' && (item.reviewStatus === 'CONFLICTING' || item.reviewStatus === 'AMBIGUOUS' || item.reviewStatus === 'MISSING'));

    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.source?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Summary Metrics */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <FileSearch className="w-4 h-4 text-sky-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Project Intelligence Review
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Deterministic provenance ledger and readiness validation across business context, architecture, workload, and NFRs.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800">
              Constitution §7: Canonical State & Provenance are deterministically owned by PECP
            </span>
          </div>
        </div>

        {/* 5 Required Summary Metrics from Constitution & Reference Project */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-5">
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div className="text-[11px] font-mono uppercase text-slate-400">Documents Analysed</div>
              <div className="text-2xl font-bold font-mono text-white mt-1">
                {summary.documentsAnalysed}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Strategy, HLD, Business, NFRs</div>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div className="text-[11px] font-mono uppercase text-slate-400">Requirements Found</div>
              <div className="text-2xl font-bold font-mono text-sky-400 mt-1">
                {summary.requirementsFound}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Extracted from upstream estate</div>
            </div>

            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div className="text-[11px] font-mono uppercase text-slate-400">Performance Reqs</div>
              <div className="text-2xl font-bold font-mono text-indigo-400 mt-1">
                {summary.performanceRequirements}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Actionable NFR targets</div>
            </div>

            <div className="bg-purple-950/20 p-3.5 rounded-xl border border-purple-900/40">
              <div className="text-[11px] font-mono uppercase text-purple-300">Conflicts Detected</div>
              <div className="text-2xl font-bold font-mono text-purple-400 mt-1 flex items-baseline gap-2">
                <span>{summary.conflicts}</span>
                {summary.conflicts > 0 && (
                  <span className="text-[10px] text-purple-300 font-sans font-medium">Pending Resolution</span>
                )}
              </div>
              <div className="text-[10px] text-purple-400/80 mt-1">Competing candidate values</div>
            </div>

            <div className="bg-rose-950/20 p-3.5 rounded-xl border border-rose-900/40">
              <div className="text-[11px] font-mono uppercase text-rose-300">Missing Information</div>
              <div className="text-2xl font-bold font-mono text-rose-400 mt-1">
                {summary.missingInformation}
              </div>
              <div className="text-[10px] text-rose-400/80 mt-1">Critical gaps to resolve</div>
            </div>
          </div>
        )}
      </div>

      {/* 7 Readiness Sections Accordion/List */}
      {summary && summary.readinessSections.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-mono uppercase text-slate-400 font-bold tracking-wider">
              Engineering Readiness by Domain Section
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              7 Evaluation Sections (Constitution §13.6)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {summary.readinessSections.map((sec) => (
              <div
                key={sec.id}
                className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-semibold text-white text-xs">{sec.title}</span>
                    <span
                      className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border uppercase ${
                        sec.status === 'VERIFIED'
                          ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/80'
                          : sec.status === 'ATTENTION_REQUIRED'
                          ? 'bg-amber-950/50 text-amber-300 border-amber-800/80'
                          : 'bg-rose-950/50 text-rose-300 border-rose-800/80'
                      }`}
                    >
                      {sec.status === 'VERIFIED'
                        ? 'VERIFIED'
                        : sec.status === 'ATTENTION_REQUIRED'
                        ? 'ATTENTION'
                        : 'INCOMPLETE'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                    {sec.summary}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-900 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Verified:</span>
                  <span className="text-slate-200">
                    {sec.verifiedCount} / {sec.totalCount} items
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Item Ledger Filter & Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {/* Filter bar */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: 'All Items' },
              { id: 'ATTENTION', label: 'Attention Required' },
              { id: 'CONFLICTING', label: 'Conflicting' },
              { id: 'AMBIGUOUS', label: 'Ambiguous' },
              { id: 'STALE', label: 'Stale' },
              { id: 'FOUND', label: 'Found' },
              { id: 'APPROVED', label: 'Approved' },
              { id: 'MISSING', label: 'Missing' }
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  activeFilter === f.id
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search parameters, keys, sources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 font-sans"
            />
          </div>
        </div>

        {/* Intelligence Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3.5">Parameter / Key</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Review Status</th>
                <th className="p-3.5">Canonical State</th>
                <th className="p-3.5">Observed Value</th>
                <th className="p-3.5">Source & Document</th>
                <th className="p-3.5">Approval</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
              {filteredItems.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  <td className="p-3.5 font-medium text-white">
                    <div className="font-semibold">{item.title}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">{item.key}</div>
                  </td>

                  <td className="p-3.5 text-[11px] font-mono text-slate-400">
                    {item.category}
                  </td>

                  <td className="p-3.5">
                    <ReviewStatusBadge status={item.reviewStatus} />
                  </td>

                  <td className="p-3.5">
                    <CanonicalStateBadge state={item.canonicalState} />
                  </td>

                  <td className="p-3.5 font-mono text-slate-200 font-semibold">
                    {item.value !== undefined ? (
                      <span>
                        {item.value} {item.unit && <span className="text-slate-400 font-normal">{item.unit}</span>}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Not defined</span>
                    )}
                  </td>

                  <td className="p-3.5 text-slate-300">
                    <div className="truncate max-w-xs">{item.source || 'Unassigned'}</div>
                    <div className="text-[10px] text-slate-400 truncate max-w-xs">{item.sourceDocument}</div>
                  </td>

                  <td className="p-3.5 font-mono text-[11px]">
                    {item.approvalState === 'APPROVED' ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approved</span>
                      </span>
                    ) : item.approvalState === 'PENDING_APPROVAL' ? (
                      <span className="text-amber-400">Pending</span>
                    ) : (
                      <span className="text-slate-400">Unreviewed</span>
                    )}
                  </td>

                  <td className="p-3.5 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem(item);
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Item Detail Drawer / Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ReviewStatusBadge status={selectedItem.reviewStatus} size="md" />
                <CanonicalStateBadge state={selectedItem.canonicalState} size="md" />
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    {selectedItem.title}
                  </h3>
                  <span className="text-xs font-mono text-slate-400">{selectedItem.key} • {selectedItem.category}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-300">
              {/* Conflicting Candidates Section */}
              {selectedItem.reviewStatus === 'CONFLICTING' && selectedItem.candidates && (
                <div className="space-y-3 bg-purple-950/20 border border-purple-900/60 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-purple-400" />
                    <span>Conflicting Upstream Candidate Values Detected</span>
                  </div>
                  <p className="text-slate-300 text-xs">
                    PECP does not automatically choose a candidate. Review the competing values side by side and formally designate the authoritative baseline:
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                    {selectedItem.candidates.map((cand) => (
                      <div
                        key={cand.id}
                        className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1 gap-1">
                            <ReviewStatusBadge status={cand.reviewStatus} />
                            <CanonicalStateBadge state={cand.canonicalState} />
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {cand.capturedDate.slice(0, 10)}
                          </div>
                          <div className="text-lg font-bold font-mono text-white mt-1">
                            {cand.value} <span className="text-xs font-normal text-slate-400">{cand.unit}</span>
                          </div>
                          <div className="mt-2 space-y-1 text-[11px] text-slate-400">
                            <div><span className="text-slate-400">Source:</span> <span className="text-slate-200">{cand.source}</span></div>
                            <div className="truncate"><span className="text-slate-400">Doc:</span> {cand.sourceDocument}</div>
                            <div className="truncate text-[10px] text-slate-400">{cand.sourceLocation}</div>
                            {cand.notes && <div className="text-[10px] text-slate-400 italic mt-1">{cand.notes}</div>}
                          </div>
                        </div>

                        <button
                          disabled={isResolving}
                          onClick={() => handleSelectCandidate(cand)}
                          className="w-full py-2 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Select as Authoritative</span>
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Resolution Rationale & Sign-off Audit Note:
                    </label>
                    <input
                      type="text"
                      value={resolutionRationale}
                      onChange={(e) => setResolutionRationale(e.target.value)}
                      placeholder="e.g. Commercial Black Friday 2026 forecast ratified by executive sponsor."
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-sans"
                    />
                  </div>
                </div>
              )}

              {/* Ambiguity Reason Banner */}
              {selectedItem.reviewStatus === 'AMBIGUOUS' && selectedItem.ambiguityReason && (
                <div className="p-3.5 bg-amber-950/40 border border-amber-900/60 rounded-xl space-y-1">
                  <span className="text-amber-400 font-bold text-xs flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4" />
                    Ambiguity Identified in Requirement Specification
                  </span>
                  <p className="text-xs text-slate-200">
                    {selectedItem.ambiguityReason}
                  </p>
                </div>
              )}

              {/* Specification & Lineage Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Current Canonical Value</span>
                  <span className="text-base font-bold font-mono text-white mt-0.5 block">
                    {selectedItem.value !== undefined ? `${selectedItem.value} ${selectedItem.unit || ''}` : 'Undefined'}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Approval Status</span>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-white font-medium">
                      {selectedItem.approvalState || 'UNREVIEWED'}
                    </span>
                    {selectedItem.approvedBy && (
                      <span className="text-[11px] text-slate-400 font-sans">
                        by {selectedItem.approvedBy} ({selectedItem.approvalDate?.slice(0, 10)})
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Source Document</span>
                  <span className="text-xs text-slate-200 mt-0.5 block font-medium">
                    {selectedItem.sourceDocument || 'Not specified'}
                  </span>
                  <span className="text-[10px] text-slate-400">{selectedItem.sourceLocation}</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block">Captured Date & Provenance</span>
                  <span className="text-xs font-mono text-slate-300 mt-0.5 block">
                    {selectedItem.capturedDate || 'Unassigned'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-sans">{selectedItem.source}</span>
                </div>
              </div>

              {/* Notes */}
              {selectedItem.notes && (
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Engineering Notes</span>
                  <p className="text-slate-300 text-xs">{selectedItem.notes}</p>
                </div>
              )}

              {/* Provenance Audit History */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-sky-400" />
                  Canonical Item Provenance Ledger
                </span>
                <div className="bg-slate-950 rounded-xl border border-slate-800 divide-y divide-slate-800/80">
                  {selectedItem.history.map((h, i) => (
                    <div key={i} className="p-3 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <div className="text-slate-200 font-medium">{h.action}</div>
                        {h.note && <div className="text-slate-400 text-[11px] mt-0.5 italic">{h.note}</div>}
                      </div>
                      <div className="text-right text-[10px] font-mono text-slate-400 shrink-0">
                        <div>{h.actor}</div>
                        <div>{h.date.slice(0, 10)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Approval Action */}
              {selectedItem.reviewStatus !== 'CONFLICTING' && selectedItem.approvalState !== 'APPROVED' && (
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs">Approver:</span>
                    <input
                      type="text"
                      value={approvalName}
                      onChange={(e) => setApprovalName(e.target.value)}
                      className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <button
                    onClick={handleApproveItem}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve as Canonical</span>
                  </button>
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
