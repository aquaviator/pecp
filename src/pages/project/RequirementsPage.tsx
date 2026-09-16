import React from 'react';
import { ListFilter, FileText, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ProjectSummary } from '../../types';
import { StateBadge } from '../../components/common/StateBadge';

interface RequirementsPageProps {
  project: ProjectSummary;
}

export const RequirementsPage: React.FC<RequirementsPageProps> = ({ project }) => {
  const nfrs = [
    {
      id: 'NFR-021',
      title: 'Checkout Response Time Target',
      statement: 'Checkout should respond within 2 seconds.',
      state: 'AMBIGUOUS' as const,
      reason: 'Response-time percentile is not defined.',
      source: 'Azure DevOps #49201'
    },
    {
      id: 'NFR-022',
      title: 'Maximum Allowed HTTP Error Rate',
      statement: 'Error rate must remain below 0.5% under peak load.',
      state: 'FOUND' as const,
      reason: 'Explicitly specifies 0.5% ceiling across 5xx responses.',
      source: 'Azure DevOps #49202'
    },
    {
      id: 'NFR-023',
      title: 'Availability During Flash Sale Window',
      statement: 'Platform availability must sustain 99.95% over 4-hour peak window.',
      state: 'APPROVED' as const,
      reason: 'Approved by Product Operations and Architecture.',
      source: 'Azure DevOps #49203'
    },
    {
      id: 'NFR-024',
      title: 'Active Product SKU Test Pool Cardinality',
      statement: 'Realistic cache hit modeling requires minimum 250,000 active SKUs.',
      state: 'MISSING' as const,
      reason: 'Data Architecture team has not yet published SKU distribution matrix.',
      source: 'Data Architecture Backlog'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ListFilter className="w-4 h-4 text-sky-400" />
          <h2 className="text-base font-bold text-white tracking-tight">
            Non-Functional Requirements (NFR) Register
          </h2>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Captured performance requirements, SLA thresholds, and qualitative criteria linked to upstream ALM work items.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-3.5">Item Ref</th>
                <th className="p-3.5">Requirement Title</th>
                <th className="p-3.5">Specification Statement</th>
                <th className="p-3.5">Canonical State</th>
                <th className="p-3.5">Analysis / Reason</th>
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
                    <StateBadge state={nfr.state} />
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
