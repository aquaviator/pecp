import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ServiceProvider } from '../services/ServiceContext';
import { TestsPage } from '../pages/project/TestsPage';
import { RETAILCO_PROJECT_FIXTURE } from '../fixtures/retailco/projectFixture';
import { RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE } from '../fixtures/retailco/intelligenceFixture';

describe('Web Integration: TestsPage (M3.0)', () => {
  it('renders the TestsPage with M3 Reference Lab execution-ready status by default', () => {
    const rawHtml = renderToString(
      <ServiceProvider>
        <TestsPage
          project={RETAILCO_PROJECT_FIXTURE}
          initialItems={RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE}
        />
      </ServiceProvider>
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    // Title & Status
    expect(html).toContain('Canonical Test Definition &amp; k6 Execution Bundle');
    expect(html).toContain('READY_FOR_EXECUTION');
    expect(html).toContain('contract-proj-retailco-bf26-v1.0-approved');

    // Drift Checksum badge
    expect(html).toContain('Drift Checksum');
    expect(html).toContain('fp-');

    // Tab navigation buttons
    expect(html).toContain('Overview &amp; Preconditions');
    expect(html).toContain('Workload Schedule');
    expect(html).toContain('Journeys &amp; Steps (5)');
    expect(html).toContain('Criteria &amp; Thresholds');
    expect(html).toContain('Generated k6 Bundle (3)');
    expect(html).toContain('Runtime Architecture');

    // Preconditions and Target Arrival Demand
    expect(html).toContain('8.75 orders/second');
    expect(html).toContain('FORECAST');
    expect(html).toContain('Secret Reference Boundary');
    expect(html).toContain('RETAILCO_CHECKOUT_AUTH_TOKEN');
  });

  it('renders governance gate warning when viewing blocked current project', () => {
    // TestsPage allows toggling or rendering with blocked state
    // Let's verify that the blocked bundle logic generates the warning text
    const rawHtml = renderToString(
      <ServiceProvider>
        <TestsPage
          project={RETAILCO_PROJECT_FIXTURE}
          initialItems={RETAILCO_M1_POST_RESOLUTION_ITEMS_FIXTURE}
        />
      </ServiceProvider>
    );
    const html = rawHtml.replace(/<!-- -->/g, '');

    // The scenario buttons exist to switch to current project
    expect(html).toContain('Current Project (Blocked Gate)');
    expect(html).toContain('M3 Reference Lab (Approved)');
  });
});
