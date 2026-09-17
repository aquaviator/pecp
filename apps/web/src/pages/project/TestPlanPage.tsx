import React, { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { ProjectSummary, IntelligenceItem } from '../../types';
import { useServices } from '../../services/ServiceContext';
import { compileDraftPerformanceContract } from '@pecp/workload-engine';
import { generatePerformanceTestPlan } from '@pecp/artefact-engine';
import { ArtefactDocumentViewer } from '../../components/artefacts/ArtefactDocumentViewer';

interface TestPlanPageProps {
  project: ProjectSummary;
  initialItems?: IntelligenceItem[];
}

export const TestPlanPage: React.FC<TestPlanPageProps> = ({ project, initialItems }) => {
  const { intelligenceService } = useServices();
  const [items, setItems] = useState<IntelligenceItem[]>(initialItems || []);

  useEffect(() => {
    if (!initialItems || initialItems.length === 0) {
      intelligenceService.getIntelligenceItems(project.id).then(setItems).catch(console.error);
    }
  }, [project.id, initialItems, intelligenceService]);

  // Compile the Draft Performance Contract deterministically
  const contract = compileDraftPerformanceContract({
    projectSummary: project,
    intelligenceItems: items,
    version: 'v0.1-draft'
  });

  // Deterministically generate the Performance Test Plan artefact
  const testPlanArtefact = generatePerformanceTestPlan({
    contract,
    intelligenceItems: items,
    projectSummary: project,
    artefactVersion: 'v1.0-draft'
  });

  return (
    <ArtefactDocumentViewer
      artefact={testPlanArtefact}
      icon={ClipboardList}
      accentColor="emerald"
    />
  );
};
