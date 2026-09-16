import React from 'react';
import { Network, Server, Database, Cloud, ShieldCheck } from 'lucide-react';
import { ProjectSummary } from '../../types';

interface ArchitecturePageProps {
  project: ProjectSummary;
}

export const ArchitecturePage: React.FC<ArchitecturePageProps> = ({ project }) => {
  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-sky-400" />
          <h2 className="text-base font-bold text-white tracking-tight">
            System Architecture Topology
          </h2>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Logical topology, service dependencies, network ingress, database connection pooling, and caching boundaries mapped into the canonical model.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-sky-400" />
              API Gateway & Ingress
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
              VERIFIED
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Envoy-based Edge Gateway with TLS termination, rate-limiting circuit breakers, and OpenTelemetry request header propagation.
          </p>
          <div className="bg-slate-950 p-2.5 rounded text-[11px] font-mono text-slate-300">
            Spec: Retail Platform HLD v4 §3.1
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-amber-400" />
              Database & Cache Layer
            </h3>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800">
              STALE POOL SPEC
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Amazon Aurora PostgreSQL (Multi-AZ) with ElastiCache Redis 6-node cluster. Pool configuration flagged STALE (needs RDS Proxy alignment).
          </p>
          <div className="bg-slate-950 p-2.5 rounded text-[11px] font-mono text-slate-300">
            Item: [db_connection_pool]
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
              <Cloud className="w-3.5 h-3.5 text-purple-400" />
              Pre-Prod Performance Lab
            </h3>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
              1:1 SCALE
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Isolated VPC with 1:1 hardware footprint matching production. External third-party payment gateway routed to wiremock stub.
          </p>
          <div className="bg-slate-950 p-2.5 rounded text-[11px] font-mono text-slate-300">
            Lab Host: lab.retailco.internal
          </div>
        </div>
      </div>
    </div>
  );
};
