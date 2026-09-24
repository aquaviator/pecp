// ApiUnavailableIntegrationService
// Defined according to M5.0 PM Review Blocker 3
// Explicit unavailable boundary for integrations in API mode.
// Invariant: Never silently instantiate mock services or return RetailCo reference data in API mode.

import { IntegrationDefinition, IntegrationMode } from '../../types';
import { IIntegrationService } from '../interfaces/IIntegrationService';

export class ApiUnavailableIntegrationService implements IIntegrationService {
  async getIntegrations(_projectId: string): Promise<IntegrationDefinition[]> {
    throw new Error(
      'ApiUnavailableIntegrationService: Integration service is not available in API mode until connectors milestone. Mock/reference integration state is disabled in API mode.'
    );
  }

  async updateIntegrationMode(
    _projectId: string,
    _integrationId: string,
    _mode: IntegrationMode
  ): Promise<IntegrationDefinition> {
    throw new Error(
      'ApiUnavailableIntegrationService: Updating integration mode is not available in API mode until connectors milestone. Mock/reference integration state is disabled in API mode.'
    );
  }
}
