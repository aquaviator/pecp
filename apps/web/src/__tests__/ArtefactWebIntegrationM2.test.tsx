import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ServiceProvider } from '../services/ServiceContext';
import { StrategyPage } from '../pages/project/StrategyPage';
import { TestPlanPage } from '../pages/project/TestPlanPage';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture';
import { RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE } from '../fixtures/retailco/intelligenceFixture';

describe('Web Integration: Strategy & Test Plan UI Pages (M2)', () => {
  describe('StrategyPage', () => {
    it('renders the compiled Performance Strategy with all sections, tables, and blocked banner', () => {
      const rawHtml = renderToString(
        <ServiceProvider>
          <StrategyPage
            project={RETAILCO_PROJECT_FIXTURE}
            initialItems={RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE}
          />
        </ServiceProvider>
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      // 1. Title & Intent
      expect(html).toContain('Performance Strategy — Black Friday 2026 Readiness');
      expect(html).toContain('Intent: FORECAST');
      expect(html).toContain('Document Status: BLOCKED');

      // 2. Bound contract references
      expect(html).toContain('contract-proj-retailco-bf2026-v0.1-draft');
      expect(html).toContain('v0.1-draft');

      // 3. Approval Blocked Button
      expect(html).toContain('Approval Blocked');

      // 4. Table of Contents
      expect(html).toContain('Table of Contents');
      expect(html).toContain('1.0');
      expect(html).toContain('Document Control &amp; Governance');
      expect(html).toContain('7.0');
      expect(html).toContain('Workload Strategy &amp; Required Demand');
      expect(html).toContain('16.0');
      expect(html).toContain('Unresolved Decisions &amp; Approval Blockers');

      // 5. Workload Demand calculations rendered
      expect(html).toContain('8.75 orders/second');
      expect(html).toContain('throughput_time_unit_conversion');

      // 6. Little's law blocked callout
      expect(html).toContain('Session Concurrency: BLOCKED');
      expect(html).toContain('Little&#x27;s Law (L = λ × W) requires arrival rate');

      // 7. Journey distribution
      expect(html).toContain('Browse');
      expect(html).toContain('55%');
      expect(html).toContain('Checkout');
      expect(html).toContain('8%');

      // 8. Action buttons present
      expect(html).toContain('Copy Markdown');
      expect(html).toContain('Export .md');
      expect(html).toContain('View Raw JSON');
      expect(html).toContain('Print / Document Mode');
    });
  });

  describe('TestPlanPage', () => {
    it('renders the compiled Performance Test Plan with execution schedules and pass/fail rules', () => {
      const rawHtml = renderToString(
        <ServiceProvider>
          <TestPlanPage
            project={RETAILCO_PROJECT_FIXTURE}
            initialItems={RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE}
          />
        </ServiceProvider>
      );
      const html = rawHtml.replace(/<!-- -->/g, '');

      // 1. Title & Intent
      expect(html).toContain('Performance Test Plan — Black Friday 2026 Readiness');
      expect(html).toContain('Intent: FORECAST');
      expect(html).toContain('Document Status: BLOCKED');

      // 2. Sections
      expect(html).toContain('6.0');
      expect(html).toContain('Workload Model &amp; Required Demand');
      expect(html).toContain('14.0');
      expect(html).toContain('Pass / Fail / Inconclusive Evaluation Rules');

      // 3. Workload demand separation & values
      expect(html).toContain('8.75');
      expect(html).toContain('Required Attainment Target');

      // 4. Pass / Fail / Inconclusive definitions
      expect(html).toContain('INCONCLUSIVE');
      expect(html).toContain('Required workload demand was NOT attained');

      // 5. Blocker callout
      expect(html).toContain('Test execution is BLOCKED');
    });
  });
});
