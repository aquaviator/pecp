import React from 'react';
import { Award, Download, ShieldCheck, FileCheck, Layers } from 'lucide-react';
import { ProjectSummary } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';

interface EvidencePageProps {
  project: ProjectSummary;
}

export const EvidencePage: React.FC<EvidencePageProps> = ({ project }) => {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-sky-400" />
          <h2 className="text-base font-bold text-white tracking-tight">
            Performance Evidence Package & Governance Audit
          </h2>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Constitution §13 steps 17–19: The formal, tamper-evident audit package compiling the Performance Contract, execution results, findings, and full source-to-result traceability.
        </p>
      </div>

      <EmptyState
        icon={Award}
        title="Performance Evidence Package Generated at Completion"
        description="The Evidence Package is the ultimate deliverable of the PECP lifecycle. It binds original business requirements, canonical model states, contract approvals, k6 test telemetry, and findings into a verifiable audit bundle."
        subtext="Audit Standard: Source-Agnostic Lineage & Cryptographic Verification"
      />
    </div>
  );
};
