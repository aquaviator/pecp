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

## 6. Error Envelope Standard

All non-2xx responses conform to the standard error envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR | NOT_FOUND | CONFLICT | INTERNAL_ERROR",
    "message": "Human-readable description of error",
    "details": null
  }
}
```

Errors never expose SQL queries, stack traces, or server filesystem paths.
