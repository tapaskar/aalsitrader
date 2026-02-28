import { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { getAuthHeaders, type User } from '../../store/authStore';

const API_URL = import.meta.env.VITE_API_URL || '';

interface DeleteUserDialogProps {
  user: User;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteUserDialog({ user, onClose, onDeleted }: DeleteUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/admin/users/${encodeURIComponent(user.email)}`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders() },
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete user');
        return;
      }
      onDeleted();
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-background/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-danger">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-lg font-bold">Delete User</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-card-hover transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-300">
            Are you sure you want to permanently delete this user?
          </p>
          <div className="bg-background rounded-lg p-3 border border-border">
            <div className="font-medium">{user.username}</div>
            <div className="text-xs text-gray-500">{user.email}</div>
          </div>
          <p className="text-xs text-gray-500">
            This action cannot be undone. All user data, settings, and credentials will be removed.
          </p>

          {error && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-lg p-2">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-border text-gray-400 hover:text-white hover:border-gray-500 font-medium text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg bg-danger hover:bg-danger/80 text-white font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
