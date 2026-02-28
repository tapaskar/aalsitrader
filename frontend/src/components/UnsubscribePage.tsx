import { useState, useEffect } from 'react';
import { MailX, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '';

export function UnsubscribePage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Invalid unsubscribe link. No token provided.');
      return;
    }

    fetch(`${API_URL}/auth/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus('success');
          setMessage(data.email ? `${data.email} has been unsubscribed.` : 'You have been unsubscribed.');
        } else {
          setStatus('error');
          setMessage(data.error || 'Failed to unsubscribe. The link may have expired.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Unable to connect to server. Please try again later.');
      });
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-accent animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Unsubscribing...</h2>
            <p className="text-gray-400 text-sm">Please wait while we process your request.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-active mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Unsubscribed</h2>
            <p className="text-gray-400 text-sm mb-6">{message}</p>
            <p className="text-gray-500 text-xs mb-4">
              You can re-enable email notifications anytime from your profile settings.
            </p>
            <a
              href="/"
              className="inline-block px-6 py-2.5 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Back to AalsiTrader
            </a>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-12 h-12 text-danger mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-gray-400 text-sm mb-6">{message}</p>
            <a
              href="/"
              className="inline-block px-6 py-2.5 bg-accent hover:bg-accent/80 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Back to AalsiTrader
            </a>
          </>
        )}
      </div>
    </div>
  );
}
