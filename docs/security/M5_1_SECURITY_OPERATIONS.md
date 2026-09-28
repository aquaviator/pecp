# M5.1 Security Operations Manual

This document provides operational procedures, configuration guidance, and administrative runbooks for managing identity, role-based access control, sessions, and security invariants in PECP M5.1.

---

## 1. Environment & Operational Configuration

The PECP API server and security subsystem are governed by the following environment variables:

| Variable | Default Value | Description | Production Requirement |
| :--- | :--- | :--- | :--- |
| `PECP_API_PORT` | `3001` | TCP port for the Fastify server (also checks `PORT`). | Bind to internal service port. |
| `PECP_API_HOST` | `0.0.0.0` | Network interface host in `server.ts`. | `0.0.0.0` or container overlay network. |
| `PECP_DB_PATH` | *Varies by context* | SQLite database file location. | **Must be explicitly configured** to the identical persistent volume path for all processes (e.g., `/var/lib/pecp/pecp.db`). |
| `PECP_COOKIE_SECRET` | `pecp-local-cookie-secret-change-in-prod` | Fastify cookie signing secret. | High-entropy secret in production environments. |
| `PECP_BOOTSTRAP_ADMIN_PASSWORD` | *None (Required)* | Password for bootstrap CLI administrator (12 to 128 characters). | Supply via environment variable when invoking `bootstrap-admin.js`. |
| `PECP_ALLOWED_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated list of permitted CORS web origins. | Whitelist exact frontend domains (e.g., `https://portal.pecp.io`). |

### Database Defaults by Context
- **API Server Entrypoint (`server.ts`):** `process.env.PECP_DB_PATH || 'data/pecp.db'`
- **Bootstrap CLI (`bootstrap-admin.ts`):** `process.env.PECP_DB_PATH || 'pecp-platform.sqlite'`
- **Application Factory / Tests (`app.ts`):** `options.dbPath || process.env.PECP_DB_PATH || ':memory:'`

*Operational Note:* In persistent environments, operators must ensure that `PECP_DB_PATH` is explicitly exported with the exact same path before executing the bootstrap command and before launching the API server.

### Secure Cookies & Production Mode
Cookie security (`Secure` attribute) is governed programmatically by `options.secureCookies` in `buildApiApp(options)`. When not explicitly passed in code, it defaults to production mode (`process.env.NODE_ENV === 'production'`). No custom environment variable is read for cookie security.

---

## 2. Platform Bootstrap & Initial Setup

The initial platform administrator is created through an explicit CLI script (`apps/api/src/cli/bootstrap-admin.ts`), NOT automatically on server startup.

### 2.1 CLI Invocation
Set the database path and bootstrap password in the environment, then run the CLI with required `--email` and `--name` arguments:

```bash
export PECP_DB_PATH="/var/lib/pecp/pecp.db"
export PECP_BOOTSTRAP_ADMIN_PASSWORD="SecureBootstrapPassword123!"

node apps/api/dist/cli/bootstrap-admin.js \
  --email "admin@organisation.com" \
  --name "Initial Platform Admin"
```

Or in development via `npx tsx`:
```bash
PECP_DB_PATH="data/pecp.db" \
PECP_BOOTSTRAP_ADMIN_PASSWORD="SecureBootstrapPassword123!" \
npx tsx apps/api/src/cli/bootstrap-admin.ts \
  --email "admin@organisation.com" \
  --name "Initial Platform Admin"
```

### 2.2 Rejection & Validation Invariants
1. **Existing Administrator Check:**
   The CLI executes `countActivePlatformAdmins()`. If any user with `platformRole === 'PLATFORM_ADMIN'` already exists in the target database, the command immediately aborts with:
   `Error: Platform administrator already exists. Bootstrap aborted.`
2. **Email Uniqueness:**
   If a user with the specified normalized email exists, the command aborts with:
   `Error: User with email '<email>' already exists`.
3. **Password Policy:**
   `PECP_BOOTSTRAP_ADMIN_PASSWORD` is strictly validated by `PasswordHasher.validatePassword()` to require between 12 and 128 characters.
4. **No Default Credentials:**
   There are no hardcoded default admin credentials or automatic background initialization routines.

---

## 3. User Administration (`/api/v1/admin/users`)

All user administration operations reside under the `/api/v1/admin/users` route family, require `PLATFORM_ADMIN` authority, and generate immutable audit events.

### 3.1 Listing Users
- **Endpoint:** `GET /api/v1/admin/users`
- **Response (200 OK):**
  ```json
  {
    "items": [
      {
        "id": "usr_94820381029",
        "email": "sarah.lead@northstar.io",
        "displayName": "Sarah Connor",
        "status": "ACTIVE",
        "platformRole": "NONE",
        "createdAt": "2026-09-28T08:00:00.000Z",
        "updatedAt": "2026-09-28T08:00:00.000Z"
      }
    ]
  }
  ```

### 3.2 Creating a New User
- **Endpoint:** `POST /api/v1/admin/users`
- **Headers:** Active session cookie + `X-PECP-CSRF` header (or `Authorization: Bearer <token>`)
- **Request Body:**
  ```json
  {
    "email": "sarah.lead@northstar.io",
    "displayName": "Sarah Connor",
    "password": "InitialSecurePassword123!",
    "platformRole": "NONE"
  }
  ```
- **Validation Rules:**
  - Password must be 12 to 128 characters.
  - Email normalized to lowercase for uniqueness checks.
  - Generates scrypt credential record in `local_credentials` and records `USER_CREATE` in `audit_events`.

### 3.3 Disabling / Re-enabling a User
- **Endpoint:** `PATCH /api/v1/admin/users/:userId/status`
- **Request Body:**
  ```json
  {
    "status": "DISABLED"
  }
  ```
- **Operational Effect:**
  - Sets user status to `DISABLED`.
  - Calls `SessionService.revokeAllForUser(userId)`, which sets the `revoked_at` timestamp on all existing sessions for that user (soft revocation).
  - Any subsequent API requests presenting those session tokens are rejected with `401 Unauthorized`.
  - Subsequent login attempts receive `401 Unauthorized` (`Invalid email or password`).
  - Setting status back to `ACTIVE` allows the user to resume authenticating.

### 3.4 Administrative Password Reset
- **Endpoint:** `POST /api/v1/admin/users/:userId/reset-password`
- **Request Body:**
  ```json
  {
    "newPassword": "NewSecurePassword456!"
  }
  ```
- **Operational Effect:**
  - Generates a new scrypt salt, derived key hash, and parameters, updating `local_credentials`.
  - Calls `SessionService.revokeAllForUser(userId)`, setting `revoked_at` on all active sessions for that user.
  - Records an audit record with action `PASSWORD_RESET`.

---

## 4. Organisation Membership Administration

Membership operations control access to tenant organisations and can be executed by `PLATFORM_ADMIN` or an `ORG_ADMIN` of that specific organisation.

### 4.1 Listing Memberships (`GET /api/v1/organisations/:orgId/memberships`)
- Requires `ORGANISATION_MANAGE_MEMBERS` (`ORG_ADMIN` or `PLATFORM_ADMIN`).
- Returns `{ items: [...] }`.

### 4.2 Adding a Member (`POST /api/v1/organisations/:orgId/memberships`)
- **Request Body:**
  ```json
  {
    "userId": "usr_94820381029",
    "role": "PERFORMANCE_ENGINEER"
  }
  ```
- **Duplicate Protection (HTTP 409):**
  - If the user already has an `ACTIVE` membership in the organisation, the endpoint returns `409 Conflict` (`Active membership already exists for user...`).
  - This prevents accidental role clobbering or unauthorized demotion via the create endpoint.
  - To change roles, operators must explicitly call the role update endpoint.
- **Reactivation Provenance:**
  - If the user was previously `REVOKED`, adding them again transitions the membership to `ACTIVE` and updates the role, while strictly preserving original `createdAt` and `createdByUserId` creation provenance.

### 4.3 Updating a Member's Role (`PATCH /api/v1/organisations/:orgId/memberships/:userId/role`)
- **Request Body:**
  ```json
  {
    "role": "PERFORMANCE_LEAD"
  }
  ```
- **Last Administrator Invariant:**
  - When demoting an `ORG_ADMIN` to any other role, the system queries the active administrator count within the database transaction lock.
  - If the count is `<= 1`, the mutation is rejected with `400 Bad Request` (`Cannot demote the last ORG_ADMIN for this organisation`).

### 4.4 Revoking a Membership (`POST /api/v1/organisations/:orgId/memberships/:userId/revoke`)
- Revoking sets the status to `REVOKED`. The user immediately loses tenant access.
- **Last Administrator Invariant:**
  - If the member is an `ORG_ADMIN` and the remaining active admin count is `<= 1`, revocation is rejected with `400 Bad Request` (`Cannot revoke the last ORG_ADMIN for this organisation`).

---

## 5. Session & Cookie Operations

### 5.1 Routine Logout
- **Endpoint:** `POST /api/v1/auth/logout`
- Calls `sessionService.revokeSession(sessionId)`, setting `revoked_at` on the session record.
- Clears `pecp_session` and `pecp_csrf` cookies with expired `Max-Age=0`.
- **Response (200 OK):**
  ```json
  {
    "success": true
  }
  ```

### 5.2 User Self-Service Password Change
- **Endpoint:** `POST /api/v1/auth/change-password`
- **Request Body:**
  ```json
  {
    "currentPassword": "OldPassword123!",
    "newPassword": "NewPassword789!"
  }
  ```
- **Operational Effect:**
  - Verifies current password against stored scrypt hash via `crypto.timingSafeEqual`.
  - Updates credential hash in `local_credentials`.
  - Calls `SessionService.revokeAllForUser(userId)` to invalidate all active sessions.
  - Clears `pecp_session` and `pecp_csrf` cookies.
  - Returns:
    ```json
    {
      "success": true,
      "message": "Password changed successfully. Please log in again."
    }
    ```

### 5.3 Fetching Authenticated Profile & Permissions
- **Endpoint:** `GET /api/v1/auth/me`
- **Response (200 OK):**
  ```json
  {
    "user": {
      "id": "usr_94820381029",
      "email": "sarah.lead@northstar.io",
      "displayName": "Sarah Connor",
      "platformRole": "NONE"
    },
    "principal": {
      "userId": "usr_94820381029",
      "email": "sarah.lead@northstar.io",
      "displayName": "Sarah Connor",
      "platformRole": "NONE",
      "memberships": [
        { "organisationId": "org_northstar", "role": "PERFORMANCE_LEAD" }
      ],
      "sessionId": "ses_491028401",
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

---

## 6. Audit Trail Inspection & Incident Response

### 6.1 Querying the Audit Ledger
- **Endpoint:** `GET /api/v1/audit`
- **Authority Required:** `AUDIT_READ` (`ORG_ADMIN`, `PERFORMANCE_LEAD`, `REVIEWER`, or `PLATFORM_ADMIN`).
- **Query Filters:**
  - `organisationId`: Filter to specific tenant events.
  - `projectId`: Filter to specific project events.
  - `actorUserId`: Trace operations performed by a specific principal.
  - `action`: Filter by `AuditAction` (`USER_CREATE`, `AUTHORIZATION_DENIED`, etc.).
  - `limit`: Number of records to return.
  - `before` / `after`: ISO-8601 timestamp range filters.
- **Response (200 OK):**
  ```json
  {
    "items": [
      {
        "id": "aud_19283019283",
        "occurredAt": "2026-09-28T08:15:00.000Z",
        "actorUserId": "usr_94820381029",
        "actorDisplayName": "Sarah Connor",
        "organisationId": "org_northstar",
        "projectId": null,
        "action": "MEMBERSHIP_ROLE_CHANGE",
        "targetType": "MEMBERSHIP",
        "targetId": "org_northstar:usr_582019283",
        "outcome": "SUCCESS",
        "reason": null,
        "metadataJson": "{\"oldRole\":\"VIEWER\",\"newRole\":\"PERFORMANCE_ENGINEER\"}"
      }
    ]
  }
  ```

### 6.2 Analyzing Authorization Denials
Denial events are recorded with `outcome: 'DENIED'` and action `AUTHORIZATION_DENIED`. Incident investigators can monitor for repeated unauthorized access attempts:
```json
{
  "id": "aud_84920192830",
  "occurredAt": "2026-09-28T08:20:00.000Z",
  "actorUserId": "usr_attacker",
  "actorDisplayName": "Malicious User",
  "organisationId": "org_northstar",
  "projectId": null,
  "action": "AUTHORIZATION_DENIED",
  "targetType": "MEMBERSHIP",
  "targetId": "org_northstar:usr_victim",
  "outcome": "DENIED",
  "reason": "ORG_ADMIN or PLATFORM_ADMIN required to manage memberships",
  "metadataJson": null
}
```

---

## 7. Emergency Disaster Recovery (Out-of-Band Break-Glass Procedure)

Direct database modification is strictly an un-audited, out-of-band break-glass procedure for catastrophic lockout recovery, NOT a supported product feature or governed workflow.

If all platform administrators are lost or incapacitated:
1. Connect directly to the production SQLite database file using the `sqlite3` CLI:
   ```bash
   sqlite3 /var/lib/pecp/pecp.db
   ```
2. Locate an existing active user ID:
   ```sql
   SELECT id, email, displayName, platformRole, status FROM users WHERE status = 'ACTIVE';
   ```
3. Elevate that user to `PLATFORM_ADMIN`:
   ```sql
   UPDATE users SET platform_role = 'PLATFORM_ADMIN', updated_at = datetime('now') WHERE id = 'usr_target';
   ```
4. Authenticate through the standard web portal using that user's credentials and resume governed operations.
