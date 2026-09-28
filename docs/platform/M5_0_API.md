# PECP M5.0 Governed API Specification

## 1. Base URL & Protocol

All operational endpoints are served under `/api/v1` over HTTP/1.1 or HTTP/2. Health and readiness probes are served at root.

Default Local Port: `3001`  
Environment Variables: `PECP_API_PORT`, `PECP_API_HOST`, `PECP_DB_PATH`

---

## 2. Health & Readiness Probes

### GET /health
Returns general process liveness.

**Response (200 OK):**
```json
{
  "status": "ok",
  "timestamp": "2026-09-24T09:20:00.000Z",
  "version": "1.0.0"
}
```

### GET /ready
Verifies database connectivity and migration application.

**Response (200 OK):**
```json
{
  "status": "ready",
  "database": "connected",
  "migrationsApplied": 2
}
```

**Response (503 Service Unavailable):**
```json
{
  "status": "unready",
  "error": {
    "code": "PERSISTENCE_NOT_READY",
    "message": "Database persistence or migrations are not ready"
  }
}
```

---

## 3. Organisations API

### GET /api/v1/organisations
Lists all organisations ordered alphabetically by name.

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "org-b903e1a0-766a-4d43-8559-8664ecad0912",
      "name": "Northstar Retail",
      "status": "ACTIVE",
      "createdAt": "2026-09-24T08:00:00.000Z",
      "updatedAt": "2026-09-24T08:00:00.000Z"
    }
  ]
}
```

### POST /api/v1/organisations
Creates a new organisation. Rejects empty names (400) and case-insensitive duplicates (409).

**Request Body:**
```json
{
  "name": "Northstar Retail"
}
```

**Response (201 Created):**
```json
{
  "id": "org-b903e1a0-766a-4d43-8559-8664ecad0912",
  "name": "Northstar Retail",
  "status": "ACTIVE",
  "createdAt": "2026-09-24T08:00:00.000Z",
  "updatedAt": "2026-09-24T08:00:00.000Z"
}
```

### GET /api/v1/organisations/:organisationId
Retrieves organisation by ID. Returns 404 if not found.

### PATCH /api/v1/organisations/:organisationId/status
Updates organisation status (`ACTIVE` | `ARCHIVED`).

**Request Body:**
```json
{
  "status": "ARCHIVED"
}
```

---

## 4. Projects API

### GET /api/v1/projects
Lists all projects ordered by creation date descending.

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "proj-901a89c1-7f92-4820-a65c-60db0c74148b",
      "name": "Holiday Peak 2027",
      "organisation": "Northstar Retail",
      "organisationId": "org-b903e1a0-766a-4d43-8559-8664ecad0912",
      "intent": "FORECAST",
      "description": "Black Friday capacity forecast",
      "createdDate": "2026-09-24T08:00:00.000Z",
      "status": "ACTIVE",
      "documentsCount": 2,
      "requirementsCount": 0,
      "conflictsCount": 0
    }
  ]
}
```

### POST /api/v1/projects
Creates a new project. Automatically resolves or creates the specified organisation. Preserves zero-invention safeguards (`requirementsCount: 0`, `conflictsCount: 0`).

**Request Body:**
```json
{
  "name": "Holiday Peak 2027",
  "organisation": "Northstar Retail",
  "intent": "FORECAST",
  "description": "Black Friday capacity forecast",
  "creationMethod": "BRIEF",
  "briefText": "Simulate peak holiday transaction growth",
  "uploadedDocumentNames": ["holiday-2026-actuals.csv", "nfr-holiday-2027.pdf"],
  "externalReference": "EXT-NORTHSTAR-2027"
}
```

**Response (201 Created):**
```json
{
  "id": "proj-901a89c1-7f92-4820-a65c-60db0c74148b",
  "name": "Holiday Peak 2027",
  "organisation": "Northstar Retail",
  "organisationId": "org-b903e1a0-766a-4d43-8559-8664ecad0912",
  "intent": "FORECAST",
  "description": "Black Friday capacity forecast",
  "createdDate": "2026-09-24T08:00:00.000Z",
  "status": "ACTIVE",
  "documentsCount": 2,
  "requirementsCount": 0,
  "conflictsCount": 0
}
```

### GET /api/v1/projects/:projectId
Retrieves a single project summary. Returns 404 if not found.

### PATCH /api/v1/projects/:projectId
Updates project attributes (`name`, `description`, `intent`, `status`).

### POST /api/v1/projects/:projectId/archive
Transitions project status to `ARCHIVED`.

### GET /api/v1/organisations/:organisationId/projects
Lists all projects belonging to the specified organisation. Returns 404 if organisation does not exist.

---

## 5. Persistent Intelligence Read Model API (§7 Extension)

### GET /api/v1/projects/:projectId/intelligence
Lists all canonical intelligence items associated with the project.

### GET /api/v1/projects/:projectId/intelligence/:itemId
Retrieves a specific intelligence item by ID. Returns 404 if project or item is not found.

---

## 7. M5.1 Identity, Authentication & Session API

State-changing endpoints (`POST`, `PATCH`, `PUT`, `DELETE`) authenticated via cookie require a valid `X-PECP-CSRF` header matching the `pecp_csrf` cookie. Requests authenticated via `Authorization: Bearer <token>` and public endpoints (including `/auth/login`) are exempt from CSRF validation.

### POST /api/v1/auth/login
Authenticates user credentials and establishes an HTTP-only session cookie.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "Password123!"
}
```

**Response (200 OK):** Sets `pecp_session` (HttpOnly) and `pecp_csrf` cookies. Returns authenticated user, principal, and CSRF token:
```json
{
  "user": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "displayName": "Jane Doe",
    "status": "ACTIVE",
    "platformRole": "NONE"
  },
  "principal": {
    "userId": "usr_abc123",
    "email": "user@example.com",
    "displayName": "Jane Doe",
    "platformRole": "NONE",
    "memberships": [
      { "organisationId": "org_northstar", "role": "PERFORMANCE_LEAD" }
    ],
    "sessionId": "ses_xyz789",
    "authenticatedAt": "2026-09-28T08:00:00.000Z"
  },
  "csrfToken": "4a8e9f..."
}
```

### POST /api/v1/auth/logout
Terminates the active session (marks `revoked_at` timestamp) and clears cookies.

**Response (200 OK):**
```json
{
  "success": true
}
```

### GET /api/v1/auth/me
Returns the authenticated user entity, principal, and calculated effective permissions. Returns 401 if unauthenticated.

**Response (200 OK):**
```json
{
  "user": {
    "id": "usr_abc123",
    "email": "user@example.com",
    "displayName": "Jane Doe",
    "platformRole": "NONE"
  },
  "principal": {
    "userId": "usr_abc123",
    "email": "user@example.com",
    "displayName": "Jane Doe",
    "platformRole": "NONE",
    "memberships": [
      { "organisationId": "org_northstar", "role": "PERFORMANCE_LEAD" }
    ],
    "sessionId": "ses_xyz789",
    "authenticatedAt": "2026-09-28T08:00:00.000Z"
  },
  "permissions": [
    "ORGANISATION_READ",
    "PROJECT_READ",
    "PROJECT_CREATE",
    "PROJECT_UPDATE",
    "PROJECT_ARCHIVE",
    "INTELLIGENCE_READ",
    "INTELLIGENCE_RESOLVE",
    "INTELLIGENCE_APPROVE",
    "AUDIT_READ"
  ]
}
```

### POST /api/v1/auth/change-password
Updates password for current user, revokes existing sessions via `SessionService.revokeAllForUser()`, and clears cookies.

**Request:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully. Please log in again."
}
```

---

## 8. M5.1 User Administration API (`/api/v1/admin/users`)

All endpoints in this route family require `PLATFORM_ADMIN` platform role.

### GET /api/v1/admin/users
Lists all users.

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "usr_abc123",
      "email": "user@example.com",
      "displayName": "Jane Doe",
      "status": "ACTIVE",
      "platformRole": "NONE",
      "createdAt": "2026-09-28T08:00:00.000Z",
      "updatedAt": "2026-09-28T08:00:00.000Z"
    }
  ]
}
```

### POST /api/v1/admin/users
Creates a new user and sets initial scrypt password credentials.

**Request:**
```json
{
  "email": "newuser@example.com",
  "displayName": "New User",
  "platformRole": "NONE",
  "password": "InitialSecurePassword123!"
}
```

**Response (201 Created):** Returns created user object.

### GET /api/v1/admin/users/:userId
Retrieves user by ID. Returns 404 if not found.

### PATCH /api/v1/admin/users/:userId/status
Updates user status (`ACTIVE` | `DISABLED`). Setting `DISABLED` immediately revokes all active sessions for that user by recording a `revoked_at` timestamp.

**Request:**
```json
{
  "status": "DISABLED"
}
```

**Response (200 OK):** Returns updated user object.

### POST /api/v1/admin/users/:userId/reset-password
Administratively resets a user's password, updating scrypt credentials and revoking all active sessions.

**Request:**
```json
{
  "newPassword": "NewSecurePassword456!"
}
```

**Response (200 OK):**
```json
{
  "success": true
}
```

---

## 9. M5.1 Organisation Membership API

Governed by `ORGANISATION_MANAGE_MEMBERS` (`ORG_ADMIN` of the organisation or `PLATFORM_ADMIN`).

### GET /api/v1/organisations/:orgId/memberships
Lists all memberships for the organisation. Requires `ORG_ADMIN` of the organisation or `PLATFORM_ADMIN`.

**Response (200 OK):**
```json
{
  "items": [
    {
      "organisationId": "org_northstar",
      "userId": "usr_abc123",
      "role": "PERFORMANCE_LEAD",
      "status": "ACTIVE",
      "createdAt": "2026-09-28T08:00:00.000Z",
      "updatedAt": "2026-09-28T08:00:00.000Z",
      "createdByUserId": "usr_admin"
    }
  ]
}
```

### POST /api/v1/organisations/:orgId/memberships
Adds a user to the organisation.
- If user has an active membership: returns **409 Conflict** (`Active membership already exists`).
- If user was revoked: reactivates membership and preserves original creation provenance (`createdByUserId`, `createdAt`).

**Request:**
```json
{
  "userId": "usr_abc123",
  "role": "PERFORMANCE_ENGINEER"
}
```

**Response (201 Created):** Returns created or reactivated membership object.

### PATCH /api/v1/organisations/:orgId/memberships/:userId/role
Updates a member's role.
- Enforces final-administrator protection inside the database transaction lock: demoting the last `ORG_ADMIN` returns **400 Bad Request** (`Cannot demote the last ORG_ADMIN for this organisation`).

**Request:**
```json
{
  "role": "VIEWER"
}
```

**Response (200 OK):** Returns updated membership object.

### POST /api/v1/organisations/:orgId/memberships/:userId/revoke
Revokes membership (`status: 'REVOKED'`).
- Enforces final-administrator protection inside the database transaction lock: revoking the last `ORG_ADMIN` returns **400 Bad Request** (`Cannot revoke the last ORG_ADMIN for this organisation`).

**Response (200 OK):** Returns revoked membership object.

---

## 10. M5.1 Intelligence Governance & Human Decision Authority

### POST /api/v1/projects/:projectId/intelligence/:itemId/resolve
Resolves an intelligence conflict. Requires `INTELLIGENCE_RESOLVE` (`ORG_ADMIN`, `PERFORMANCE_LEAD`, `REVIEWER`).
Attribution is bound to the authenticated actor.

### POST /api/v1/projects/:projectId/intelligence/:itemId/approve
Approves an intelligence candidate. Requires `INTELLIGENCE_APPROVE` (`ORG_ADMIN`, `PERFORMANCE_LEAD`, `REVIEWER`).
Attribution is bound to the authenticated actor.

---

## 11. M5.1 Audit Ledger API

### GET /api/v1/audit
Queries the immutable audit ledger. Requires `AUDIT_READ` (`ORG_ADMIN`, `PERFORMANCE_LEAD`, `REVIEWER`, or `PLATFORM_ADMIN`).
Supports `organisationId`, `projectId`, `actorUserId`, `action`, `limit`, `before`, and `after` query parameters.

**Response (200 OK):**
```json
{
  "items": [
    {
      "id": "aud_19283019283",
      "occurredAt": "2026-09-28T08:15:00.000Z",
      "actorUserId": "usr_abc123",
      "actorDisplayName": "Jane Doe",
      "organisationId": "org_northstar",
      "projectId": null,
      "action": "MEMBERSHIP_ROLE_CHANGE",
      "targetType": "MEMBERSHIP",
      "targetId": "org_northstar:usr_target",
      "outcome": "SUCCESS",
      "reason": null,
      "metadataJson": "{\"oldRole\":\"VIEWER\",\"newRole\":\"PERFORMANCE_ENGINEER\"}"
    }
  ]
}
```

---

## 12. Error Envelope Standard

All non-2xx responses conform to the standard error envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR | NOT_FOUND | CONFLICT | FORBIDDEN | UNAUTHORIZED | INTERNAL_ERROR",
    "message": "Human-readable description of error",
    "details": null
  }
}
```

Errors never expose SQL queries, stack traces, or server filesystem paths.
