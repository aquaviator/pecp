import { IIntegrationService } from '../interfaces/IIntegrationService';
import { IntegrationDefinition, IntegrationMode } from '../../types';
import { INITIAL_INTEGRATIONS_FIXTURE } from '../../fixtures/retailco/integrationsFixture';

export class MockIntegrationService implements IIntegrationService {
  private integrations: Map<string, IntegrationDefinition[]> = new Map();

  constructor() {
    this.integrations.set('proj-retailco-bf2026', JSON.parse(JSON.stringify(INITIAL_INTEGRATIONS_FIXTURE)));
  }

  async getIntegrations(projectId: string): Promise<IntegrationDefinition[]> {
    let list = this.integrations.get(projectId);
    if (!list) {
      const initialList: IntegrationDefinition[] = JSON.parse(JSON.stringify(INITIAL_INTEGRATIONS_FIXTURE));
      this.integrations.set(projectId, initialList);
      list = initialList;
    }
    return JSON.parse(JSON.stringify(list));
  }

  async updateIntegrationMode(
    projectId: string,
    integrationId: string,
    mode: IntegrationMode
  ): Promise<IntegrationDefinition> {
    const list = await this.getIntegrations(projectId);
    const target = list.find((i) => i.id === integrationId);
    if (!target) throw new Error(`Integration ${integrationId} not found`);

    target.currentMode = mode;
    this.integrations.set(projectId, list);
    return JSON.parse(JSON.stringify(target));
  }
}
