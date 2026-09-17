import React, { useEffect, useState } from 'react';
import { Compass } from 'lucide-react';
import { ProjectSummary, IntelligenceItem } from '../../types';
import { useServices } from '../../services/ServiceContext';
import { compileDraftPerformanceContract } from '@pecp/workload-engine';
import { generatePerformanceStrategy } from '@pecp/artefact-engine';
import { ArtefactDocumentViewer } from '../../components/artefacts/ArtefactDocumentViewer';

interface StrategyPageProps {
  project: ProjectSummary;
  initialItems?: IntelligenceItem[];
}

export const StrategyPage: React.FC<StrategyPageProps> = ({ project, initialItems }) => {
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

  // Deterministically generate the Performance Strategy artefact
  const strategyArtefact = generatePerformanceStrategy({
    contract,
    intelligenceItems: items,
    projectSummary: project,
    artefactVersion: 'v1.0-draft'
  });

  return (
    <ArtefactDocumentViewer
      artefact={strategyArtefact}
      icon={Compass}
      accentColor="sky"
    />
  );
};
