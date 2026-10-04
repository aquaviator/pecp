import React, { createContext, useContext, useMemo } from 'react';
import { IProjectService } from './interfaces/IProjectService';
import { IIntelligenceService } from './interfaces/IIntelligenceService';
import { ISourceService } from './interfaces/ISourceService';
import { IIntegrationService } from './interfaces/IIntegrationService';
import { IExecutionEvidenceService } from './interfaces/IExecutionEvidenceService';
import { IAuthService } from './interfaces/IAuthService';
import { IAdminService } from './interfaces/IAdminService';
import { IPerformanceContractService } from './interfaces/IPerformanceContractService';
import { IArtefactService } from './interfaces/IArtefactService';
import { MockProjectService } from './mock/MockProjectService';
import { MockIntelligenceService } from './mock/MockIntelligenceService';
import { MockSourceService } from './mock/MockSourceService';
import { MockIntegrationService } from './mock/MockIntegrationService';
import { MockExecutionEvidenceService } from './mock/MockExecutionEvidenceService';
import { MockAuthService } from './mock/MockAuthService';
import { MockAdminService } from './mock/MockAdminService';
import { MockPerformanceContractService } from './mock/MockPerformanceContractService';
import { MockArtefactService } from './mock/MockArtefactService';
import {
  ApiProjectService,
  ApiIntelligenceService,
  ApiUnavailableIntegrationService,
  ApiUnavailableExecutionEvidenceService,
  ApiPerformanceContractService,
  ApiArtefactService
} from './api';
import { ApiSourceService } from './api/ApiSourceService';
import { ApiAuthService } from './api/ApiAuthService';
import { ApiAdminService } from './api/ApiAdminService';

export type ServiceMode = 'MOCK' | 'API';

export interface ServiceContainer {
  serviceMode: ServiceMode;
  mode: ServiceMode;
  projectService: IProjectService;
  intelligenceService: IIntelligenceService;
  sourceService: ISourceService;
  integrationService: IIntegrationService;
  executionEvidenceService: IExecutionEvidenceService;
  authService: IAuthService;
  adminService: IAdminService;
  performanceContractService: IPerformanceContractService;
  artefactService: IArtefactService;
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
    let sourceService = overrideServices?.sourceService;
    let integrationService = overrideServices?.integrationService;
    let executionEvidenceService = overrideServices?.executionEvidenceService;
    let authService = overrideServices?.authService;
    let adminService = overrideServices?.adminService;
    let performanceContractService = overrideServices?.performanceContractService;
    let artefactService = overrideServices?.artefactService;

    if (effectiveMode === 'API') {
      if (!projectService) projectService = new ApiProjectService();
      if (!intelligenceService) intelligenceService = new ApiIntelligenceService();
      if (!sourceService) sourceService = new ApiSourceService();
      if (!integrationService) integrationService = new ApiUnavailableIntegrationService();
      if (!executionEvidenceService) executionEvidenceService = new ApiUnavailableExecutionEvidenceService();
      if (!authService) authService = new ApiAuthService();
      if (!adminService) adminService = new ApiAdminService();
      if (!performanceContractService) performanceContractService = new ApiPerformanceContractService();
      if (!artefactService) artefactService = new ApiArtefactService();
    } else {
      if (!projectService) projectService = new MockProjectService();
      if (!intelligenceService) intelligenceService = new MockIntelligenceService();
      if (!sourceService) sourceService = new MockSourceService();
      if (!integrationService) integrationService = new MockIntegrationService();
      if (!executionEvidenceService) executionEvidenceService = new MockExecutionEvidenceService();
      if (!authService) authService = new MockAuthService();
      if (!adminService) adminService = new MockAdminService();
      if (!performanceContractService) performanceContractService = new MockPerformanceContractService(projectService, intelligenceService);
      if (!artefactService) artefactService = new MockArtefactService(projectService, intelligenceService);
    }

    return {
      serviceMode: effectiveMode,
      mode: effectiveMode,
      projectService,
      intelligenceService,
      sourceService,
      integrationService,
      executionEvidenceService,
      authService,
      adminService,
      performanceContractService,
      artefactService
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
