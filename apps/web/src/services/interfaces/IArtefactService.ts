import {
  ArtefactListItem,
  ArtefactDetailResponse,
  GenerateArtefactInput
} from '@pecp/pe-domain';

export interface IArtefactService {
  listArtefacts(projectId: string): Promise<ArtefactListItem[]>;
  getArtefact(
    projectId: string,
    artefactIdOrType: string,
    revisionNumber?: number
  ): Promise<ArtefactDetailResponse>;
  generateArtefact(
    projectId: string,
    input: GenerateArtefactInput
  ): Promise<ArtefactDetailResponse>;
  exportArtefactMarkdown(
    projectId: string,
    artefactIdOrType: string,
    revisionNumber?: number
  ): Promise<string>;
}
