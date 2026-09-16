import React from 'react';
import { ListFilter, FileText, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ProjectSummary, ReviewStatus, CanonicalState } from '../../types';
import { ReviewStatusBadge, CanonicalStateBadge } from '../../components/common/StateBadge';

interface RequirementsPageProps {
  project: ProjectSummary;
}

export const RequirementsPage: React.FC<RequirementsPageProps> = ({ project }) => {
  const nfrs: Array<{
    id: string;
    title: string;
    statement: string;
    reviewStatus: ReviewStatus;
    canonicalState: CanonicalState;
    reason: string;
    source: string;
  }> = [
    {
      id: 'NFR-021',
      title: 'Checkout Response Time Target',
      statement: 'Checkout should respond within 2 seconds.',
      reviewStatus: 'AMBIGUOUS',
      canonicalState: 'IMPORTED',
      reason: 'Response-time percentile is not defined.',
      source: 'Azure DevOps #49201'
    },
    {
      id: 'NFR-022',
      title: 'Maximum Allowed HTTP Error Rate',
      statement: 'Error rate must remain below 0.5% under peak load.',
      reviewStatus: 'FOUND',
      canonicalState: 'APPROVED',
      reason: 'Explicitly specifies 0.5% ceiling across 5xx responses.',
      source: 'Azure DevOps #49202'
    },
    {
      id: 'NFR-023',
      title: 'Availability During Flash Sale Window',
      statement: 'Platform availability must sustain 99.95% over 4-hour peak window.',
      reviewStatus: 'FOUND',
      canonicalState: 'APPROVED',
      reason: 'Approved by Product Operations and Architecture.',
      source: 'Azure DevOps #49203'
    },
    {
      id: 'NFR-024',
      title: 'Active Product SKU Test Pool Cardinality',
      statement: 'Realistic cache hit modeling requires minimum 250,000 active SKUs.',
      reviewStatus: 'MISSING',
      canonicalState: 'MISSING',
      reason: 'Missing data pool volume definition.',
      source: 'Data Strategy §4.2'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-sky-400" />
              <span>Project Requirements & NFR Register</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Deterministic extraction of Non-Functional Requirements from upstream Azure DevOps and architecture documentation.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1 rounded-md border border-slate-800">
            Source of Truth: Canonical PE Model
          </span>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3.5">ID</th>
                <th className="p-3.5">Title</th>
                <th className="p-3.5">Requirement Statement</th>
                <th className="p-3.5">Review Status</th>
                <th className="p-3.5">Canonical State</th>
                <th className="p-3.5">Review Notes / Gap</th>
                <th className="p-3.5">ALM Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-900/40">
              {nfrs.map((nfr) => (
                <tr key={nfr.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="p-3.5 font-mono text-sky-400 font-bold">{nfr.id}</td>
                  <td className="p-3.5 font-semibold text-white">{nfr.title}</td>
                  <td className="p-3.5 text-slate-300 italic font-serif">"{nfr.statement}"</td>
                  <td className="p-3.5">
                    <ReviewStatusBadge status={nfr.reviewStatus} />
                  </td>
                  <td className="p-3.5">
                    <CanonicalStateBadge state={nfr.canonicalState} />
                  </td>
                  <td className="p-3.5 text-slate-400">{nfr.reason}</td>
                  <td className="p-3.5 font-mono text-slate-500 text-[11px]">{nfr.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
