import React, { createContext, useContext, useMemo } from 'react';
import { IProjectService } from './interfaces/IProjectService';
import { IIntelligenceService } from './interfaces/IIntelligenceService';
import { IIntegrationService } from './interfaces/IIntegrationService';
import { MockProjectService } from './mock/MockProjectService';
import { MockIntelligenceService } from './mock/MockIntelligenceService';
import { MockIntegrationService } from './mock/MockIntegrationService';

export interface ServiceContainer {
  projectService: IProjectService;
  intelligenceService: IIntelligenceService;
  integrationService: IIntegrationService;
}

const ServiceContext = createContext<ServiceContainer | null>(null);

export interface ServiceProviderProps {
  children: React.ReactNode;
  overrideServices?: Partial<ServiceContainer>;
}

export const ServiceProvider: React.FC<ServiceProviderProps> = ({
  children,
  overrideServices
}) => {
  const services = useMemo<ServiceContainer>(() => {
    return {
      projectService: overrideServices?.projectService || new MockProjectService(),
      intelligenceService: overrideServices?.intelligenceService || new MockIntelligenceService(),
      integrationService: overrideServices?.integrationService || new MockIntegrationService()
    };
  }, [overrideServices]);

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
