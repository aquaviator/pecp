// IArtefactRepository
// Defined according to Real Strategy and Test Plan Workflow

import { SavedArtefactRecord, SavedArtefactRevisionRecord } from '../types.js';

export interface IArtefactRepository {
  listByProject(projectId: string): Promise<SavedArtefactRecord[]>;
  getById(projectId: string, artefactId: string): Promise<SavedArtefactRecord | null>;
  getByType(projectId: string, artefactType: string): Promise<SavedArtefactRecord | null>;
  getRevision(
    projectId: string,
    artefactId: string,
    revisionNumber: number
  ): Promise<SavedArtefactRevisionRecord | null>;
  listRevisions(projectId: string, artefactId: string): Promise<SavedArtefactRevisionRecord[]>;
  saveArtefactWithRevision(
    artefact: SavedArtefactRecord,
    revision: SavedArtefactRevisionRecord
  ): Promise<void>;
}
