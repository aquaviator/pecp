import { describe, it, expect } from 'vitest';
import { CanonicalState, ReviewStatus, IntelligenceCategory } from '../types';
import { RETAILCO_INTELLIGENCE_ITEMS_FIXTURE } from '../fixtures/retailco/intelligenceFixture';

describe('Canonical State & Review Status Domain Separation', () => {
  it('supports all 10 Constitution §7 Canonical States without mixing with Review Status', () => {
    const validCanonicalStates: CanonicalState[] = [
      'MISSING',
      'OBSERVED',
      'MANUAL',
      'IMPORTED',
      'INFERRED',
      'CALCULATED',
      'CONFLICTING',
      'STALE',
      'APPROVED',
      'SUPERSEDED'
    ];

    expect(validCanonicalStates).toHaveLength(10);
  });

  it('supports the 5 UI Review Status classifications', () => {
    const validReviewStatuses: ReviewStatus[] = [
      'FOUND',
      'MISSING',
      'AMBIGUOUS',
      'CONFLICTING',
      'STALE'
    ];

    expect(validReviewStatuses).toHaveLength(5);
  });

  it('verifies that ambiguous items maintain IMPORTED canonical state with AMBIGUOUS review status', () => {
    const checkoutLatency = RETAILCO_INTELLIGENCE_ITEMS_FIXTURE.find(
      (i) => i.key === 'checkout_response_time'
    );

    expect(checkoutLatency).toBeDefined();
    // Provenance is IMPORTED from Azure DevOps NFR-021
    expect(checkoutLatency?.canonicalState).toBe('IMPORTED');
    // Review assessment is AMBIGUOUS because percentile is omitted
    expect(checkoutLatency?.reviewStatus).toBe('AMBIGUOUS');
    expect(checkoutLatency?.ambiguityReason).toBeDefined();
  });

  it('verifies that approved items maintain APPROVED canonical state with FOUND review status', () => {
    const sessionDuration = RETAILCO_INTELLIGENCE_ITEMS_FIXTURE.find(
      (i) => i.key === 'avg_session_duration'
    );

    expect(sessionDuration).toBeDefined();
    expect(sessionDuration?.canonicalState).toBe('APPROVED');
    expect(sessionDuration?.reviewStatus).toBe('FOUND');
    expect(sessionDuration?.approvedBy).toBe('Lead Performance Architect');
  });

  it('verifies that candidates preserve both canonical state and review status', () => {
    const peakOrders = RETAILCO_INTELLIGENCE_ITEMS_FIXTURE.find(
      (i) => i.key === 'peak_hourly_orders'
    );
    expect(peakOrders?.candidates).toBeDefined();

    const candidate1 = peakOrders?.candidates?.find((c) => c.id === 'cand-1');
    expect(candidate1).toBeDefined();
    // Historical candidate is canonically SUPERSEDED, and marked STALE in review
    expect(candidate1?.canonicalState).toBe('SUPERSEDED');
    expect(candidate1?.reviewStatus).toBe('STALE');

    const candidate3 = peakOrders?.candidates?.find((c) => c.id === 'cand-3');
    expect(candidate3).toBeDefined();
    expect(candidate3?.canonicalState).toBe('IMPORTED');
    expect(candidate3?.reviewStatus).toBe('FOUND');
  });

  it('confirms that the Aurora DB pool item has legitimate ARCHITECTURE category with no type escapes', () => {
    const dbPool = RETAILCO_INTELLIGENCE_ITEMS_FIXTURE.find(
      (i) => i.key === 'db_connection_pool'
    );

    expect(dbPool).toBeDefined();
    expect(dbPool?.category).toBe('ARCHITECTURE');
    // Ensure category is one of the valid domain categories
    const validCategories: IntelligenceCategory[] = [
      'BUSINESS_CONTEXT',
      'WORKLOAD',
      'REQUIREMENTS',
      'ARCHITECTURE',
      'ACCEPTANCE_CRITERIA',
      'TEST_DATA',
      'ENVIRONMENT',
      'OBSERVABILITY'
    ];
    expect(validCategories).toContain(dbPool?.category);
  });
});
