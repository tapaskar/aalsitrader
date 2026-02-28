import { useState, useEffect, useCallback } from 'react';
import { Users, BarChart3, Activity, Shield, Search, RefreshCw, Loader2, ChevronDown, UserPlus, Trash2 } from 'lucide-react';
import { useAuthStore, getAuthHeaders, type User, type PlanType, type PlanStatus } from '../store/authStore';
import { AddUserModal } from './admin/AddUserModal';
import { DeleteUserDialog } from './admin/DeleteUserDialog';
import { UserAnalyticsPanel } from './admin/UserAnalyticsPanel';

const API_URL = import.meta.env.VITE_API_URL || '';

type AdminTab = 'overview' | 'users' | 'analytics' | 'trading';

interface SystemStats {
  totalUsers: number;
  activeLastDay: number;
  planBreakdown: Record<string, number>;
  liveTraders: number;
  trialUsers: number;
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [analyticsTarget, setAnalyticsTarget] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        headers: { ...getAuthHeaders() },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/admin/stats`, {
        headers: { ...getAuthHeaders() },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchUsers(), fetchStats()]);
      setLoading(false);
    };
    load();
  }, [fetchUsers, fetchStats]);

  const updatePlan = async (email: string, plan: PlanType, planStatus: PlanStatus) => {
    setActionLoading(email);
    try {
      const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(email)}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ plan, planStatus }),
      });
      if (res.ok) {
        await fetchUsers();
        await fetchStats();
      }
    } catch (err) {
      console.error('Failed to update plan:', err);
    }
    setActionLoading(null);
  };

  const extendTrial = async (email: string, days: number) => {
    setActionLoading(email);
    try {
      const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(email)}/trial`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ days }),
      });
      if (res.ok) {
        await fetchUsers();
      }
    } catch (err) {
      console.error('Failed to extend trial:', err);
    }
    setActionLoading(null);
  };

  const toggleTrading = async (email: string, enabled: boolean) => {
    setActionLoading(email);
    try {
      const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(email)}/trading`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ liveTradingEnabled: enabled }),
      });
      if (res.ok) {
        await fetchUsers();
      }
    } catch (err) {
      console.error('Failed to toggle trading:', err);
    }
    setActionLoading(null);
  };

  const toggleAccount = async (email: string, enabled: boolean) => {
    setActionLoading(email);
    try {
      const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(email)}/account`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ accountEnabled: enabled }),
      });
      if (res.ok) {
        await fetchUsers();
      }
    } catch (err) {
      console.error('Failed to toggle account:', err);
    }
    setActionLoading(null);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
    { id: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'trading', label: 'Trading', icon: <Shield className="w-4 h-4" /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div>
      {/* Tab Bar */}
      <div className="flex items-center gap-1 bg-card-hover rounded-lg p-1 mb-6 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => { fetchUsers(); fetchStats(); }}
          className="ml-2 p-2 text-gray-400 hover:text-white rounded-lg hover:bg-card transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowAddUser(true)}
          className="ml-1 flex items-center gap-1.5 px-3 py-2 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 text-sm font-medium transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && <OverviewTab stats={stats} users={users} />}
      {activeTab === 'users' && (
        <UsersTab
          users={filteredUsers}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          actionLoading={actionLoading}
          onUpdatePlan={updatePlan}
          onExtendTrial={extendTrial}
          onToggleAccount={toggleAccount}
          onViewAnalytics={(u) => setAnalyticsTarget(u)}
          onDeleteUser={(u) => setDeleteTarget(u)}
        />
      )}
      {activeTab === 'analytics' && <AnalyticsTab stats={stats} users={users} />}
      {activeTab === 'trading' && (
        <TradingTab
          users={filteredUsers}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          actionLoading={actionLoading}
          onToggleTrading={toggleTrading}
          onToggleAccount={toggleAccount}
        />
      )}

      {/* Modals */}
      {showAddUser && (
        <AddUserModal onClose={() => setShowAddUser(false)} onUserCreated={() => { fetchUsers(); fetchStats(); }} />
      )}
      {deleteTarget && (
        <DeleteUserDialog user={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => { setDeleteTarget(null); fetchUsers(); fetchStats(); }} />
      )}
      {analyticsTarget && (
        <UserAnalyticsPanel user={analyticsTarget} onClose={() => setAnalyticsTarget(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────────────────────────────────────

function OverviewTab({ stats, users }: { stats: SystemStats | null; users: User[] }) {
  const statCards = [
    { label: 'Total Users', value: stats?.totalUsers ?? 0, color: 'text-accent' },
    { label: 'Active (24h)', value: stats?.activeLastDay ?? 0, color: 'text-active' },
    { label: 'Trial Users', value: stats?.trialUsers ?? 0, color: 'text-amber-400' },
    { label: 'Live Traders', value: stats?.liveTraders ?? 0, color: 'text-sigma' },
  ];

  const recentUsers = [...users]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Plan Breakdown */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Plan Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(stats?.planBreakdown || {}).map(([plan, count]) => (
            <div key={plan} className="bg-card-hover rounded-lg p-3">
              <div className="text-xs text-gray-400 capitalize">{plan}</div>
              <div className="text-lg font-bold">{count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Users */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Recent Registrations</h3>
        <div className="space-y-2">
          {recentUsers.map((u) => (
            <div key={u.email} className="flex items-center justify-between py-2 px-3 bg-card-hover rounded-lg">
              <div>
                <div className="text-sm font-medium">{u.username}</div>
                <div className="text-xs text-gray-500">{u.email}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">
                  {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
                <PlanBadge plan={u.plan} status={u.planStatus} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Users Tab
// ─────────────────────────────────────────────────────────────────────────────

function UsersTab({
  users,
  searchQuery,
  onSearch,
  actionLoading,
  onUpdatePlan,
  onExtendTrial,
  onToggleAccount,
  onViewAnalytics,
  onDeleteUser,
}: {
  users: User[];
  searchQuery: string;
  onSearch: (q: string) => void;
  actionLoading: string | null;
  onUpdatePlan: (email: string, plan: PlanType, status: PlanStatus) => void;
  onExtendTrial: (email: string, days: number) => void;
  onToggleAccount: (email: string, enabled: boolean) => void;
  onViewAnalytics: (user: User) => void;
  onDeleteUser: (user: User) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search users by email or name..."
          className="w-full bg-card border border-border rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-accent"
        />
      </div>

      {/* User Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card-hover">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">User</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Plan</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Trial Ends</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Broker</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Status</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email} className="border-b border-border/50 hover:bg-card-hover/50">
                  <td className="py-3 px-4 cursor-pointer group/user" onClick={() => onViewAnalytics(u)}>
                    <div className="font-medium group-hover/user:text-accent transition-colors">{u.username}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <PlanBadge plan={u.plan} status={u.planStatus} />
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-400">
                    {u.trialEndsAt
                      ? new Date(u.trialEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </td>
                  <td className="py-3 px-4">
                    <BrokerBadges user={u} />
                  </td>
                  <td className="py-3 px-4">
                    {u.accountEnabled === false ? (
                      <span className="text-xs px-2 py-0.5 bg-danger/10 text-danger rounded-full">Disabled</span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 bg-active/10 text-active rounded-full">Active</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <UserActions
                      user={u}
                      loading={actionLoading === u.email}
                      onUpdatePlan={onUpdatePlan}
                      onExtendTrial={onExtendTrial}
                      onToggleAccount={onToggleAccount}
                      onViewAnalytics={() => onViewAnalytics(u)}
                      onDeleteUser={() => onDeleteUser(u)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Analytics Tab
// ─────────────────────────────────────────────────────────────────────────────

function AnalyticsTab({ stats, users }: { stats: SystemStats | null; users: User[] }) {
  const planData = stats?.planBreakdown || {};
  const total = Object.values(planData).reduce((a, b) => a + b, 0) || 1;

  const brokerCounts = { dhan: 0, zerodha: 0, motilal: 0, none: 0 };
  users.forEach((u) => {
    if (u.hasDhanCredentials) brokerCounts.dhan++;
    else if (u.hasZerodhaCredentials) brokerCounts.zerodha++;
    else if (u.hasMotilalCredentials) brokerCounts.motilal++;
    else brokerCounts.none++;
  });

  return (
    <div className="space-y-6">
      {/* Plan Distribution */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Plan Distribution</h3>
        <div className="space-y-3">
          {Object.entries(planData).map(([plan, count]) => {
            const pct = ((count / total) * 100).toFixed(1);
            const colors: Record<string, string> = {
              starter: 'bg-blue-500',
              pro: 'bg-accent',
              premium: 'bg-sigma',
              none: 'bg-gray-600',
            };
            return (
              <div key={plan}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="capitalize">{plan}</span>
                  <span className="text-gray-400">{count} ({pct}%)</span>
                </div>
                <div className="h-2 bg-card-hover rounded-full overflow-hidden">
                  <div
                    className={`h-full ${colors[plan] || 'bg-gray-600'} rounded-full transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Broker Usage */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Broker Usage</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(brokerCounts).map(([broker, count]) => (
            <div key={broker} className="bg-card-hover rounded-lg p-3 text-center">
              <div className="text-lg font-bold">{count}</div>
              <div className="text-xs text-gray-400 capitalize">{broker === 'none' ? 'No Broker' : broker}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Summary */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-semibold mb-4">Activity Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-card-hover rounded-lg p-4">
            <div className="text-2xl font-bold text-accent">{stats?.activeLastDay ?? 0}</div>
            <div className="text-xs text-gray-400 mt-1">Active last 24h</div>
          </div>
          <div className="bg-card-hover rounded-lg p-4">
            <div className="text-2xl font-bold text-active">{stats?.liveTraders ?? 0}</div>
            <div className="text-xs text-gray-400 mt-1">Live traders</div>
          </div>
          <div className="bg-card-hover rounded-lg p-4">
            <div className="text-2xl font-bold text-amber-400">{stats?.trialUsers ?? 0}</div>
            <div className="text-xs text-gray-400 mt-1">On trial</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Trading Controls Tab
// ─────────────────────────────────────────────────────────────────────────────

function TradingTab({
  users,
  searchQuery,
  onSearch,
  actionLoading,
  onToggleTrading,
  onToggleAccount,
}: {
  users: User[];
  searchQuery: string;
  onSearch: (q: string) => void;
  actionLoading: string | null;
  onToggleTrading: (email: string, enabled: boolean) => void;
  onToggleAccount: (email: string, enabled: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full bg-card border border-border rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-accent"
        />
      </div>

      {/* Trading Controls Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card-hover">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">User</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Plan</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Live Trading</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Account</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Broker</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email} className="border-b border-border/50 hover:bg-card-hover/50">
                  <td className="py-3 px-4">
                    <div className="font-medium">{u.username}</div>
                    <div className="text-xs text-gray-500">{u.email}</div>
                  </td>
                  <td className="py-3 px-4">
                    <PlanBadge plan={u.plan} status={u.planStatus} />
                  </td>
                  <td className="py-3 px-4">
                    <ToggleSwitch
                      enabled={u.liveTradingEnabled || false}
                      loading={actionLoading === u.email}
                      onToggle={() => onToggleTrading(u.email, !u.liveTradingEnabled)}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <ToggleSwitch
                      enabled={u.accountEnabled !== false}
                      loading={actionLoading === u.email}
                      onToggle={() => onToggleAccount(u.email, u.accountEnabled === false)}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <BrokerBadges user={u} />
                  </td>
                  <td className="py-3 px-4 text-right">
                    {actionLoading === u.email && (
                      <Loader2 className="w-4 h-4 animate-spin text-accent inline" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Components
// ─────────────────────────────────────────────────────────────────────────────

function PlanBadge({ plan, status }: { plan?: PlanType | null; status?: PlanStatus }) {
  if (!plan) {
    return <span className="text-xs px-2 py-0.5 bg-gray-700 text-gray-400 rounded-full">No plan</span>;
  }

  const colors: Record<string, string> = {
    starter: 'bg-blue-500/10 text-blue-400',
    pro: 'bg-accent/10 text-accent',
    premium: 'bg-sigma/10 text-sigma',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colors[plan] || 'bg-gray-700 text-gray-400'}`}>
      {plan}{status === 'trial' ? ' (trial)' : ''}
    </span>
  );
}

function BrokerBadges({ user }: { user: User }) {
  const brokers: string[] = [];
  if (user.hasDhanCredentials) brokers.push('Dhan');
  if (user.hasZerodhaCredentials) brokers.push('Zerodha');
  if (user.hasMotilalCredentials) brokers.push('Motilal');

  if (brokers.length === 0) {
    return <span className="text-xs text-gray-500">None</span>;
  }

  return (
    <div className="flex gap-1 flex-wrap">
      {brokers.map((b) => (
        <span key={b} className="text-xs px-1.5 py-0.5 bg-card-hover rounded text-gray-300">
          {b}
        </span>
      ))}
    </div>
  );
}

function ToggleSwitch({
  enabled,
  loading,
  onToggle,
}: {
  enabled: boolean;
  loading: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={loading}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        enabled ? 'bg-active' : 'bg-gray-600'
      } ${loading ? 'opacity-50' : ''}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function UserActions({
  user,
  loading,
  onUpdatePlan,
  onExtendTrial,
  onToggleAccount,
  onViewAnalytics,
  onDeleteUser,
}: {
  user: User;
  loading: boolean;
  onUpdatePlan: (email: string, plan: PlanType, status: PlanStatus) => void;
  onExtendTrial: (email: string, days: number) => void;
  onToggleAccount: (email: string, enabled: boolean) => void;
  onViewAnalytics: () => void;
  onDeleteUser: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  if (loading) {
    return <Loader2 className="w-4 h-4 animate-spin text-accent inline" />;
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-card-hover rounded hover:bg-border transition-colors"
      >
        Actions <ChevronDown className="w-3 h-3" />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 w-44 bg-card border border-border rounded-lg shadow-xl z-50 py-1">
            <button
              onClick={() => { onViewAnalytics(); setShowMenu(false); }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-card-hover text-accent transition-colors flex items-center gap-2"
            >
              <BarChart3 className="w-3 h-3" /> View Analytics
            </button>
            <div className="border-t border-border my-1" />
            <div className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider">Set Plan</div>
            {(['starter', 'pro', 'premium'] as PlanType[]).map((p) => (
              <button
                key={p}
                onClick={() => { onUpdatePlan(user.email, p, 'active'); setShowMenu(false); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-card-hover transition-colors capitalize"
              >
                {p}
              </button>
            ))}
            <div className="border-t border-border my-1" />
            <button
              onClick={() => { onExtendTrial(user.email, 7); setShowMenu(false); }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-card-hover text-amber-400 transition-colors"
            >
              +7 days trial
            </button>
            <button
              onClick={() => { onExtendTrial(user.email, 30); setShowMenu(false); }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-card-hover text-amber-400 transition-colors"
            >
              +30 days trial
            </button>
            <div className="border-t border-border my-1" />
            <button
              onClick={() => { onToggleAccount(user.email, user.accountEnabled === false); setShowMenu(false); }}
              className={`w-full text-left px-3 py-1.5 text-xs hover:bg-card-hover transition-colors ${
                user.accountEnabled === false ? 'text-active' : 'text-danger'
              }`}
            >
              {user.accountEnabled === false ? 'Enable Account' : 'Disable Account'}
            </button>
            <div className="border-t border-border my-1" />
            <button
              onClick={() => { onDeleteUser(); setShowMenu(false); }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-card-hover text-danger transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-3 h-3" /> Delete User
            </button>
          </div>
        </>
      )}
    </div>
  );
}
