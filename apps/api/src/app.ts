// Fastify API Application Factory
// Defined according to M5.0 Work Package §4

import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { EngineeringIntent, ProjectCreationMethod } from '@pecp/pe-domain';
import {
  PlatformApplicationService,
  OrganisationStatus
} from '@pecp/platform-core';
import { SqliteDatabase } from './persistence/sqlite/SqliteDatabase';
import { SqliteOrganisationRepository } from './persistence/sqlite/SqliteOrganisationRepository';
import { SqliteProjectRepository } from './persistence/sqlite/SqliteProjectRepository';
import { SqliteEntityRevisionRepository } from './persistence/sqlite/SqliteEntityRevisionRepository';
import { SqliteIntelligenceRepository } from './persistence/sqlite/SqliteIntelligenceRepository';

export interface ApiAppOptions {
  dbPath?: string;
  database?: SqliteDatabase;
  platformService?: PlatformApplicationService;
  logger?: boolean;
}

const VALID_INTENTS: Set<string> = new Set<EngineeringIntent>([
  'DISCOVERY',
  'REPRESENTATIVE',
  'FORECAST',
  'INVESTIGATIVE',
  'CERTIFICATION'
]);

const VALID_CREATION_METHODS: Set<string> = new Set<ProjectCreationMethod>([
  'BRIEF',
  'UPLOAD_DOCUMENTS',
  'CONNECT_EXISTING',
  'ANALYSE_EXISTING'
]);

const VALID_ORG_STATUSES: Set<string> = new Set<OrganisationStatus>([
  'ACTIVE',
  'ARCHIVED'
]);

const VALID_PROJECT_STATUSES: Set<string> = new Set([
  'ACTIVE',
  'ARCHIVED',
  'DRAFT'
]);

export function buildApiApp(options: ApiAppOptions = {}): FastifyInstance {
  const app = fastify({
    logger: options.logger ?? false
  });

  // CORS support
  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
  });

  // Persistence & Services initialization
  let db: SqliteDatabase;
  if (options.database) {
    db = options.database;
  } else {
    const dbPath = options.dbPath || process.env.PECP_DB_PATH || ':memory:';
    db = new SqliteDatabase(dbPath);
    db.open();
  }

  let service: PlatformApplicationService;
  if (options.platformService) {
    service = options.platformService;
  } else {
    const orgRepo = new SqliteOrganisationRepository(db);
    const projectRepo = new SqliteProjectRepository(db);
    const revisionRepo = new SqliteEntityRevisionRepository(db);
    const intelligenceRepo = new SqliteIntelligenceRepository(db);
    service = new PlatformApplicationService({
      organisationRepository: orgRepo,
      projectRepository: projectRepo,
      entityRevisionRepository: revisionRepo,
      intelligenceRepository: intelligenceRepo,
      unitOfWork: db
    });
  }

  // Consistent Error Handler
  app.setErrorHandler((error: any, request, reply) => {
    const statusCode = error?.statusCode || 500;

    let code = 'INTERNAL_ERROR';
    if (statusCode === 400) code = 'VALIDATION_ERROR';
    else if (statusCode === 404) code = 'NOT_FOUND';
    else if (statusCode === 409) code = 'CONFLICT';

    // Do not leak SQL statements or file paths in 500 errors
    let message = error?.message;
    if (statusCode >= 500) {
      message = 'An unexpected internal error occurred';
    }

    reply.status(statusCode).send({
      error: {
        code,
        message,
        details: error?.details || undefined
      }
    });
  });

  // --- Health & Readiness Endpoints ---

  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  });

  app.get('/ready', async (request, reply) => {
    const ready = db.isReady();
    if (!ready) {
      reply.status(503).send({
        status: 'unready',
        error: {
          code: 'PERSISTENCE_NOT_READY',
          message: 'Database persistence or migrations are not ready'
        }
      });
      return;
    }
    return {
      status: 'ready',
      database: 'connected',
      migrationsApplied: db.getMigrationsApplied()
    };
  });

  // --- Versioned API: /api/v1 ---

  // Organisations
  app.get('/api/v1/organisations', async () => {
    const orgs = await service.listOrganisations();
    return { items: orgs };
  });

  app.post('/api/v1/organisations', async (request, reply) => {
    const body = request.body as any;
    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Organisation name is required and cannot be empty'
        }
      });
      return;
    }

    try {
      const created = await service.createOrganisation({ name: body.name.trim() });
      reply.status(201).send(created);
    } catch (err: any) {
      if (err.statusCode === 409) {
        reply.status(409).send({
          error: {
            code: 'CONFLICT',
            message: err.message
          }
        });
        return;
      }
      throw err;
    }
  });

  app.get('/api/v1/organisations/:organisationId', async (request, reply) => {
    const { organisationId } = request.params as { organisationId: string };
    const org = await service.getOrganisationById(organisationId);
    if (!org) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Organisation '${organisationId}' not found`
        }
      });
      return;
    }
    return org;
  });

  app.patch('/api/v1/organisations/:organisationId/status', async (request, reply) => {
    const { organisationId } = request.params as { organisationId: string };
    const body = request.body as any;
    if (!body || !VALID_ORG_STATUSES.has(body.status)) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid status '${body?.status}'. Allowed: ACTIVE, ARCHIVED`
        }
      });
      return;
    }

    const updated = await service.updateOrganisationStatus(organisationId, body.status);
    if (!updated) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Organisation '${organisationId}' not found`
        }
      });
      return;
    }
    return updated;
  });

  // Projects
  app.get('/api/v1/projects', async () => {
    const projects = await service.listProjects();
    return { items: projects };
  });

  app.post('/api/v1/projects', async (request, reply) => {
    const body = request.body as any;
    if (!body || typeof body !== 'object') {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body must be a valid JSON object'
        }
      });
      return;
    }

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project name is required'
        }
      });
      return;
    }

    if (!body.organisation || typeof body.organisation !== 'string' || !body.organisation.trim()) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Project organisation is required'
        }
      });
      return;
    }

    if (!body.intent || !VALID_INTENTS.has(body.intent)) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid engineering intent '${body.intent}'. Allowed: ${Array.from(VALID_INTENTS).join(', ')}`
        }
      });
      return;
    }

    if (body.creationMethod && !VALID_CREATION_METHODS.has(body.creationMethod)) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid creationMethod '${body.creationMethod}'. Allowed: ${Array.from(VALID_CREATION_METHODS).join(', ')}`
        }
      });
      return;
    }

    const created = await service.createProject({
      name: body.name.trim(),
      organisation: body.organisation.trim(),
      organisationId: body.organisationId,
      intent: body.intent,
      description: typeof body.description === 'string' ? body.description : '',
      creationMethod: body.creationMethod || 'BRIEF',
      briefText: body.briefText,
      uploadedDocumentNames: Array.isArray(body.uploadedDocumentNames) ? body.uploadedDocumentNames : undefined,
      externalReference: body.externalReference
    });

    reply.status(201).send(created);
  });

  app.get('/api/v1/projects/:projectId', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const project = await service.getProjectById(projectId);
    if (!project) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Project '${projectId}' not found`
        }
      });
      return;
    }
    return project;
  });

  app.patch('/api/v1/projects/:projectId', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const body = request.body as any;
    if (!body || typeof body !== 'object') {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body must be a valid JSON object'
        }
      });
      return;
    }

    if (body.intent && !VALID_INTENTS.has(body.intent)) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid engineering intent '${body.intent}'`
        }
      });
      return;
    }

    if (body.status && !VALID_PROJECT_STATUSES.has(body.status)) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid project status '${body.status}'`
        }
      });
      return;
    }

    const updated = await service.updateProject(projectId, {
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      intent: body.intent,
      status: body.status
    });

    if (!updated) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Project '${projectId}' not found`
        }
      });
      return;
    }

    return updated;
  });

  app.post('/api/v1/projects/:projectId/archive', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const archived = await service.archiveProject(projectId);
    if (!archived) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `Project '${projectId}' not found`
        }
      });
      return;
    }
    return archived;
  });

  app.get('/api/v1/organisations/:organisationId/projects', async (request, reply) => {
    const { organisationId } = request.params as { organisationId: string };
    try {
      const projects = await service.listProjectsByOrganisation(organisationId);
      return { items: projects };
    } catch (err: any) {
      if (err.statusCode === 404) {
        reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: err.message
          }
        });
        return;
      }
      throw err;
    }
  });

  // §7 Persistent Intelligence Read Model
  app.get('/api/v1/projects/:projectId/intelligence', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    try {
      const items = await service.listProjectIntelligence(projectId);
      return { items };
    } catch (err: any) {
      if (err.statusCode === 404) {
        reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: err.message
          }
        });
        return;
      }
      throw err;
    }
  });

  app.get('/api/v1/projects/:projectId/intelligence/:itemId', async (request, reply) => {
    const { projectId, itemId } = request.params as { projectId: string; itemId: string };
    try {
      const item = await service.getProjectIntelligenceItem(projectId, itemId);
      if (!item) {
        reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: `Intelligence item '${itemId}' not found in project '${projectId}'`
          }
        });
        return;
      }
      return item;
    } catch (err: any) {
      if (err.statusCode === 404) {
        reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: err.message
          }
        });
        return;
      }
      throw err;
    }
  });

  // Add cleanup hook on close
  app.addHook('onClose', async () => {
    db.close();
  });

  return app;
}
