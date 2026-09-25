// Administration & Governance Control Hub
// Defined according to M5.1 Work Package §20 & §21

import React, { useState, useEffect, useCallback } from 'react';
import {
  SlidersHorizontal,
  ShieldCheck,
  Cpu,
  Server,
  Users,
  Building2,
  Lock,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  KeyRound,
  UserCheck,
  UserX,
  FileText,
  Clock,
  Filter
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useServices } from '../services/ServiceContext';
import {
  UserSummary,
  OrganisationMembershipSummary,
  OrganisationRole,
  AuditEventSummary,
  UserStatus
} from '../types/auth';

type AdminTab = 'IDENTITY' | 'MEMBERSHIPS' | 'AUDIT' | 'GOVERNANCE';

export const AdministrationPage: React.FC = () => {
  const { user, principal, hasPermission } = useAuth();
  const { adminService } = useServices();

  const [activeTab, setActiveTab] = useState<AdminTab>('IDENTITY');

  // User Administration state
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'PLATFORM_ADMIN' | 'NONE'>('NONE');
  const [creatingUser, setCreatingUser] = useState(false);

  // Reset password state
  const [resettingUser, setResettingUser] = useState<UserSummary | null>(null);
  const [newResetPassword, setNewResetPassword] = useState('');

  // Membership Administration state
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [memberships, setMemberships] = useState<OrganisationMembershipSummary[]>([]);
  const [loadingMemberships, setLoadingMemberships] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [addMemberUserId, setAddMemberUserId] = useState('');
  const [addMemberRole, setAddMemberRole] = useState<OrganisationRole>('VIEWER');

  // Audit state
  const [auditEvents, setAuditEvents] = useState<AuditEventSummary[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState('');

  const isPlatformAdmin = principal?.platformRole === 'PLATFORM_ADMIN';
  const availableOrgs = principal?.memberships || [];

  useEffect(() => {
    if (availableOrgs.length > 0 && !selectedOrgId) {
      setSelectedOrgId(availableOrgs[0].organisationId);
    }
  }, [availableOrgs, selectedOrgId]);

  // Load Users
  const loadUsers = useCallback(async () => {
    if (!isPlatformAdmin) return;
    setLoadingUsers(true);
    setUserError(null);
    try {
      const list = await adminService.listUsers();
      setUsers(list);
    } catch (err: any) {
      setUserError(err.message || 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }, [isPlatformAdmin, adminService]);

  // Load Memberships
  const loadMemberships = useCallback(async () => {
    if (!selectedOrgId) return;
    setLoadingMemberships(true);
    try {
      const list = await adminService.listMemberships(selectedOrgId);
      setMemberships(list);
    } catch (err: any) {
      console.error('Failed to load memberships:', err);
    } finally {
      setLoadingMemberships(false);
    }
  }, [selectedOrgId, adminService]);

  // Load Audit
  const loadAudit = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const events = await adminService.queryAudit({
        organisationId: selectedOrgId || undefined,
        action: auditActionFilter || undefined,
        limit: 50
      });
      setAuditEvents(events);
    } catch (err) {
      console.error('Failed to load audit events:', err);
    } finally {
      setLoadingAudit(false);
    }
  }, [selectedOrgId, auditActionFilter, adminService]);

  useEffect(() => {
    if (activeTab === 'IDENTITY' && isPlatformAdmin) {
      loadUsers();
    } else if (activeTab === 'MEMBERSHIPS') {
      loadMemberships();
    } else if (activeTab === 'AUDIT') {
      loadAudit();
    }
  }, [activeTab, loadUsers, loadMemberships, loadAudit, isPlatformAdmin]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail.trim() || !newUserName.trim() || !newUserPassword) return;

    setCreatingUser(true);
    try {
      await adminService.createUser({
        email: newUserEmail.trim(),
        displayName: newUserName.trim(),
        initialPassword: newUserPassword,
        platformRole: newUserRole
      });
      setIsCreateUserOpen(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserPassword('');
      setNewUserRole('NONE');
      await loadUsers();
    } catch (err: any) {
      alert(`User creation failed: ${err.message}`);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleToggleStatus = async (targetUser: UserSummary) => {
    const nextStatus: UserStatus = targetUser.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await adminService.updateUserStatus(targetUser.id, nextStatus);
      await loadUsers();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !newResetPassword) return;
    try {
      await adminService.resetPassword(resettingUser.id, newResetPassword);
      setResettingUser(null);
      setNewResetPassword('');
      alert(`Password reset for ${resettingUser.displayName}`);
    } catch (err: any) {
      alert(`Reset failed: ${err.message}`);
    }
  };

  const handleAddMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrgId || !addMemberUserId) return;
    try {
      await adminService.addMembership(selectedOrgId, {
        userId: addMemberUserId,
        role: addMemberRole
      });
      setIsAddMemberOpen(false);
      setAddMemberUserId('');
      await loadMemberships();
    } catch (err: any) {
      alert(`Failed to add membership: ${err.message}`);
    }
  };

  const handleUpdateRole = async (targetUserId: string, role: OrganisationRole) => {
    if (!selectedOrgId) return;
    try {
      await adminService.updateMembershipRole(selectedOrgId, targetUserId, role);
      await loadMemberships();
    } catch (err: any) {
      alert(`Role update failed: ${err.message}`);
    }
  };

  const handleRevokeMembership = async (targetUserId: string) => {
    if (!selectedOrgId) return;
    if (!confirm('Are you sure you want to revoke this membership?')) return;
    try {
      await adminService.revokeMembership(selectedOrgId, targetUserId);
      await loadMemberships();
    } catch (err: any) {
      alert(`Revocation failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-sky-400" />
            <h1 className="text-lg font-bold text-white tracking-tight">
              PECP Administration & Governance Control
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded text-xs font-mono font-semibold bg-sky-950 text-sky-300 border border-sky-800 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              M5.1 Authority Engine
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-1 max-w-3xl">
          Deterministic server-side RBAC, authenticated human identity attribution, organisation membership governance, and immutable audit ledger.
        </p>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 mt-5 border-t border-slate-800/80 pt-4">
          <button
            onClick={() => setActiveTab('IDENTITY')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'IDENTITY'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Identity & Users</span>
          </button>

          <button
            onClick={() => setActiveTab('MEMBERSHIPS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'MEMBERSHIPS'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Memberships</span>
          </button>

          <button
            onClick={() => setActiveTab('AUDIT')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'AUDIT'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Audit Ledger</span>
          </button>

          <button
            onClick={() => setActiveTab('GOVERNANCE')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'GOVERNANCE'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>System Architecture</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Current Identity & User Administration */}
      {activeTab === 'IDENTITY' && (
        <div className="space-y-6">
          {/* Current Authenticated Principal Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Authenticated Session Principal
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Display Name</span>
                <span className="text-sm font-semibold text-white mt-0.5 block">{user?.displayName || 'Anonymous'}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Email Identity</span>
                <span className="text-sm font-semibold text-white mt-0.5 block truncate">{user?.email || 'N/A'}</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Platform Authority</span>
                <span className={`text-xs font-mono font-bold mt-1 inline-block px-2 py-0.5 rounded border ${
                  principal?.platformRole === 'PLATFORM_ADMIN'
                    ? 'bg-purple-950 text-purple-300 border-purple-800'
                    : 'bg-slate-900 text-slate-400 border-slate-800'
                }`}>
                  {principal?.platformRole || 'NONE'}
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-mono block">Active Memberships</span>
                <span className="text-sm font-mono text-white mt-0.5 block">
                  {principal?.memberships.length || 0} Organisation(s)
                </span>
              </div>
            </div>
          </div>

          {/* User Administration Section (Visible to PLATFORM_ADMIN) */}
          {isPlatformAdmin ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-sky-400" />
                    User Directory & Identity Lifecycle
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Platform Administrator Authority: Provision accounts, toggle status, and execute credential resets.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadUsers}
                    className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800"
                    title="Refresh user directory"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingUsers ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setIsCreateUserOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create User</span>
                  </button>
                </div>
              </div>

              {userError && (
                <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-800 text-xs text-rose-300">
                  {userError}
                </div>
              )}

              {/* Users Table */}
              <div className="overflow-x-auto border border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                    <tr>
                      <th className="p-3">User</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Platform Role</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300 font-mono">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/40">
                        <td className="p-3 font-sans font-medium text-white">{u.displayName}</td>
                        <td className="p-3 text-slate-400">{u.email}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            u.platformRole === 'PLATFORM_ADMIN'
                              ? 'bg-purple-950 text-purple-300 border-purple-800'
                              : 'bg-slate-950 text-slate-500 border-slate-800'
                          }`}>
                            {u.platformRole}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                              : 'bg-rose-950/80 text-rose-300 border-rose-800'
                          }`}>
                            {u.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {u.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2 font-sans">
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 text-[11px] text-slate-300 border border-slate-800 transition-colors"
                          >
                            {u.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => setResettingUser(u)}
                            className="px-2 py-1 rounded bg-slate-950 hover:bg-slate-800 text-[11px] text-sky-400 border border-slate-800 transition-colors"
                          >
                            Reset Password
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center text-xs text-slate-400">
              User directory administration is restricted to PLATFORM_ADMIN principals.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Membership Administration */}
      {activeTab === 'MEMBERSHIPS' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sky-400" />
                  Organisation Membership Governance
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Assign and revoke organisation roles: ORG_ADMIN, PERFORMANCE_LEAD, PERFORMANCE_ENGINEER, REVIEWER, VIEWER.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Org selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Org:</span>
                  <select
                    value={selectedOrgId}
                    onChange={(e) => setSelectedOrgId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none"
                  >
                    {availableOrgs.map((m) => (
                      <option key={m.organisationId} value={m.organisationId}>
                        {m.organisationId} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                {hasPermission('ORGANISATION_MANAGE_MEMBERS', selectedOrgId) && (
                  <button
                    onClick={() => setIsAddMemberOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Member</span>
                  </button>
                )}
              </div>
            </div>

            {/* Memberships Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">User ID</th>
                    <th className="p-3">Assigned Role</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Assigned Date</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300 font-mono">
                  {memberships.map((m) => (
                    <tr key={m.userId} className="hover:bg-slate-800/40">
                      <td className="p-3 font-sans font-medium text-white">
                        {m.user?.displayName || m.userId}
                        {m.user?.email && <span className="block text-[11px] text-slate-500 font-mono">{m.user.email}</span>}
                      </td>
                      <td className="p-3">
                        <select
                          disabled={!hasPermission('ORGANISATION_MANAGE_MEMBERS', selectedOrgId)}
                          value={m.role}
                          onChange={(e) => handleUpdateRole(m.userId, e.target.value as OrganisationRole)}
                          className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white focus:outline-none disabled:opacity-50"
                        >
                          <option value="ORG_ADMIN">ORG_ADMIN</option>
                          <option value="PERFORMANCE_LEAD">PERFORMANCE_LEAD</option>
                          <option value="PERFORMANCE_ENGINEER">PERFORMANCE_ENGINEER</option>
                          <option value="REVIEWER">REVIEWER</option>
                          <option value="VIEWER">VIEWER</option>
                        </select>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          m.status === 'ACTIVE'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : 'bg-rose-950 text-rose-300 border-rose-800'
                        }`}>
                          {m.status}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">{m.createdAt.slice(0, 10)}</td>
                      <td className="p-3 text-right font-sans">
                        {hasPermission('ORGANISATION_MANAGE_MEMBERS', selectedOrgId) && (
                          <button
                            onClick={() => handleRevokeMembership(m.userId)}
                            className="px-2 py-1 rounded bg-slate-950 hover:bg-rose-950 text-[11px] text-rose-400 border border-slate-800 hover:border-rose-800 transition-colors"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {memberships.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500">
                        No memberships found for organisation '{selectedOrgId}'.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Immutable Audit Authority Ledger */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-400" />
                  Append-Only Audit Authority Ledger
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Attributed chronological event stream for all governed mutations, conflict resolutions, and approvals.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter by action..."
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  onClick={loadAudit}
                  className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Audit Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">Outcome</th>
                    <th className="p-3">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300 font-mono text-[11px]">
                  {auditEvents.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-800/40">
                      <td className="p-3 text-slate-400 whitespace-nowrap">{e.occurredAt.replace('T', ' ').slice(0, 19)}</td>
                      <td className="p-3 font-sans font-medium text-white">
                        {e.actorDisplayName || e.actorUserId || 'System'}
                      </td>
                      <td className="p-3 text-sky-400 font-semibold">{e.action}</td>
                      <td className="p-3 text-slate-400">
                        {e.targetType} {e.targetId ? `(${e.targetId.slice(0, 12)}...)` : ''}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          e.outcome === 'SUCCESS'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                            : 'bg-rose-950 text-rose-300 border-rose-800'
                        }`}>
                          {e.outcome}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500 max-w-xs truncate">
                        {e.metadata ? JSON.stringify(e.metadata) : '-'}
                      </td>
                    </tr>
                  ))}
                  {auditEvents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        No audit events recorded matching current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: System Architecture & Governance Law (Preserved from M0) */}
      {activeTab === 'GOVERNANCE' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-emerald-400" />
              Customer Deployment Status
            </h3>
            <p className="text-xs text-slate-400">
              Constitution §2: Production customers run PECP in infrastructure they control. Hosted environments are for demonstration and reference evaluation only.
            </p>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
              <div>Deployment Mode: Customer Local Infrastructure / Isolated Container</div>
              <div>Runtime: Node.js 22 LTS / SQLite Persistent WAL Mode</div>
              <div>Boundary: Fastify Identity & Session Authority Layer</div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              Bring Your Own AI (BYOAI) Boundary
            </h3>
            <p className="text-xs text-slate-400">
              Constitution §3: Customers use their approved AI provider and credits. AI proposes. Systems verify. Humans decide.
            </p>
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
              <div>Model Role: Draft generation & candidate extraction</div>
              <div>Authority: Authenticated engineering principals only</div>
              <div>Determinism: Models do not generate unverified state</div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create User */}
      {isCreateUserOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Create New Platform User</h3>
            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Rachel Reviewer"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="e.g. rachel@retailco.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Initial Password (min 12 chars)</label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Platform Role</label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none"
                >
                  <option value="NONE">NONE (Standard User)</option>
                  <option value="PLATFORM_ADMIN">PLATFORM_ADMIN (Global Authority)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateUserOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-3.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                >
                  {creatingUser ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {resettingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Reset Password for {resettingUser.displayName}</h3>
            <form onSubmit={handleResetPassword} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">New Password (min 12 chars)</label>
                <input
                  type="password"
                  required
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                >
                  Apply Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Membership */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">Add Member to {selectedOrgId}</h3>
            <form onSubmit={handleAddMembership} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">User ID</label>
                <input
                  type="text"
                  required
                  value={addMemberUserId}
                  onChange={(e) => setAddMemberUserId(e.target.value)}
                  placeholder="usr-..."
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none focus:border-sky-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  User must already exist in the platform directory.
                </span>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Organisation Role</label>
                <select
                  value={addMemberRole}
                  onChange={(e) => setAddMemberRole(e.target.value as OrganisationRole)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-white focus:outline-none"
                >
                  <option value="ORG_ADMIN">ORG_ADMIN</option>
                  <option value="PERFORMANCE_LEAD">PERFORMANCE_LEAD</option>
                  <option value="PERFORMANCE_ENGINEER">PERFORMANCE_ENGINEER</option>
                  <option value="REVIEWER">REVIEWER</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold"
                >
                  Add Membership
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
