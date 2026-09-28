# M5.1 Security Operations Manual

This document provides operational procedures, configuration guidance, and administrative runbooks for managing identity, role-based access control, sessions, and security invariants in PECP M5.1.

---

## 1. Environment & Operational Configuration

The PECP API server and security subsystem are governed by the following environment variables:

| Variable | Default Value | Description | Production Requirement |
| :--- | :--- | :--- | :--- |
| `PECP_API_PORT` | `3001` | TCP port for the Fastify server. | Bind to internal service port. |
| `PECP_API_HOST` | `127.0.0.1` | Network interface host. | `0.0.0.0` or container overlay network. |
| `PECP_DB_PATH` | `:memory:` | SQLite database file location. | Persistent file volume path (e.g. `/var/lib/pecp/pecp.db`). |
| `PECP_SESSION_TTL_HOURS` | `12` | Active session time-to-live in hours. | 8 to 24 hours depending on organizational policy. |
| `PECP_COOKIE_SECURE` | `false` | Enforce `Secure` attribute on cookies. | **Must be set to `true`** when TLS is terminated. |
| `PECP_ALLOWED_ORIGINS` | `http://localhost:3000,http://localhost:5173` | Comma-separated list of permitted CORS web origins. | Whitelist exact frontend domains (e.g., `https://portal.pecp.io`). |
| `PECP_BOOTSTRAP_ADMIN_EMAIL` | `admin@pecp.io` | Email for initial bootstrap administrator. | Customer-designated initial administrator email. |
| `PECP_BOOTSTRAP_ADMIN_PASSWORD`| `Admin123456!` | Password for initial bootstrap administrator. | Secure, high-entropy initial secret (min 12 chars). |
| `PECP_BOOTSTRAP_ADMIN_NAME` | `Platform Administrator` | Display name for bootstrap administrator. | Identifying title for audit provenance. |

---

## 2. Platform Bootstrap & Initial Setup

1. **Automatic Initialization:**
   Upon process startup, the migration and bootstrap sequence inspects the database. If zero users with `platformRole === 'PLATFORM_ADMIN'` exist, the system creates the bootstrap administrator using `PECP_BOOTSTRAP_ADMIN_EMAIL` and `PECP_BOOTSTRAP_ADMIN_PASSWORD`.
2. **Idempotency Guarantee:**
   If at least one platform administrator exists, the bootstrap step is skipped with zero side effects.
3. **Post-Deployment Hardening:**
   Immediately following initial setup:
   - Log in using the bootstrap credentials at `/api/v1/auth/login`.
   - Update the bootstrap administrator password via `POST /api/v1/auth/change-password` or create dedicated administrative accounts and disable the generic bootstrap account.

---

## 3. User Lifecycle Management

All user administration operations require `PLATFORM_ADMIN` authority and generate immutable audit events.

### 3.1 Creating a New User
- **Endpoint:** `POST /api/v1/users`
- **Headers:** Active session cookie + `x-csrf-token`
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
  - Email is normalized to lowercase for uniqueness checks.
  - Initial status is automatically set to `ACTIVE`.

### 3.2 Disabling a User
Disabling a user terminates all existing sessions immediately and prevents new logins.
- **Endpoint:** `PATCH /api/v1/users/:userId/status`
- **Request Body:**
  ```json
  {
    "status": "DISABLED"
  }
  ```
- **Operational Effect:**
  - Database status set to `DISABLED`.
  - All active sessions matching `user_id` are deleted from `sessions`.
  - Client attempts to reuse session tokens immediately receive `401 Unauthorized`.
  - Subsequent login attempts receive `403 Forbidden` (`User account is disabled`).

### 3.3 Re-enabling a Disabled User
- **Endpoint:** `PATCH /api/v1/users/:userId/status`
- **Request Body:**
  ```json
  {
    "status": "ACTIVE"
  }
  ```
- The user can resume authentication using their existing credentials.

### 3.4 Administrative Password Reset
When a user forgets credentials or a credential compromise is suspected:
- **Endpoint:** `POST /api/v1/users/:userId/reset-password`
- **Request Body:**
  ```json
  {
    "newPassword": "NewSecurePassword456!"
  }
  ```
- **Operational Effect:**
  - New scrypt salt and hash generated and persisted atomically.
  - All current sessions for the user are immediately revoked.
  - An audit record with action `USER_PASSWORD_RESET` is written within the transaction.

---

## 4. Organisation Membership Administration

Membership operations control access to tenant organisations and can be executed by `PLATFORM_ADMIN` or an `ORG_ADMIN` of that specific organisation.

### 4.1 Adding a Member (`POST /api/v1/organisations/:orgId/memberships`)
- **Request Body:**
  ```json
  {
    "userId": "usr_94820381029",
    "role": "PERFORMANCE_ENGINEER"
  }
  ```
- **Duplicate Protection:**
  - If the user already has an `ACTIVE` membership in the organisation, the endpoint returns `409 Conflict` (`Active membership already exists for user...`).
  - This prevents accidental role clobbering or unauthorized demotion via the create endpoint.
  - To change roles, operators must explicitly call the role update endpoint.
- **Reactivation Provenance:**
  - If the user was previously `REVOKED`, adding them again transitions the membership to `ACTIVE` and updates the role, while strictly preserving original `createdAt` and `createdByUserId` provenance.

### 4.2 Updating a Member's Role (`PATCH /api/v1/organisations/:orgId/memberships/:userId/role`)
- **Request Body:**
  ```json
  {
    "role": "PERFORMANCE_LEAD"
  }
  ```
- **Last Administrator Invariant:**
  - If attempting to demote an `ORG_ADMIN` to any other role, the system queries the active administrator count within the database transaction lock.
  - If the count is `<= 1`, the mutation is rejected with `400 Bad Request` (`Cannot demote the last ORG_ADMIN for this organisation`).

### 4.3 Revoking a Membership (`POST /api/v1/organisations/:orgId/memberships/:userId/revoke`)
- Revoking sets the status to `REVOKED`. The user immediately loses tenant access.
- **Last Administrator Invariant:**
  - If the member is an `ORG_ADMIN` and the remaining active admin count is `<= 1`, revocation is rejected with `400 Bad Request` (`Cannot revoke the last ORG_ADMIN for this organisation`).

---

## 5. Session & Cookie Operations

### 5.1 Routine Logout
- **Endpoint:** `POST /api/v1/auth/logout`
- The active session is deleted from the database.
- `pecp_session` and `pecp_csrf` cookies are cleared with expired `Max-Age=0`.

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
  - Verifies current password against stored scrypt hash.
  - Updates credential hash.
  - Revokes all sessions for the user.
  - Clears browser cookies and forces immediate re-authentication.

---

## 6. Audit Trail Inspection & Incident Response

### 6.1 Querying the Audit Ledger
- **Endpoint:** `GET /api/v1/audit?organisationId=org_123&action=MEMBERSHIP_ROLE_CHANGE`
- **Authority Required:** `AUDIT_READ` (`ORG_ADMIN`, `PERFORMANCE_LEAD`, `REVIEWER`, or `PLATFORM_ADMIN`).
- **Query Filters:**
  - `organisationId`: Filter to specific tenant events.
  - `action`: Filter by action type (`USER_CREATE`, `AUTHORIZATION_DENIED`, etc.).
  - `actorUserId`: Trace operations performed by a specific principal.
  - `limit` / `offset`: Pagination controls.

### 6.2 Analyzing Authorization Denials
Denial events are recorded with `outcome: 'DENIED'` and action `AUTHORIZATION_DENIED`. Incident investigators can monitor for repeated unauthorized access attempts:
```json
{
  "action": "AUTHORIZATION_DENIED",
  "actorUserId": "usr_attacker",
  "actorEmail": "attacker@external.io",
  "organisationId": "org_northstar",
  "targetType": "MEMBERSHIP",
  "targetId": "org_northstar:usr_victim",
  "outcome": "DENIED",
  "reason": "ORG_ADMIN or PLATFORM_ADMIN required to manage memberships"
}
```

---

## 7. Emergency Recovery Runbook: Administrator Lockout

If all organizational administrators are incapacitated:
1. Access the platform using a global `PLATFORM_ADMIN` credential.
2. If all `PLATFORM_ADMIN` credentials are lost:
   - Connect directly to the production SQLite database file using the `sqlite3` CLI:
     ```bash
     sqlite3 /var/lib/pecp/pecp.db
     ```
   - Identify an existing trusted user ID:
     ```sql
     SELECT id, email, platform_role, status FROM users WHERE status = 'ACTIVE';
     ```
   - Elevate the selected user to `PLATFORM_ADMIN`:
     ```sql
     UPDATE users SET platform_role = 'PLATFORM_ADMIN', updated_at = datetime('now') WHERE id = 'usr_target';
     ```
   - Log into the portal with that user's credentials and assign fresh `ORG_ADMIN` memberships via the standard API or admin UI.
