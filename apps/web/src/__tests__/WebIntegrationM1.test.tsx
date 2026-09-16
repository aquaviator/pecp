import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ServiceProvider } from '../services/ServiceContext';
import { WorkloadPage } from '../pages/project/WorkloadPage';
import { ContractPage } from '../pages/project/ContractPage';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture';
import {
  RETAILCO_INTELLIGENCE_ITEMS_FIXTURE,
  RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE
} from '../fixtures/retailco/intelligenceFixture';

describe('Web Integration: Workload & Governed Contract UI Pages (M1 & M1.1)', () => {
  describe('M1 Post-Resolution State (Formally Approved 31,500 Baseline)', () => {
    it('renders real workload engine calculations, lineage, and refusal states in WorkloadPage', () => {
      const rawHtml = renderToString(
        <ServiceProvider>
          <WorkloadPage project={RETAILCO_PROJECT_FIXTURE} initialItems={RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE} />
        </ServiceProvider>
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      // 1. Throughput conversion: 31,500/hr -> 525/min -> 8.75 orders/sec
      expect(html).toContain('31,500 /hr');
      expect(html).toContain('525 /min');
      expect(html).toContain('8.75 orders/sec');
      expect(html).toContain('Unit conversion of transaction/order volume only');

      // 2. Concurrency blocked state (Constitution §3)
      expect(html).toContain('Concurrent Sessions: NOT CALCULATED');
      expect(html).toContain('Average session duration is known, but session arrival rate is not');
      expect(html).toContain('Peak session starts/hour OR an approved relationship');

      // 3. Workload readiness status remains BLOCKED because session arrival rate is missing
      expect(html).toContain('Workload Readiness: BLOCKED');

      // 4. Validated journey distribution
      expect(html).toContain('Validated 100%');
      expect(html).toContain('Browse:');
      expect(html).toContain('55%');
    });

    it('renders compiled Draft Performance Contract with truthful BLOCKED status in ContractPage', () => {
      const rawHtml = renderToString(
        <ServiceProvider>
          <ContractPage project={RETAILCO_PROJECT_FIXTURE} initialItems={RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE} />
        </ServiceProvider>
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      // 1. Contract metadata & intent
      expect(html).toContain('Governed Performance Contract');
      expect(html).toContain('Intent: FORECAST');
      expect(html).toContain('Contract Status: BLOCKED');

      // 2. Approval Readiness is blocked and button is locked
      expect(html).toContain('Approval Readiness: BLOCKED');
      expect(html).toContain('Sign &amp; Approve Contract (Locked)');

      // 3. Acceptance criteria with ambiguous checkout latency
      expect(html).toContain('Checkout API Flow');
      expect(html).toContain('Checkout Response Time Target');
      expect(html).toContain('&lt; 2 seconds');
      expect(html).toContain('UNDEFINED');
      expect(html).toContain('AMBIGUOUS');
      expect(html).toContain('Response-time percentile is not defined');

      // 4. Throughput specification from compiled workload
      expect(html).toContain('Peak Transaction Throughput');
      expect(html).toContain('8.75');
      expect(html).toContain('orders/sec (525/min, 31.5k/hr)');

      // 5. Blocked session concurrency in contract
      expect(html).toContain('Concurrent User Sessions');
      expect(html).toContain('UNRESOLVED (Not Calculated)');
    });
  });

  describe('M0 Pre-Resolution State (Conflicting Peak Orders)', () => {
    it('shows unresolved candidate warning in WorkloadPage when peak orders is conflicting without one-click resolution button', () => {
      const rawHtml = renderToString(
        <ServiceProvider>
          <WorkloadPage project={RETAILCO_PROJECT_FIXTURE} initialItems={RETAILCO_INTELLIGENCE_ITEMS_FIXTURE} />
        </ServiceProvider>
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('Blocked / Unresolved');
      expect(html).toContain('Unresolved Competing Candidates');
      expect(html).toContain('Inspect &amp; Resolve in Intelligence Review');
      expect(html).not.toContain('Resolve to Approved Candidate (31,500 /hr)');
    });

    it('blocks authoritative throughput calculation in ContractPage when peak orders is conflicting', () => {
      const rawHtml = renderToString(
        <ServiceProvider>
          <ContractPage project={RETAILCO_PROJECT_FIXTURE} initialItems={RETAILCO_INTELLIGENCE_ITEMS_FIXTURE} />
        </ServiceProvider>
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('Peak Transaction Throughput');
      expect(html).toContain('UNRESOLVED (Not Calculated)');
      expect(html).toContain('Peak hourly order volume is in a CONFLICTING state');
    });
  });

  describe('M1.2 WorkloadPage Semantic Decoupling', () => {
    it('does NOT render or compute 31,500, 20%, 30%, 8 minutes, or 55/20/15/8/2 when given an empty or unrelated payload', () => {
      const emptyPayload: any[] = [];
      const rawHtml = renderToString(
        <ServiceProvider>
          <WorkloadPage project={RETAILCO_PROJECT_FIXTURE} initialItems={emptyPayload} />
        </ServiceProvider>
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      // Proves no fallback peak orders 31,500
      expect(html).not.toContain('31,500');
      expect(html).not.toContain('31500');
      expect(html).not.toContain('8.75 orders/sec');

      // Proves no default growth 20%
      expect(html).not.toContain('+20%');

      // Proves no default headroom 30%
      expect(html).not.toContain('+30%');

      // Proves no default session duration 8 minutes
      expect(html).not.toContain('8.0 minutes');
      expect(html).not.toContain('480 sec');

      // Proves no hard-coded journey distribution 55/20/15/8/2
      expect(html).not.toContain('Browse:');
      expect(html).not.toContain('55%');
      expect(html).not.toContain('Search:');
      expect(html).not.toContain('20%');
      expect(html).not.toContain('Basket:');
      expect(html).not.toContain('15%');
      expect(html).not.toContain('Checkout:');
      expect(html).not.toContain('8%');
      expect(html).not.toContain('Account:');
      expect(html).not.toContain('2%');

      // Shows unsupplied states
      expect(html).toContain('Not supplied in intelligence');
      expect(html).toContain('Not Supplied in Intelligence');
      expect(html).toContain('No transformation applied');
    });

    it('displays unresolved / blocked indicator rather than a default calculated throughput in conflict state', () => {
      const rawHtml = renderToString(
        <ServiceProvider>
          <WorkloadPage project={RETAILCO_PROJECT_FIXTURE} initialItems={RETAILCO_INTELLIGENCE_ITEMS_FIXTURE} />
        </ServiceProvider>
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('Blocked / Unresolved');
      expect(html).toContain('Unresolved Competing Candidates');
      expect(html).not.toContain('8.75 orders/sec');
      expect(html).not.toContain('525 /min');
    });

    it('verifies the conflict resolution button is gone from WorkloadPage and navigating to intelligence review is the available action', () => {
      let navigated = false;
      const rawHtml = renderToString(
        <ServiceProvider>
          <WorkloadPage
            project={RETAILCO_PROJECT_FIXTURE}
            initialItems={RETAILCO_INTELLIGENCE_ITEMS_FIXTURE}
            onNavigateToIntelligence={() => {
              navigated = true;
            }}
          />
        </ServiceProvider>
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      // The old resolution button must be completely gone
      expect(html).not.toContain('Resolve to Approved Candidate');
      expect(html).not.toContain('cand-3');

      // Action to navigate to Intelligence Review is present
      expect(html).toContain('Inspect &amp; Resolve in Intelligence Review');
    });
  });
});
