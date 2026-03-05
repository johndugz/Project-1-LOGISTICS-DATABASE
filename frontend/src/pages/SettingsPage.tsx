import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../utils/authStore';
import apiService from '../services/api';
import { UserRole } from '../types';

interface PendingUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  email_verified: boolean;
  admin_approved: boolean;
  created_at: string;
}

interface CurrentUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  region?: string | null;
  phone?: string | null;
  is_active: boolean;
  email_verified: boolean;
  admin_approved: boolean;
  created_at: string;
  approved_at?: string | null;
  updated_at: string;
}

interface UserEditDraft {
  firstName: string;
  lastName: string;
  role: CurrentRole;
  password: string;
}

type ApproveRole = 'admin' | 'operator' | 'auditor';
type CurrentRole = 'admin' | 'operator' | 'auditor' | 'agent' | 'customer';
type SettingsTab = 'password-security' | 'pending-user-approvals' | 'current-user-list';

const formatDateTime = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const SettingsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const currentUserId = useAuthStore((state) => state.user?.id || null);
  const hasRole = useAuthStore((state) => state.hasRole);
  const isAdmin = hasRole(UserRole.ADMIN);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activeTab, setActiveTab] = useState<SettingsTab>('password-security');
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [currentUsers, setCurrentUsers] = useState<CurrentUser[]>([]);
  const [editDraftByUser, setEditDraftByUser] = useState<Record<string, UserEditDraft>>({});
  const [selectedRoleByUser, setSelectedRoleByUser] = useState<Record<string, ApproveRole>>({});
  const [isLoadingPending, setIsLoadingPending] = useState(false);
  const [isLoadingCurrentUsers, setIsLoadingCurrentUsers] = useState(false);
  const [currentUserSearchQuery, setCurrentUserSearchQuery] = useState('');
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminSuccess, setAdminSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      setActiveTab('password-security');
      return;
    }

    if (location.hash === '#pending-user-approvals') {
      setActiveTab('pending-user-approvals');
      return;
    }

    if (location.hash === '#current-user-list') {
      setActiveTab('current-user-list');
      return;
    }

    setActiveTab('password-security');
  }, [isAdmin, location.hash]);

  const loadPendingUsers = async (): Promise<void> => {
    if (!isAdmin) return;

    setIsLoadingPending(true);
    try {
      const rows = await apiService.listPendingUsers();
      setPendingUsers(rows);
      setAdminError(null);
      setSelectedRoleByUser((prev) => {
        const next: Record<string, ApproveRole> = { ...prev };
        rows.forEach((row) => {
          if (!next[row.id]) {
            if (row.role === 'admin' || row.role === 'operator' || row.role === 'auditor') {
              next[row.id] = row.role;
            } else {
              next[row.id] = 'operator';
            }
          }
        });
        return next;
      });
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to load pending users');
    } finally {
      setIsLoadingPending(false);
    }
  };

  const loadCurrentUsers = async (): Promise<void> => {
    if (!isAdmin) return;

    setIsLoadingCurrentUsers(true);
    try {
      const rows = await apiService.listCurrentUsers();
      setCurrentUsers(rows);
      setEditDraftByUser((prev) => {
        const next: Record<string, UserEditDraft> = { ...prev };
        rows.forEach((row) => {
          const role = String(row.role).toLowerCase();
          const normalizedRole: CurrentRole =
            role === 'admin' || role === 'operator' || role === 'auditor' || role === 'agent' || role === 'customer'
              ? role
              : 'customer';

          next[row.id] = {
            firstName: row.first_name || '',
            lastName: row.last_name || '',
            role: normalizedRole,
            password: '',
          };
        });
        return next;
      });
      setAdminError(null);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to load current users');
    } finally {
      setIsLoadingCurrentUsers(false);
    }
  };

  useEffect(() => {
    if (!isAdmin || activeTab !== 'pending-user-approvals') return;
    loadPendingUsers();
  }, [isAdmin, activeTab]);

  useEffect(() => {
    if (!isAdmin || activeTab !== 'current-user-list') return;
    loadCurrentUsers();
  }, [isAdmin, activeTab]);

  const handleApproveUser = async (userId: string): Promise<void> => {
    setAdminError(null);
    setAdminSuccess(null);
    setApprovingUserId(userId);
    try {
      const selectedRole = selectedRoleByUser[userId] || 'operator';
      await apiService.approveUser(userId, selectedRole);
      setAdminSuccess('User approved successfully.');
      await Promise.all([loadPendingUsers(), loadCurrentUsers()]);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to approve user');
    } finally {
      setApprovingUserId(null);
    }
  };

  const handleLogout = (): void => {
    logout();
    navigate('/login');
  };

  const filteredCurrentUsers = useMemo(() => {
    const query = currentUserSearchQuery.trim().toLowerCase();
    if (!query) return currentUsers;

    return currentUsers.filter((user) =>
      [
        user.first_name,
        user.last_name,
        user.email,
        user.role,
        user.region || '',
        user.phone || '',
        user.is_active ? 'active' : 'inactive',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [currentUsers, currentUserSearchQuery]);

  const handleStartEditUser = (user: CurrentUser): void => {
    const role = String(user.role).toLowerCase();
    const normalizedRole: CurrentRole =
      role === 'admin' || role === 'operator' || role === 'auditor' || role === 'agent' || role === 'customer'
        ? role
        : 'customer';

    setEditDraftByUser((prev) => ({
      ...prev,
      [user.id]: {
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        role: normalizedRole,
        password: '',
      },
    }));
    setEditingUserId(user.id);
    setAdminError(null);
    setAdminSuccess(null);
  };

  const handleCancelEditUser = (user: CurrentUser): void => {
    const role = String(user.role).toLowerCase();
    const normalizedRole: CurrentRole =
      role === 'admin' || role === 'operator' || role === 'auditor' || role === 'agent' || role === 'customer'
        ? role
        : 'customer';

    setEditDraftByUser((prev) => ({
      ...prev,
      [user.id]: {
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        role: normalizedRole,
        password: '',
      },
    }));
    setEditingUserId(null);
    setAdminError(null);
  };

  const handleSaveEditUser = async (user: CurrentUser): Promise<void> => {
    const draft = editDraftByUser[user.id];
    if (!draft) return;

    const nextFirstName = draft.firstName.trim();
    const nextLastName = draft.lastName.trim();
    const nextRole = draft.role;
    const nextPassword = draft.password;

    if (!nextFirstName || !nextLastName) {
      setAdminError('First name and last name are required.');
      return;
    }

    if (nextPassword && nextPassword.length < 6) {
      setAdminError('Password must be at least 6 characters long.');
      return;
    }

    const roleChanged = nextRole !== user.role;
    const firstNameChanged = nextFirstName !== user.first_name;
    const lastNameChanged = nextLastName !== user.last_name;
    const passwordChanged = !!nextPassword;

    if (!roleChanged && !firstNameChanged && !lastNameChanged && !passwordChanged) {
      setAdminSuccess('No changes to save.');
      setEditingUserId(null);
      return;
    }

    const shouldProceed = window.confirm(`⚠️ Are you sure you want to save changes for ${user.email}?`);
    if (!shouldProceed) {
      return;
    }

    setUpdatingRoleUserId(user.id);
    setAdminError(null);
    setAdminSuccess(null);

    try {
      await apiService.updateUser(user.id, {
        firstName: nextFirstName,
        lastName: nextLastName,
        role: nextRole,
        ...(passwordChanged ? { password: nextPassword } : {}),
      });

      setAdminSuccess('User updated successfully.');
      setEditingUserId(null);
      await loadCurrentUsers();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setUpdatingRoleUserId(null);
    }
  };

  const handleDeleteCurrentUser = async (user: CurrentUser): Promise<void> => {
    setAdminError(null);
    setAdminSuccess(null);

    const shouldProceed = window.confirm(`⚠️ Are you sure you want to delete ${user.email}? This action cannot be undone.`);
    if (!shouldProceed) {
      return;
    }

    setDeletingUserId(user.id);
    try {
      await apiService.deleteUser(user.id);
      setAdminSuccess('User deleted successfully.');
      await loadCurrentUsers();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please complete all password fields.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    localStorage.setItem('mockPassword', newPassword);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordSuccess('Password updated successfully.');
  };

  const handleTabChange = (tab: SettingsTab): void => {
    setActiveTab(tab);
    if (tab === 'pending-user-approvals') {
      navigate('/settings#pending-user-approvals', { replace: true });
      return;
    }
    if (tab === 'current-user-list') {
      navigate('/settings#current-user-list', { replace: true });
      return;
    }
    navigate('/settings', { replace: true });
  };

  return (
    <div className="min-h-screen bg-brand-sand py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6 gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-red font-semibold mb-2">
              Settings
            </p>
            <h1 className="text-4xl text-brand-ink">Account Settings</h1>
          </div>
          <div className="flex gap-2">
            <Link
              to="/dashboard"
              className="bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-4 py-2 rounded-lg"
            >
              Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="bg-brand-red hover:bg-brand-redDark text-white font-semibold px-4 py-2 rounded-lg"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mb-6 bg-white rounded-xl shadow p-2 border border-brand-amber/20">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleTabChange('password-security')}
              className={`px-4 py-2 rounded-lg font-semibold ${
                activeTab === 'password-security'
                  ? 'bg-brand-red text-white'
                  : 'bg-brand-sand text-brand-charcoal hover:bg-brand-amber/30'
              }`}
            >
              Password & Security
            </button>

            {isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => handleTabChange('pending-user-approvals')}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    activeTab === 'pending-user-approvals'
                      ? 'bg-brand-red text-white'
                      : 'bg-brand-sand text-brand-charcoal hover:bg-brand-amber/30'
                  }`}
                >
                  Pending User Approvals
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('current-user-list')}
                  className={`px-4 py-2 rounded-lg font-semibold ${
                    activeTab === 'current-user-list'
                      ? 'bg-brand-red text-white'
                      : 'bg-brand-sand text-brand-charcoal hover:bg-brand-amber/30'
                  }`}
                >
                  Current User List
                </button>
              </>
            )}
          </div>
        </div>

        {activeTab === 'password-security' && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-xl shadow p-6 border border-brand-amber/20 space-y-4"
          >
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.currentTarget.value)}
                className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                required
              />
            </div>

            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.currentTarget.value)}
                className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                required
              />
            </div>

            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                required
              />
            </div>

            {passwordError && (
              <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 bg-green-100 border border-green-300 text-green-700 rounded-lg">
                {passwordSuccess}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-brand-red hover:bg-brand-redDark text-white font-bold px-5 py-2 rounded-lg"
              >
                Update Password
              </button>
            </div>
          </form>
        )}

        {isAdmin && activeTab === 'pending-user-approvals' && (
          <div id="pending-user-approvals" className="bg-white rounded-xl shadow p-6 border border-brand-amber/20">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-2xl text-brand-ink">Pending User Approvals</h2>
              <button
                type="button"
                onClick={loadPendingUsers}
                className="bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-4 py-2 rounded-lg"
              >
                Refresh
              </button>
            </div>

            {adminError && (
              <div className="mb-3 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
                {adminError}
              </div>
            )}

            {adminSuccess && (
              <div className="mb-3 p-3 bg-green-100 border border-green-300 text-green-700 rounded-lg">
                {adminSuccess}
              </div>
            )}

            {isLoadingPending ? (
              <p className="text-brand-charcoal/80">Loading pending users...</p>
            ) : pendingUsers.length === 0 ? (
              <p className="text-brand-charcoal/80">No pending users.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-amber/30 text-left text-brand-charcoal">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Assign Role</th>
                      <th className="py-2 pr-4">Email Verified</th>
                      <th className="py-2 pr-4">Admin Approved</th>
                      <th className="py-2 pr-4">Created</th>
                      <th className="py-2 pr-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingUsers.map((pendingUser) => (
                      <tr key={pendingUser.id} className="border-b border-brand-amber/15 text-brand-charcoal">
                        <td className="py-2 pr-4">{pendingUser.first_name} {pendingUser.last_name}</td>
                        <td className="py-2 pr-4">{pendingUser.email}</td>
                        <td className="py-2 pr-4">
                          <select
                            value={selectedRoleByUser[pendingUser.id] || 'operator'}
                            onChange={(e) =>
                              setSelectedRoleByUser((prev) => ({
                                ...prev,
                                [pendingUser.id]: e.currentTarget.value as ApproveRole,
                              }))
                            }
                            className="px-2 py-1 border border-brand-amber/40 rounded focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                            disabled={!!pendingUser.admin_approved || approvingUserId === pendingUser.id}
                          >
                            <option value="admin">Admin</option>
                            <option value="operator">Operator</option>
                            <option value="auditor">Guest</option>
                          </select>
                        </td>
                        <td className="py-2 pr-4">{pendingUser.email_verified ? 'Yes' : 'No'}</td>
                        <td className="py-2 pr-4">{pendingUser.admin_approved ? 'Yes' : 'No'}</td>
                        <td className="py-2 pr-4">{formatDateTime(pendingUser.created_at)}</td>
                        <td className="py-2 pr-4">
                          <button
                            type="button"
                            disabled={!pendingUser.email_verified || !!pendingUser.admin_approved || approvingUserId === pendingUser.id}
                            onClick={() => handleApproveUser(pendingUser.id)}
                            className="bg-brand-red hover:bg-brand-redDark disabled:bg-brand-charcoal/40 text-white font-semibold px-3 py-1 rounded"
                          >
                            {approvingUserId === pendingUser.id
                              ? 'Approving...'
                              : pendingUser.admin_approved
                              ? 'Approved'
                              : 'Approve'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {isAdmin && activeTab === 'current-user-list' && (
          <div id="current-user-list" className="bg-white rounded-xl shadow p-6 border border-brand-amber/20">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-2xl text-brand-ink">Current User List</h2>
              <button
                type="button"
                onClick={loadCurrentUsers}
                className="bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-4 py-2 rounded-lg"
              >
                Refresh
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                value={currentUserSearchQuery}
                onChange={(e) => setCurrentUserSearchQuery(e.currentTarget.value)}
                placeholder="Filter by name, email, role, region, phone, status..."
                className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
              />
            </div>

            {adminError && (
              <div className="mb-3 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
                {adminError}
              </div>
            )}

            {isLoadingCurrentUsers ? (
              <p className="text-brand-charcoal/80">Loading current users...</p>
            ) : filteredCurrentUsers.length === 0 ? (
              <p className="text-brand-charcoal/80">No users found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-amber/30 text-left text-brand-charcoal">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Password</th>
                      <th className="py-2 pr-4">Action</th>
                      <th className="py-2 pr-4">Region</th>
                      <th className="py-2 pr-4">Phone</th>
                      <th className="py-2 pr-4">Email Verified</th>
                      <th className="py-2 pr-4">Admin Approved</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Created</th>
                      <th className="py-2 pr-4">Approved</th>
                      <th className="py-2 pr-4">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCurrentUsers.map((user) => (
                      <tr key={user.id} className="border-b border-brand-amber/15 text-brand-charcoal align-top">
                        <td className="py-2 pr-4">
                          {editingUserId === user.id ? (
                            <div className="grid grid-cols-1 gap-1 min-w-[13rem]">
                              <input
                                type="text"
                                value={editDraftByUser[user.id]?.firstName || ''}
                                onChange={(e) => {
                                  const value = e.currentTarget.value;
                                  setEditDraftByUser((prev) => ({
                                    ...prev,
                                    [user.id]: {
                                      ...(prev[user.id] || {
                                        firstName: '',
                                        lastName: '',
                                        role: 'customer' as CurrentRole,
                                        password: '',
                                      }),
                                      firstName: value,
                                    },
                                  }));
                                }}
                                className="px-2 py-1 border border-brand-amber/40 rounded focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                                placeholder="First name"
                              />
                              <input
                                type="text"
                                value={editDraftByUser[user.id]?.lastName || ''}
                                onChange={(e) => {
                                  const value = e.currentTarget.value;
                                  setEditDraftByUser((prev) => ({
                                    ...prev,
                                    [user.id]: {
                                      ...(prev[user.id] || {
                                        firstName: '',
                                        lastName: '',
                                        role: 'customer' as CurrentRole,
                                        password: '',
                                      }),
                                      lastName: value,
                                    },
                                  }));
                                }}
                                className="px-2 py-1 border border-brand-amber/40 rounded focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                                placeholder="Last name"
                              />
                            </div>
                          ) : (
                            <>{user.first_name} {user.last_name}</>
                          )}
                        </td>
                        <td className="py-2 pr-4">{user.email}</td>
                        <td className="py-2 pr-4">
                          {editingUserId === user.id ? (
                            <select
                              value={editDraftByUser[user.id]?.role || (user.role as CurrentRole)}
                              onChange={(e) => {
                                const value = e.currentTarget.value as CurrentRole;
                                setEditDraftByUser((prev) => ({
                                  ...prev,
                                  [user.id]: {
                                    ...(prev[user.id] || {
                                      firstName: user.first_name,
                                      lastName: user.last_name,
                                      role: user.role as CurrentRole,
                                      password: '',
                                    }),
                                    role: value,
                                  },
                                }));
                              }}
                              className="px-2 py-1 border border-brand-amber/40 rounded focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                              disabled={updatingRoleUserId === user.id || deletingUserId === user.id || currentUserId === user.id}
                            >
                              <option value="admin">Admin</option>
                              <option value="operator">Operator</option>
                              <option value="auditor">Guest</option>
                              <option value="agent">Agent</option>
                              <option value="customer">Customer</option>
                            </select>
                          ) : (
                            <span className="uppercase">{user.role}</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {editingUserId === user.id ? (
                            <input
                              type="password"
                              value={editDraftByUser[user.id]?.password || ''}
                              onChange={(e) => {
                                const value = e.currentTarget.value;
                                setEditDraftByUser((prev) => ({
                                  ...prev,
                                  [user.id]: {
                                    ...(prev[user.id] || {
                                      firstName: user.first_name,
                                      lastName: user.last_name,
                                      role: user.role as CurrentRole,
                                      password: '',
                                    }),
                                    password: value,
                                  },
                                }));
                              }}
                              className="px-2 py-1 border border-brand-amber/40 rounded focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                              placeholder="New password (optional)"
                            />
                          ) : (
                            <span className="text-brand-charcoal/70">••••••</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex flex-wrap gap-2">
                            {editingUserId === user.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditUser(user)}
                                  disabled={updatingRoleUserId === user.id || deletingUserId === user.id || currentUserId === user.id}
                                  className="bg-brand-charcoal hover:bg-brand-ink disabled:bg-brand-charcoal/40 text-white text-xs font-semibold px-2 py-1 rounded"
                                  title="⚠️ Are you sure you want to save this edit?"
                                >
                                  {updatingRoleUserId === user.id ? '⏳ Saving...' : '✅ Save'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancelEditUser(user)}
                                  disabled={updatingRoleUserId === user.id || deletingUserId === user.id}
                                  className="bg-brand-sand hover:bg-brand-amber/30 border border-brand-amber/40 text-brand-charcoal text-xs font-semibold px-2 py-1 rounded"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStartEditUser(user)}
                                disabled={updatingRoleUserId === user.id || deletingUserId === user.id || currentUserId === user.id}
                                className="bg-brand-charcoal hover:bg-brand-ink disabled:bg-brand-charcoal/40 text-white text-xs font-semibold px-2 py-1 rounded"
                                title="Edit role/name/password"
                              >
                                ✏️ Edit
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDeleteCurrentUser(user)}
                              disabled={deletingUserId === user.id || updatingRoleUserId === user.id || currentUserId === user.id}
                              className="bg-brand-red hover:bg-brand-redDark disabled:bg-brand-charcoal/40 text-white text-xs font-semibold px-2 py-1 rounded"
                              title="Are you sure you want to delete this user?"
                            >
                              {deletingUserId === user.id ? '⏳ Deleting...' : '🗑️ Delete'}
                            </button>
                          </div>
                          {currentUserId === user.id && (
                            <p className="text-xs text-brand-charcoal/70 mt-1">Current account</p>
                          )}
                        </td>
                        <td className="py-2 pr-4">{user.region || '-'}</td>
                        <td className="py-2 pr-4">{user.phone || '-'}</td>
                        <td className="py-2 pr-4">{user.email_verified ? 'Yes' : 'No'}</td>
                        <td className="py-2 pr-4">{user.admin_approved ? 'Yes' : 'No'}</td>
                        <td className="py-2 pr-4">{user.is_active ? 'Active' : 'Inactive'}</td>
                        <td className="py-2 pr-4">{formatDateTime(user.created_at)}</td>
                        <td className="py-2 pr-4">{formatDateTime(user.approved_at)}</td>
                        <td className="py-2 pr-4">{formatDateTime(user.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;