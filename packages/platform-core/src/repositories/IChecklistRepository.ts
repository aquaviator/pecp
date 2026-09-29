// IChecklistRepository
// Defined according to M5.2 Work Package §8 [I06]

import { ProjectChecklist } from '@pecp/pe-domain';

export interface IChecklistRepository {
  getChecklist(projectId: string): Promise<ProjectChecklist | null>;
  saveChecklist(checklist: ProjectChecklist): Promise<void>;
}
