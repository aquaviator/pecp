// ServiceContext Mode Selection & No-Mock-Fallback Regression Tests
// Defined according to M5.0 PM Review Blocker 3

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ServiceProvider, useServices, ServiceContainer } from '../services/ServiceContext';
import { ApiProjectService } from '../services/api/ApiProjectService';
import { ApiIntelligenceService } from '../services/api/ApiIntelligenceService';
import { ApiUnavailableIntegrationService } from '../services/api/ApiUnavailableIntegrationService';
import { ApiUnavailableExecutionEvidenceService } from '../services/api/ApiUnavailableExecutionEvidenceService';
import { MockProjectService } from '../services/mock/MockProjectService';
import { MockIntelligenceService } from '../services/mock/MockIntelligenceService';
import { MockIntegrationService } from '../services/mock/MockIntegrationService';
import { MockExecutionEvidenceService } from '../services/mock/MockExecutionEvidenceService';

describe('M5.0 ServiceContext Mode Selection Invariants', () => {
  it('1. In API mode, never instantiates any Mock*Service and uses pure Api* adapters', () => {
    let capturedServices: ServiceContainer | null = null;
    const TestConsumer = () => {
      capturedServices = useServices();
      return <div>Test</div>;
    };

    renderToString(
      <ServiceProvider serviceMode="API">
        <TestConsumer />
      </ServiceProvider>
    );

    expect(capturedServices).not.toBeNull();
    const services = capturedServices!;

    expect(services.serviceMode).toBe('API');

    // Positive checks: Must be Api* services
    expect(services.projectService).toBeInstanceOf(ApiProjectService);
    expect(services.intelligenceService).toBeInstanceOf(ApiIntelligenceService);
    expect(services.integrationService).toBeInstanceOf(ApiUnavailableIntegrationService);
    expect(services.executionEvidenceService).toBeInstanceOf(ApiUnavailableExecutionEvidenceService);

    // Negative invariant checks: Must NEVER be Mock* services
    expect(services.projectService).not.toBeInstanceOf(MockProjectService);
    expect(services.intelligenceService).not.toBeInstanceOf(MockIntelligenceService);
    expect(services.integrationService).not.toBeInstanceOf(MockIntegrationService);
    expect(services.executionEvidenceService).not.toBeInstanceOf(MockExecutionEvidenceService);
  });

  it('2. In API mode, unplatformised integration and execution services throw explicit unavailable errors rather than returning mock/reference fixtures', async () => {
    let capturedServices: ServiceContainer | null = null;
    const TestConsumer = () => {
      capturedServices = useServices();
      return <div>Test</div>;
    };

    renderToString(
      <ServiceProvider serviceMode="API">
        <TestConsumer />
      </ServiceProvider>
    );

    const services = capturedServices!;

    // Integration service must explicitly reject and not return RetailCo integrations
    await expect(services.integrationService.getIntegrations('proj-123')).rejects.toThrow(
      /Integration service is not available in API mode until connectors milestone/
    );

    await expect(
      services.integrationService.updateIntegrationMode('proj-123', 'int-1', 'LIVE')
    ).rejects.toThrow(/Updating integration mode is not available in API mode/);

    // Execution evidence service must explicitly reject and not return RetailCo execution state
    await expect(
      services.executionEvidenceService.getExecutionEvidenceState('proj-123')
    ).rejects.toThrow(
      /Execution evidence service is not available in API mode until live runner milestone/
    );
  });

  it('3. In MOCK mode, instantiates deterministic mock/reference services', () => {
    let capturedServices: ServiceContainer | null = null;
    const TestConsumer = () => {
      capturedServices = useServices();
      return <div>Test</div>;
    };

    renderToString(
      <ServiceProvider serviceMode="MOCK">
        <TestConsumer />
      </ServiceProvider>
    );

    expect(capturedServices).not.toBeNull();
    const services = capturedServices!;

    expect(services.serviceMode).toBe('MOCK');
    expect(services.projectService).toBeInstanceOf(MockProjectService);
    expect(services.intelligenceService).toBeInstanceOf(MockIntelligenceService);
    expect(services.integrationService).toBeInstanceOf(MockIntegrationService);
    expect(services.executionEvidenceService).toBeInstanceOf(MockExecutionEvidenceService);
  });
});
