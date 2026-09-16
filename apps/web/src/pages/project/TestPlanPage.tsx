import React from 'react';
import { FileText, CheckCircle2, ShieldAlert } from 'lucide-react';
import { ProjectSummary } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';

interface TestPlanPageProps {
  project: ProjectSummary;
}

export const TestPlanPage: React.FC<TestPlanPageProps> = ({ project }) => {
  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-400" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Performance Test Plan Artefact
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Constitution §8: Test plans are compiled engineering documents linked to specific execution runs and canonical contract versions.
            </p>
          </div>

          <span className="px-2.5 py-1 rounded text-[11px] font-mono bg-slate-950 text-slate-400 border border-slate-800">
            Lifecycle Stage: Generation Pending Model Approval
          </span>
        </div>
      </div>

      {/* Professional Empty State / Preview */}
      <EmptyState
        icon={FileText}
        title="Performance Test Plan Generates from the Canonical Model"
        description="The Performance Test Plan specifies test execution windows, journey scenarios, environment prerequisites, data seeding procedures, and pass/fail thresholds. Rather than manually drafting and updating a Word or Confluence document, PECP generates this plan deterministically from the approved Workload Model and Performance Contract."
        subtext="Generation Target: Azure DevOps Test Plans / Confluence / JSON Artefact Store"
      />

      {/* Test Plan Structural Outline */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm space-y-4 max-w-4xl mx-auto">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Compiled Test Plan Outline (Generated Sections)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-emerald-400 font-mono font-bold block">1. Test Execution Scope</span>
            <p className="text-slate-400">
              Scenarios: Browse, Search, Basket, and Checkout workflows under {project.intent} intent.
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-emerald-400 font-mono font-bold block">2. Workload & Profile Schedules</span>
            <p className="text-slate-400">
              Ramping stages, steady-state duration, Little's Law target concurrency, and think time parameters.
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-emerald-400 font-mono font-bold block">3. Test Data & Synthetic Pools</span>
            <p className="text-slate-400">
              SKU catalog cardinality, test customer credentials, payment virtualisation tokens.
            </p>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
            <span className="text-emerald-400 font-mono font-bold block">4. SLA Assertions & Abort Criteria</span>
            <p className="text-slate-400">
              Automated circuit breakers, response time thresholds, and error rate failure conditions.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
