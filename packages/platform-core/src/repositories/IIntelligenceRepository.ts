// IIntelligenceRepository
// Defined according to M5.0 Work Package §7 (Persistent Intelligence Read Model)

import { IntelligenceItem } from '@pecp/pe-domain';

export interface IIntelligenceRepository {
  listByProject(projectId: string): Promise<IntelligenceItem[]>;
  getById(projectId: string, itemId: string): Promise<IntelligenceItem | null>;
  saveItems(projectId: string, items: IntelligenceItem[]): Promise<void>;
}
