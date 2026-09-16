import { IProjectService, CreateProjectRequest } from '../interfaces/IProjectService';
import { ProjectSummary } from '../../types';
import { ALL_PROJECTS_FIXTURE } from '../../fixtures/retailco/projectFixture';

export class MockProjectService implements IProjectService {
  private projects: ProjectSummary[] = [...ALL_PROJECTS_FIXTURE];

  async getProjects(): Promise<ProjectSummary[]> {
    // Return cloned array to avoid external mutations
    return JSON.parse(JSON.stringify(this.projects));
  }

  async getProjectById(id: string): Promise<ProjectSummary | null> {
    const found = this.projects.find((p) => p.id === id);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }

  async createProject(request: CreateProjectRequest): Promise<ProjectSummary> {
    const newProject: ProjectSummary = {
      id: `proj-${Date.now()}`,
      name: request.name.trim(),
      organisation: request.organisation.trim(),
      intent: request.intent,
      description: request.description.trim() || 'Performance engineering project created in PECP Portal.',
      createdDate: new Date().toISOString(),
      status: 'ACTIVE',
      documentsCount: request.uploadedDocumentNames?.length || (request.creationMethod === 'UPLOAD_DOCUMENTS' ? 2 : 0),
      requirementsCount: request.creationMethod === 'BRIEF' ? 4 : 0,
      conflictsCount: 0
    };

    this.projects.unshift(newProject);
    return JSON.parse(JSON.stringify(newProject));
  }
}
