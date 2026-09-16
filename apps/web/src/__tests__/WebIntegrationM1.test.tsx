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
    it('shows unresolved candidate warning in WorkloadPage when peak orders is conflicting', () => {
      const rawHtml = renderToString(
        <ServiceProvider>
          <WorkloadPage project={RETAILCO_PROJECT_FIXTURE} initialItems={RETAILCO_INTELLIGENCE_ITEMS_FIXTURE} />
        </ServiceProvider>
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      expect(html).toContain('Blocked / Unresolved');
      expect(html).toContain('Unresolved Competing Candidates');
      expect(html).toContain('Resolve to Approved Candidate (31,500 /hr)');
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
});
