import React from 'react';
import {
  SlidersHorizontal,
  ShieldCheck,
  Cpu,
  Server,
  Key,
  Users,
  Terminal,
  Building2,
  Lock
} from 'lucide-react';

export const AdministrationPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-sky-400" />
          <h1 className="text-lg font-bold text-white tracking-tight">
            PECP Administration & Governance Control
          </h1>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Customer-deployed instance configuration, Bring Your Own AI (BYOAI) provider endpoints, role-based governance policies, and security diagnostics.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Deployment Verification */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              Customer Deployment Status
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
              CUSTOMER-DEPLOYED
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Constitution §2: Production customers run PECP in infrastructure they control. Hosted environments are for demonstration and reference evaluation only.
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
            <div>Deployment Mode: Self-Hosted / On-Premise Container</div>
            <div>Runtime: Node.js 22 (LTS) / Linux x86_64</div>
            <div>Ingress: Port 3000 (0.0.0.0)</div>
          </div>
        </div>

        {/* Bring Your Own AI (BYOAI) Governance */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              BYOAI Provider Configuration
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-950 text-sky-300 border border-sky-800">
              CUSTOMER-MANAGED
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Constitution §3: Customers use their approved AI provider, credentials, and credits. AI assists drafting and interpretation; PECP deterministically owns canonical state.
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
            <div>Provider: Customer Private Endpoint (Unconfigured in M0)</div>
            <div>Credentials: Stored exclusively in customer secrets manager</div>
            <div>Determinism: Models do not generate unverified state</div>
          </div>
        </div>

        {/* Governance Roles & Approval Authority */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              Governance Sign-off Roles
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-purple-950 text-purple-300 border border-purple-800">
              ROLE MAPPING
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Constitution §5 & §8: Material decisions (conflict resolution, contract approval, release verdicts) require designated engineering sign-off.
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
            <div>Performance Lead: Authority to resolve conflicting items</div>
            <div>Governance Board: Authority to sign Performance Contracts</div>
            <div>Audit Ledger: Cryptographic timestamp & actor tracking</div>
          </div>
        </div>

        {/* Security & Secrets Law */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              Security & Zero Raw Secrets Law
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
              ENFORCED
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Constitution §15 Law 8: No raw secrets or unmasked tokens in canonical models, test scripts, execution logs, or exported documents.
          </p>
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
            <div>Credential Masking: Active on all ingested documents</div>
            <div>Vault Integration: Ready for HashiCorp / Azure Key Vault</div>
          </div>
        </div>
      </div>
    </div>
  );
};
