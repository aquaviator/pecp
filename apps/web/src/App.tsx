import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ProjectSummary } from './types';
import { ServiceProvider, useServices } from './services/ServiceContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/auth/LoginPage';
import { AppHeader, MainNavSection } from './components/layout/AppHeader';
import { ProjectHeader } from './components/layout/ProjectHeader';
import { ProjectSubnav, ProjectTab } from './components/layout/ProjectSubnav';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { AdministrationPage } from './pages/AdministrationPage';
import { ProjectOverviewPage } from './pages/project/ProjectOverviewPage';
import { IntelligencePage } from './pages/project/IntelligencePage';
import { ArchitecturePage } from './pages/project/ArchitecturePage';
import { RequirementsPage } from './pages/project/RequirementsPage';
import { WorkloadPage } from './pages/project/WorkloadPage';
import { ContractPage } from './pages/project/ContractPage';
import { StrategyPage } from './pages/project/StrategyPage';
import { TestPlanPage } from './pages/project/TestPlanPage';
import { TestsPage } from './pages/project/TestsPage';
import { ExecutionsPage } from './pages/project/ExecutionsPage';
import { ResultsPage } from './pages/project/ResultsPage';
import { FindingsPage } from './pages/project/FindingsPage';
import { EvidencePage } from './pages/project/EvidencePage';
import { IntegrationsPage } from './pages/project/IntegrationsPage';
import { NewProjectModal } from './pages/project/NewProjectModal';
import { ConstitutionModal } from './components/ConstitutionModal';

const AppContent: React.FC = () => {
  const { projectService, intelligenceService } = useServices();
  const { isAuthenticated } = useAuth();

  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectSummary | null>(null);
  const [mainNav, setMainNav] = useState<MainNavSection>('PROJECTS');
  const [projectTab, setProjectTab] = useState<ProjectTab>('INTELLIGENCE');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isConstitutionOpen, setIsConstitutionOpen] = useState(false);
  const [conflictsCount, setConflictsCount] = useState<number | null>(null);

  // Load projects from service when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadProjects();
    }
  }, [isAuthenticated]);

  const loadProjects = async () => {
    try {
      const list = await projectService.getProjects();
      setProjects(list);
      if (list.length > 0 && !activeProject) {
        setActiveProject(list[0]);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  // Sync conflict count from intelligence summary or project record
  useEffect(() => {
    if (activeProject) {
      intelligenceService
        .getIntelligenceSummary(activeProject.id)
        .then((sum) => {
          setConflictsCount(sum.conflicts);
        })
        .catch(() => {
          // In API mode, review summary is unsupported; use authoritative project record field
          setConflictsCount(activeProject.conflictsCount ?? 0);
        });
    } else {
      setConflictsCount(null);
    }
  }, [activeProject, intelligenceService]);

  const handleSelectProject = (projectId: string) => {
    const found = projects.find((p) => p.id === projectId);
    if (found) {
      setActiveProject(found);
      setMainNav('PROJECTS');
    }
  };

  const handleProjectCreated = (newProject: ProjectSummary) => {
    setProjects((prev) => [newProject, ...prev]);
    setActiveProject(newProject);
    setMainNav('PROJECTS');
    setProjectTab('INTELLIGENCE');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 selection:text-sky-200">
      {/* Top Application Header */}
      <AppHeader
        activeNav={mainNav}
        onSelectNav={setMainNav}
        activeProject={activeProject}
        projects={projects}
        onSelectProject={handleSelectProject}
        onOpenNewProjectModal={() => setIsNewProjectModalOpen(true)}
        onOpenConstitution={() => setIsConstitutionOpen(true)}
      />

      {/* Main Content Area */}
      {mainNav === 'DASHBOARD' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <DashboardPage
            projects={projects}
            onSelectProject={handleSelectProject}
            onOpenNewProject={() => setIsNewProjectModalOpen(true)}
            onOpenConstitution={() => setIsConstitutionOpen(true)}
          />
        </main>
      )}

      {mainNav === 'ADMINISTRATION' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <AdministrationPage />
        </main>
      )}

      {mainNav === 'PROJECTS' && (
        <div className="flex-1 flex flex-col">
          {activeProject ? (
            <>
              {/* Active Project Header & Subnav */}
              <ProjectHeader project={activeProject} />
              <ProjectSubnav
                activeTab={projectTab}
                onSelectTab={setProjectTab}
                conflictsCount={conflictsCount}
              />

              {/* Project Subtab Content */}
              <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {projectTab === 'OVERVIEW' && (
                  <ProjectOverviewPage
                    project={activeProject}
                    onNavigateTab={setProjectTab}
                  />
                )}
                {projectTab === 'INTELLIGENCE' && (
                  <IntelligencePage project={activeProject} />
                )}
                {projectTab === 'ARCHITECTURE' && (
                  <ArchitecturePage project={activeProject} />
                )}
                {projectTab === 'REQUIREMENTS' && (
                  <RequirementsPage project={activeProject} />
                )}
                {projectTab === 'WORKLOAD' && (
                  <WorkloadPage
                    project={activeProject}
                    onNavigateToIntelligence={() => setProjectTab('INTELLIGENCE')}
                  />
                )}
                {projectTab === 'PERFORMANCE_CONTRACT' && (
                  <ContractPage project={activeProject} />
                )}
                {projectTab === 'STRATEGY' && (
                  <StrategyPage project={activeProject} />
                )}
                {projectTab === 'TEST_PLAN' && (
                  <TestPlanPage project={activeProject} />
                )}
                {projectTab === 'TESTS' && (
                  <TestsPage project={activeProject} />
                )}
                {projectTab === 'EXECUTIONS' && (
                  <ExecutionsPage project={activeProject} />
                )}
                {projectTab === 'RESULTS' && (
                  <ResultsPage project={activeProject} />
                )}
                {projectTab === 'FINDINGS' && (
                  <FindingsPage project={activeProject} />
                )}
                {projectTab === 'EVIDENCE' && (
                  <EvidencePage project={activeProject} />
                )}
                {projectTab === 'INTEGRATIONS' && (
                  <IntegrationsPage project={activeProject} />
                )}
              </main>
            </>
          ) : (
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <ProjectsPage
                projects={projects}
                onSelectProject={handleSelectProject}
                onOpenNewProject={() => setIsNewProjectModalOpen(true)}
              />
            </main>
          )}
        </div>
      )}

      {/* New Project Creation Flow Modal */}
      <NewProjectModal
        isOpen={isNewProjectModalOpen}
        onClose={() => setIsNewProjectModalOpen(false)}
        onProjectCreated={handleProjectCreated}
      />

      {/* Authoritative Product Constitution Modal */}
      <ConstitutionModal
        isOpen={isConstitutionOpen}
        onClose={() => setIsConstitutionOpen(false)}
      />
    </div>
  );
};

export const AuthenticatedAppBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { mode } = useServices();
  const { isAuthenticated, isLoading } = useAuth();

  // In MOCK mode: deterministic mock/reference operation bypasses real login,
  // but AuthContext provides the valid mock admin principal.
  if (mode === 'MOCK') {
    return <>{children}</>;
  }

  // In API mode:
  // 1. While restoring session, render neutral loading indicator
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
        <div className="flex items-center gap-3 text-slate-400 text-xs font-mono">
          <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
          <span>Restoring platform authority session...</span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated -> LoginPage
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // 3. Authenticated -> portal
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ServiceProvider>
      <AuthProvider>
        <AuthenticatedAppBoundary>
          <AppContent />
        </AuthenticatedAppBoundary>
      </AuthProvider>
    </ServiceProvider>
  );
};

export default App;
