import { useState } from 'react';
import { X, Loader2, AlertCircle, UserPlus } from 'lucide-react';
import { getAuthHeaders, type PlanType, type PlanStatus } from '../../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || '';

interface AddUserModalProps {
  onClose: () => void;
  onUserCreated: () => void;
}

export function AddUserModal({ onClose, onUserCreated }: AddUserModalProps) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [plan, setPlan] = useState<PlanType>('pro');
  const [planStatus, setPlanStatus] = useState<PlanStatus>('trial');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !username || !password) {
      setError('All fields are required');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ email, username, password, plan, planStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create user');
        return;
      }
      onUserCreated();
      onClose();
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const plans: { id: PlanType; label: string; color: string }[] = [
    { id: 'starter', label: 'Starter', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { id: 'pro', label: 'Pro', color: 'bg-accent/20 text-accent border-accent/30' },
    { id: 'premium', label: 'Premium', color: 'bg-sigma/20 text-sigma border-sigma/30' },
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-background/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold">Add New User</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-card-hover transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
              placeholder="user@example.com"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
              placeholder="Display name"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
              placeholder="Min 8 characters"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Plan</label>
            <div className="flex gap-2">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlan(p.id)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    plan === p.id ? p.color : 'border-border text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 uppercase tracking-wider">Status</label>
            <div className="flex gap-2">
              {(['trial', 'active'] as PlanStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPlanStatus(s)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors capitalize ${
                    planStatus === s
                      ? s === 'trial' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-active/20 text-active border-active/30'
                      : 'border-border text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-accent hover:bg-accent/80 text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </div>
    </div>
  );
}
