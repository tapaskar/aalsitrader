import { useState, useEffect, useCallback, useRef } from 'react';
import { Wifi, WifiOff, Volume2, VolumeX, TrendingUp, TrendingDown, Shield, ShieldOff, RefreshCw, LogIn, X, Check, Loader2, User, LogOut, Settings, Users, ChevronDown, Mail } from 'lucide-react';
import { useAuthStore, getAuthHeaders, BrokerType } from '../store/authStore';
import { UserProfile } from './UserProfile';
import { Logo } from './Logo';

interface MarketIndex {
  value: number;
  change: number;
  changePercent: number;
}

type ViewType = 'dashboard' | 'paper-trading' | 'screener' | 'nifty-straddle' | 'admin';

interface HeaderProps {
  wsConnected: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  activeView?: ViewType;
  onViewChange?: (view: ViewType) => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'https://kzdbk5z09k.execute-api.ap-south-1.amazonaws.com/prod';

export function Header({
  wsConnected,
  soundEnabled,
  onToggleSound,
  activeView = 'dashboard',
  onViewChange,
}: HeaderProps) {
  const { user, logout, updateProfile } = useAuthStore();
  const [showProfile, setShowProfile] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showBrokerDropdown, setShowBrokerDropdown] = useState(false);
  const [switchingBroker, setSwitchingBroker] = useState(false);
  const brokerDropdownRef = useRef<HTMLDivElement>(null);

  const [zerodhaStatus, setZerodhaStatus] = useState<{
    connected: boolean;
    tokenExists: boolean;
    message: string;
    positions?: number;
  }>({ connected: false, tokenExists: false, message: 'Checking...' });

  const [showRefreshDialog, setShowRefreshDialog] = useState(false);
  const [refreshStep, setRefreshStep] = useState<'idle' | 'loading-url' | 'ready' | 'submitting' | 'success' | 'error'>('idle');
  const [refreshError, setRefreshError] = useState('');

  const [marketData, setMarketData] = useState<{
    nifty: MarketIndex;
    bankNifty: MarketIndex;
    sensex: MarketIndex;
  }>({
    nifty: { value: 0, change: 0, changePercent: 0 },
    bankNifty: { value: 0, change: 0, changePercent: 0 },
    sensex: { value: 0, change: 0, changePercent: 0 },
  });

  const refreshZerodhaStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/zerodha-status`, {
        headers: getAuthHeaders(),
      });
      if (res.status === 401) {
        setZerodhaStatus({ connected: false, tokenExists: false, message: 'Please login first' });
        return;
      }
      const data = await res.json();
      setZerodhaStatus({
        connected: data.connected || false,
        tokenExists: data.tokenExists || false,
        message: data.message || 'Unknown',
        positions: data.positions,
      });
    } catch {
      setZerodhaStatus({ connected: false, tokenExists: false, message: 'API unreachable' });
    }
  }, []);

  // Auto-capture request_token from Zerodha redirect URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('request_token');
    const status = params.get('status');

    if (token && status === 'success') {
      // Clean up URL immediately
      window.history.replaceState({}, '', window.location.pathname);

      // Auto-submit the token
      setShowRefreshDialog(true);
      setRefreshStep('submitting');

      (async () => {
        try {
          const res = await fetch(`${API_URL}/zerodha-refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
            body: JSON.stringify({ request_token: token }),
          });
          if (res.status === 401) {
            setRefreshError('Please login first to connect Zerodha');
            setRefreshStep('error');
            return;
          }
          const data = await res.json();
          if (data.success) {
            setRefreshStep('success');
            await refreshZerodhaStatus();
            setTimeout(() => {
              setShowRefreshDialog(false);
              setRefreshStep('idle');
            }, 2000);
          } else {
            setRefreshError(data.error || 'Token refresh failed');
            setRefreshStep('error');
          }
        } catch {
          setRefreshError('Failed to reach API');
          setRefreshStep('error');
        }
      })();
    }
  }, [refreshZerodhaStatus]);

  useEffect(() => {
    const fetchMarket = async () => {
      try {
        const res = await fetch(`${API_URL}/market-data`);
        const data = await res.json();
        if (data.indices) {
          setMarketData(data.indices);
        }
      } catch (err) {
        console.error('Failed to fetch market data:', err);
      }
    };

    fetchMarket();
    const interval = setInterval(fetchMarket, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    refreshZerodhaStatus();
    const interval = setInterval(refreshZerodhaStatus, 60000);
    return () => clearInterval(interval);
  }, [refreshZerodhaStatus]);

  const handleStartRefresh = useCallback(async () => {
    setShowRefreshDialog(true);
    setRefreshStep('loading-url');
    setRefreshError('');
    try {
      const res = await fetch(`${API_URL}/zerodha-login-url`, {
        headers: getAuthHeaders(),
      });
      if (res.status === 401) {
        // Session expired - logout and show re-login message
        logout();
        setRefreshError('Session expired. Please login again.');
        setRefreshStep('error');
        return;
      }
      const data = await res.json();
      if (data.loginUrl) {
        // Navigate to Zerodha login — it will redirect back with request_token
        window.location.href = data.loginUrl;
      } else if (data.error) {
        // Backend returned an error
        if (data.error.includes('credentials') || data.error.includes('not found') || data.message?.includes('credentials')) {
          setRefreshError('Zerodha API credentials not configured. Go to Profile Settings → Broker API → Zerodha to add your API Key and Secret.');
        } else {
          setRefreshError(data.error);
        }
        setRefreshStep('error');
      } else {
        setRefreshError('Could not get login URL. Please configure Zerodha API credentials in Profile Settings.');
        setRefreshStep('error');
      }
    } catch {
      setRefreshError('Failed to reach API');
      setRefreshStep('error');
    }
  }, [logout]);

  const handleCloseDialog = useCallback(() => {
    setShowRefreshDialog(false);
    setRefreshStep('idle');
    setRefreshError('');
  }, []);

  return (
    <header className="bg-card border-b border-border sticky top-0 z-40">
      <div className="max-w-[1920px] mx-auto px-4 md:px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Logo & Navigation */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-active to-accent rounded-lg flex items-center justify-center text-white">
                <Logo className="w-7 h-7" />
              </div>
              <div>
                <h1 className="text-xl font-bold">AalsiTrader</h1>
                <p className="text-xs text-gray-500">Mission Control</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            {onViewChange && (
              <div className="hidden md:flex items-center bg-card-hover rounded-lg p-1 ml-4">
                <button
                  onClick={() => onViewChange('dashboard')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeView === 'dashboard'
                      ? 'bg-accent text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => onViewChange('paper-trading')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeView === 'paper-trading'
                      ? 'bg-sigma text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  AI Trader
                </button>
                <button
                  onClick={() => onViewChange('screener')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeView === 'screener'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Smart Money
                </button>
                <button
                  onClick={() => onViewChange('nifty-straddle')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeView === 'nifty-straddle'
                      ? 'bg-amber-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Nifty Scalper
                </button>
                {user?.role === 'admin' && (
                  <button
                    onClick={() => onViewChange('admin')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      activeView === 'admin'
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Admin
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Market Status */}
          <div className="flex items-center gap-4 md:gap-6">
            {[
              { label: 'Nifty 50', data: marketData.nifty },
              { label: 'Bank Nifty', data: marketData.bankNifty },
              { label: 'Sensex', data: marketData.sensex },
            ].map(({ label, data }) => (
              <div key={label} className="text-right">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-xs text-gray-500">
                    {data.value > 0 ? data.value.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '—'}
                  </span>
                </div>
                <div className={`flex items-center justify-end gap-1 text-xs ${data.changePercent >= 0 ? 'text-active' : 'text-danger'}`}>
                  {data.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span>
                    {data.value > 0
                      ? `${data.change >= 0 ? '+' : ''}${data.change.toFixed(0)} (${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%)`
                      : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Status & Controls */}
          <div className="flex items-center gap-4">
            {/* Broker Selector */}
            {(() => {
              const brokers: { id: BrokerType; label: string; icon: string; color: string; has: boolean }[] = [
                { id: 'zerodha', label: 'Zerodha', icon: '🟢', color: 'text-green-400', has: !!user?.hasZerodhaCredentials },
                { id: 'dhan', label: 'DhanHQ', icon: '🟠', color: 'text-amber-400', has: !!user?.hasDhanCredentials },
                { id: 'motilal', label: 'Motilal', icon: '🔵', color: 'text-blue-400', has: !!user?.hasMotilalCredentials },
                { id: 'angelone', label: 'AngelOne', icon: '🔴', color: 'text-red-400', has: !!user?.hasAngelOneCredentials },
                { id: 'upstox', label: 'Upstox', icon: '🟣', color: 'text-purple-400', has: !!user?.hasUpstoxCredentials },
              ];
              const configured = brokers.filter(b => b.has);
              const activeBroker = brokers.find(b => b.id === user?.brokerType) || configured[0];
              const noBroker = configured.length === 0;

              if (noBroker) {
                return (
                  <button
                    onClick={() => setShowProfile(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-danger/10 text-danger hover:bg-danger/20 cursor-pointer transition-colors"
                    title="Click to configure broker credentials"
                  >
                    <ShieldOff className="w-3.5 h-3.5" />
                    <span>No Broker</span>
                  </button>
                );
              }

              return (
                <div className="relative" ref={brokerDropdownRef}>
                  <button
                    onClick={() => setShowBrokerDropdown(!showBrokerDropdown)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      activeBroker
                        ? `bg-active/10 ${activeBroker.color} hover:bg-active/20`
                        : 'bg-card-hover text-gray-400 hover:bg-border'
                    }`}
                  >
                    {activeBroker && <span>{activeBroker.icon}</span>}
                    <span>{activeBroker?.label || 'Select Broker'}</span>
                    <Shield className="w-3 h-3" />
                    {configured.length > 1 && <ChevronDown className={`w-3 h-3 transition-transform ${showBrokerDropdown ? 'rotate-180' : ''}`} />}
                  </button>

                  {showBrokerDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowBrokerDropdown(false)} />
                      <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-lg shadow-xl z-50 py-1">
                        <div className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider">Your Brokers</div>
                        {configured.map(b => {
                          const isActive = b.id === (user?.brokerType === 'none' ? configured[0]?.id : user?.brokerType);
                          const isZerodha = b.id === 'zerodha';
                          return (
                            <button
                              key={b.id}
                              disabled={switchingBroker}
                              onClick={async () => {
                                if (isActive) {
                                  setShowBrokerDropdown(false);
                                  return;
                                }
                                setSwitchingBroker(true);
                                await updateProfile({ brokerType: b.id });
                                setSwitchingBroker(false);
                                setShowBrokerDropdown(false);
                              }}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                                isActive ? 'bg-active/10' : 'hover:bg-card-hover'
                              }`}
                            >
                              <span>{b.icon}</span>
                              <span className={`font-medium ${isActive ? b.color : 'text-white'}`}>{b.label}</span>
                              {isActive && <Check className="w-3.5 h-3.5 text-active ml-auto" />}
                              {isZerodha && !zerodhaStatus.connected && (
                                <span className="ml-auto text-[10px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded">Login needed</span>
                              )}
                            </button>
                          );
                        })}
                        <div className="border-t border-border mt-1 pt-1">
                          <button
                            onClick={() => { setShowBrokerDropdown(false); setShowProfile(true); }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-400 hover:bg-card-hover transition-colors"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            <span>Manage API Keys</span>
                          </button>
                        </div>
                        {/* Zerodha login shortcut */}
                        {user?.hasZerodhaCredentials && !zerodhaStatus.connected && (
                          <div className="border-t border-border pt-1">
                            <button
                              onClick={() => { setShowBrokerDropdown(false); handleStartRefresh(); }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-yellow-400 hover:bg-yellow-500/10 transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Login to Zerodha</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* WebSocket Status */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${
              wsConnected ? 'bg-active/10 text-active' : 'bg-danger/10 text-danger'
            }`}>
              {wsConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span>{wsConnected ? 'Live' : 'Offline'}</span>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={onToggleSound}
              className={`p-2 rounded-lg transition-colors ${
                soundEnabled ? 'bg-card-hover text-white' : 'bg-card-hover text-gray-500'
              }`}
              title={soundEnabled ? 'Sound on' : 'Sound off'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* User Menu */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-card-hover hover:bg-border rounded-lg transition-colors"
                >
                  <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center text-xs font-bold text-white">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium hidden md:inline">{user.username}</span>
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-lg shadow-xl z-50 py-1">
                      <div className="px-3 py-2 border-b border-border">
                        <div className="text-sm font-medium">{user.username}</div>
                        <div className="text-xs text-gray-400">{user.email}</div>
                      </div>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowProfile(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-card-hover transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        Profile Settings
                      </button>
                      {user.role === 'admin' && onViewChange && (
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            onViewChange('admin');
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-card-hover transition-colors text-sigma"
                        >
                          <Users className="w-4 h-4" />
                          Admin Panel
                        </button>
                      )}
                      <a
                        href="mailto:support@aalsitrader.com"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:bg-card-hover hover:text-gray-200 transition-colors"
                      >
                        <Mail className="w-4 h-4" />
                        Contact Support
                      </a>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Zerodha Token Refresh Dialog */}
      {showRefreshDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Zerodha Login</h2>
              <button onClick={handleCloseDialog} className="p-1 hover:bg-card-hover rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {refreshStep === 'loading-url' && (
              <div className="flex items-center gap-3 py-8 justify-center text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Redirecting to Zerodha...</span>
              </div>
            )}

            {refreshStep === 'submitting' && (
              <div className="flex items-center gap-3 py-8 justify-center text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Connecting to Zerodha...</span>
              </div>
            )}

            {refreshStep === 'success' && (
              <div className="flex flex-col items-center gap-3 py-8 text-active">
                <Check className="w-8 h-8" />
                <span className="font-medium">Zerodha connected!</span>
              </div>
            )}

            {refreshStep === 'error' && (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-2 py-4 text-danger">
                  <ShieldOff className="w-8 h-8" />
                  <span className="text-sm text-center px-4">{refreshError}</span>
                </div>
                {refreshError.includes('credentials') || refreshError.includes('Profile Settings') ? (
                  <button
                    onClick={() => {
                      handleCloseDialog();
                      setShowProfile(true);
                    }}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors text-sm font-medium"
                  >
                    <Settings className="w-4 h-4" />
                    Open Profile Settings
                  </button>
                ) : (
                  <button
                    onClick={handleStartRefresh}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-card-hover text-white rounded-lg hover:bg-border transition-colors text-sm font-medium"
                  >
                    <LogIn className="w-4 h-4" />
                    Try Again
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {showProfile && <UserProfile onClose={() => setShowProfile(false)} />}

    </header>
  );
}
