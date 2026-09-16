import { ProjectSummary, ProjectCreationMethod, EngineeringIntent } from '../../types';

export interface CreateProjectRequest {
  name: string;
  organisation: string;
  intent: EngineeringIntent;
  description: string;
  creationMethod: ProjectCreationMethod;
  briefText?: string;
  uploadedDocumentNames?: string[];
  externalReference?: string;
}

export interface IProjectService {
  getProjects(): Promise<ProjectSummary[]>;
  getProjectById(id: string): Promise<ProjectSummary | null>;
  createProject(request: CreateProjectRequest): Promise<ProjectSummary>;
}
