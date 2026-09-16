import { ProjectSummary } from '../../types';

export const RETAILCO_PROJECT_FIXTURE: ProjectSummary = {
  id: 'proj-retailco-bf2026',
  name: 'Black Friday 2026 Readiness',
  organisation: 'RetailCo',
  intent: 'FORECAST',
  description: 'First PECP Reference Intelligence project evaluating peak transactional capacity, checkout latency limits, and architecture headroom for the Black Friday 2026 trading window.',
  createdDate: '2026-08-14T09:00:00Z',
  status: 'ACTIVE',
  documentsCount: 5,
  requirementsCount: 28,
  conflictsCount: 3
};

export const ALL_PROJECTS_FIXTURE: ProjectSummary[] = [
  RETAILCO_PROJECT_FIXTURE
];
