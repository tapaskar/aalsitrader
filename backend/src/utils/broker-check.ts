import { getUserProfile } from '../auth/auth';

export interface BrokerCheckResult {
  hasBroker: boolean;
  configuredBrokers: string[];
  primaryBroker: string | null;
}

export async function checkBrokerConfigured(userId: string): Promise<BrokerCheckResult> {
  const profile = await getUserProfile(userId);
  if (!profile) {
    return { hasBroker: false, configuredBrokers: [], primaryBroker: null };
  }

  const configuredBrokers: string[] = [];
  if (profile.hasDhanCredentials) configuredBrokers.push('dhan');
  if (profile.hasZerodhaCredentials) configuredBrokers.push('zerodha');
  if (profile.hasMotilalCredentials) configuredBrokers.push('motilal');
  if (profile.hasAngelOneCredentials) configuredBrokers.push('angelone');
  if (profile.hasUpstoxCredentials) configuredBrokers.push('upstox');

  return {
    hasBroker: configuredBrokers.length > 0,
    configuredBrokers,
    primaryBroker: configuredBrokers.length > 0 ? configuredBrokers[0] : null,
  };
}

export interface BrokerGuide {
  name: string;
  steps: string[];
  docsUrl: string;
}

export function getBrokerSetupGuidance(): { brokers: BrokerGuide[] } {
  return {
    brokers: [
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
    ],
  };
}
