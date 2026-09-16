import { IntegrationDefinition, IntegrationMode } from '../../types';

export interface IIntegrationService {
  getIntegrations(projectId: string): Promise<IntegrationDefinition[]>;
  updateIntegrationMode(
    projectId: string,
    integrationId: string,
    mode: IntegrationMode
  ): Promise<IntegrationDefinition>;
}
