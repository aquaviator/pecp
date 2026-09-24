import React, { createContext, useContext, useMemo } from 'react';
import { IProjectService } from './interfaces/IProjectService';
import { IIntelligenceService } from './interfaces/IIntelligenceService';
import { IIntegrationService } from './interfaces/IIntegrationService';
import { IExecutionEvidenceService } from './interfaces/IExecutionEvidenceService';
import { MockProjectService } from './mock/MockProjectService';
import { MockIntelligenceService } from './mock/MockIntelligenceService';
import { MockIntegrationService } from './mock/MockIntegrationService';
import { MockExecutionEvidenceService } from './mock/MockExecutionEvidenceService';
import {
  ApiProjectService,
  ApiIntelligenceService,
  ApiUnavailableIntegrationService,
  ApiUnavailableExecutionEvidenceService
} from './api';

export type ServiceMode = 'MOCK' | 'API';

export interface ServiceContainer {
  serviceMode: ServiceMode;
  projectService: IProjectService;
  intelligenceService: IIntelligenceService;
  integrationService: IIntegrationService;
  executionEvidenceService: IExecutionEvidenceService;
}

const ServiceContext = createContext<ServiceContainer | null>(null);

export interface ServiceProviderProps {
  children: React.ReactNode;
  overrideServices?: Partial<ServiceContainer>;
  serviceMode?: ServiceMode;
}

export const ServiceProvider: React.FC<ServiceProviderProps> = ({
  children,
  overrideServices,
  serviceMode
}) => {
  const effectiveMode: ServiceMode =
    serviceMode ||
    overrideServices?.serviceMode ||
    ((import.meta as any).env?.VITE_PECP_SERVICE_MODE === 'API' ? 'API' : 'MOCK');

  const services = useMemo<ServiceContainer>(() => {
    let projectService = overrideServices?.projectService;
    let intelligenceService = overrideServices?.intelligenceService;
    let integrationService = overrideServices?.integrationService;
    let executionEvidenceService = overrideServices?.executionEvidenceService;

    if (effectiveMode === 'API') {
      if (!projectService) projectService = new ApiProjectService();
      if (!intelligenceService) intelligenceService = new ApiIntelligenceService();
      if (!integrationService) integrationService = new ApiUnavailableIntegrationService();
      if (!executionEvidenceService) executionEvidenceService = new ApiUnavailableExecutionEvidenceService();
    } else {
      if (!projectService) projectService = new MockProjectService();
      if (!intelligenceService) intelligenceService = new MockIntelligenceService();
      if (!integrationService) integrationService = new MockIntegrationService();
      if (!executionEvidenceService) executionEvidenceService = new MockExecutionEvidenceService();
    }

    return {
      serviceMode: effectiveMode,
      projectService,
      intelligenceService,
      integrationService,
      executionEvidenceService
    };
  }, [overrideServices, effectiveMode]);

  return (
    <ServiceContext.Provider value={services}>
      {children}
    </ServiceContext.Provider>
  );
};

export const useServices = (): ServiceContainer => {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error('useServices must be used within a ServiceProvider');
  }
  return context;
};
