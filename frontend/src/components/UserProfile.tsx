import { useState, useEffect } from 'react';
import { X, User, Mail, Key, Shield, Save, Loader2, CheckCircle, AlertCircle, Eye, EyeOff, LogOut, Smartphone, ExternalLink, Bell, BellOff } from 'lucide-react';
import { useAuthStore, BrokerType } from '../store/authStore';

interface UserProfileProps {
  onClose: () => void;
}

// Broker metadata — single source of truth for selector + credential forms
const BROKERS: {
  value: BrokerType;
  label: string;
  api: string;
  color: string;
  docsUrl: string;
  docsLabel: string;
  hasKey: string;
  fields: Array<{
    key: string;
    label: string;
    placeholder: string;
    icon: 'key' | 'shield' | 'user' | 'phone';
    sensitive: boolean;
    hint?: string;
    maxLength?: number;
  }>;
}[] = [
  {
    value: 'zerodha', label: 'Zerodha', api: 'Kite Connect', color: 'bg-green-500',
    docsUrl: 'https://developers.kite.trade/', docsLabel: 'developers.kite.trade',
    hasKey: 'hasZerodhaCredentials',
    fields: [
      { key: 'zerodhaApiKey', label: 'API Key', placeholder: 'Kite Connect API Key', icon: 'key', sensitive: true },
      { key: 'zerodhaApiSecret', label: 'API Secret', placeholder: 'Kite Connect API Secret', icon: 'shield', sensitive: true },
    ],
  },
  {
    value: 'dhan', label: 'DhanHQ', api: 'DhanHQ API', color: 'bg-orange-500',
    docsUrl: 'https://dhanhq.co/docs/', docsLabel: 'dhanhq.co/docs',
    hasKey: 'hasDhanCredentials',
    fields: [
      { key: 'dhanClientId', label: 'Client ID', placeholder: 'Dhan Client ID', icon: 'user', sensitive: false },
      { key: 'dhanAccessToken', label: 'Access Token', placeholder: 'Dhan Access Token', icon: 'key', sensitive: true },
      { key: 'dhanPin', label: 'Trading PIN', placeholder: '6-digit trading PIN', icon: 'key', sensitive: true, hint: 'For auto token renewal', maxLength: 6 },
      { key: 'dhanTotpSecret', label: 'TOTP Secret', placeholder: 'TOTP secret from authenticator', icon: 'phone', sensitive: true, hint: 'For auto token renewal' },
    ],
  },
  {
    value: 'motilal', label: 'Motilal Oswal', api: 'XTS API', color: 'bg-blue-500',
    docsUrl: 'https://moxtsapi.motilaloswal.com:3000/dashboard', docsLabel: 'moxtsapi.motilaloswal.com',
    hasKey: 'hasMotilalCredentials',
    fields: [
      { key: 'motilalClientId', label: 'Client ID', placeholder: 'Trading Client ID', icon: 'user', sensitive: false },
      { key: 'motilalPassword', label: 'Trading Password', placeholder: 'Trading Password', icon: 'key', sensitive: true },
      { key: 'motilalTotpSecret', label: 'TOTP Secret', placeholder: '32-character TOTP secret', icon: 'phone', sensitive: true },
      { key: 'motilalApiSecret', label: 'API Secret', placeholder: 'API Secret', icon: 'shield', sensitive: true },
    ],
  },
  {
    value: 'angelone', label: 'AngelOne', api: 'SmartAPI', color: 'bg-red-500',
    docsUrl: 'https://smartapi.angelone.in', docsLabel: 'smartapi.angelone.in',
    hasKey: 'hasAngelOneCredentials',
    fields: [
      { key: 'angeloneApiKey', label: 'API Key', placeholder: 'SmartAPI App Key', icon: 'key', sensitive: true },
      { key: 'angeloneClientId', label: 'Client ID', placeholder: 'AngelOne Client Code', icon: 'user', sensitive: false },
      { key: 'angelonePin', label: 'PIN', placeholder: 'Trading PIN', icon: 'key', sensitive: true },
      { key: 'angeloneTotpSecret', label: 'TOTP Secret', placeholder: 'TOTP secret from authenticator', icon: 'phone', sensitive: true },
    ],
  },
  {
    value: 'upstox', label: 'Upstox', api: 'API v2', color: 'bg-purple-500',
    docsUrl: 'https://account.upstox.com/developer/apps', docsLabel: 'account.upstox.com',
    hasKey: 'hasUpstoxCredentials',
    fields: [
      { key: 'upstoxApiKey', label: 'API Key', placeholder: 'Upstox App API Key', icon: 'key', sensitive: true },
      { key: 'upstoxApiSecret', label: 'API Secret', placeholder: 'Upstox App Secret', icon: 'shield', sensitive: true },
      { key: 'upstoxAccessToken', label: 'Access Token', placeholder: 'OAuth2 Access Token', icon: 'key', sensitive: true, hint: 'Expires daily — re-enter after market open' },
    ],
  },
];

const ICON_MAP = {
  key: Key,
  shield: Shield,
  user: User,
  phone: Smartphone,
};

export function UserProfile({ onClose }: UserProfileProps) {
  const { user, updateProfile, logout, isLoading, error, clearError } = useAuthStore();

  const [username, setUsername] = useState(user?.username || '');
  const [brokerType, setBrokerType] = useState<BrokerType>(user?.brokerType || 'none');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(!user?.emailOptOut);

  useEffect(() => {
    clearError();
    setSaveSuccess(false);
  }, []);

  const setField = (key: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [key]: value }));
  };

  const toggleVisible = (key: string) => {
    setVisibleFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveProfile = async () => {
    setSaveSuccess(false);
    const updates: any = {};

    if (username !== user?.username) updates.username = username;
    if (brokerType !== user?.brokerType) updates.brokerType = brokerType;

    // Email notification preference
    const newOptOut = !emailNotifications;
    if (newOptOut !== !!user?.emailOptOut) updates.emailOptOut = newOptOut;

    // Only save credentials for the selected broker
    const selectedBroker = BROKERS.find(b => b.value === brokerType);
    if (selectedBroker) {
      for (const field of selectedBroker.fields) {
        const val = fieldValues[field.key];
        if (val) updates[field.key] = val;
      }
    }

    if (Object.keys(updates).length === 0) return;

    const success = await updateProfile(updates);
    if (success) {
      setSaveSuccess(true);
      setFieldValues({});
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  const handleLogout = () => { logout(); onClose(); };

  if (!user) return null;

  const selectedBroker = BROKERS.find(b => b.value === brokerType);
  const isConfigured = (b: typeof BROKERS[0]) => !!(user as any)[b.hasKey];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-background/50 flex items-center justify-between">
          <h2 className="text-lg font-bold">Profile Settings</h2>
          <button onClick={onClose} className="p-1 hover:bg-border/50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Status Messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {saveSuccess && (
            <div className="flex items-center gap-2 p-3 bg-active/10 border border-active/30 rounded-lg text-active text-sm">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          {/* Account Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Account</h3>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" value={user.email} disabled className="w-full bg-background/50 border border-border rounded-lg pl-10 pr-3 py-2.5 text-sm text-gray-400 cursor-not-allowed" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Your display name" className="w-full bg-background border border-border rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:border-accent" />
              </div>
            </div>
          </div>

          {/* Broker Selection */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Broker</h3>

            {/* Broker Picker */}
            <div className="space-y-1.5">
              {/* None option */}
              <button
                type="button"
                onClick={() => setBrokerType('none')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                  brokerType === 'none'
                    ? 'border-accent bg-accent/5 text-white'
                    : 'border-border bg-background hover:bg-card-hover text-gray-400'
                }`}
              >
                <div className="w-2 h-2 rounded-full bg-gray-600" />
                <span className="font-medium">No broker</span>
                <span className="text-[10px] text-gray-500 ml-auto">Paper trading only</span>
              </button>

              {/* Broker options */}
              {BROKERS.map((b) => {
                const configured = isConfigured(b);
                const selected = brokerType === b.value;
                return (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setBrokerType(b.value)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                      selected
                        ? 'border-accent bg-accent/5 text-white'
                        : 'border-border bg-background hover:bg-card-hover text-gray-400'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${b.color}`} />
                    <span className="font-medium">{b.label}</span>
                    <span className="text-[10px] text-gray-500">{b.api}</span>
                    {configured && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-active/15 text-active rounded-full">Connected</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Credential Form — only for the selected broker */}
            {selectedBroker && (
              <div className="space-y-3 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-300">{selectedBroker.label} Credentials</span>
                  <a
                    href={selectedBroker.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-accent hover:text-accent/80 transition-colors"
                  >
                    {selectedBroker.docsLabel} <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>

                {selectedBroker.fields.map((field) => {
                  const IconComponent = ICON_MAP[field.icon];
                  const value = fieldValues[field.key] || '';
                  const isVisible = visibleFields[field.key] || false;
                  const configured = isConfigured(selectedBroker);

                  return (
                    <div key={field.key}>
                      <label className="block text-sm font-medium mb-1.5">
                        {field.label}
                        {field.hint && <span className="text-gray-500 text-[10px] ml-1">({field.hint})</span>}
                      </label>
                      <div className="relative">
                        <IconComponent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type={field.sensitive && !isVisible ? 'password' : 'text'}
                          value={value}
                          onChange={(e) => setField(field.key, e.target.value)}
                          placeholder={configured ? '••••••••' : field.placeholder}
                          autoComplete="off"
                          data-1p-ignore
                          maxLength={field.maxLength}
                          className="w-full bg-background border border-border rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-accent"
                        />
                        {field.sensitive && (
                          <button
                            type="button"
                            onClick={() => toggleVisible(field.key)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                          >
                            {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <p className="text-[10px] text-gray-500">
                  Credentials are AES-256 encrypted and stored securely. We never share or log them.
                </p>
              </div>
            )}
          </div>

          {/* Email Notifications */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Notifications</h3>
            <button
              type="button"
              onClick={() => setEmailNotifications(!emailNotifications)}
              className="w-full flex items-center justify-between px-3 py-3 rounded-lg border border-border bg-background hover:bg-card-hover transition-colors"
            >
              <div className="flex items-center gap-3">
                {emailNotifications ? <Bell className="w-4 h-4 text-active" /> : <BellOff className="w-4 h-4 text-gray-500" />}
                <div className="text-left">
                  <div className="text-sm font-medium">Email Notifications</div>
                  <div className="text-[10px] text-gray-500">Account updates & weekly market insights</div>
                </div>
              </div>
              <div className={`w-9 h-5 rounded-full transition-colors relative ${emailNotifications ? 'bg-active' : 'bg-gray-600'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${emailNotifications ? 'left-[18px]' : 'left-0.5'}`} />
              </div>
            </button>
          </div>

          {/* Subscription */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Subscription</h3>
            <div className="bg-background/50 rounded-lg p-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium capitalize">
                  {user.plan || 'Starter'} Plan
                  {user.planStatus === 'trial' && (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">Trial</span>
                  )}
                  {user.planStatus === 'active' && (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">Active</span>
                  )}
                  {(user.planStatus === 'expired' || user.planStatus === 'cancelled') && (
                    <span className="ml-2 text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full capitalize">{user.planStatus}</span>
                  )}
                </div>
                {user.planStatus === 'trial' && user.trialEndsAt && (
                  <div className="text-xs text-gray-400 mt-1">
                    Trial ends {new Date(user.trialEndsAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              {(!user.plan || user.plan === 'starter' || user.planStatus === 'trial' || user.planStatus === 'expired' || user.planStatus === 'cancelled') && (
                <a
                  href={`https://aalsitrader.lemonsqueezy.com/checkout/buy/a7780a5a-9a8f-42dc-a742-815a1476f3b1?checkout[email]=${encodeURIComponent(user.email)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent/80 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Upgrade
                </a>
              )}
            </div>
          </div>

          {/* Account Stats */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Account Info</h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-background/50 rounded-lg p-3">
                <div className="text-gray-400">Member Since</div>
                <div className="font-medium">{new Date(user.createdAt).toLocaleDateString()}</div>
              </div>
              <div className="bg-background/50 rounded-lg p-3">
                <div className="text-gray-400">Last Login</div>
                <div className="font-medium">{new Date(user.lastLogin).toLocaleDateString()}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-background/30 flex items-center justify-between">
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-danger hover:bg-danger/10 rounded-lg transition-colors text-sm">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
          <button onClick={handleSaveProfile} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent/80 disabled:bg-accent/50 text-white rounded-lg transition-colors text-sm font-medium">
            {isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : (
              <><Save className="w-4 h-4" /> Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
