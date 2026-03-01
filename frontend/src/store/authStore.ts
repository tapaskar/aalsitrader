import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_URL = import.meta.env.VITE_API_URL || '';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BrokerType = 'zerodha' | 'motilal' | 'dhan' | 'angelone' | 'upstox' | 'none';

export type PlanType = 'starter' | 'pro' | 'premium';
export type PlanStatus = 'active' | 'trial' | 'expired' | 'cancelled';

export interface User {
  email: string;
  username: string;
  role: 'user' | 'admin';
  createdAt: number;
  updatedAt: number;
  lastLogin: number;
  brokerType: BrokerType;
  hasZerodhaCredentials: boolean;
  hasMotilalCredentials: boolean;
  hasDhanCredentials: boolean;
  hasAngelOneCredentials: boolean;
  hasUpstoxCredentials: boolean;
  plan?: PlanType | null;
  planStatus?: PlanStatus;
  trialStartedAt?: string;
  trialEndsAt?: string;
  liveTradingEnabled?: boolean;
  accountEnabled?: boolean;
  capitalLimit?: number;
  lastActive?: number;
  emailOptOut?: boolean;
  settings: {
    soundEnabled: boolean;
    darkMode: boolean;
    requireSigmaApproval: boolean;
  };
}

interface AuthState {
  // State
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  onboardingCompleted: boolean;

  // Actions
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, username: string, password: string) => Promise<boolean>;
  completeOnboarding: () => void;
  logout: () => void;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: {
    username?: string;
    brokerType?: BrokerType;
    zerodhaApiKey?: string;
    zerodhaApiSecret?: string;
    motilalClientId?: string;
    motilalPassword?: string;
    motilalTotpSecret?: string;
    motilalApiSecret?: string;
    dhanAccessToken?: string;
    dhanClientId?: string;
    dhanPin?: string;
    dhanTotpSecret?: string;
    angeloneApiKey?: string;
    angeloneClientId?: string;
    angelonePin?: string;
    angeloneTotpSecret?: string;
    upstoxApiKey?: string;
    upstoxApiSecret?: string;
    upstoxAccessToken?: string;
    settings?: Partial<User['settings']>;
    emailOptOut?: boolean;
  }) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean }>;
  resetPassword: (email: string, resetToken: string, newPassword: string) => Promise<boolean>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      onboardingCompleted: false,

      // Login
      login: async (email: string, password: string): Promise<boolean> => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });

          let data: any;
          try {
            data = await response.json();
          } catch {
            set({ isLoading: false, error: `Server error (${response.status}). Please try again later.` });
            return false;
          }

          if (!response.ok) {
            set({ isLoading: false, error: data.error || 'Invalid email or password' });
            return false;
          }

          set({
            token: data.token,
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          // GTM: track login
          (window as any).dataLayer?.push({ event: 'login', method: 'email' });

          return true;
        } catch (err) {
          set({ isLoading: false, error: 'Unable to connect to server. Check your internet connection.' });
          return false;
        }
      },

      // Register
      register: async (email: string, username: string, password: string): Promise<boolean> => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, username, password }),
          });

          let data: any;
          try {
            data = await response.json();
          } catch {
            set({ isLoading: false, error: `Server error (${response.status}). Please try again later.` });
            return false;
          }

          if (!response.ok) {
            set({ isLoading: false, error: data.error || 'Registration failed' });
            return false;
          }

          set({
            token: data.token,
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            onboardingCompleted: false, // New user — show the guide
          });

          // GTM: track sign_up conversion
          (window as any).dataLayer?.push({ event: 'sign_up', method: 'email' });

          return true;
        } catch (err) {
          set({ isLoading: false, error: 'Unable to connect to server. Check your internet connection.' });
          return false;
        }
      },

      // Logout
      logout: () => {
        set({
          token: null,
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      // Fetch Profile
      fetchProfile: async () => {
        const { token } = get();
        if (!token) return;

        set({ isLoading: true });

        try {
          const response = await fetch(`${API_URL}/auth/profile`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            // Token expired or invalid
            if (response.status === 401) {
              set({
                token: null,
                user: null,
                isAuthenticated: false,
                isLoading: false,
              });
              return;
            }
            throw new Error('Failed to fetch profile');
          }

          const data = await response.json();
          set({ user: data.user, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
        }
      },

      // Update Profile
      updateProfile: async (data): Promise<boolean> => {
        const { token } = get();
        if (!token) return false;

        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_URL}/auth/profile`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(data),
          });

          const result = await response.json();

          if (!response.ok) {
            set({ isLoading: false, error: result.error || 'Update failed' });
            return false;
          }

          set({ user: result.user, isLoading: false, error: null });
          return true;
        } catch (err) {
          set({ isLoading: false, error: 'Unable to connect to server. Check your internet connection.' });
          return false;
        }
      },

      // Request Password Reset
      requestPasswordReset: async (email: string): Promise<{ success: boolean }> => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_URL}/auth/forgot-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });

          const data = await response.json();

          if (!response.ok) {
            set({ isLoading: false, error: data.error || 'Failed to request password reset' });
            return { success: false };
          }

          set({ isLoading: false, error: null });
          return { success: true };
        } catch (err) {
          set({ isLoading: false, error: 'Unable to connect to server. Check your internet connection.' });
          return { success: false };
        }
      },

      // Reset Password
      resetPassword: async (email: string, resetToken: string, newPassword: string): Promise<boolean> => {
        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_URL}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, resetToken, newPassword }),
          });

          const data = await response.json();

          if (!response.ok) {
            set({ isLoading: false, error: data.error || 'Password reset failed' });
            return false;
          }

          set({ isLoading: false, error: null });
          return true;
        } catch (err) {
          set({ isLoading: false, error: 'Unable to connect to server. Check your internet connection.' });
          return false;
        }
      },

      // Clear Error
      clearError: () => set({ error: null }),

      // Complete onboarding tour
      completeOnboarding: () => set({ onboardingCompleted: true }),

      // Set Loading
      setLoading: (loading: boolean) => set({ isLoading: loading }),
    }),
    {
      name: 'trading-squad-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        onboardingCompleted: state.onboardingCompleted,
      }),
    }
  )
);

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Get auth headers for API calls
// ─────────────────────────────────────────────────────────────────────────────

export function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  if (!token) return {};
  return { 'Authorization': `Bearer ${token}` };
}
