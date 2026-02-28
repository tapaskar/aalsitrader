import { useState } from 'react';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, Loader2, ArrowLeft, KeyRound, CheckCircle2, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

type AuthMode = 'login' | 'register' | 'forgot' | 'reset-code' | 'reset-password' | 'reset-success';

interface AuthModalProps {
  initialMode?: 'login' | 'register';
  onClose?: () => void;
}

export function AuthModal({ initialMode = 'login', onClose }: AuthModalProps = {}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const { login, register, requestPasswordReset, resetPassword, isLoading, error, clearError } = useAuthStore();

  const validateForm = (): boolean => {
    setValidationError('');

    if (!email.trim()) {
      setValidationError('Email is required');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setValidationError('Invalid email format');
      return false;
    }

    if (mode === 'register' && !username.trim()) {
      setValidationError('Username is required');
      return false;
    }

    if ((mode === 'login' || mode === 'register') && password.length < 8) {
      setValidationError('Password must be at least 8 characters');
      return false;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setValidationError('Passwords do not match');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) return;

    if (mode === 'login') {
      await login(email, password);
    } else if (mode === 'register') {
      await register(email, username, password);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError('');

    if (!email.trim()) {
      setValidationError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setValidationError('Invalid email format');
      return;
    }

    const result = await requestPasswordReset(email);
    if (result.success) {
      if (result.resetToken) {
        setResetToken(result.resetToken);
      }
      setMode('reset-code');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setValidationError('');

    if (!resetToken.trim()) {
      setValidationError('Reset code is required');
      return;
    }

    if (newPassword.length < 8) {
      setValidationError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setValidationError('Passwords do not match');
      return;
    }

    const success = await resetPassword(email, resetToken, newPassword);
    if (success) {
      setMode('reset-success');
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setValidationError('');
    clearError();
    setPassword('');
    setConfirmPassword('');
  };

  const goToForgot = () => {
    setMode('forgot');
    setValidationError('');
    clearError();
    setResetToken('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const backToLogin = () => {
    setMode('login');
    setValidationError('');
    clearError();
    setPassword('');
    setResetToken('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const displayError = validationError || error;

  // Forgot password: enter email
  if (mode === 'forgot') {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-background/50">
            <button onClick={backToLogin} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 mb-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to login
            </button>
            <h2 className="text-xl font-bold">Reset Password</h2>
            <p className="text-sm text-gray-400 mt-1">
              Enter your email address and we'll generate a reset code
            </p>
          </div>

          <form onSubmit={handleForgotPassword} className="p-6 space-y-4">
            {displayError && (
              <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{displayError}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-background border border-border rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-accent"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-accent hover:bg-accent/80 disabled:bg-accent/50 text-white py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Get Reset Code'
              )}
            </button>
          </form>

          <div className="px-6 py-3 border-t border-border bg-background/30">
            <p className="text-[10px] text-gray-500 text-center">
              AalsiTrader
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Reset code: show code + enter new password
  if (mode === 'reset-code') {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-background/50">
            <button onClick={goToForgot} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-200 mb-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <h2 className="text-xl font-bold">Enter Reset Code</h2>
            <p className="text-sm text-gray-400 mt-1">
              Enter the reset code and your new password
            </p>
          </div>

          <form onSubmit={handleResetPassword} className="p-6 space-y-4">
            {displayError && (
              <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{displayError}</span>
              </div>
            )}

            {/* Show the generated reset code */}
            {resetToken && (
              <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg">
                <p className="text-xs text-gray-400 mb-1">Your reset code:</p>
                <p className="text-2xl font-mono font-bold text-accent tracking-[0.3em] text-center">
                  {resetToken}
                </p>
                <p className="text-[10px] text-gray-500 mt-1.5 text-center">
                  This code expires in 1 hour
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">Reset Code</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="6-digit code"
                  maxLength={6}
                  className="w-full bg-background border border-border rounded-lg pl-10 pr-3 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:border-accent"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-border rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-accent"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-border rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-accent"
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-accent hover:bg-accent/80 disabled:bg-accent/50 text-white py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>

          <div className="px-6 py-3 border-t border-border bg-background/30">
            <p className="text-[10px] text-gray-500 text-center">
              AalsiTrader
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Reset success
  if (mode === 'reset-success') {
    return (
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-background/50">
            <h2 className="text-xl font-bold text-center">Password Reset</h2>
          </div>

          <div className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-success" />
              </div>
              <h3 className="text-lg font-semibold">Password Updated!</h3>
              <p className="text-sm text-gray-400 text-center">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
            </div>

            <button
              onClick={backToLogin}
              className="w-full bg-accent hover:bg-accent/80 text-white py-2.5 rounded-lg font-semibold transition-colors"
            >
              Back to Sign In
            </button>
          </div>

          <div className="px-6 py-3 border-t border-border bg-background/30">
            <p className="text-[10px] text-gray-500 text-center">
              AalsiTrader
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Login / Register (default)
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-background/50 relative">
          {onClose && (
            <button onClick={onClose} className="absolute right-4 top-4 p-1 text-gray-400 hover:text-white rounded-lg hover:bg-card-hover transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
          <h2 className="text-xl font-bold text-center">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-sm text-gray-400 text-center mt-1">
            {mode === 'login'
              ? 'Sign in to access your trading dashboard'
              : 'Register to start AI trading — 7 days free'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Error Display */}
          {displayError && (
            <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{displayError}</span>
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-background border border-border rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-accent"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Username (Register only) */}
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Your display name"
                  className="w-full bg-background border border-border rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-accent"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium">Password</label>
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={goToForgot}
                  className="text-xs text-accent hover:text-accent/80"
                >
                  Forgot Password?
                </button>
              )}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-background border border-border rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-accent"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password (Register only) */}
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-border rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-accent"
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-accent hover:bg-accent/80 disabled:bg-accent/50 text-white py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {mode === 'login' ? 'Signing in...' : 'Creating account...'}
              </>
            ) : (
              mode === 'login' ? 'Sign In' : 'Create Account'
            )}
          </button>

          {/* Switch Mode */}
          <div className="text-center text-sm">
            <span className="text-gray-400">
              {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
            </span>
            <button
              type="button"
              onClick={switchMode}
              className="ml-1 text-accent hover:text-accent/80 font-medium"
              disabled={isLoading}
            >
              {mode === 'login' ? 'Register' : 'Sign In'}
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-background/30">
          <p className="text-[10px] text-gray-500 text-center">
            AalsiTrader
          </p>
        </div>
      </div>
    </div>
  );
}
