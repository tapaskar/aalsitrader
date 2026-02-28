import { X, ExternalLink, CheckCircle2 } from 'lucide-react';

interface BrokerGuide {
  name: string;
  steps: string[];
  docsUrl: string;
}

interface BrokerGuidanceModalProps {
  onClose: () => void;
  onRetry: () => void;
  guidance?: { brokers: BrokerGuide[] };
}

export function BrokerGuidanceModal({ onClose, onRetry, guidance }: BrokerGuidanceModalProps) {
  const brokers = guidance?.brokers || [
    {
      name: 'DhanHQ',
      steps: [
        'Create an account at dhan.co',
        'Go to API section in your Dhan dashboard',
        'Generate an Access Token',
        'Copy your Client ID and Access Token',
        'Go to Profile Settings in AalsiTrader',
        'Select DhanHQ as your broker and paste credentials',
      ],
      docsUrl: 'https://dhanhq.co/docs/v2/',
    },
    {
      name: 'Zerodha',
      steps: [
        'Create an account at zerodha.com',
        'Apply for Kite Connect API access at kite.trade',
        'Create an app and get your API Key and API Secret',
        'Go to Profile Settings in AalsiTrader',
        'Select Zerodha as your broker and paste credentials',
        'Click "Connect Zerodha" to authorize via Kite login',
      ],
      docsUrl: 'https://kite.trade/docs/connect/v3/',
    },
    {
      name: 'Motilal Oswal',
      steps: [
        'Have an active Motilal Oswal trading account',
        'Get your Client ID, Password, and TOTP Secret',
        'Request API Secret from Motilal Oswal support',
        'Go to Profile Settings in AalsiTrader',
        'Select Motilal Oswal and enter all credentials',
      ],
      docsUrl: 'https://www.motilaloswal.com/',
    },
    {
      name: 'AngelOne',
      steps: [
        'Create an account at angelone.in',
        'Register for SmartAPI at smartapi.angelone.in',
        'Create an app to get your API Key',
        'Note your Client ID and Trading PIN',
        'Enable TOTP and save the secret key',
        'Go to Profile Settings in AalsiTrader',
        'Select AngelOne and enter all credentials',
      ],
      docsUrl: 'https://smartapi.angelone.in/docs',
    },
    {
      name: 'Upstox',
      steps: [
        'Create an account at upstox.com',
        'Go to Developer Apps at account.upstox.com/developer/apps',
        'Create an app and get API Key and Secret',
        'Authorize the app to get an Access Token',
        'Go to Profile Settings in AalsiTrader',
        'Select Upstox and paste credentials',
        'Note: Access token expires daily — re-enter after market open',
      ],
      docsUrl: 'https://upstox.com/developer/api-documentation/',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold">Configure Your Broker</h2>
            <p className="text-sm text-gray-400 mt-1">
              Set up a broker to enable live trading with real money
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-card-hover rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {brokers.map((broker) => (
            <div key={broker.name} className="bg-card-hover rounded-xl p-5 border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold">{broker.name}</h3>
                <a
                  href={broker.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition-colors"
                >
                  Docs <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <ol className="space-y-2">
                {broker.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-border sticky bottom-0 bg-card rounded-b-2xl">
          <button
            onClick={onRetry}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/80 transition-colors text-sm font-medium"
          >
            <CheckCircle2 className="w-4 h-4" />
            I've configured my broker — retry
          </button>
        </div>
      </div>
    </div>
  );
}
