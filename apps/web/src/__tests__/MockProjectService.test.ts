import { describe, it, expect, beforeEach } from 'vitest';
import { MockProjectService } from '../services/mock/MockProjectService';

describe('MockProjectService', () => {
  let projectService: MockProjectService;

  beforeEach(() => {
    projectService = new MockProjectService();
  });

  it('retrieves the initial seeded projects including the RetailCo reference project', async () => {
    const projects = await projectService.getProjects();
    expect(projects.length).toBeGreaterThanOrEqual(1);

    const retailCo = projects.find((p) => p.id === 'proj-retailco-bf2026');
    expect(retailCo).toBeDefined();
    expect(retailCo?.name).toBe('Black Friday 2026 Readiness');
    expect(retailCo?.organisation).toBe('RetailCo');
    expect(retailCo?.intent).toBe('FORECAST');
    expect(retailCo?.status).toBe('ACTIVE');
  });

  it('retrieves a project by ID correctly', async () => {
    const project = await projectService.getProjectById('proj-retailco-bf2026');
    expect(project).not.toBeNull();
    expect(project?.id).toBe('proj-retailco-bf2026');
    expect(project?.conflictsCount).toBe(3);
    expect(project?.documentsCount).toBe(5);
    expect(project?.requirementsCount).toBe(28);
  });

  it('returns null when querying a nonexistent project ID', async () => {
    const project = await projectService.getProjectById('nonexistent-id');
    expect(project).toBeNull();
  });

  it('creates a new governed project and appends it to the project list', async () => {
    const initialProjects = await projectService.getProjects();
    const initialCount = initialProjects.length;

    const newProject = await projectService.createProject({
      name: 'Q1 Surge Peak Analysis',
      organisation: 'LogisticsCorp',
      intent: 'DISCOVERY',
      creationMethod: 'UPLOAD_DOCUMENTS',
      description: 'Capacity discovery for automated sorting facilities'
    });

    expect(newProject.id).toMatch(/^proj-/);
    expect(newProject.name).toBe('Q1 Surge Peak Analysis');
    expect(newProject.organisation).toBe('LogisticsCorp');
    expect(newProject.intent).toBe('DISCOVERY');
    expect(newProject.status).toBe('ACTIVE');

    const updatedProjects = await projectService.getProjects();
    expect(updatedProjects.length).toBe(initialCount + 1);
    expect(updatedProjects.some((p) => p.id === newProject.id)).toBe(true);
  });
});
