import { useState, useEffect, useCallback } from 'react';
import { X, Users, Shield, ShieldOff, Trash2, Loader2, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || '';

type BrokerType = 'zerodha' | 'motilal' | 'none';

interface AdminUser {
  email: string;
  username: string;
  role: 'user' | 'admin';
  createdAt: number;
  updatedAt: number;
  lastLogin: number;
  brokerType: BrokerType;
  hasZerodhaCredentials: boolean;
  hasMotilalCredentials: boolean;
}

interface AdminPanelProps {
  onClose: () => void;
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const { token, user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch users');
        return;
      }

      setUsers(data.users || []);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleUpdateRole = async (email: string, newRole: 'user' | 'admin') => {
    if (!token) return;

    setActionLoading(email);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_URL}/admin/users/${encodeURIComponent(email)}/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to update role');
        return;
      }

      setSuccess(`Updated ${email} to ${newRole}`);
      await fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async (email: string, username: string) => {
    if (!token) return;

    const confirmed = window.confirm(`Are you sure you want to delete user "${username}" (${email})? This action cannot be undone.`);
    if (!confirmed) return;

    setActionLoading(email);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`${API_URL}/admin/users/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to delete user');
        return;
      }

      setSuccess(`Deleted user ${email}`);
      await fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-background/50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-sigma/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-sigma" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Admin Panel</h2>
              <p className="text-xs text-gray-400">Manage users and roles</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-border/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Messages */}
        {(error || success) && (
          <div className="px-6 pt-4 flex-shrink-0">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 bg-active/10 border border-active/30 rounded-lg text-active text-sm">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-gray-400">
              {users.length} user{users.length !== 1 ? 's' : ''} total
            </div>
            <button
              onClick={fetchUsers}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-card-hover hover:bg-border rounded-lg transition-colors text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Users Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No users found
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-background/50">
                  <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Broker</th>
                    <th className="px-4 py-3">Last Login</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {users.map((user) => (
                    <tr key={user.email} className="hover:bg-card-hover/50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium text-sm">{user.username}</div>
                          <div className="text-xs text-gray-400">{user.email}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.role === 'admin'
                            ? 'bg-sigma/20 text-sigma'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {user.role === 'admin' ? <Shield className="w-3 h-3" /> : <ShieldOff className="w-3 h-3" />}
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.brokerType === 'zerodha' && user.hasZerodhaCredentials ? (
                          <span className="text-xs text-active">Zerodha</span>
                        ) : user.brokerType === 'motilal' && user.hasMotilalCredentials ? (
                          <span className="text-xs text-active">Motilal</span>
                        ) : (
                          <span className="text-xs text-gray-500">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <div>{formatDate(user.lastLogin)}</div>
                          <div className="text-gray-500">{formatTime(user.lastLogin)}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-gray-400">
                          {formatDate(user.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {/* Toggle Role Button */}
                          {user.email !== currentUser?.email && (
                            <>
                              <button
                                onClick={() => handleUpdateRole(user.email, user.role === 'admin' ? 'user' : 'admin')}
                                disabled={actionLoading === user.email}
                                className={`p-1.5 rounded-lg transition-colors text-xs ${
                                  user.role === 'admin'
                                    ? 'bg-gray-500/20 hover:bg-gray-500/30 text-gray-400'
                                    : 'bg-sigma/20 hover:bg-sigma/30 text-sigma'
                                }`}
                                title={user.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
                              >
                                {actionLoading === user.email ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : user.role === 'admin' ? (
                                  <ShieldOff className="w-4 h-4" />
                                ) : (
                                  <Shield className="w-4 h-4" />
                                )}
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={() => handleDeleteUser(user.email, user.username)}
                                disabled={actionLoading === user.email}
                                className="p-1.5 rounded-lg bg-danger/20 hover:bg-danger/30 text-danger transition-colors"
                                title="Delete user"
                              >
                                {actionLoading === user.email ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </>
                          )}
                          {user.email === currentUser?.email && (
                            <span className="text-xs text-gray-500 italic">You</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-background/30 flex-shrink-0">
          <p className="text-[10px] text-gray-500 text-center">
            Admin actions are logged. Use responsibly.
          </p>
        </div>
      </div>
    </div>
  );
}
