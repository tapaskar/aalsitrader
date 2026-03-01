import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ScanCommand, GetCommand, PutCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { docClient, TableNames } from './utils/db.js';
import {
  handlePaperModeRequest,
  handlePaperPortfolioRequest,
  handlePaperTradesRequest,
  handlePaperMetricsRequest,
  handleEquityCurveRequest,
  handleSigmaApprovalsRequest,
} from './momentum-trader/dashboard-api.js';
import { handleScreenerRequest, handleChartDataRequest } from './screener-api.js';
import {
  handleStraddleStatus,
  handleStraddleCapital,
  handleStraddleCurrent,
  handleStraddleTrades,
  handleStraddleStart,
  handleStraddleStop,
  handleStraddleMode,
  handleStraddleBroker,
  handleStraddleIndex,
  handleStraddleStrategy,
} from './nifty-straddle/straddle-api.js';
import {
  createUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  authenticateRequest,
  trackUserActivity,
  isUserAdmin,
  listAllUsers,
  updateUserRole,
  deleteUser,
  requestPasswordReset,
  resetPassword,
  getDhanCredentials,
  updateUserPlan,
  extendUserTrial,
  updateUserTradingControls,
  getSystemStats,
  adminCreateUser,
  getAdminUserAnalytics,
  getZerodhaCredentials,
  updateEmailOptOut,
} from './auth/auth.js';
import { verifyUnsubscribeToken } from './utils/email.js';
import crypto from 'crypto';

const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'ap-south-1' });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

export const handler = async (
  event: any
): Promise<APIGatewayProxyResult> => {
  // Support both API Gateway V1 and V2 event formats
  const httpMethod = event.httpMethod || event.requestContext?.http?.method;
  const rawPath = event.path || event.rawPath || event.requestContext?.http?.path || '';
  // Strip stage prefix (e.g., /prod/stats -> /stats)
  const path = rawPath.replace(/^\/prod/, '') || '/';
  const timestamp = Date.now();

  console.log(`HTTP ${httpMethod} ${path}`);

  // Track user activity for any authenticated request (fire-and-forget, throttled)
  const authHeaderForTracking = event.headers?.Authorization || event.headers?.authorization;
  if (authHeaderForTracking) {
    const authForTracking = authenticateRequest(authHeaderForTracking);
    if (authForTracking) trackUserActivity(authForTracking.email);
  }

  try {
    // GET /trades
    if (httpMethod === 'GET' && path === '/trades') {
      const result = await docClient.send(new ScanCommand({
        TableName: TableNames.trades,
        Limit: 100,
      }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ trades: result.Items || [] }),
      };
    }

    // POST /trades
    if (httpMethod === 'POST' && path === '/trades') {
      if (!event.body) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'No trade data provided' }),
        };
      }

      const trade = JSON.parse(event.body);
      const id = crypto.randomUUID();
      
      await docClient.send(new PutCommand({
        TableName: TableNames.trades,
        Item: {
          id,
          entryTime: timestamp,
          status: 'open',
          ...trade,
        },
      }));

      return {
        statusCode: 201,
        headers: corsHeaders,
        body: JSON.stringify({ id, message: 'Trade created' }),
      };
    }

    // PUT /trades/{id}
    if (httpMethod === 'PUT' && path.startsWith('/trades/')) {
      const id = path.split('/')[2];
      
      if (!event.body) {
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'No update data' }),
        };
      }

      const updates = JSON.parse(event.body);
      
      // Get existing trade
      const existing = await docClient.send(new GetCommand({
        TableName: TableNames.trades,
        Key: { id },
      }));

      if (!existing.Item) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Trade not found' }),
        };
      }

      // Merge updates
      await docClient.send(new PutCommand({
        TableName: TableNames.trades,
        Item: {
          ...existing.Item,
          ...updates,
          id,
        },
      }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Trade updated' }),
      };
    }

    // GET /agents
    if (httpMethod === 'GET' && path === '/agents') {
      const result = await docClient.send(new ScanCommand({
        TableName: TableNames.agentState,
      }));

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ agents: result.Items || [] }),
      };
    }

    // GET /activities
    if (httpMethod === 'GET' && path === '/activities') {
      const agentId = event.queryStringParameters?.agentId;
      
      let result;
      if (agentId) {
        result = await docClient.send(new QueryCommand({
          TableName: TableNames.activities,
          IndexName: 'AgentIdIndex',
          KeyConditionExpression: 'agentId = :agentId',
          ExpressionAttributeValues: { ':agentId': agentId },
          ScanIndexForward: false,
          Limit: 50,
        }));
      } else {
        result = await docClient.send(new ScanCommand({
          TableName: TableNames.activities,
          Limit: 50,
        }));
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ activities: result.Items || [] }),
      };
    }

    // GET /comms - Fetch inter-agent communications
    if (httpMethod === 'GET' && path === '/comms') {
      const result = await docClient.send(new ScanCommand({
        TableName: TableNames.communications,
        Limit: 50,
      }));
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ comms: result.Items || [] }),
      };
    }

    // GET /stats
    if (httpMethod === 'GET' && path === '/stats') {
      const tradesResult = await docClient.send(new ScanCommand({
        TableName: TableNames.trades,
      }));
      
      const agentsResult = await docClient.send(new ScanCommand({
        TableName: TableNames.agentState,
      }));

      const trades = tradesResult.Items || [];
      const agents = agentsResult.Items || [];
      
      const closedTrades = trades.filter((t) => t.status === 'closed' && t.pnl !== undefined);
      const wins = closedTrades.filter((t) => (t.pnl || 0) > 0);
      
      const stats = {
        totalTrades: trades.length,
        winRate: closedTrades.length > 0 ? Math.round((wins.length / closedTrades.length) * 100) : 0,
        totalPnl: closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0),
        activeAgents: agents.filter((a) => a.status === 'active').length,
        sleepingAgents: agents.filter((a) => a.status === 'sleeping').length,
      };

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ stats }),
      };
    }

    // GET /market-data - Live Nifty, Bank Nifty, Sensex
    if (httpMethod === 'GET' && path === '/market-data') {
      try {
        const indices = await fetchMarketData();
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Cache-Control': 'max-age=30' },
          body: JSON.stringify({ indices, fetchedAt: Date.now() }),
        };
      } catch (err) {
        console.error('Market data fetch error:', err);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            indices: {
              nifty: { value: 0, change: 0, changePercent: 0 },
              bankNifty: { value: 0, change: 0, changePercent: 0 },
              sensex: { value: 0, change: 0, changePercent: 0 },
            },
            error: 'Market data temporarily unavailable',
          }),
        };
      }
    }

    // GET /zerodha-login-url - Get Kite Connect login URL for token refresh (requires auth)
    if (httpMethod === 'GET' && path === '/zerodha-login-url') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);

      if (!auth) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Unauthorized - please login first' }),
        };
      }

      try {
        // Try token-manager Lambda first (checks Secrets Manager)
        const response = await lambdaClient.send(new InvokeCommand({
          FunctionName: 'zerodha-token-manager',
          Payload: Buffer.from(JSON.stringify({ action: 'get_login_url', userEmail: auth.email })),
        }));
        const result = JSON.parse(new TextDecoder().decode(response.Payload));
        const body = typeof result.body === 'string' ? JSON.parse(result.body) : result;
        const loginUrl = body.login_url || body.loginUrl;

        if (loginUrl) {
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ loginUrl }),
          };
        }

        // Fallback: build login URL from DynamoDB credentials
        const dbCreds = await getZerodhaCredentials(auth.email);
        console.log(`[zerodha-login-url] DynamoDB creds for ${auth.email}: apiKey=${dbCreds?.apiKey ? dbCreds.apiKey.substring(0, 4) + '...(len=' + dbCreds.apiKey.length + ')' : 'null'}, apiSecret=${dbCreds?.apiSecret ? dbCreds.apiSecret.substring(0, 4) + '...(len=' + dbCreds.apiSecret.length + ')' : 'null'}`);
        if (dbCreds?.apiKey) {
          const fallbackUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${dbCreds.apiKey}`;
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ loginUrl: fallbackUrl }),
          };
        }

        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'No Zerodha credentials found. Please add your API key in Settings.' }),
        };
      } catch (err) {
        // If token-manager fails entirely, try DynamoDB fallback
        console.error('Token manager failed, trying DynamoDB fallback:', err);
        try {
          const dbCreds = await getZerodhaCredentials(auth.email);
          if (dbCreds?.apiKey) {
            const fallbackUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${dbCreds.apiKey}`;
            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify({ loginUrl: fallbackUrl }),
            };
          }
        } catch (dbErr) {
          console.error('DynamoDB credential lookup also failed:', dbErr);
        }
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to get login URL' }),
        };
      }
    }

    // POST /zerodha-refresh - Refresh Zerodha access token with request_token (requires auth)
    if (httpMethod === 'POST' && path === '/zerodha-refresh') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);

      if (!auth) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Unauthorized - please login first' }),
        };
      }

      try {
        const reqBody = JSON.parse(event.body || '{}');
        const requestToken = reqBody.request_token;
        if (!requestToken) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'request_token is required' }),
          };
        }

        // Get credentials from DynamoDB and call setup (stores creds + generates token in one step)
        const dbCreds = await getZerodhaCredentials(auth.email);
        if (!dbCreds?.apiKey) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: 'No Zerodha credentials found. Please add your API key in Settings.' }),
          };
        }

        // setup action: stores credentials in Secrets Manager AND exchanges request_token for access_token
        const response = await lambdaClient.send(new InvokeCommand({
          FunctionName: 'zerodha-token-manager',
          Payload: Buffer.from(JSON.stringify({
            action: 'setup',
            userEmail: auth.email,
            api_key: dbCreds.apiKey,
            api_secret: dbCreds.apiSecret,
            request_token: requestToken,
          })),
        }));
        console.log(`Called setup for ${auth.email} with api_key=${dbCreds.apiKey.substring(0, 4)}...`);
        const result = JSON.parse(new TextDecoder().decode(response.Payload));
        const body = typeof result.body === 'string' ? JSON.parse(result.body) : result;

        if (body.error) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ success: false, error: body.error }),
          };
        }

        // Sync tokens to global path for paper trading/autonomous trader
        try {
          await lambdaClient.send(new InvokeCommand({
            FunctionName: 'zerodha-token-manager',
            Payload: Buffer.from(JSON.stringify({
              action: 'sync_to_global',
              userEmail: auth.email
            })),
          }));
          console.log('Synced user tokens to global path for paper trading');
        } catch (syncErr) {
          console.error('Failed to sync tokens to global:', syncErr);
          // Don't fail the request, just log
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ success: true, message: 'Token refreshed successfully' }),
        };
      } catch (err) {
        console.error('Zerodha token refresh failed:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Token refresh failed' }),
        };
      }
    }

    // GET /zerodha-status - Check Zerodha token status (requires auth)
    if (httpMethod === 'GET' && path === '/zerodha-status') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);

      if (!auth) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Unauthorized - please login first' }),
        };
      }

      try {
        const zerodhaStatus = await checkZerodhaStatus(auth.email);
        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Cache-Control': 'no-cache, no-store' },
          body: JSON.stringify(zerodhaStatus),
        };
      } catch (err) {
        console.error('Zerodha status check error:', err);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            connected: false,
            tokenExists: false,
            error: 'Failed to check Zerodha status',
          }),
        };
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Paper Trading Routes (auth required, per-user)
    // ──────────────────────────────────────────────────────────────────────────

    // GET /paper-mode - Get paper trading mode configuration
    if (httpMethod === 'GET' && path === '/paper-mode') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      const result = await handlePaperModeRequest('GET', undefined, auth.email);
      return {
        statusCode: result.statusCode,
        headers: corsHeaders,
        body: JSON.stringify(result.body),
      };
    }

    // POST /paper-mode - Update paper trading mode
    if (httpMethod === 'POST' && path === '/paper-mode') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      const body = event.body ? JSON.parse(event.body) : {};
      const result = await handlePaperModeRequest('POST', body, auth.email);
      return {
        statusCode: result.statusCode,
        headers: corsHeaders,
        body: JSON.stringify(result.body),
      };
    }

    // GET /paper-portfolio - Get paper trading portfolio
    if (httpMethod === 'GET' && path === '/paper-portfolio') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      const result = await handlePaperPortfolioRequest(event.queryStringParameters || undefined, auth.email);
      return {
        statusCode: result.statusCode,
        headers: corsHeaders,
        body: JSON.stringify(result.body),
      };
    }

    // GET /paper-trades - List paper trades
    if (httpMethod === 'GET' && path === '/paper-trades') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      const result = await handlePaperTradesRequest(event.queryStringParameters || undefined, auth.email);
      return {
        statusCode: result.statusCode,
        headers: corsHeaders,
        body: JSON.stringify(result.body),
      };
    }

    // GET /paper-metrics - Get performance metrics
    if (httpMethod === 'GET' && path === '/paper-metrics') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      const result = await handlePaperMetricsRequest(event.queryStringParameters || undefined, auth.email);
      return {
        statusCode: result.statusCode,
        headers: corsHeaders,
        body: JSON.stringify(result.body),
      };
    }

    // GET /paper-equity-curve - Get equity curve data
    if (httpMethod === 'GET' && path === '/paper-equity-curve') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      const result = await handleEquityCurveRequest(event.queryStringParameters, auth.email);
      return {
        statusCode: result.statusCode,
        headers: corsHeaders,
        body: JSON.stringify(result.body),
      };
    }

    // GET /sigma-approvals - Get pending Sigma approvals
    if (httpMethod === 'GET' && path === '/sigma-approvals') {
      const result = await handleSigmaApprovalsRequest('GET');
      return {
        statusCode: result.statusCode,
        headers: corsHeaders,
        body: JSON.stringify(result.body),
      };
    }

    // POST /sigma-approvals - Process approval
    if (httpMethod === 'POST' && path === '/sigma-approvals') {
      const body = event.body ? JSON.parse(event.body) : {};
      const result = await handleSigmaApprovalsRequest('POST', body);
      return {
        statusCode: result.statusCode,
        headers: corsHeaders,
        body: JSON.stringify(result.body),
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Authentication Routes
    // ──────────────────────────────────────────────────────────────────────────

    // POST /auth/register - Create new user
    if (httpMethod === 'POST' && path === '/auth/register') {
      try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { email, username, password } = body;

        if (!email || !username || !password) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Email, username, and password are required' }),
          };
        }

        if (password.length < 8) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Password must be at least 8 characters' }),
          };
        }

        const result = await createUser(email, username, password);

        if (!result.success) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: result.error }),
          };
        }

        return {
          statusCode: 201,
          headers: corsHeaders,
          body: JSON.stringify({ token: result.token, user: result.user }),
        };
      } catch (err) {
        console.error('Registration error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Registration failed' }),
        };
      }
    }

    // POST /auth/login - Login user
    if (httpMethod === 'POST' && path === '/auth/login') {
      try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { email, password } = body;

        if (!email || !password) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Email and password are required' }),
          };
        }

        const result = await loginUser(email, password);

        if (!result.success) {
          return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({ error: result.error }),
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ token: result.token, user: result.user }),
        };
      } catch (err) {
        console.error('Login error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Login failed' }),
        };
      }
    }

    // POST /auth/forgot-password - Request password reset
    if (httpMethod === 'POST' && path === '/auth/forgot-password') {
      try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { email } = body;

        if (!email) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Email is required' }),
          };
        }

        const result = await requestPasswordReset(email);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            message: 'If an account with that email exists, a reset code has been sent.',
          }),
        };
      } catch (err) {
        console.error('Password reset request error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to process password reset request' }),
        };
      }
    }

    // POST /auth/reset-password - Reset password with token
    if (httpMethod === 'POST' && path === '/auth/reset-password') {
      try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { email, resetToken, newPassword } = body;

        if (!email || !resetToken || !newPassword) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Email, reset code, and new password are required' }),
          };
        }

        if (newPassword.length < 8) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'New password must be at least 8 characters' }),
          };
        }

        const result = await resetPassword(email, resetToken, newPassword);

        if (!result.success) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: result.error }),
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Password has been reset successfully' }),
        };
      } catch (err) {
        console.error('Password reset error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to reset password' }),
        };
      }
    }

    // POST /auth/unsubscribe - Unsubscribe from emails via token
    if (httpMethod === 'POST' && path === '/auth/unsubscribe') {
      try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { token } = body;
        if (!token) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Token is required' }) };
        }
        const email = verifyUnsubscribeToken(token);
        if (!email) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid or expired token' }) };
        }
        await updateEmailOptOut(email, true);
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ message: 'Successfully unsubscribed', email }) };
      } catch (err) {
        console.error('Unsubscribe error:', err);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to unsubscribe' }) };
      }
    }

    // GET /unsubscribe - Unsubscribe page (email link click)
    if (httpMethod === 'GET' && path === '/unsubscribe') {
      const token = event.queryStringParameters?.token;
      if (!token) {
        return {
          statusCode: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html' },
          body: '<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Invalid Link</h2><p>This unsubscribe link is invalid or has expired.</p></body></html>',
        };
      }
      const email = verifyUnsubscribeToken(token);
      if (!email) {
        return {
          statusCode: 400, headers: { ...corsHeaders, 'Content-Type': 'text/html' },
          body: '<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>Invalid Link</h2><p>This unsubscribe link is invalid or has expired.</p></body></html>',
        };
      }
      await updateEmailOptOut(email, true);
      return {
        statusCode: 200, headers: { ...corsHeaders, 'Content-Type': 'text/html' },
        body: `<html><body style="font-family:sans-serif;text-align:center;padding:60px">
          <h2>Unsubscribed Successfully</h2>
          <p>You will no longer receive emails from AalsiTrader.</p>
          <p style="margin-top:24px"><a href="https://aalsitrader.com" style="color:#18181b">Back to AalsiTrader</a></p>
        </body></html>`,
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Lemon Squeezy Webhook — subscription lifecycle events
    // ──────────────────────────────────────────────────────────────────────────

    if (httpMethod === 'POST' && path === '/webhooks/lemonsqueezy') {
      const LS_SIGNING_SECRET = process.env.LEMONSQUEEZY_SIGNING_SECRET || '';

      // Verify webhook signature
      if (LS_SIGNING_SECRET && event.body) {
        const sig = event.headers?.['x-signature'] || event.headers?.['X-Signature'] || '';
        const hmac = crypto.createHmac('sha256', LS_SIGNING_SECRET).update(event.body).digest('hex');
        if (sig !== hmac) {
          console.warn('[LemonSqueezy] Invalid webhook signature');
          return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid signature' }) };
        }
      }

      try {
        const payload = event.body ? JSON.parse(event.body) : {};
        const eventName: string = payload.meta?.event_name || '';
        const customData = payload.meta?.custom_data || {};
        const attrs = payload.data?.attributes || {};

        // Extract user email from custom_data (passed via checkout) or from subscription
        const userEmail: string = (customData.email || attrs.user_email || '').toLowerCase();
        const variantName: string = (attrs.variant_name || attrs.product_name || '').toLowerCase();
        const status: string = attrs.status || '';

        console.log(`[LemonSqueezy] Event: ${eventName}, email: ${userEmail}, variant: ${variantName}, status: ${status}`);

        if (!userEmail) {
          console.warn('[LemonSqueezy] No user email in webhook payload');
          return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, warning: 'no email' }) };
        }

        // Map Lemon Squeezy product to our plan type
        const plan = variantName.includes('premium') ? 'premium' : 'pro';

        // Map Lemon Squeezy status to our plan status
        let planStatus: 'active' | 'cancelled' | 'expired' = 'active';
        if (status === 'cancelled' || status === 'expired' || eventName === 'subscription_cancelled') {
          planStatus = status === 'expired' ? 'expired' : 'cancelled';
        }

        if (eventName === 'subscription_created' || eventName === 'subscription_payment_success') {
          await updateUserPlan(userEmail, plan, 'active');
          console.log(`[LemonSqueezy] Activated ${plan} plan for ${userEmail}`);
        } else if (eventName === 'subscription_updated') {
          await updateUserPlan(userEmail, plan, planStatus);
          console.log(`[LemonSqueezy] Updated ${userEmail} to ${plan}/${planStatus}`);
        } else if (eventName === 'subscription_cancelled') {
          await updateUserPlan(userEmail, plan, 'cancelled');
          console.log(`[LemonSqueezy] Cancelled ${plan} plan for ${userEmail}`);
        } else if (eventName === 'subscription_expired') {
          await updateUserPlan(userEmail, plan, 'expired');
          console.log(`[LemonSqueezy] Expired ${plan} plan for ${userEmail}`);
        }

        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true }) };
      } catch (err) {
        console.error('[LemonSqueezy] Webhook error:', err);
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, error: 'processing failed' }) };
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Authenticated Routes
    // ──────────────────────────────────────────────────────────────────────────

    // GET /auth/profile - Get user profile (requires auth)
    if (httpMethod === 'GET' && path === '/auth/profile') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);

      if (!auth) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Unauthorized' }),
        };
      }

      try {
        const user = await getUserProfile(auth.email);

        if (!user) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'User not found' }),
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ user }),
        };
      } catch (err) {
        console.error('Get profile error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to get profile' }),
        };
      }
    }

    // PUT /auth/profile - Update user profile (requires auth)
    if (httpMethod === 'PUT' && path === '/auth/profile') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);

      if (!auth) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Unauthorized' }),
        };
      }

      try {
        const body = event.body ? JSON.parse(event.body) : {};
        const {
          username,
          brokerType,
          zerodhaApiKey,
          zerodhaApiSecret,
          motilalClientId,
          motilalPassword,
          motilalTotpSecret,
          motilalApiSecret,
          dhanAccessToken,
          dhanClientId,
          dhanPin,
          dhanTotpSecret,
          settings
        } = body;

        if (zerodhaApiKey || zerodhaApiSecret) {
          console.log(`[profile-update] ${auth.email} zerodha creds: apiKey=${zerodhaApiKey ? zerodhaApiKey.substring(0, 4) + '...(len=' + zerodhaApiKey.length + ')' : 'empty'}, apiSecret=${zerodhaApiSecret ? zerodhaApiSecret.substring(0, 4) + '...(len=' + zerodhaApiSecret.length + ')' : 'empty'}`);
        }

        const user = await updateUserProfile(auth.email, {
          username,
          brokerType,
          zerodhaApiKey,
          zerodhaApiSecret,
          motilalClientId,
          motilalPassword,
          motilalTotpSecret,
          motilalApiSecret,
          dhanAccessToken,
          dhanClientId,
          dhanPin,
          dhanTotpSecret,
          settings,
        });

        if (!user) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'User not found' }),
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ user, message: 'Profile updated' }),
        };
      } catch (err) {
        console.error('Update profile error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to update profile' }),
        };
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Admin Routes (requires admin role)
    // ──────────────────────────────────────────────────────────────────────────

    // GET /admin/users - List all users (admin only)
    if (httpMethod === 'GET' && path === '/admin/users') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);

      if (!auth) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Unauthorized' }),
        };
      }

      // Check if user is admin
      const isAdmin = await isUserAdmin(auth.email);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Admin access required' }),
        };
      }

      try {
        const users = await listAllUsers();
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ users }),
        };
      } catch (err) {
        console.error('List users error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to list users' }),
        };
      }
    }

    // PUT /admin/users/:email/role - Update user role (admin only)
    if (httpMethod === 'PUT' && path.startsWith('/admin/users/') && path.endsWith('/role')) {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);

      if (!auth) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Unauthorized' }),
        };
      }

      const isAdmin = await isUserAdmin(auth.email);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Admin access required' }),
        };
      }

      try {
        // Extract email from path: /admin/users/{email}/role
        const pathParts = path.split('/');
        const targetEmail = decodeURIComponent(pathParts[3]);
        const body = event.body ? JSON.parse(event.body) : {};
        const { role } = body;

        if (!role || !['user', 'admin'].includes(role)) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Valid role (user or admin) is required' }),
          };
        }

        const user = await updateUserRole(targetEmail, role);

        if (!user) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'User not found' }),
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ user, message: 'User role updated' }),
        };
      } catch (err) {
        console.error('Update role error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to update role' }),
        };
      }
    }

    // DELETE /admin/users/:email - Delete user (admin only)
    if (httpMethod === 'DELETE' && path.startsWith('/admin/users/')) {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);

      if (!auth) {
        return {
          statusCode: 401,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Unauthorized' }),
        };
      }

      const isAdmin = await isUserAdmin(auth.email);
      if (!isAdmin) {
        return {
          statusCode: 403,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Admin access required' }),
        };
      }

      try {
        // Extract email from path: /admin/users/{email}
        const pathParts = path.split('/');
        const targetEmail = decodeURIComponent(pathParts[3]);

        // Prevent self-deletion
        if (targetEmail === auth.email) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Cannot delete your own account' }),
          };
        }

        const success = await deleteUser(targetEmail);

        if (!success) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'User not found or deletion failed' }),
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'User deleted' }),
        };
      } catch (err) {
        console.error('Delete user error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to delete user' }),
        };
      }
    }

    // GET /admin/stats - System statistics (admin only)
    if (httpMethod === 'GET' && path === '/admin/stats') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);

      if (!auth) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const isAdmin = await isUserAdmin(auth.email);
      if (!isAdmin) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Admin access required' }) };
      }

      try {
        const stats = await getSystemStats();
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(stats) };
      } catch (err) {
        console.error('Get stats error:', err);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to get stats' }) };
      }
    }

    // PUT /admin/users/:email/plan - Update user plan (admin only)
    if (httpMethod === 'PUT' && path.startsWith('/admin/users/') && path.endsWith('/plan')) {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);

      if (!auth) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const isAdmin = await isUserAdmin(auth.email);
      if (!isAdmin) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Admin access required' }) };
      }

      try {
        const pathParts = path.split('/');
        const targetEmail = decodeURIComponent(pathParts[3]);
        const body = event.body ? JSON.parse(event.body) : {};

        if (!body.plan || !body.planStatus) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'plan and planStatus are required' }) };
        }

        const user = await updateUserPlan(targetEmail, body.plan, body.planStatus);
        if (!user) {
          return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'User not found' }) };
        }

        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ user, message: 'Plan updated' }) };
      } catch (err) {
        console.error('Update plan error:', err);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to update plan' }) };
      }
    }

    // PUT /admin/users/:email/trial - Extend user trial (admin only)
    if (httpMethod === 'PUT' && path.startsWith('/admin/users/') && path.endsWith('/trial')) {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);

      if (!auth) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const isAdmin = await isUserAdmin(auth.email);
      if (!isAdmin) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Admin access required' }) };
      }

      try {
        const pathParts = path.split('/');
        const targetEmail = decodeURIComponent(pathParts[3]);
        const body = event.body ? JSON.parse(event.body) : {};

        const days = body.days || 7;
        const user = await extendUserTrial(targetEmail, days);
        if (!user) {
          return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'User not found' }) };
        }

        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ user, message: `Trial extended by ${days} days` }) };
      } catch (err) {
        console.error('Extend trial error:', err);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to extend trial' }) };
      }
    }

    // PUT /admin/users/:email/trading - Update trading controls (admin only)
    if (httpMethod === 'PUT' && path.startsWith('/admin/users/') && path.endsWith('/trading')) {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);

      if (!auth) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const isAdmin = await isUserAdmin(auth.email);
      if (!isAdmin) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Admin access required' }) };
      }

      try {
        const pathParts = path.split('/');
        const targetEmail = decodeURIComponent(pathParts[3]);
        const body = event.body ? JSON.parse(event.body) : {};

        const user = await updateUserTradingControls(targetEmail, {
          liveTradingEnabled: body.liveTradingEnabled,
          accountEnabled: body.accountEnabled,
          capitalLimit: body.capitalLimit,
        });
        if (!user) {
          return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'User not found' }) };
        }

        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ user, message: 'Trading controls updated' }) };
      } catch (err) {
        console.error('Update trading controls error:', err);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to update trading controls' }) };
      }
    }

    // PUT /admin/users/:email/account - Toggle account enabled (admin only)
    if (httpMethod === 'PUT' && path.startsWith('/admin/users/') && path.endsWith('/account')) {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);

      if (!auth) {
        return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      }

      const isAdmin = await isUserAdmin(auth.email);
      if (!isAdmin) {
        return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Admin access required' }) };
      }

      try {
        const pathParts = path.split('/');
        const targetEmail = decodeURIComponent(pathParts[3]);
        const body = event.body ? JSON.parse(event.body) : {};

        const user = await updateUserTradingControls(targetEmail, {
          accountEnabled: body.accountEnabled,
        });
        if (!user) {
          return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'User not found' }) };
        }

        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ user, message: 'Account status updated' }) };
      } catch (err) {
        console.error('Toggle account error:', err);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to toggle account' }) };
      }
    }

    // POST /admin/users - Create new user (admin only)
    if (httpMethod === 'POST' && path === '/admin/users') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

      const isAdmin = await isUserAdmin(auth.email);
      if (!isAdmin) return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Admin access required' }) };

      try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { email, username, password, plan, planStatus } = body;

        if (!email || !username || !password) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'email, username, and password are required' }) };
        }
        if (password.length < 8) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Password must be at least 8 characters' }) };
        }

        const result = await adminCreateUser(email, username, password, plan, planStatus);
        if (!result.success) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: result.error }) };
        }

        return { statusCode: 201, headers: corsHeaders, body: JSON.stringify({ user: result.user, message: 'User created' }) };
      } catch (err) {
        console.error('Admin create user error:', err);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to create user' }) };
      }
    }

    // GET /admin/users/:email/analytics - Per-user analytics (admin only)
    if (httpMethod === 'GET' && path.startsWith('/admin/users/') && path.endsWith('/analytics')) {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

      const isAdmin = await isUserAdmin(auth.email);
      if (!isAdmin) return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'Admin access required' }) };

      try {
        const pathParts = path.split('/');
        const targetEmail = decodeURIComponent(pathParts[3]);
        const analytics = await getAdminUserAnalytics(targetEmail);
        if (!analytics) return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'User not found' }) };
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify(analytics) };
      } catch (err) {
        console.error('User analytics error:', err);
        return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to get user analytics' }) };
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Analysis API Routes (Integrating existing Lambda functions)
    // ──────────────────────────────────────────────────────────────────────────

    // POST /analysis/news - Get news analysis for a stock
    if (httpMethod === 'POST' && path === '/analysis/news') {
      try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { symbol, query } = body;

        if (!symbol && !query) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Symbol or query is required' }),
          };
        }

        // Use stock-news-rag-query for intelligent news analysis
        const response = await lambdaClient.send(new InvokeCommand({
          FunctionName: 'stock-news-rag-query',
          Payload: Buffer.from(JSON.stringify({
            query: query || `Latest news and sentiment for ${symbol} stock`,
            symbol: symbol?.toUpperCase(),
          })),
        }));

        const result = JSON.parse(new TextDecoder().decode(response.Payload));
        const resultBody = typeof result.body === 'string' ? JSON.parse(result.body) : result;

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            symbol: symbol?.toUpperCase(),
            analysis: resultBody,
            timestamp: Date.now(),
          }),
        };
      } catch (err) {
        console.error('News analysis error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'News analysis failed' }),
        };
      }
    }

    // POST /analysis/fundamental - Get fundamental analysis for a stock
    if (httpMethod === 'POST' && path === '/analysis/fundamental') {
      try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { symbol, symbols } = body;

        const stockList = symbols || (symbol ? [symbol.toUpperCase()] : null);

        if (!stockList || stockList.length === 0) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Symbol or symbols array is required' }),
          };
        }

        // Use stock-analysis-batch-processor for fundamental analysis
        const response = await lambdaClient.send(new InvokeCommand({
          FunctionName: 'stock-analysis-batch-processor',
          Payload: Buffer.from(JSON.stringify({
            symbols: stockList.map((s: string) => s.toUpperCase()),
            analysis_type: 'fundamental',
          })),
        }));

        const result = JSON.parse(new TextDecoder().decode(response.Payload));
        const resultBody = typeof result.body === 'string' ? JSON.parse(result.body) : result;

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            symbols: stockList,
            analysis: resultBody,
            timestamp: Date.now(),
          }),
        };
      } catch (err) {
        console.error('Fundamental analysis error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Fundamental analysis failed' }),
        };
      }
    }

    // POST /analysis/technical - Get technical analysis for a stock (uses Zerodha)
    if (httpMethod === 'POST' && path === '/analysis/technical') {
      try {
        const body = event.body ? JSON.parse(event.body) : {};
        const { symbol, days } = body;

        if (!symbol) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Symbol is required' }),
          };
        }

        // Use zerodha-technical-indicators Lambda
        const response = await lambdaClient.send(new InvokeCommand({
          FunctionName: 'zerodha-technical-indicators',
          Payload: Buffer.from(JSON.stringify({
            symbol: symbol.toUpperCase(),
            days: days || 365,
          })),
        }));

        const result = JSON.parse(new TextDecoder().decode(response.Payload));
        const resultBody = typeof result.body === 'string' ? JSON.parse(result.body) : result;

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            symbol: symbol.toUpperCase(),
            analysis: resultBody,
            timestamp: Date.now(),
          }),
        };
      } catch (err) {
        console.error('Technical analysis error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Technical analysis failed' }),
        };
      }
    }

    // GET /analysis/chart-data - Get chart data for a stock
    if (httpMethod === 'GET' && path === '/analysis/chart-data') {
      try {
        const symbol = event.queryStringParameters?.symbol;
        const days = parseInt(event.queryStringParameters?.days || '90', 10);

        if (!symbol) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Symbol query parameter is required' }),
          };
        }

        // Use zerodha-chart-data-api Lambda
        const response = await lambdaClient.send(new InvokeCommand({
          FunctionName: 'zerodha-chart-data-api',
          Payload: Buffer.from(JSON.stringify({
            symbol: symbol.toUpperCase(),
            days,
          })),
        }));

        const result = JSON.parse(new TextDecoder().decode(response.Payload));
        const resultBody = typeof result.body === 'string' ? JSON.parse(result.body) : result;

        return {
          statusCode: 200,
          headers: { ...corsHeaders, 'Cache-Control': 'max-age=60' },
          body: JSON.stringify(resultBody),
        };
      } catch (err) {
        console.error('Chart data error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to fetch chart data' }),
        };
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Prime Intelligence API Routes (Decision History & Rationale)
    // ──────────────────────────────────────────────────────────────────────────

    // GET /prime/decisions - Get Prime's recent decisions with rationale (user-scoped)
    if (httpMethod === 'GET' && path === '/prime/decisions') {
      try {
        const symbol = event.queryStringParameters?.symbol;
        const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
        // Get userId from auth context or use GLOBAL for backwards compatibility
        const userId = (event.requestContext as any)?.authorizer?.userId || 'GLOBAL';

        const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');

        let result;
        if (symbol) {
          // Get decisions for specific symbol (user-scoped)
          result = await docClient.send(new QueryCommand({
            TableName: 'sigma-memory-prod',
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': `USER#${userId}#DECISION#${symbol.toUpperCase()}` },
            ScanIndexForward: false,
            Limit: limit,
          }));
        } else {
          // Get today's decisions (user-scoped)
          const today = new Date().toISOString().split('T')[0];
          result = await docClient.send(new QueryCommand({
            TableName: 'sigma-memory-prod',
            IndexName: 'gsi1',
            KeyConditionExpression: 'gsi1pk = :pk',
            ExpressionAttributeValues: { ':pk': `USER#${userId}#DATE#${today}` },
            ScanIndexForward: false,
            Limit: limit,
          }));
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            decisions: result.Items || [],
            count: result.Items?.length || 0,
            timestamp: Date.now(),
          }),
        };
      } catch (err) {
        console.error('Prime decisions error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to fetch Prime decisions' }),
        };
      }
    }

    // GET /prime/thinking - Get Prime's thinking logs for a symbol (user-scoped)
    if (httpMethod === 'GET' && path === '/prime/thinking') {
      try {
        const symbol = event.queryStringParameters?.symbol;
        const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
        const userId = (event.requestContext as any)?.authorizer?.userId || 'GLOBAL';

        if (!symbol) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Symbol query parameter is required' }),
          };
        }

        const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');

        const result = await docClient.send(new QueryCommand({
          TableName: 'sigma-memory-prod',
          KeyConditionExpression: 'pk = :pk',
          ExpressionAttributeValues: { ':pk': `USER#${userId}#THINKING#${symbol.toUpperCase()}` },
          ScanIndexForward: false,
          Limit: limit,
        }));

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            symbol: symbol.toUpperCase(),
            logs: result.Items || [],
            count: result.Items?.length || 0,
            timestamp: Date.now(),
          }),
        };
      } catch (err) {
        console.error('Prime thinking logs error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to fetch thinking logs' }),
        };
      }
    }

    // GET /prime/consultations - Get agent consultations (user-scoped)
    if (httpMethod === 'GET' && path === '/prime/consultations') {
      try {
        const agentId = event.queryStringParameters?.agent;
        const symbol = event.queryStringParameters?.symbol;
        const limit = parseInt(event.queryStringParameters?.limit || '30', 10);
        const userId = (event.requestContext as any)?.authorizer?.userId || 'GLOBAL';

        const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');

        let result;
        if (symbol) {
          result = await docClient.send(new QueryCommand({
            TableName: 'sigma-memory-prod',
            KeyConditionExpression: 'pk = :pk',
            ExpressionAttributeValues: { ':pk': `USER#${userId}#CONSULTATION#${symbol.toUpperCase()}` },
            ScanIndexForward: false,
            Limit: limit,
          }));
        } else if (agentId) {
          result = await docClient.send(new QueryCommand({
            TableName: 'sigma-memory-prod',
            IndexName: 'gsi1',
            KeyConditionExpression: 'gsi1pk = :pk',
            ExpressionAttributeValues: { ':pk': `USER#${userId}#AGENT#${agentId}` },
            ScanIndexForward: false,
            Limit: limit,
          }));
        } else {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Either agent or symbol query parameter is required' }),
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            consultations: result.Items || [],
            count: result.Items?.length || 0,
            timestamp: Date.now(),
          }),
        };
      } catch (err) {
        console.error('Consultations error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to fetch consultations' }),
        };
      }
    }

    // GET /prime/summary - Get Prime's activity summary for humans (user-scoped)
    if (httpMethod === 'GET' && path === '/prime/summary') {
      try {
        const userId = (event.requestContext as any)?.authorizer?.userId || 'GLOBAL';
        const { generateHumanSummary } = await import('./prime-intelligence.js');
        const summary = await generateHumanSummary(userId);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            summary,
            timestamp: Date.now(),
          }),
        };
      } catch (err) {
        console.error('Prime summary error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to generate summary' }),
        };
      }
    }

    // POST /prime/preferences - Store user trading preferences
    if (httpMethod === 'POST' && path === '/prime/preferences') {
      try {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        const auth = authenticateRequest(authHeader);
        if (!auth) {
          return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Authentication required' }),
          };
        }
        const userId = auth.email;

        const body = event.body ? JSON.parse(event.body) : {};
        const { storeUserPreferences } = await import('./prime-intelligence.js');

        await storeUserPreferences({
          userId,
          tradingStyle: body.tradingStyle,
          preferredSectors: body.preferredSectors,
          riskTolerance: body.riskTolerance,
          preferredTimeframes: body.preferredTimeframes,
          customRules: body.customRules,
          lastUpdated: Date.now(),
        });

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ success: true, message: 'Preferences saved' }),
        };
      } catch (err) {
        console.error('Store preferences error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to save preferences' }),
        };
      }
    }

    // GET /prime/preferences - Get user trading preferences
    if (httpMethod === 'GET' && path === '/prime/preferences') {
      try {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        const auth = authenticateRequest(authHeader);
        if (!auth) {
          return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Authentication required' }),
          };
        }
        const userId = auth.email;

        const { getUserPreferences } = await import('./prime-intelligence.js');
        const preferences = await getUserPreferences(userId);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            preferences: preferences || {
              userId,
              tradingStyle: 'moderate',
              riskTolerance: 5,
              preferredSectors: [],
              preferredTimeframes: [],
              customRules: [],
            },
            timestamp: Date.now(),
          }),
        };
      } catch (err) {
        console.error('Get preferences error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to get preferences' }),
        };
      }
    }

    // POST /prime/chat - Two-way conversation with Prime
    if (httpMethod === 'POST' && path === '/prime/chat') {
      try {
        // Get userId from auth header
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        const auth = authenticateRequest(authHeader);
        const userId = auth?.email || 'GLOBAL';

        const body = event.body ? JSON.parse(event.body) : {};
        const { message, context } = body;

        if (!message) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Message is required' }),
          };
        }

        const { handleUserMessage } = await import('./prime-intelligence.js');
        const response = await handleUserMessage(message, userId, context);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            response,
            timestamp: Date.now(),
          }),
        };
      } catch (err) {
        console.error('Prime chat error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to process message' }),
        };
      }
    }

    // GET /prime/chat/history - Get chat history with Prime
    if (httpMethod === 'GET' && path === '/prime/chat/history') {
      try {
        // Get userId from auth header
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        const auth = authenticateRequest(authHeader);
        const userId = auth?.email || 'GLOBAL';
        const limit = parseInt(event.queryStringParameters?.limit || '50', 10);

        const { getChatHistory } = await import('./prime-intelligence.js');
        const messages = await getChatHistory(userId, limit);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            messages,
            count: messages.length,
            timestamp: Date.now(),
          }),
        };
      } catch (err) {
        console.error('Chat history error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to fetch chat history' }),
        };
      }
    }

    // GET /trading-rules - Get user's trading rules
    if (httpMethod === 'GET' && path === '/trading-rules') {
      try {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        const auth = authenticateRequest(authHeader);
        if (!auth) {
          return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        const { getTradingRules } = await import('./prime-intelligence.js');
        const rules = await getTradingRules(auth.email);

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ rules }),
        };
      } catch (err) {
        console.error('Get trading rules error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to fetch trading rules' }),
        };
      }
    }

    // PUT /trading-rules - Update user's trading rules
    if (httpMethod === 'PUT' && path === '/trading-rules') {
      try {
        const authHeader = event.headers?.Authorization || event.headers?.authorization;
        const auth = authenticateRequest(authHeader);
        if (!auth) {
          return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
        }

        const body = event.body ? JSON.parse(event.body) : {};
        const { updateTradingRules } = await import('./prime-intelligence.js');
        const updates: any = {};
        if (body.entryRules) updates.entryRules = body.entryRules;
        if (body.exitRules) updates.exitRules = body.exitRules;
        if (body.riskRules) updates.riskRules = body.riskRules;
        if (body.config) updates.config = body.config;

        const updatedRules = await updateTradingRules(auth.email, updates, 'user');

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ rules: updatedRules, message: 'Trading rules updated' }),
        };
      } catch (err) {
        console.error('Update trading rules error:', err);
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Failed to update trading rules' }),
        };
      }
    }

    // GET /screener - Smart Money Screener (top 100 F&O stocks)
    if (httpMethod === 'GET' && path === '/screener') {
      const forceRefresh = event.queryStringParameters?.force === '1';
      const result = await handleScreenerRequest(forceRefresh);
      return {
        statusCode: result.statusCode,
        headers: { ...corsHeaders, 'Cache-Control': 'max-age=60' },
        body: JSON.stringify(result.body),
      };
    }

    // GET /screener/chart - OHLC chart data for a single stock (Yahoo Finance)
    if (httpMethod === 'GET' && path === '/screener/chart') {
      const symbol = event.queryStringParameters?.symbol || '';
      const result = await handleChartDataRequest(symbol);
      return {
        statusCode: result.statusCode,
        headers: { ...corsHeaders, 'Cache-Control': 'max-age=120' },
        body: JSON.stringify(result.body),
      };
    }

    // ─── Broker Portfolio Route (auth required, per-user) ──────

    // GET /broker-portfolio - Fetch real broker positions & holdings
    if (httpMethod === 'GET' && path === '/broker-portfolio') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };

      try {
        const profile = await getUserProfile(auth.email);
        if (!profile) {
          return { statusCode: 404, headers: corsHeaders, body: JSON.stringify({ error: 'User not found' }) };
        }

        let broker = profile.brokerType;
        // Auto-detect broker from credentials if brokerType is not explicitly set
        if (!broker || broker === 'none') {
          if (profile.hasZerodhaCredentials) broker = 'zerodha';
          else if (profile.hasDhanCredentials) broker = 'dhan';
          else if (profile.hasMotilalCredentials) broker = 'motilal';
          else if (profile.hasAngelOneCredentials) broker = 'angelone';
          else if (profile.hasUpstoxCredentials) broker = 'upstox';
          else {
            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify({ needsBrokerSetup: true, positions: [], holdings: [], broker: null }),
            };
          }
        }

        if (broker === 'zerodha') {
          const [posRes, holdRes, marginRes] = await Promise.all([
            lambdaClient.send(new InvokeCommand({
              FunctionName: 'zerodha-trading-api',
              Payload: Buffer.from(JSON.stringify({ action: 'get_positions', userEmail: auth.email })),
            })),
            lambdaClient.send(new InvokeCommand({
              FunctionName: 'zerodha-trading-api',
              Payload: Buffer.from(JSON.stringify({ action: 'get_holdings', userEmail: auth.email })),
            })),
            lambdaClient.send(new InvokeCommand({
              FunctionName: 'zerodha-trading-api',
              Payload: Buffer.from(JSON.stringify({ action: 'get_margins', userEmail: auth.email })),
            })).catch(() => null),
          ]);

          const posResult = JSON.parse(new TextDecoder().decode(posRes.Payload));
          const posBody = typeof posResult.body === 'string' ? JSON.parse(posResult.body) : posResult;
          const holdResult = JSON.parse(new TextDecoder().decode(holdRes.Payload));
          const holdBody = typeof holdResult.body === 'string' ? JSON.parse(holdResult.body) : holdResult;

          if (posBody.error && holdBody.error) {
            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify({ needsBrokerSetup: true, error: 'Broker token expired. Please re-login.', positions: [], holdings: [], broker }),
            };
          }

          const positions = (posBody.positions?.net || []).filter((p: any) => p.quantity !== 0);
          const holdings = holdBody.holdings || holdBody.data || [];

          // Parse margin/funds data from Zerodha
          let funds: any = null;
          if (marginRes) {
            try {
              const marginResult = JSON.parse(new TextDecoder().decode(marginRes.Payload));
              const marginBody = typeof marginResult.body === 'string' ? JSON.parse(marginResult.body) : marginResult;
              const eq = marginBody?.margins?.equity || marginBody?.equity || marginBody;
              if (eq && !eq.error) {
                funds = {
                  availableBalance: eq.available?.live_balance ?? eq.available?.cash ?? eq.net ?? 0,
                  usedMargin: eq.utilised?.debits ?? eq.utilised?.total ?? 0,
                  totalBalance: (eq.available?.live_balance ?? eq.net ?? 0) + (eq.utilised?.debits ?? 0),
                  dayPnl: eq.available?.opening_balance != null ? (eq.net ?? 0) - eq.available.opening_balance : undefined,
                };
              }
            } catch { /* margin fetch is best-effort */ }
          }

          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ positions, holdings, funds, broker, needsBrokerSetup: false }),
          };
        }

        if (broker === 'dhan') {
          const dhanCreds = await getDhanCredentials(auth.email);
          if (!dhanCreds) {
            return {
              statusCode: 200,
              headers: corsHeaders,
              body: JSON.stringify({ needsBrokerSetup: true, positions: [], holdings: [], broker }),
            };
          }

          const headers = {
            'access-token': dhanCreds.accessToken,
            'client-id': dhanCreds.clientId,
            'Content-Type': 'application/json',
          };

          const [posRes, holdRes, fundsRes] = await Promise.all([
            fetch('https://api.dhan.co/v2/positions', { headers }).then(r => r.json()).catch(() => null),
            fetch('https://api.dhan.co/v2/holdings', { headers }).then(r => r.json()).catch(() => null),
            fetch('https://api.dhan.co/v2/fundlimit', { headers }).then(r => r.json()).catch(() => null),
          ]);

          const positions = (Array.isArray(posRes) ? posRes : posRes?.data || []).filter((p: any) => p.netQty !== 0);
          const holdings = Array.isArray(holdRes) ? holdRes : holdRes?.data || [];

          // Parse funds data from Dhan
          let funds: any = null;
          if (fundsRes && !fundsRes.error) {
            const f = fundsRes;
            funds = {
              availableBalance: f.availabelBalance ?? f.availableBalance ?? f.sodLimit ?? 0,
              usedMargin: f.utilizedAmount ?? f.blockedPayoutAmount ?? 0,
              totalBalance: (f.availabelBalance ?? f.availableBalance ?? 0) + (f.utilizedAmount ?? 0),
              dayPnl: f.receivedAmount ?? undefined,
            };
          }

          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ positions, holdings, funds, broker, needsBrokerSetup: false }),
          };
        }

        // Motilal or unknown broker - not yet supported for portfolio fetch
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ positions: [], holdings: [], broker, needsBrokerSetup: false, message: `Portfolio fetch not yet supported for ${broker}` }),
        };
      } catch (err) {
        console.error('Broker portfolio error:', err);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ needsBrokerSetup: false, error: `Broker API error: ${(err as Error).message || 'Failed to fetch portfolio'}`, positions: [], holdings: [], broker: null }),
        };
      }
    }

    // ─── Nifty Straddle Routes (auth required, per-user) ──────

    // GET /nifty-straddle/status
    if (httpMethod === 'GET' && path === '/nifty-straddle/status') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      const result = await handleStraddleStatus(auth.email);
      return { statusCode: result.statusCode, headers: corsHeaders, body: JSON.stringify(result.body) };
    }

    // GET /nifty-straddle/capital
    if (httpMethod === 'GET' && path === '/nifty-straddle/capital') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      const result = await handleStraddleCapital(auth.email);
      return { statusCode: result.statusCode, headers: corsHeaders, body: JSON.stringify(result.body) };
    }

    // GET /nifty-straddle/current
    if (httpMethod === 'GET' && path === '/nifty-straddle/current') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      const result = await handleStraddleCurrent(auth.email);
      return { statusCode: result.statusCode, headers: corsHeaders, body: JSON.stringify(result.body) };
    }

    // GET /nifty-straddle/trades
    if (httpMethod === 'GET' && path === '/nifty-straddle/trades') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      const result = await handleStraddleTrades(event.queryStringParameters || null, auth.email);
      return { statusCode: result.statusCode, headers: corsHeaders, body: JSON.stringify(result.body) };
    }

    // POST /nifty-straddle/start
    if (httpMethod === 'POST' && path === '/nifty-straddle/start') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      const body = event.body ? JSON.parse(event.body) : {};
      const result = await handleStraddleStart(body, auth.email);
      return { statusCode: result.statusCode, headers: corsHeaders, body: JSON.stringify(result.body) };
    }

    // POST /nifty-straddle/stop
    if (httpMethod === 'POST' && path === '/nifty-straddle/stop') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      const result = await handleStraddleStop(auth.email);
      return { statusCode: result.statusCode, headers: corsHeaders, body: JSON.stringify(result.body) };
    }

    // POST /nifty-straddle/mode
    if (httpMethod === 'POST' && path === '/nifty-straddle/mode') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      const body = event.body ? JSON.parse(event.body) : {};
      const result = await handleStraddleMode(body, auth.email);
      return { statusCode: result.statusCode, headers: corsHeaders, body: JSON.stringify(result.body) };
    }

    // POST /nifty-straddle/broker
    if (httpMethod === 'POST' && path === '/nifty-straddle/broker') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      const body = event.body ? JSON.parse(event.body) : {};
      const result = await handleStraddleBroker(body, auth.email);
      return { statusCode: result.statusCode, headers: corsHeaders, body: JSON.stringify(result.body) };
    }

    // POST /nifty-straddle/index
    if (httpMethod === 'POST' && path === '/nifty-straddle/index') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      const body = event.body ? JSON.parse(event.body) : {};
      const result = await handleStraddleIndex(body, auth.email);
      return { statusCode: result.statusCode, headers: corsHeaders, body: JSON.stringify(result.body) };
    }

    // POST /nifty-straddle/strategy
    if (httpMethod === 'POST' && path === '/nifty-straddle/strategy') {
      const authHeader = event.headers?.Authorization || event.headers?.authorization;
      const auth = authenticateRequest(authHeader);
      if (!auth) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'Unauthorized' }) };
      const body = event.body ? JSON.parse(event.body) : {};
      const result = await handleStraddleStrategy(body, auth.email);
      return { statusCode: result.statusCode, headers: corsHeaders, body: JSON.stringify(result.body) };
    }

    // OPTIONS (CORS preflight)
    if (httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: '',
      };
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Not found' }),
    };

  } catch (error) {
    console.error('HTTP API error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
};

// Check Zerodha token status by invoking token-manager Lambda cross-region
async function checkZerodhaStatus(userEmail: string) {
  try {
    // Invoke zerodha-token-manager with action: status and user email for credential lookup
    const statusResponse = await lambdaClient.send(new InvokeCommand({
      FunctionName: 'zerodha-token-manager',
      Payload: Buffer.from(JSON.stringify({ action: 'status', userEmail })),
    }));

    const statusResult = JSON.parse(new TextDecoder().decode(statusResponse.Payload));
    const statusBody = typeof statusResult.body === 'string' ? JSON.parse(statusResult.body) : statusResult;
    const tokenExists = statusBody.token_exists === true;

    if (!tokenExists) {
      return { connected: false, tokenExists: false, message: 'No access token found. Please login to Zerodha.' };
    }

    // Validate token by trying to get positions
    try {
      const posResponse = await lambdaClient.send(new InvokeCommand({
        FunctionName: 'zerodha-trading-api',
        Payload: Buffer.from(JSON.stringify({ action: 'get_positions', userEmail })),
      }));

      const posResult = JSON.parse(new TextDecoder().decode(posResponse.Payload));
      const posBody = typeof posResult.body === 'string' ? JSON.parse(posResult.body) : posResult;

      if (posBody.error) {
        return { connected: false, tokenExists: true, message: 'Token expired. Please re-login to Zerodha.', error: posBody.error };
      }

      const positions = posBody.positions?.net || posBody.positions?.day || [];
      return {
        connected: true,
        tokenExists: true,
        message: 'Zerodha connected',
        positions: positions.length,
        timestamp: statusBody.timestamp,
      };
    } catch {
      return { connected: false, tokenExists: true, message: 'Token validation failed' };
    }
  } catch (err) {
    console.error('Zerodha status check failed:', err);
    return { connected: false, tokenExists: false, message: 'Failed to reach Zerodha token manager' };
  }
}

// Fetch live market data from NSE India
async function fetchMarketData() {
  const symbols = [
    { key: 'nifty', symbol: '^NSEI' },
    { key: 'bankNifty', symbol: '^NSEBANK' },
    { key: 'sensex', symbol: '^BSESN' },
  ];

  const results: Record<string, { value: number; change: number; changePercent: number }> = {};

  await Promise.all(
    symbols.map(async ({ key, symbol }) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        const data = await res.json() as any;
        const meta = data?.chart?.result?.[0]?.meta;
        if (meta) {
          const price = meta.regularMarketPrice || 0;
          const prevClose = meta.chartPreviousClose || meta.previousClose || price;
          const change = price - prevClose;
          const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
          results[key] = {
            value: Math.round(price * 100) / 100,
            change: Math.round(change * 100) / 100,
            changePercent: Math.round(changePercent * 100) / 100,
          };
        } else {
          results[key] = { value: 0, change: 0, changePercent: 0 };
        }
      } catch {
        results[key] = { value: 0, change: 0, changePercent: 0 };
      }
    })
  );

  return results;
}
