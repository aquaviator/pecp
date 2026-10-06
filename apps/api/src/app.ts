// Fastify API Application Factory
// Defined according to M5.0 & M5.1 Work Package Specifications

import fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'node:crypto';
import cors from '@fastify/cors';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import { EngineeringIntent, ProjectCreationMethod } from '@pecp/pe-domain';
import {
  PlatformApplicationService,
  OrganisationStatus,
  AuthenticatedPrincipal,
  AuthorizationPolicy,
  SessionService,
  LocalAuthenticationProvider,
  AuditService,
  IdentityAdministrationService,
  IntakeService,
  PerformanceContractService,
  ArtefactService,
  OrganisationRole,
  Permission
} from '@pecp/platform-core';
import { SqliteDatabase } from './persistence/sqlite/SqliteDatabase.js';
import { SqliteOrganisationRepository } from './persistence/sqlite/SqliteOrganisationRepository.js';
import { SqliteProjectRepository } from './persistence/sqlite/SqliteProjectRepository.js';
import { SqliteEntityRevisionRepository } from './persistence/sqlite/SqliteEntityRevisionRepository.js';
import { SqliteIntelligenceRepository } from './persistence/sqlite/SqliteIntelligenceRepository.js';
import { SqliteUserRepository } from './persistence/sqlite/SqliteUserRepository.js';
import { SqliteLocalCredentialRepository } from './persistence/sqlite/SqliteLocalCredentialRepository.js';
import { SqliteOrganisationMembershipRepository } from './persistence/sqlite/SqliteOrganisationMembershipRepository.js';
import { SqliteSessionRepository } from './persistence/sqlite/SqliteSessionRepository.js';
import { SqliteAuditEventRepository } from './persistence/sqlite/SqliteAuditEventRepository.js';
import { SqliteSourceRepository } from './persistence/sqlite/SqliteSourceRepository.js';
import { SqliteExtractionRepository } from './persistence/sqlite/SqliteExtractionRepository.js';
import { SqliteChecklistRepository } from './persistence/sqlite/SqliteChecklistRepository.js';
import { SqliteIdempotencyRepository } from './persistence/sqlite/SqliteIdempotencyRepository.js';
import { SqliteArtefactRepository } from './persistence/sqlite/SqliteArtefactRepository.js';
import { SqliteContractRevisionRepository } from './persistence/sqlite/SqliteContractRevisionRepository.js';
import { SqliteGovernanceDecisionRepository } from './persistence/sqlite/SqliteGovernanceDecisionRepository.js';
import { DocumentParserRegistry } from './intake/parsers/DocumentParserRegistry.js';

declare module 'fastify' {
  interface FastifyRequest {
    principal?: AuthenticatedPrincipal;
  }
}

export interface ApiAppOptions {
  dbPath?: string;
  database?: SqliteDatabase;
  platformService?: PlatformApplicationService;
  intakeService?: IntakeService;
  performanceContractService?: PerformanceContractService;
  artefactService?: ArtefactService;
  identityAdminService?: IdentityAdministrationService;
  sessionService?: SessionService;
  localAuthProvider?: LocalAuthenticationProvider;
  auditService?: AuditService;
  logger?: boolean;
  secureCookies?: boolean;
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

const VALID_MEMBERSHIP_ROLES: Set<string> = new Set<OrganisationRole>([
  'ORG_ADMIN',
  'PERFORMANCE_LEAD',
  'PERFORMANCE_ENGINEER',
  'REVIEWER',
  'VIEWER'
]);

const SESSION_COOKIE_NAME = 'pecp_session';
const CSRF_COOKIE_NAME = 'pecp_csrf';

export function buildApiApp(options: ApiAppOptions = {}): FastifyInstance {
  const app = fastify({
    logger: options.logger ?? false
  });

  // CORS configuration
  const allowedOriginsEnv = process.env.PECP_ALLOWED_ORIGINS;
  const allowedOrigins = allowedOriginsEnv
    ? allowedOriginsEnv.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        cb(null, true);
      } else {
        cb(new Error(`Origin '${origin}' not allowed by CORS`), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-PECP-CSRF', 'Accept']
  });

  // Cookie Support
  app.register(fastifyCookie, {
    secret: process.env.PECP_COOKIE_SECRET || 'pecp-local-cookie-secret-change-in-prod',
    parseOptions: {}
  });

  // Multipart Support for file uploads (Bounded to 10 MiB, 1 file per request)
  app.register(fastifyMultipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1
    }
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

  const userRepo = new SqliteUserRepository(db);
  const credentialRepo = new SqliteLocalCredentialRepository(db);
  const membershipRepo = new SqliteOrganisationMembershipRepository(db);
  const sessionRepo = new SqliteSessionRepository(db);
  const auditRepo = new SqliteAuditEventRepository(db);
  const orgRepo = new SqliteOrganisationRepository(db);
  const projectRepo = new SqliteProjectRepository(db);
  const revisionRepo = new SqliteEntityRevisionRepository(db);
  const intelligenceRepo = new SqliteIntelligenceRepository(db);
  const sourceRepo = new SqliteSourceRepository(db);
  const extractionRepo = new SqliteExtractionRepository(db);
  const checklistRepo = new SqliteChecklistRepository(db);
  const idempotencyRepo = new SqliteIdempotencyRepository(db);
  const artefactRepo = new SqliteArtefactRepository(db);
  const contractRevisionRepo = new SqliteContractRevisionRepository(db);
  const governanceDecisionRepo = new SqliteGovernanceDecisionRepository(db);
  const parserRegistry = new DocumentParserRegistry();

  const ttlHours = process.env.PECP_SESSION_TTL_HOURS ? Number(process.env.PECP_SESSION_TTL_HOURS) : 12;
  const sessionService = options.sessionService || new SessionService(sessionRepo, userRepo, ttlHours);
  const localAuthProvider = options.localAuthProvider || new LocalAuthenticationProvider(userRepo, credentialRepo, membershipRepo);
  const auditService = options.auditService || new AuditService(auditRepo);
  const identityAdminService = options.identityAdminService || new IdentityAdministrationService(
    userRepo,
    credentialRepo,
    membershipRepo,
    sessionRepo,
    auditService,
    db
  );

  let service: PlatformApplicationService;
  if (options.platformService) {
    service = options.platformService;
  } else {
    service = new PlatformApplicationService({
      organisationRepository: orgRepo,
      projectRepository: projectRepo,
      entityRevisionRepository: revisionRepo,
      intelligenceRepository: intelligenceRepo,
      membershipRepository: membershipRepo,
      auditService: auditService,
      unitOfWork: db
    });
  }

  const intakeService =
    options.intakeService ||
    new IntakeService({
      sourceRepository: sourceRepo,
      extractionRepository: extractionRepo,
      intelligenceRepository: intelligenceRepo,
      checklistRepository: checklistRepo,
      idempotencyRepository: idempotencyRepo,
      projectRepository: projectRepo,
      membershipRepository: membershipRepo,
      auditService: auditService,
      unitOfWork: db,
      parserRegistry: parserRegistry
    });

  const performanceContractService =
    options.performanceContractService ||
    new PerformanceContractService({
      projectRepository: projectRepo,
      intelligenceRepository: intelligenceRepo,
      sourceRepository: sourceRepo,
      extractionRepository: extractionRepo,
      checklistRepository: checklistRepo,
      membershipRepository: membershipRepo,
      contractRevisionRepository: contractRevisionRepo,
      governanceDecisionRepository: governanceDecisionRepo,
      auditService: auditService,
      idempotencyRepository: idempotencyRepo,
      unitOfWork: db
    });

  const artefactService =
    options.artefactService ||
    new ArtefactService({
      artefactRepository: artefactRepo,
      performanceContractService,
      projectRepository: projectRepo,
      intelligenceRepository: intelligenceRepo,
      membershipRepository: membershipRepo,
      idempotencyRepository: idempotencyRepo,
      contractRevisionRepository: contractRevisionRepo,
      governanceDecisionRepository: governanceDecisionRepo,
      auditService,
      unitOfWork: db
    });

  const isProduction = process.env.NODE_ENV === 'production';
  const secureCookie = options.secureCookies !== undefined ? options.secureCookies : isProduction;

  // Consistent Error Handler
  app.setErrorHandler((error: any, request, reply) => {
    const statusCode = error?.statusCode || 500;

    let code = 'INTERNAL_ERROR';
    if (error?.code === 'FST_REQ_FILE_TOO_LARGE' || statusCode === 413) code = 'RESOURCE_LIMIT_EXCEEDED';
    else if (statusCode === 415) code = 'UNSUPPORTED_MEDIA_TYPE';
    else if (statusCode === 400) code = 'VALIDATION_ERROR';
    else if (statusCode === 401) code = 'UNAUTHORIZED';
    else if (statusCode === 403) code = 'FORBIDDEN';
    else if (statusCode === 404) code = 'NOT_FOUND';
    else if (statusCode === 409) code = 'CONFLICT';

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


  // Authentication & CSRF Hook
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url.split('?')[0];
    const isPublic =
      url === '/health' ||
      url === '/ready' ||
      url === '/api/v1/auth/login';

    let rawToken: string | undefined;
    const cookieToken = request.cookies[SESSION_COOKIE_NAME];
    const authHeader = request.headers.authorization;

    if (cookieToken) {
      rawToken = cookieToken;
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      rawToken = authHeader.slice(7).trim();
    }

    if (rawToken) {
      const valid = await sessionService.validateSession(rawToken);
      if (valid) {
        const principal = await localAuthProvider.buildPrincipal(
          valid.user.id,
          valid.session.id,
          valid.session.authenticatedAt
        );
        if (principal) {
          request.principal = principal;
        }
      }
    }

    if (isPublic) {
      return;
    }

    if (url.startsWith('/api/')) {
      if (!request.principal) {
        reply.status(401).send({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return reply;
      }

      // CSRF check for browser mutations authenticated via cookie
      const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method);
      if (isMutation && cookieToken) {
        const csrfCookie = request.cookies[CSRF_COOKIE_NAME];
        const csrfHeader = request.headers['x-pecp-csrf'] as string | undefined;
        if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
          reply.status(403).send({
            error: {
              code: 'CSRF_FORBIDDEN',
              message: 'Invalid or missing CSRF token'
            }
          });
          return reply;
        }
      }
    }
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

  // --- Authentication Routes ---

  app.post('/api/v1/auth/login', async (request, reply) => {
    const body = request.body as any;
    if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and password are required'
        }
      });
      return;
    }

    const authResult = await localAuthProvider.authenticate({
      email: body.email,
      password: body.password
    });

    if (!authResult.success || !authResult.user || !authResult.principal) {
      await auditService.record({
        action: 'LOGIN_FAILURE',
        targetType: 'SESSION',
        outcome: 'FAILURE',
        reason: 'Invalid credentials',
        metadata: { attemptedEmail: body.email }
      });
      reply.status(401).send({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
      return;
    }

    const sessionResult = await sessionService.createSession(authResult.user.id);
    const csrfToken = SessionService.generateCsrfToken();

    reply.setCookie(SESSION_COOKIE_NAME, sessionResult.rawToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookie
    });

    reply.setCookie(CSRF_COOKIE_NAME, csrfToken, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      secure: secureCookie
    });

    authResult.principal.sessionId = sessionResult.session.id;
    authResult.principal.authenticatedAt = sessionResult.session.authenticatedAt;

    await auditService.record({
      actor: authResult.principal,
      action: 'LOGIN_SUCCESS',
      targetType: 'SESSION',
      targetId: sessionResult.session.id,
      outcome: 'SUCCESS'
    });

    return {
      user: {
        id: authResult.user.id,
        email: authResult.user.email,
        displayName: authResult.user.displayName,
        status: authResult.user.status,
        platformRole: authResult.user.platformRole
      },
      principal: authResult.principal,
      csrfToken
    };
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    const principal = request.principal!;
    if (principal.sessionId) {
      await sessionService.revokeSession(principal.sessionId);
    }

    reply.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    reply.clearCookie(CSRF_COOKIE_NAME, { path: '/' });

    await auditService.record({
      actor: principal,
      action: 'LOGOUT',
      targetType: 'SESSION',
      targetId: principal.sessionId,
      outcome: 'SUCCESS'
    });

    return { success: true };
  });

  app.get('/api/v1/auth/me', async (request) => {
    const principal = request.principal!;
    const effectivePermissions = AuthorizationPolicy.getEffectivePermissions(principal);

    return {
      user: {
        id: principal.userId,
        email: principal.email,
        displayName: principal.displayName,
        platformRole: principal.platformRole
      },
      principal,
      permissions: effectivePermissions
    };
  });

  app.post('/api/v1/auth/change-password', async (request, reply) => {
    const principal = request.principal!;
    const body = request.body as any;

    if (!body || !body.currentPassword || !body.newPassword) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'currentPassword and newPassword are required'
        }
      });
      return;
    }

    try {
      await identityAdminService.changePassword(principal, body.currentPassword, body.newPassword);
      // Forced reauthentication: revoke all sessions, clear cookies, force explicit login
      reply.clearCookie(SESSION_COOKIE_NAME, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: secureCookie
      });
      reply.clearCookie(CSRF_COOKIE_NAME, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        secure: secureCookie
      });
      return {
        success: true,
        message: 'Password changed successfully. Please log in again.'
      };
    } catch (err: any) {
      reply.status(400).send({
        error: {
          code: 'PASSWORD_CHANGE_FAILED',
          message: err.message
        }
      });
    }
  });

  // --- User Administration Routes (PLATFORM_ADMIN only) ---

  app.get('/api/v1/admin/users', async (request, reply) => {
    const principal = request.principal!;
    if (principal.platformRole !== 'PLATFORM_ADMIN') {
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'PLATFORM_ADMIN role required'
        }
      });
      return;
    }
    const users = await identityAdminService.listUsers(principal);
    return { items: users };
  });

  app.post('/api/v1/admin/users', async (request, reply) => {
    const principal = request.principal!;
    if (principal.platformRole !== 'PLATFORM_ADMIN') {
      await auditService.record({
        actor: principal,
        action: 'AUTHORIZATION_DENIED',
        targetType: 'USER',
        outcome: 'DENIED',
        reason: 'PLATFORM_ADMIN role required',
        metadata: { attemptedAction: 'USER_CREATE' }
      });
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'PLATFORM_ADMIN role required'
        }
      });
      return;
    }

    const body = request.body as any;
    if (!body || !body.email || !body.displayName) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email and displayName are required'
        }
      });
      return;
    }

    try {
      const created = await identityAdminService.createUser(principal, {
        email: body.email,
        displayName: body.displayName,
        platformRole: body.platformRole || 'NONE',
        password: body.password
      });
      reply.status(201).send(created);
    } catch (err: any) {
      const status = err.message?.includes('already exists') ? 409 : 400;
      reply.status(status).send({
        error: {
          code: status === 409 ? 'CONFLICT' : 'VALIDATION_ERROR',
          message: err.message
        }
      });
    }
  });

  app.get('/api/v1/admin/users/:userId', async (request, reply) => {
    const principal = request.principal!;
    const { userId } = request.params as { userId: string };

    if (principal.platformRole !== 'PLATFORM_ADMIN' && principal.userId !== userId) {
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied'
        }
      });
      return;
    }

    const user = await identityAdminService.getUserById(principal, userId);
    if (!user) {
      reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message: `User '${userId}' not found`
        }
      });
      return;
    }
    return user;
  });

  app.patch('/api/v1/admin/users/:userId/status', async (request, reply) => {
    const principal = request.principal!;
    const { userId } = request.params as { userId: string };
    const body = request.body as any;

    if (principal.platformRole !== 'PLATFORM_ADMIN') {
      await auditService.record({
        actor: principal,
        action: 'AUTHORIZATION_DENIED',
        targetType: 'USER',
        targetId: userId,
        outcome: 'DENIED',
        reason: 'PLATFORM_ADMIN role required',
        metadata: { attemptedAction: 'USER_STATUS_CHANGE' }
      });
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'PLATFORM_ADMIN role required'
        }
      });
      return;
    }

    if (!body || (body.status !== 'ACTIVE' && body.status !== 'DISABLED')) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: "Status must be 'ACTIVE' or 'DISABLED'"
        }
      });
      return;
    }

    try {
      const updated = await identityAdminService.updateUserStatus(principal, userId, body.status);
      return updated;
    } catch (err: any) {
      const status = err.message?.includes('not found') ? 404 : 400;
      reply.status(status).send({
        error: {
          code: status === 404 ? 'NOT_FOUND' : 'OPERATION_FAILED',
          message: err.message
        }
      });
    }
  });

  app.post('/api/v1/admin/users/:userId/reset-password', async (request, reply) => {
    const principal = request.principal!;
    const { userId } = request.params as { userId: string };
    const body = request.body as any;

    if (principal.platformRole !== 'PLATFORM_ADMIN') {
      await auditService.record({
        actor: principal,
        action: 'AUTHORIZATION_DENIED',
        targetType: 'USER',
        targetId: userId,
        outcome: 'DENIED',
        reason: 'PLATFORM_ADMIN role required',
        metadata: { attemptedAction: 'PASSWORD_RESET' }
      });
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'PLATFORM_ADMIN role required'
        }
      });
      return;
    }

    if (!body || !body.newPassword) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'newPassword is required'
        }
      });
      return;
    }

    try {
      await identityAdminService.resetPassword(principal, userId, body.newPassword);
      return { success: true };
    } catch (err: any) {
      const status = err.message?.includes('not found') ? 404 : 400;
      reply.status(status).send({
        error: {
          code: status === 404 ? 'NOT_FOUND' : 'VALIDATION_ERROR',
          message: err.message
        }
      });
    }
  });

  // --- Organisation Membership Routes ---

  app.get('/api/v1/organisations/:organisationId/memberships', async (request, reply) => {
    const principal = request.principal!;
    const { organisationId } = request.params as { organisationId: string };

    const canManage = AuthorizationPolicy.hasPermission(principal, 'ORGANISATION_MANAGE_MEMBERS', organisationId);
    if (!canManage) {
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'ORGANISATION_MANAGE_MEMBERS permission required to view organisation memberships'
        }
      });
      return;
    }

    const memberships = await identityAdminService.listMemberships(principal, organisationId);
    return { items: memberships };
  });

  app.post('/api/v1/organisations/:organisationId/memberships', async (request, reply) => {
    const principal = request.principal!;
    const { organisationId } = request.params as { organisationId: string };
    const body = request.body as any;

    const canManage = AuthorizationPolicy.hasPermission(principal, 'ORGANISATION_MANAGE_MEMBERS', organisationId);
    if (!canManage) {
      await auditService.record({
        actor: principal,
        organisationId,
        action: 'AUTHORIZATION_DENIED',
        targetType: 'MEMBERSHIP',
        outcome: 'DENIED',
        reason: 'ORGANISATION_MANAGE_MEMBERS permission required',
        metadata: { attemptedAction: 'MEMBERSHIP_CREATE' }
      });
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'ORGANISATION_MANAGE_MEMBERS permission required'
        }
      });
      return;
    }

    if (!body || !body.userId || !VALID_MEMBERSHIP_ROLES.has(body.role)) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: `userId and a valid role (${Array.from(VALID_MEMBERSHIP_ROLES).join(', ')}) are required`
        }
      });
      return;
    }

    try {
      const membership = await identityAdminService.addMembership(
        principal,
        organisationId,
        body.userId,
        body.role
      );
      reply.status(201).send(membership);
    } catch (err: any) {
      const isConflict = err.statusCode === 409 || err.message?.includes('already exists');
      const status = isConflict ? 409 : 400;
      reply.status(status).send({
        error: {
          code: isConflict ? 'CONFLICT' : 'OPERATION_FAILED',
          message: err.message
        }
      });
    }
  });

  app.patch('/api/v1/organisations/:organisationId/memberships/:userId/role', async (request, reply) => {
    const principal = request.principal!;
    const { organisationId, userId } = request.params as { organisationId: string; userId: string };
    const body = request.body as any;

    const canManage = AuthorizationPolicy.hasPermission(principal, 'ORGANISATION_MANAGE_MEMBERS', organisationId);
    if (!canManage) {
      await auditService.record({
        actor: principal,
        organisationId,
        action: 'AUTHORIZATION_DENIED',
        targetType: 'MEMBERSHIP',
        targetId: `${organisationId}:${userId}`,
        outcome: 'DENIED',
        reason: 'ORGANISATION_MANAGE_MEMBERS permission required',
        metadata: { attemptedAction: 'MEMBERSHIP_ROLE_CHANGE' }
      });
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'ORGANISATION_MANAGE_MEMBERS permission required'
        }
      });
      return;
    }

    if (!body || !VALID_MEMBERSHIP_ROLES.has(body.role)) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Valid role (${Array.from(VALID_MEMBERSHIP_ROLES).join(', ')}) is required`
        }
      });
      return;
    }

    try {
      const updated = await identityAdminService.updateMembershipRole(
        principal,
        organisationId,
        userId,
        body.role
      );
      return updated;
    } catch (err: any) {
      reply.status(400).send({
        error: {
          code: 'OPERATION_FAILED',
          message: err.message
        }
      });
    }
  });

  app.post('/api/v1/organisations/:organisationId/memberships/:userId/revoke', async (request, reply) => {
    const principal = request.principal!;
    const { organisationId, userId } = request.params as { organisationId: string; userId: string };

    const canManage = AuthorizationPolicy.hasPermission(principal, 'ORGANISATION_MANAGE_MEMBERS', organisationId);
    if (!canManage) {
      await auditService.record({
        actor: principal,
        organisationId,
        action: 'AUTHORIZATION_DENIED',
        targetType: 'MEMBERSHIP',
        targetId: `${organisationId}:${userId}`,
        outcome: 'DENIED',
        reason: 'ORGANISATION_MANAGE_MEMBERS permission required',
        metadata: { attemptedAction: 'MEMBERSHIP_REVOKE' }
      });
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'ORGANISATION_MANAGE_MEMBERS permission required'
        }
      });
      return;
    }

    try {
      await identityAdminService.revokeMembership(principal, organisationId, userId);
      return { success: true };
    } catch (err: any) {
      reply.status(400).send({
        error: {
          code: 'OPERATION_FAILED',
          message: err.message
        }
      });
    }
  });

  // --- Audit Trail Queries ---

  app.get('/api/v1/audit', async (request, reply) => {
    const principal = request.principal!;
    const query = request.query as any;

    const isPlatformAdmin = principal.platformRole === 'PLATFORM_ADMIN';
    const targetOrgId = query.organisationId;

    if (!isPlatformAdmin) {
      if (targetOrgId) {
        if (!AuthorizationPolicy.hasPermission(principal, 'AUDIT_READ', targetOrgId)) {
          reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'AUDIT_READ permission required for this organisation'
            }
          });
          return;
        }
      } else {
        // If no organisation is specified, user must have AUDIT_READ in at least one organisation
        const allowedOrgs = principal.memberships
          .filter((m) => AuthorizationPolicy.hasPermission(principal, 'AUDIT_READ', m.organisationId))
          .map((m) => m.organisationId);

        if (allowedOrgs.length === 0) {
          reply.status(403).send({
            error: {
              code: 'FORBIDDEN',
              message: 'AUDIT_READ permission required'
            }
          });
          return;
        }
      }
    }

    const events = await auditService.query({
      organisationId: targetOrgId,
      projectId: query.projectId,
      actorUserId: query.actorUserId,
      action: query.action,
      limit: query.limit ? Number(query.limit) : undefined,
      before: query.before,
      after: query.after
    });

    // Tenant filter: if not platform admin and no specific organisationId in query, filter events to user's permitted organisations
    let filteredEvents = events;
    if (!isPlatformAdmin && !targetOrgId) {
      const allowedOrgs = new Set(
        principal.memberships
          .filter((m) => AuthorizationPolicy.hasPermission(principal, 'AUDIT_READ', m.organisationId))
          .map((m) => m.organisationId)
      );
      filteredEvents = events.filter((e) => e.organisationId && allowedOrgs.has(e.organisationId));
    }

    return { items: filteredEvents };
  });

  // --- Tenancy-Governed Organisations API ---

  app.get('/api/v1/organisations', async (request) => {
    const principal = request.principal!;
    const allOrgs = await service.listOrganisations();

    if (principal.platformRole === 'PLATFORM_ADMIN') {
      return { items: allOrgs };
    }

    const memberOrgIds = new Set(principal.memberships.map((m) => m.organisationId));
    const allowedOrgs = allOrgs.filter((org) => memberOrgIds.has(org.id));
    return { items: allowedOrgs };
  });

  app.post('/api/v1/organisations', async (request, reply) => {
    const principal = request.principal!;
    if (principal.platformRole !== 'PLATFORM_ADMIN') {
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Only PLATFORM_ADMIN may create new organisations'
        }
      });
      return;
    }

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
      const created = await service.createOrganisation({ name: body.name.trim() }, principal);
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
    const principal = request.principal!;
    const { organisationId } = request.params as { organisationId: string };

    const hasAccess =
      principal.platformRole === 'PLATFORM_ADMIN' ||
      principal.memberships.some((m) => m.organisationId === organisationId);

    if (!hasAccess) {
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to organisation'
        }
      });
      return;
    }

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
    const principal = request.principal!;
    const { organisationId } = request.params as { organisationId: string };

    const canManage =
      principal.platformRole === 'PLATFORM_ADMIN' ||
      AuthorizationPolicy.hasPermission(principal, 'ORGANISATION_MANAGE_MEMBERS', organisationId);

    if (!canManage) {
      await auditService.record({
        actor: principal,
        organisationId,
        action: 'AUTHORIZATION_DENIED',
        targetType: 'ORGANISATION',
        targetId: organisationId,
        outcome: 'DENIED',
        reason: 'Admin authority required to update organisation status',
        metadata: { attemptedAction: 'ORGANISATION_STATUS_CHANGE' }
      });
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Admin authority required to update organisation status'
        }
      });
      return;
    }

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

    const updated = await service.updateOrganisationStatus(organisationId, body.status, principal);
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

  // --- Tenancy-Governed Projects API ---

  app.get('/api/v1/projects', async (request) => {
    const principal = request.principal!;
    const allProjects = await service.listProjects();

    if (principal.platformRole === 'PLATFORM_ADMIN') {
      return { items: allProjects };
    }

    const memberOrgIds = new Set(
      principal.memberships
        .filter((m) => AuthorizationPolicy.hasPermission(principal, 'PROJECT_READ', m.organisationId))
        .map((m) => m.organisationId)
    );

    const filtered = allProjects.filter((p) => Boolean(p.organisationId && memberOrgIds.has(p.organisationId)));
    return { items: filtered };
  });

  app.post('/api/v1/projects', async (request, reply) => {
    const principal = request.principal!;
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

    if (body.uploadedDocumentNames !== undefined) {
      if (
        !Array.isArray(body.uploadedDocumentNames) ||
        !body.uploadedDocumentNames.every((n: any) => typeof n === 'string')
      ) {
        reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'All uploadedDocumentNames must be strings'
          }
        });
        return;
      }
    }

    // Tenancy authorization check
    let targetOrg = body.organisationId
      ? await service.getOrganisationById(body.organisationId)
      : await service.getOrganisationByName(body.organisation.trim());

    if (targetOrg) {
      const canCreate = AuthorizationPolicy.hasPermission(principal, 'PROJECT_CREATE', targetOrg.id);
      if (!canCreate) {
        await auditService.record({
          actor: principal,
          organisationId: targetOrg.id,
          action: 'AUTHORIZATION_DENIED',
          targetType: 'PROJECT',
          outcome: 'DENIED',
          reason: 'PROJECT_CREATE permission required in target organisation',
          metadata: { attemptedAction: 'PROJECT_CREATE' }
        });
        reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'PROJECT_CREATE permission required in target organisation'
          }
        });
        return;
      }
    } else {
      // Auto-creating an organisation requires PLATFORM_ADMIN
      if (principal.platformRole !== 'PLATFORM_ADMIN') {
        await auditService.record({
          actor: principal,
          action: 'AUTHORIZATION_DENIED',
          targetType: 'ORGANISATION',
          outcome: 'DENIED',
          reason: `Organisation '${body.organisation.trim()}' does not exist and only PLATFORM_ADMIN may create organisations`,
          metadata: { attemptedAction: 'ORGANISATION_CREATE' }
        });
        reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: `Organisation '${body.organisation.trim()}' does not exist and only PLATFORM_ADMIN may create organisations`
          }
        });
        return;
      }
    }

    try {
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
      }, principal);

      reply.status(201).send(created);
    } catch (err: any) {
      if (err.statusCode) {
        reply.status(err.statusCode).send({
          error: {
            code: err.statusCode === 403 ? 'FORBIDDEN' : 'VALIDATION_ERROR',
            message: err.message
          }
        });
        return;
      }
      throw err;
    }
  });

  app.get('/api/v1/projects/:projectId', async (request, reply) => {
    const principal = request.principal!;
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

    const canRead = AuthorizationPolicy.hasPermission(principal, 'PROJECT_READ', project.organisationId);
    if (!canRead) {
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Access denied to project'
        }
      });
      return;
    }

    return project;
  });

  app.patch('/api/v1/projects/:projectId', async (request, reply) => {
    const principal = request.principal!;
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

    const canUpdate = AuthorizationPolicy.hasPermission(principal, 'PROJECT_UPDATE', project.organisationId);
    if (!canUpdate) {
      await auditService.record({
        actor: principal,
        projectId,
        organisationId: project.organisationId,
        action: 'AUTHORIZATION_DENIED',
        targetType: 'PROJECT',
        targetId: projectId,
        outcome: 'DENIED',
        reason: 'PROJECT_UPDATE permission required',
        metadata: { attemptedAction: 'PROJECT_UPDATE' }
      });
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'PROJECT_UPDATE permission required'
        }
      });
      return;
    }

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
    }, principal);

    return updated;
  });

  app.post('/api/v1/projects/:projectId/archive', async (request, reply) => {
    const principal = request.principal!;
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

    const canArchive = AuthorizationPolicy.hasPermission(principal, 'PROJECT_ARCHIVE', project.organisationId);
    if (!canArchive) {
      await auditService.record({
        actor: principal,
        projectId,
        organisationId: project.organisationId,
        action: 'AUTHORIZATION_DENIED',
        targetType: 'PROJECT',
        targetId: projectId,
        outcome: 'DENIED',
        reason: 'PROJECT_ARCHIVE permission required',
        metadata: { attemptedAction: 'PROJECT_ARCHIVE' }
      });
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'PROJECT_ARCHIVE permission required'
        }
      });
      return;
    }

    const archived = await service.archiveProject(projectId, principal);
    return archived;
  });

  app.get('/api/v1/organisations/:organisationId/projects', async (request, reply) => {
    const principal = request.principal!;
    const { organisationId } = request.params as { organisationId: string };

    const canRead = AuthorizationPolicy.hasPermission(principal, 'PROJECT_READ', organisationId);
    if (!canRead) {
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'PROJECT_READ permission required for this organisation'
        }
      });
      return;
    }

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

  // --- Governed Intelligence API ---

  app.get('/api/v1/projects/:projectId/intelligence', async (request, reply) => {
    const principal = request.principal!;
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

    const canRead = AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_READ', project.organisationId);
    if (!canRead) {
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'INTELLIGENCE_READ permission required'
        }
      });
      return;
    }

    const items = await service.listProjectIntelligence(projectId);
    return { items };
  });

  app.get('/api/v1/projects/:projectId/intelligence/:itemId', async (request, reply) => {
    const principal = request.principal!;
    const { projectId, itemId } = request.params as { projectId: string; itemId: string };
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

    const canRead = AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_READ', project.organisationId);
    if (!canRead) {
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'INTELLIGENCE_READ permission required'
        }
      });
      return;
    }

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
  });

  app.post('/api/v1/projects/:projectId/intelligence/:itemId/resolve', async (request, reply) => {
    const principal = request.principal!;
    const { projectId, itemId } = request.params as { projectId: string; itemId: string };
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

    const canResolve = AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_RESOLVE', project.organisationId);
    const canApprove = AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_APPROVE', project.organisationId);

    if (!canResolve || !canApprove) {
      await auditService.record({
        actor: principal,
        projectId,
        organisationId: project.organisationId,
        action: 'AUTHORIZATION_DENIED',
        targetType: 'INTELLIGENCE_ITEM',
        targetId: itemId,
        outcome: 'DENIED',
        reason: 'Both INTELLIGENCE_RESOLVE and INTELLIGENCE_APPROVE permissions are required',
        metadata: { attemptedAction: 'INTELLIGENCE_CONFLICT_RESOLVE' }
      });
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'Both INTELLIGENCE_RESOLVE and INTELLIGENCE_APPROVE permissions are required'
        }
      });
      return;
    }

    const body = request.body as any;
    if (!body || !body.chosenCandidateId || typeof body.chosenCandidateId !== 'string') {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'chosenCandidateId is required'
        }
      });
      return;
    }

    try {
      const resolved = await intakeService.resolveConflict(
        projectId,
        itemId,
        body.chosenCandidateId,
        body.rationale,
        body.expectedRevision !== undefined ? Number(body.expectedRevision) : undefined,
        principal
      );
      return resolved;
    } catch (err: any) {
      const status = err.statusCode || 400;
      reply.status(status).send({
        error: {
          code: status === 409 ? 'CONFLICT' : status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'OPERATION_FAILED',
          message: err.message
        }
      });
    }
  });

  app.post('/api/v1/projects/:projectId/intelligence/:itemId/approve', async (request, reply) => {
    const principal = request.principal!;
    const { projectId, itemId } = request.params as { projectId: string; itemId: string };
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

    const canApprove = AuthorizationPolicy.hasPermission(principal, 'INTELLIGENCE_APPROVE', project.organisationId);
    if (!canApprove) {
      await auditService.record({
        actor: principal,
        projectId,
        organisationId: project.organisationId,
        action: 'AUTHORIZATION_DENIED',
        targetType: 'INTELLIGENCE_ITEM',
        targetId: itemId,
        outcome: 'DENIED',
        reason: 'INTELLIGENCE_APPROVE permission required',
        metadata: { attemptedAction: 'INTELLIGENCE_APPROVE' }
      });
      reply.status(403).send({
        error: {
          code: 'FORBIDDEN',
          message: 'INTELLIGENCE_APPROVE permission required'
        }
      });
      return;
    }

    const body = (request.body as any) || {};

    try {
      const approved = await intakeService.approveIntelligenceItem(
        projectId,
        itemId,
        body.expectedRevision !== undefined ? Number(body.expectedRevision) : undefined,
        principal
      );
      return approved;
    } catch (err: any) {
      const status = err.statusCode || 400;
      reply.status(status).send({
        error: {
          code: status === 409 ? 'CONFLICT' : status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'OPERATION_FAILED',
          message: err.message
        }
      });
    }
  });


  // --- M5.2 Sources & Intake API (§10 [I08]) ---

  app.get('/api/v1/projects/:projectId/sources', async (request, reply) => {
    const principal = request.principal!;
    const { projectId } = request.params as { projectId: string };

    try {
      const sources = await intakeService.listSources(projectId, principal);
      return { items: sources };
    } catch (err: any) {
      const status = err.statusCode || 404;
      reply.status(status).send({
        error: {
          code: status === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
          message: err.message
        }
      });
    }
  });

  app.post('/api/v1/projects/:projectId/sources/text', async (request, reply) => {
    const principal = request.principal!;
    const { projectId } = request.params as { projectId: string };
    const body = request.body as any;

    if (!body || !body.text || !body.kind) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: "kind ('BRIEF' or 'MANUAL_ASSERTION') and text are required"
        }
      });
      return;
    }

    if (body.kind !== 'BRIEF' && body.kind !== 'MANUAL_ASSERTION') {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: "kind must be 'BRIEF' or 'MANUAL_ASSERTION'"
        }
      });
      return;
    }

    // Idempotency check
    const idempKey = (request.headers['idempotency-key'] || request.headers['x-idempotency-key']) as string | undefined;
    const payloadHash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
    const scopedKey = idempKey ? `${projectId}:${principal.userId}:source_text:${idempKey}` : undefined;

    if (scopedKey && idempotencyRepo) {
      const existing = await idempotencyRepo.get(scopedKey);
      if (existing) {
        if (existing.payloadSha256 !== payloadHash) {
          reply.status(409).send({
            error: {
              code: 'IDEMPOTENCY_CONFLICT',
              message: 'Idempotency key replayed with differing payload'
            }
          });
          return;
        }
        return reply.status(existing.responseStatus).send(JSON.parse(existing.responseJson));
      }
    }

    try {
      const result = await intakeService.captureTextSource(
        projectId,
        {
          kind: body.kind,
          title: body.title || (body.kind === 'BRIEF' ? 'Project Brief' : 'Stakeholder Assertion'),
          text: body.text,
          format: body.format,
          suppliedAuthoredAt: body.suppliedAuthoredAt,
          suppliedSpeaker: body.suppliedSpeaker,
          suppliedExternalReference: body.suppliedExternalReference
        },
        principal
      );

      if (scopedKey && idempotencyRepo) {
        await idempotencyRepo.save({
          key: scopedKey,
          projectId,
          actorUserId: principal.userId,
          operation: 'source_text',
          payloadSha256: payloadHash,
          responseStatus: 201,
          responseJson: JSON.stringify(result),
          createdAt: new Date().toISOString()
        });
      }

      reply.status(201).send(result);
    } catch (err: any) {
      const status = err.statusCode || 400;
      reply.status(status).send({
        error: {
          code: status === 413 ? 'RESOURCE_LIMIT_EXCEEDED' : status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'VALIDATION_ERROR',
          message: err.message
        }
      });
    }
  });

  app.post('/api/v1/projects/:projectId/sources/upload', async (request, reply) => {
    const principal = request.principal!;
    const { projectId } = request.params as { projectId: string };

    // Check project write permission before consuming upload stream
    await intakeService.assertSourceWritePermission(projectId, principal);

    let data: any;
    try {
      data = await request.file();
    } catch (err: any) {
      if (err.code === 'FST_REQ_FILE_TOO_LARGE') {
        reply.status(413).send({
          error: {
            code: 'RESOURCE_LIMIT_EXCEEDED',
            message: 'File size exceeds 10 MiB upload limit'
          }
        });
        return;
      }
      throw err;
    }

    if (!data) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No file uploaded'
        }
      });
      return;
    }

    const buffer = await data.toBuffer();
    const title = (data.fields?.title as any)?.value;

    // Idempotency check
    const idempKey = (request.headers['idempotency-key'] || request.headers['x-idempotency-key']) as string | undefined;
    const payloadHash = createHash('sha256').update(buffer).digest('hex');
    const scopedKey = idempKey ? `${projectId}:${principal.userId}:source_upload:${idempKey}` : undefined;

    if (scopedKey && idempotencyRepo) {
      const existing = await idempotencyRepo.get(scopedKey);
      if (existing) {
        if (existing.payloadSha256 !== payloadHash) {
          reply.status(409).send({
            error: {
              code: 'IDEMPOTENCY_CONFLICT',
              message: 'Idempotency key replayed with differing file content'
            }
          });
          return;
        }
        return reply.status(existing.responseStatus).send(JSON.parse(existing.responseJson));
      }
    }

    try {
      const result = await intakeService.captureUploadSource(
        projectId,
        {
          filename: data.filename,
          buffer,
          mimeType: data.mimetype,
          title
        },
        principal
      );

      if (scopedKey && idempotencyRepo) {
        await idempotencyRepo.save({
          key: scopedKey,
          projectId,
          actorUserId: principal.userId,
          operation: 'source_upload',
          payloadSha256: payloadHash,
          responseStatus: 201,
          responseJson: JSON.stringify(result),
          createdAt: new Date().toISOString()
        });
      }

      reply.status(201).send(result);
    } catch (err: any) {
      const status = err.statusCode || 400;
      reply.status(status).send({
        error: {
          code: status === 413 ? 'RESOURCE_LIMIT_EXCEEDED' : status === 415 ? 'UNSUPPORTED_MEDIA_TYPE' : status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'VALIDATION_ERROR',
          message: err.message
        }
      });
    }
  });

  app.get('/api/v1/projects/:projectId/sources/:sourceId', async (request, reply) => {
    const principal = request.principal!;
    const { projectId, sourceId } = request.params as { projectId: string; sourceId: string };

    try {
      const source = await intakeService.getSource(projectId, sourceId, principal);
      return source;
    } catch (err: any) {
      const status = err.statusCode || 404;
      reply.status(status).send({
        error: {
          code: status === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
          message: err.message
        }
      });
    }
  });

  app.get('/api/v1/projects/:projectId/sources/:sourceId/versions', async (request, reply) => {
    const principal = request.principal!;
    const { projectId, sourceId } = request.params as { projectId: string; sourceId: string };

    try {
      const versions = await intakeService.listSourceVersions(projectId, sourceId, principal);
      return { items: versions };
    } catch (err: any) {
      const status = err.statusCode || 404;
      reply.status(status).send({
        error: {
          code: status === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
          message: err.message
        }
      });
    }
  });

  app.post('/api/v1/projects/:projectId/sources/:sourceId/versions', async (request, reply) => {
    const principal = request.principal!;
    const { projectId, sourceId } = request.params as { projectId: string; sourceId: string };

    const isMulti = request.isMultipart();
    let text: string | undefined;
    let buffer: Buffer | undefined;
    let filename: string | undefined;
    let mimeType: string | undefined;
    let expectedRevision: number | undefined;

    if (isMulti) {
      const data = await request.file();
      if (data) {
        buffer = await data.toBuffer();
        filename = data.filename;
        mimeType = data.mimetype;
        const revField = (data.fields?.expectedRevision as any)?.value;
        if (revField) expectedRevision = Number(revField);
      }
    } else {
      const body = request.body as any;
      text = body?.text;
      if (body?.expectedRevision !== undefined) expectedRevision = Number(body.expectedRevision);
    }

    try {
      const result = await intakeService.createSourceVersion(
        projectId,
        sourceId,
        { text, buffer, filename, mimeType, expectedRevision },
        principal
      );
      reply.status(201).send(result);
    } catch (err: any) {
      const status = err.statusCode || 400;
      reply.status(status).send({
        error: {
          code: status === 409 ? 'CONFLICT' : status === 413 ? 'RESOURCE_LIMIT_EXCEEDED' : status === 415 ? 'UNSUPPORTED_MEDIA_TYPE' : status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'OPERATION_FAILED',
          message: err.message
        }
      });
    }
  });

  app.get('/api/v1/projects/:projectId/sources/:sourceId/versions/:versionId/content', async (request, reply) => {
    const principal = request.principal!;
    const { projectId, sourceId, versionId } = request.params as {
      projectId: string;
      sourceId: string;
      versionId: string;
    };

    try {
      const { version, buffer } = await intakeService.getSourceBlob(projectId, sourceId, versionId, principal);
      const source = await intakeService.getSource(projectId, sourceId, principal);

      const safeFilename = source.title.replace(/[^a-zA-Z0-9._-]/g, '_');

      reply
        .header('Content-Type', version.mediaType || 'application/octet-stream')
        .header('Content-Disposition', `attachment; filename="${safeFilename}"`)
        .header('X-Content-Type-Options', 'nosniff')
        .header('Cache-Control', 'private, no-store')
        .send(buffer);
    } catch (err: any) {
      const status = err.statusCode || 404;
      reply.status(status).send({
        error: {
          code: status === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
          message: err.message
        }
      });
    }
  });

  app.post('/api/v1/projects/:projectId/sources/:sourceId/versions/:versionId/extract', async (request, reply) => {
    const principal = request.principal!;
    const { projectId, sourceId, versionId } = request.params as {
      projectId: string;
      sourceId: string;
      versionId: string;
    };

    try {
      const extraction = await intakeService.extractSourceVersion(projectId, sourceId, versionId, principal);
      return extraction;
    } catch (err: any) {
      const status = err.statusCode || 400;
      reply.status(status).send({
        error: {
          code: status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'OPERATION_FAILED',
          message: err.message
        }
      });
    }
  });

  app.get('/api/v1/projects/:projectId/sources/:sourceId/versions/:versionId/extraction', async (request, reply) => {
    const principal = request.principal!;
    const { projectId, sourceId, versionId } = request.params as {
      projectId: string;
      sourceId: string;
      versionId: string;
    };

    try {
      const extraction = await intakeService.getExtraction(projectId, sourceId, versionId, principal);
      return extraction;
    } catch (err: any) {
      const status = err.statusCode || 404;
      reply.status(status).send({
        error: {
          code: status === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
          message: err.message
        }
      });
    }
  });

  app.post('/api/v1/projects/:projectId/intelligence', async (request, reply) => {
    const principal = request.principal!;
    const { projectId } = request.params as { projectId: string };
    const body = request.body as any;

    if (!body || !body.key || typeof body.key !== 'string') {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Intelligence key is required'
        }
      });
      return;
    }

    try {
      const item = await intakeService.captureIntelligenceItem(
        projectId,
        {
          key: body.key,
          title: body.title || body.key,
          category: body.category || 'REQUIREMENTS',
          valueKind: body.valueKind,
          value: body.value,
          unit: body.unit,
          ambiguityReason: body.ambiguityReason,
          sourceBinding: body.sourceBinding
        },
        principal
      );
      reply.status(201).send(item);
    } catch (err: any) {
      const status = err.statusCode || 400;
      reply.status(status).send({
        error: {
          code: status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'VALIDATION_ERROR',
          message: err.message
        }
      });
    }
  });

  app.patch('/api/v1/projects/:projectId/intelligence/:itemId', async (request, reply) => {
    const principal = request.principal!;
    const { projectId, itemId } = request.params as { projectId: string; itemId: string };
    const body = request.body as any;

    if (!body || body.expectedRevision === undefined) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'expectedRevision is required for optimistic concurrency'
        }
      });
      return;
    }

    try {
      const item = await intakeService.updateIntelligenceItem(
        projectId,
        itemId,
        {
          expectedRevision: Number(body.expectedRevision),
          title: body.title,
          value: body.value,
          unit: body.unit,
          ambiguityReason: body.ambiguityReason,
          sourceBinding: body.sourceBinding
        },
        principal
      );
      return item;
    } catch (err: any) {
      const status = err.statusCode || 400;
      reply.status(status).send({
        error: {
          code: status === 409 ? 'CONFLICT' : status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'OPERATION_FAILED',
          message: err.message
        }
      });
    }
  });

  app.get('/api/v1/projects/:projectId/intelligence/:itemId/history', async (request, reply) => {
    const principal = request.principal!;
    const { projectId, itemId } = request.params as { projectId: string; itemId: string };

    try {
      const history = await intakeService.getIntelligenceHistory(projectId, itemId, principal);
      return { items: history };
    } catch (err: any) {
      const status = err.statusCode || 404;
      reply.status(status).send({
        error: {
          code: status === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
          message: err.message
        }
      });
    }
  });

  app.post('/api/v1/projects/:projectId/intelligence/import-preview', async (request, reply) => {
    const principal = request.principal!;
    const { projectId } = request.params as { projectId: string };
    const body = request.body as any;

    if (!body || !body.sourceId || !body.sourceVersionId || !Array.isArray(body.mappings)) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'sourceId, sourceVersionId and mappings array are required'
        }
      });
      return;
    }

    try {
      const preview = await intakeService.previewImport(
        projectId,
        {
          sourceId: body.sourceId,
          sourceVersionId: body.sourceVersionId,
          mappings: body.mappings
        },
        principal
      );
      return preview;
    } catch (err: any) {
      const status = err.statusCode || 400;
      reply.status(status).send({
        error: {
          code: status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'VALIDATION_ERROR',
          message: err.message
        }
      });
    }
  });

  app.post('/api/v1/projects/:projectId/intelligence/import-apply', async (request, reply) => {
    const principal = request.principal!;
    const { projectId } = request.params as { projectId: string };
    const body = request.body as any;

    if (!body || !body.sourceId || !body.sourceVersionId || !Array.isArray(body.mappings) || !body.mappingDigest) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'sourceId, sourceVersionId, mappings and mappingDigest are required'
        }
      });
      return;
    }

    try {
      const result = await intakeService.applyImport(
        projectId,
        {
          sourceId: body.sourceId,
          sourceVersionId: body.sourceVersionId,
          mappings: body.mappings,
          mappingDigest: body.mappingDigest,
          expectedRevisions: body.expectedRevisions
        },
        principal
      );
      reply.status(201).send(result);
    } catch (err: any) {
      const status = err.statusCode || 400;
      reply.status(status).send({
        error: {
          code: status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'VALIDATION_ERROR',
          message: err.message
        }
      });
    }
  });

  app.get('/api/v1/projects/:projectId/intelligence-requirements', async (request, reply) => {
    const principal = request.principal!;
    const { projectId } = request.params as { projectId: string };

    try {
      const checklist = await intakeService.getChecklist(projectId, principal);
      if (!checklist) {
        return {
          projectId,
          revision: 0,
          status: 'NOT_CONFIGURED',
          items: []
        };
      }
      return checklist;
    } catch (err: any) {
      const status = err.statusCode || 404;
      reply.status(status).send({
        error: {
          code: status === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
          message: err.message
        }
      });
    }
  });

  app.put('/api/v1/projects/:projectId/intelligence-requirements', async (request, reply) => {
    const principal = request.principal!;
    const { projectId } = request.params as { projectId: string };
    const body = request.body as any;

    if (!body || !Array.isArray(body.items)) {
      reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'items array is required'
        }
      });
      return;
    }

    try {
      const updated = await intakeService.updateChecklist(
        projectId,
        {
          expectedRevision: body.expectedRevision !== undefined ? Number(body.expectedRevision) : undefined,
          items: body.items
        },
        principal
      );
      return updated;
    } catch (err: any) {
      const status = err.statusCode || 400;
      reply.status(status).send({
        error: {
          code: status === 409 ? 'CONFLICT' : status === 404 ? 'NOT_FOUND' : status === 403 ? 'FORBIDDEN' : 'OPERATION_FAILED',
          message: err.message
        }
      });
    }
  });

  app.get('/api/v1/projects/:projectId/intelligence-intake-summary', async (request, reply) => {
    const principal = request.principal!;
    const { projectId } = request.params as { projectId: string };

    try {
      const summary = await intakeService.getIntakeReviewSummary(projectId, principal);
      return summary;
    } catch (err: any) {
      const status = err.statusCode || 404;
      reply.status(status).send({
        error: {
          code: status === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
          message: err.message
        }
      });
    }
  });

  app.get('/api/v1/projects/:projectId/performance-contract', async (request, reply) => {
    const principal = request.principal!;
    const { projectId } = request.params as { projectId: string };

    try {
      const result = await performanceContractService.compileProjectPerformanceContract(projectId, principal);
      return result;
    } catch (err: any) {
      const status = err.statusCode || 500;
      reply.status(status).send({
        error: {
          code: status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: err.message
        }
      });
    }
  });

  // --- Performance Contract Review Revisions & Decisions API ---

  app.post('/api/v1/projects/:projectId/performance-contract/revisions', async (request, reply) => {
    const principal = request.principal;
    if (!principal) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
    const { projectId } = request.params as { projectId: string };
    const body = (request.body as any) || {};

    const idempotencyKey =
      (request.headers['idempotency-key'] as string) ||
      (request.headers['x-idempotency-key'] as string) ||
      body.idempotencyKey;

    try {
      const result = await performanceContractService.saveContractReviewRevision(
        projectId,
        {
          expectedFingerprint: body.expectedFingerprint ?? body.expectedContractFingerprint,
          notes: body.notes ?? body.commitMessage,
          idempotencyKey
        },
        principal
      );
      reply.status(201).send(result);
    } catch (err: any) {
      const status = err.statusCode || 500;
      reply.status(status).send({
        error: {
          code:
            status === 409
              ? 'CONFLICT'
              : status === 403
              ? 'FORBIDDEN'
              : status === 404
              ? 'NOT_FOUND'
              : status === 400
              ? 'VALIDATION_ERROR'
              : status === 401
              ? 'UNAUTHORIZED'
              : 'INTERNAL_ERROR',
          message: err.message
        }
      });
    }
  });

  app.get('/api/v1/projects/:projectId/performance-contract/revisions', async (request, reply) => {
    const principal = request.principal;
    if (!principal) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
    const { projectId } = request.params as { projectId: string };

    try {
      const revisions = await performanceContractService.listContractReviewRevisions(projectId, principal);
      return { revisions };
    } catch (err: any) {
      const status = err.statusCode || 500;
      reply.status(status).send({
        error: {
          code: status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: err.message
        }
      });
    }
  });

  app.get('/api/v1/projects/:projectId/performance-contract/revisions/:revisionNumber', async (request, reply) => {
    const principal = request.principal;
    if (!principal) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
    const { projectId, revisionNumber } = request.params as { projectId: string; revisionNumber: string };

    try {
      const revision = await performanceContractService.getContractReviewRevision(
        projectId,
        Number(revisionNumber),
        principal
      );
      return revision;
    } catch (err: any) {
      const status = err.statusCode || 500;
      reply.status(status).send({
        error: {
          code: status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: err.message
        }
      });
    }
  });

  app.post('/api/v1/projects/:projectId/performance-contract/revisions/:revisionNumber/decisions', async (request, reply) => {
    const principal = request.principal;
    if (!principal) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
    const { projectId, revisionNumber } = request.params as { projectId: string; revisionNumber: string };
    const revNum = Number(revisionNumber);
    if (isNaN(revNum) || revNum < 1) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'revisionNumber must be a positive integer' } });
    }

    const body = (request.body as any) || {};

    const idempotencyKey =
      (request.headers['idempotency-key'] as string) ||
      (request.headers['x-idempotency-key'] as string) ||
      body.idempotencyKey;

    try {
      const result = await performanceContractService.submitContractDecision(
        projectId,
        revNum,
        {
          decisionType: body.decisionType,
          rationale: body.rationale,
          expectedRevisionNumber: body.expectedRevisionNumber,
          expectedContentFingerprint: body.expectedContentFingerprint,
          expectedInputDigest: body.expectedInputDigest,
          expectedDecisionRevision: body.expectedDecisionRevision,
          idempotencyKey
        },
        principal
      );
      return result;
    } catch (err: any) {
      const status = err.statusCode || 500;
      reply.status(status).send({
        error: {
          code:
            status === 409
              ? 'CONFLICT'
              : status === 403
              ? 'FORBIDDEN'
              : status === 404
              ? 'NOT_FOUND'
              : status === 400
              ? 'VALIDATION_ERROR'
              : status === 401
              ? 'UNAUTHORIZED'
              : 'INTERNAL_ERROR',
          message: err.message
        }
      });
    }
  });

  // --- Engineering Artefacts API (Strategy & Test Plan) ---

  app.post('/api/v1/projects/:projectId/artefacts', async (request, reply) => {
    const principal = request.principal;
    if (!principal) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
    const { projectId } = request.params as { projectId: string };
    const body = (request.body as any) || {};

    const idempotencyKey =
      (request.headers['idempotency-key'] as string) ||
      (request.headers['x-idempotency-key'] as string) ||
      body.idempotencyKey;

    try {
      const result = await artefactService.generateArtefact(
        projectId,
        {
          artefactType: body.artefactType,
          expectedContractFingerprint: body.expectedContractFingerprint,
          expectedInputRevision: body.expectedInputRevision,
          contractRevisionNumber: body.contractRevisionNumber,
          author: body.author,
          idempotencyKey
        },
        principal
      );
      reply.status(201).send(result);
    } catch (err: any) {
      const status = err.statusCode || 500;
      reply.status(status).send({
        error: {
          code:
            status === 409
              ? 'CONFLICT'
              : status === 403
              ? 'FORBIDDEN'
              : status === 404
              ? 'NOT_FOUND'
              : status === 400
              ? 'VALIDATION_ERROR'
              : status === 401
              ? 'UNAUTHORIZED'
              : 'INTERNAL_ERROR',
          message: err.message
        }
      });
    }
  });

  app.get('/api/v1/projects/:projectId/artefacts', async (request, reply) => {
    const principal = request.principal!;
    const { projectId } = request.params as { projectId: string };

    try {
      const items = await artefactService.listArtefacts(projectId, principal);
      return { items };
    } catch (err: any) {
      const status = err.statusCode || 500;
      reply.status(status).send({
        error: {
          code: status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: err.message
        }
      });
    }
  });

  app.get('/api/v1/projects/:projectId/artefacts/:artefactId', async (request, reply) => {
    const principal = request.principal!;
    const { projectId, artefactId } = request.params as { projectId: string; artefactId: string };
    const query = (request.query as any) || {};
    const revisionNumber = query.revision ? Number(query.revision) : undefined;

    try {
      const detail = await artefactService.getArtefact(
        projectId,
        artefactId,
        revisionNumber,
        principal
      );
      return detail;
    } catch (err: any) {
      const status = err.statusCode || 500;
      reply.status(status).send({
        error: {
          code: status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: err.message
        }
      });
    }
  });

  app.get('/api/v1/projects/:projectId/artefacts/:artefactId/export', async (request, reply) => {
    const principal = request.principal!;
    const { projectId, artefactId } = request.params as { projectId: string; artefactId: string };
    const query = (request.query as any) || {};
    const revisionNumber = query.revision ? Number(query.revision) : undefined;
    const format = query.format || 'markdown';

    try {
      const exported = await artefactService.exportArtefactMarkdown(
        projectId,
        artefactId,
        revisionNumber,
        principal
      );

      const acceptHeader = request.headers['accept'] || '';
      if (acceptHeader.includes('application/json') && format !== 'raw' && format !== 'markdown') {
        return exported;
      }

      reply
        .header('Content-Type', 'text/markdown; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${exported.filename}"`)
        .send(exported.markdown);
    } catch (err: any) {
      const status = err.statusCode || 500;
      reply.status(status).send({
        error: {
          code: status === 403 ? 'FORBIDDEN' : status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR',
          message: err.message
        }
      });
    }
  });

  app.post('/api/v1/projects/:projectId/artefacts/:artefactId/revisions/:revisionNumber/decisions', async (request, reply) => {
    const principal = request.principal;
    if (!principal) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
    const { projectId, artefactId, revisionNumber } = request.params as {
      projectId: string;
      artefactId: string;
      revisionNumber: string;
    };
    const revNum = Number(revisionNumber);
    if (isNaN(revNum) || revNum < 1) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'revisionNumber must be a positive integer' } });
    }

    const body = (request.body as any) || {};

    const idempotencyKey =
      (request.headers['idempotency-key'] as string) ||
      (request.headers['x-idempotency-key'] as string) ||
      body.idempotencyKey;

    try {
      const result = await artefactService.submitArtefactDecision(
        projectId,
        artefactId,
        revNum,
        {
          decisionType: body.decisionType,
          rationale: body.rationale,
          expectedRevisionNumber: body.expectedRevisionNumber,
          expectedContentFingerprint: body.expectedContentFingerprint,
          expectedInputDigest: body.expectedInputDigest,
          expectedDecisionRevision: body.expectedDecisionRevision,
          idempotencyKey
        },
        principal
      );
      return result;
    } catch (err: any) {
      const status = err.statusCode || 500;
      reply.status(status).send({
        error: {
          code:
            status === 409
              ? 'CONFLICT'
              : status === 403
              ? 'FORBIDDEN'
              : status === 404
              ? 'NOT_FOUND'
              : status === 400
              ? 'VALIDATION_ERROR'
              : status === 401
              ? 'UNAUTHORIZED'
              : 'INTERNAL_ERROR',
          message: err.message
        }
      });
    }
  });


  app.addHook('onClose', async () => {
    db.close();
  });

  return app;
}
