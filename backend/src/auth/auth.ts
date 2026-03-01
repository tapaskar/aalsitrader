import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { sendWelcomeEmail, sendAccountChangeEmail, sendPasswordResetEmail } from '../utils/email.js';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const STAGE = process.env.STAGE || 'prod';
const USERS_TABLE = process.env.USERS_TABLE || `users-${STAGE}`;
const JWT_SECRET = process.env.JWT_SECRET || 'trading-squad-jwt-secret-change-in-production';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'trading-squad-enc-key-32bytes!!'; // Must be 32 bytes for AES-256
const JWT_EXPIRY = '24h';
const BCRYPT_ROUNDS = 12;

// DynamoDB client
const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

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

export interface UserRecord extends User {
  pk: string;
  sk: string;
  passwordHash: string;
  // Zerodha credentials (Encrypted)
  zerodhaApiKey?: string;
  zerodhaApiSecret?: string;
  // Motilal Oswal credentials (Encrypted)
  motilalClientId?: string;
  motilalPassword?: string;
  motilalTotpSecret?: string;
  motilalApiSecret?: string;
  // DhanHQ credentials (Encrypted)
  dhanAccessToken?: string;
  dhanClientId?: string;
  dhanPin?: string;
  dhanTotpSecret?: string;
  // AngelOne credentials (Encrypted)
  angeloneApiKey?: string;
  angeloneClientId?: string;
  angelonePin?: string;
  angeloneTotpSecret?: string;
  // Upstox credentials (Encrypted)
  upstoxApiKey?: string;
  upstoxApiSecret?: string;
  upstoxAccessToken?: string;
  // Subscription fields (stored directly, not inherited from User since User already has them)
}

// Admin emails (first user to register with these emails becomes admin)
const ADMIN_EMAILS = ['tapas.eric@gmail.com', 'admin@tradingsquad.com'];

export interface JWTPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Password Hashing
// ─────────────────────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT Token Management
// ─────────────────────────────────────────────────────────────────────────────

export function generateToken(userId: string, email: string): string {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export function extractTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// ─────────────────────────────────────────────────────────────────────────────
// AES Encryption for Zerodha Secrets
// ─────────────────────────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encryptedData (all hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptSecret(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ─────────────────────────────────────────────────────────────────────────────
// User CRUD Operations
// ─────────────────────────────────────────────────────────────────────────────

function getUserPk(email: string): string {
  return `USER#${email.toLowerCase()}`;
}

export async function createUser(
  email: string,
  username: string,
  password: string
): Promise<AuthResult> {
  const emailLower = email.toLowerCase();
  const pk = getUserPk(emailLower);

  // Check if user exists
  const existingUser = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
  }));

  if (existingUser.Item) {
    return { success: false, error: 'User already exists' };
  }

  // Hash password
  const passwordHash = await hashPassword(password);
  const now = Date.now();

  // Determine role (admin for predefined emails)
  const isAdmin = ADMIN_EMAILS.includes(emailLower);

  // Auto-start 7-day trial
  const trialStart = new Date(now);
  const trialEnd = new Date(now + 7 * 24 * 60 * 60 * 1000);

  // Create user record
  const userRecord: UserRecord = {
    pk,
    sk: 'PROFILE',
    email: emailLower,
    username,
    role: isAdmin ? 'admin' : 'user',
    passwordHash,
    createdAt: now,
    updatedAt: now,
    lastLogin: now,
    brokerType: 'none',
    hasZerodhaCredentials: false,
    hasMotilalCredentials: false,
    hasDhanCredentials: false,
    hasAngelOneCredentials: false,
    hasUpstoxCredentials: false,
    plan: 'starter',
    planStatus: 'trial',
    trialStartedAt: trialStart.toISOString(),
    trialEndsAt: trialEnd.toISOString(),
    liveTradingEnabled: false,
    accountEnabled: true,
    emailOptOut: false,
    settings: {
      soundEnabled: true,
      darkMode: true,
      requireSigmaApproval: true,
    },
  };

  await docClient.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: userRecord,
  }));

  // Send welcome email (fire-and-forget)
  sendWelcomeEmail(emailLower, username).catch(err =>
    console.error('[Auth] Failed to send welcome email:', err)
  );

  // Generate token
  const token = generateToken(emailLower, emailLower);

  // Return user (without sensitive data)
  const user: User = {
    email: userRecord.email,
    username: userRecord.username,
    role: userRecord.role,
    createdAt: userRecord.createdAt,
    updatedAt: userRecord.updatedAt,
    lastLogin: userRecord.lastLogin,
    brokerType: userRecord.brokerType,
    hasZerodhaCredentials: userRecord.hasZerodhaCredentials,
    hasMotilalCredentials: userRecord.hasMotilalCredentials,
    hasDhanCredentials: userRecord.hasDhanCredentials,
    hasAngelOneCredentials: userRecord.hasAngelOneCredentials,
    hasUpstoxCredentials: userRecord.hasUpstoxCredentials,
    plan: userRecord.plan,
    planStatus: userRecord.planStatus,
    trialStartedAt: userRecord.trialStartedAt,
    trialEndsAt: userRecord.trialEndsAt,
    liveTradingEnabled: userRecord.liveTradingEnabled,
    accountEnabled: userRecord.accountEnabled,
    emailOptOut: userRecord.emailOptOut,
    settings: userRecord.settings,
  };

  return { success: true, token, user };
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  const emailLower = email.toLowerCase();
  const pk = getUserPk(emailLower);

  // Get user
  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
  }));

  if (!result.Item) {
    return { success: false, error: 'Invalid email or password' };
  }

  const userRecord = result.Item as UserRecord;

  // Verify password
  const validPassword = await verifyPassword(password, userRecord.passwordHash);
  if (!validPassword) {
    return { success: false, error: 'Invalid email or password' };
  }

  // Check if account is disabled
  if (userRecord.accountEnabled === false) {
    return { success: false, error: 'Your account has been disabled. Contact support@aalsitrader.com' };
  }

  // Update last login
  const now = Date.now();
  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
    UpdateExpression: 'SET lastLogin = :lastLogin',
    ExpressionAttributeValues: { ':lastLogin': now },
  }));

  // Generate token
  const token = generateToken(emailLower, emailLower);

  // Return user (without sensitive data)
  const user: User = {
    email: userRecord.email,
    username: userRecord.username,
    role: userRecord.role || 'user',
    createdAt: userRecord.createdAt,
    updatedAt: userRecord.updatedAt,
    lastLogin: now,
    brokerType: userRecord.brokerType || 'none',
    hasZerodhaCredentials: !!(userRecord.zerodhaApiKey && userRecord.zerodhaApiSecret),
    hasMotilalCredentials: !!(userRecord.motilalClientId && userRecord.motilalPassword && userRecord.motilalTotpSecret && userRecord.motilalApiSecret),
    hasDhanCredentials: !!(userRecord.dhanAccessToken && userRecord.dhanClientId),
    hasAngelOneCredentials: !!(userRecord.angeloneApiKey && userRecord.angeloneClientId && userRecord.angelonePin && userRecord.angeloneTotpSecret),
    hasUpstoxCredentials: !!(userRecord.upstoxApiKey && userRecord.upstoxApiSecret && userRecord.upstoxAccessToken),
    plan: userRecord.plan,
    planStatus: userRecord.planStatus,
    trialStartedAt: userRecord.trialStartedAt,
    trialEndsAt: userRecord.trialEndsAt,
    liveTradingEnabled: userRecord.liveTradingEnabled,
    accountEnabled: userRecord.accountEnabled,
    capitalLimit: userRecord.capitalLimit,
    lastActive: userRecord.lastActive,
    settings: userRecord.settings,
  };

  return { success: true, token, user };
}

export async function getUserProfile(email: string): Promise<User | null> {
  const pk = getUserPk(email);

  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
  }));

  if (!result.Item) {
    return null;
  }

  const userRecord = result.Item as UserRecord;

  return {
    email: userRecord.email,
    username: userRecord.username,
    role: userRecord.role || 'user',
    createdAt: userRecord.createdAt,
    updatedAt: userRecord.updatedAt,
    lastLogin: userRecord.lastLogin,
    brokerType: userRecord.brokerType || 'none',
    hasZerodhaCredentials: !!(userRecord.zerodhaApiKey && userRecord.zerodhaApiSecret),
    hasMotilalCredentials: !!(userRecord.motilalClientId && userRecord.motilalPassword && userRecord.motilalTotpSecret && userRecord.motilalApiSecret),
    hasDhanCredentials: !!(userRecord.dhanAccessToken && userRecord.dhanClientId),
    hasAngelOneCredentials: !!(userRecord.angeloneApiKey && userRecord.angeloneClientId && userRecord.angelonePin && userRecord.angeloneTotpSecret),
    hasUpstoxCredentials: !!(userRecord.upstoxApiKey && userRecord.upstoxApiSecret && userRecord.upstoxAccessToken),
    plan: userRecord.plan,
    planStatus: userRecord.planStatus,
    trialStartedAt: userRecord.trialStartedAt,
    trialEndsAt: userRecord.trialEndsAt,
    liveTradingEnabled: userRecord.liveTradingEnabled,
    accountEnabled: userRecord.accountEnabled,
    capitalLimit: userRecord.capitalLimit,
    lastActive: userRecord.lastActive,
    emailOptOut: userRecord.emailOptOut,
    settings: userRecord.settings,
  };
}

export async function updateUserProfile(
  email: string,
  updates: {
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
  }
): Promise<User | null> {
  const pk = getUserPk(email);
  const now = Date.now();

  // Build update expression
  const updateParts: string[] = ['updatedAt = :updatedAt'];
  const expressionValues: Record<string, any> = { ':updatedAt': now };

  if (updates.username) {
    updateParts.push('username = :username');
    expressionValues[':username'] = updates.username;
  }

  if (updates.brokerType !== undefined) {
    updateParts.push('brokerType = :brokerType');
    expressionValues[':brokerType'] = updates.brokerType;
  }

  if (updates.zerodhaApiKey !== undefined) {
    if (updates.zerodhaApiKey) {
      updateParts.push('zerodhaApiKey = :zerodhaApiKey');
      expressionValues[':zerodhaApiKey'] = encryptSecret(updates.zerodhaApiKey);
    } else {
      updateParts.push('zerodhaApiKey = :zerodhaApiKey');
      expressionValues[':zerodhaApiKey'] = null;
    }
  }

  if (updates.zerodhaApiSecret !== undefined) {
    if (updates.zerodhaApiSecret) {
      updateParts.push('zerodhaApiSecret = :zerodhaApiSecret');
      expressionValues[':zerodhaApiSecret'] = encryptSecret(updates.zerodhaApiSecret);
    } else {
      updateParts.push('zerodhaApiSecret = :zerodhaApiSecret');
      expressionValues[':zerodhaApiSecret'] = null;
    }
  }

  // Update hasZerodhaCredentials flag
  if (updates.zerodhaApiKey !== undefined || updates.zerodhaApiSecret !== undefined) {
    updateParts.push('hasZerodhaCredentials = :hasZerodha');
    expressionValues[':hasZerodha'] = !!(updates.zerodhaApiKey && updates.zerodhaApiSecret);
  }

  // Motilal Oswal credentials
  if (updates.motilalClientId !== undefined) {
    if (updates.motilalClientId) {
      updateParts.push('motilalClientId = :motilalClientId');
      expressionValues[':motilalClientId'] = encryptSecret(updates.motilalClientId);
    } else {
      updateParts.push('motilalClientId = :motilalClientId');
      expressionValues[':motilalClientId'] = null;
    }
  }

  if (updates.motilalPassword !== undefined) {
    if (updates.motilalPassword) {
      updateParts.push('motilalPassword = :motilalPassword');
      expressionValues[':motilalPassword'] = encryptSecret(updates.motilalPassword);
    } else {
      updateParts.push('motilalPassword = :motilalPassword');
      expressionValues[':motilalPassword'] = null;
    }
  }

  if (updates.motilalTotpSecret !== undefined) {
    if (updates.motilalTotpSecret) {
      updateParts.push('motilalTotpSecret = :motilalTotpSecret');
      expressionValues[':motilalTotpSecret'] = encryptSecret(updates.motilalTotpSecret);
    } else {
      updateParts.push('motilalTotpSecret = :motilalTotpSecret');
      expressionValues[':motilalTotpSecret'] = null;
    }
  }

  if (updates.motilalApiSecret !== undefined) {
    if (updates.motilalApiSecret) {
      updateParts.push('motilalApiSecret = :motilalApiSecret');
      expressionValues[':motilalApiSecret'] = encryptSecret(updates.motilalApiSecret);
    } else {
      updateParts.push('motilalApiSecret = :motilalApiSecret');
      expressionValues[':motilalApiSecret'] = null;
    }
  }

  // Update hasMotilalCredentials flag
  if (updates.motilalClientId !== undefined || updates.motilalPassword !== undefined ||
      updates.motilalTotpSecret !== undefined || updates.motilalApiSecret !== undefined) {
    updateParts.push('hasMotilalCredentials = :hasMotilal');
    expressionValues[':hasMotilal'] = !!(updates.motilalClientId && updates.motilalPassword &&
                                          updates.motilalTotpSecret && updates.motilalApiSecret);
  }

  // DhanHQ credentials
  if (updates.dhanAccessToken !== undefined) {
    if (updates.dhanAccessToken) {
      updateParts.push('dhanAccessToken = :dhanAccessToken');
      expressionValues[':dhanAccessToken'] = encryptSecret(updates.dhanAccessToken);
    } else {
      updateParts.push('dhanAccessToken = :dhanAccessToken');
      expressionValues[':dhanAccessToken'] = null;
    }
  }

  if (updates.dhanClientId !== undefined) {
    if (updates.dhanClientId) {
      updateParts.push('dhanClientId = :dhanClientId');
      expressionValues[':dhanClientId'] = encryptSecret(updates.dhanClientId);
    } else {
      updateParts.push('dhanClientId = :dhanClientId');
      expressionValues[':dhanClientId'] = null;
    }
  }

  if (updates.dhanPin !== undefined) {
    if (updates.dhanPin) {
      updateParts.push('dhanPin = :dhanPin');
      expressionValues[':dhanPin'] = encryptSecret(updates.dhanPin);
    } else {
      updateParts.push('dhanPin = :dhanPin');
      expressionValues[':dhanPin'] = null;
    }
  }

  if (updates.dhanTotpSecret !== undefined) {
    if (updates.dhanTotpSecret) {
      updateParts.push('dhanTotpSecret = :dhanTotpSecret');
      expressionValues[':dhanTotpSecret'] = encryptSecret(updates.dhanTotpSecret);
    } else {
      updateParts.push('dhanTotpSecret = :dhanTotpSecret');
      expressionValues[':dhanTotpSecret'] = null;
    }
  }

  // Update hasDhanCredentials flag
  if (updates.dhanAccessToken !== undefined || updates.dhanClientId !== undefined) {
    updateParts.push('hasDhanCredentials = :hasDhan');
    expressionValues[':hasDhan'] = !!(updates.dhanAccessToken && updates.dhanClientId);
  }

  // AngelOne credentials
  for (const field of ['angeloneApiKey', 'angeloneClientId', 'angelonePin', 'angeloneTotpSecret'] as const) {
    if (updates[field] !== undefined) {
      updateParts.push(`${field} = :${field}`);
      expressionValues[`:${field}`] = updates[field] ? encryptSecret(updates[field]) : null;
    }
  }

  if (updates.angeloneApiKey !== undefined || updates.angeloneClientId !== undefined ||
      updates.angelonePin !== undefined || updates.angeloneTotpSecret !== undefined) {
    updateParts.push('hasAngelOneCredentials = :hasAngelOne');
    expressionValues[':hasAngelOne'] = !!(updates.angeloneApiKey && updates.angeloneClientId &&
                                           updates.angelonePin && updates.angeloneTotpSecret);
  }

  // Upstox credentials
  for (const field of ['upstoxApiKey', 'upstoxApiSecret', 'upstoxAccessToken'] as const) {
    if (updates[field] !== undefined) {
      updateParts.push(`${field} = :${field}`);
      expressionValues[`:${field}`] = updates[field] ? encryptSecret(updates[field]) : null;
    }
  }

  if (updates.upstoxApiKey !== undefined || updates.upstoxApiSecret !== undefined ||
      updates.upstoxAccessToken !== undefined) {
    updateParts.push('hasUpstoxCredentials = :hasUpstox');
    expressionValues[':hasUpstox'] = !!(updates.upstoxApiKey && updates.upstoxApiSecret && updates.upstoxAccessToken);
  }

  if (updates.emailOptOut !== undefined) {
    updateParts.push('emailOptOut = :emailOptOut');
    expressionValues[':emailOptOut'] = updates.emailOptOut;
  }

  if (updates.settings) {
    // Get current user to merge settings
    const currentUser = await docClient.send(new GetCommand({
      TableName: USERS_TABLE,
      Key: { pk, sk: 'PROFILE' },
    }));

    if (currentUser.Item) {
      const currentSettings = (currentUser.Item as UserRecord).settings || {};
      const newSettings = { ...currentSettings, ...updates.settings };
      updateParts.push('settings = :settings');
      expressionValues[':settings'] = newSettings;
    }
  }

  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
    UpdateExpression: 'SET ' + updateParts.join(', '),
    ExpressionAttributeValues: expressionValues,
  }));

  // Send account change email (fire-and-forget, skip if opted out)
  const updatedUser = await getUserProfile(email);
  if (updatedUser && !updatedUser.emailOptOut) {
    const changes: string[] = [];
    if (updates.username) changes.push('Username updated');
    if (updates.brokerType !== undefined) changes.push(`Broker changed to ${updates.brokerType}`);
    if (updates.zerodhaApiKey !== undefined || updates.zerodhaApiSecret !== undefined) changes.push('Zerodha credentials updated');
    if (updates.motilalClientId !== undefined || updates.motilalPassword !== undefined) changes.push('Motilal Oswal credentials updated');
    if (updates.dhanAccessToken !== undefined || updates.dhanClientId !== undefined) changes.push('Dhan credentials updated');
    if (updates.angeloneApiKey !== undefined || updates.angeloneClientId !== undefined) changes.push('AngelOne credentials updated');
    if (updates.upstoxApiKey !== undefined || updates.upstoxApiSecret !== undefined) changes.push('Upstox credentials updated');
    if (updates.settings) changes.push('Settings updated');

    if (changes.length > 0) {
      sendAccountChangeEmail(email, updatedUser.username, changes.join('<br>')).catch(err =>
        console.error('[Auth] Failed to send account change email:', err)
      );
    }
  }

  return updatedUser;
}

export async function updateEmailOptOut(email: string, optOut: boolean): Promise<boolean> {
  const pk = getUserPk(email);
  try {
    await docClient.send(new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { pk, sk: 'PROFILE' },
      UpdateExpression: 'SET emailOptOut = :optOut, updatedAt = :now',
      ExpressionAttributeValues: { ':optOut': optOut, ':now': Date.now() },
      ConditionExpression: 'attribute_exists(pk)',
    }));
    return true;
  } catch {
    return false;
  }
}

export async function getZerodhaCredentials(email: string): Promise<{ apiKey: string; apiSecret: string } | null> {
  const pk = getUserPk(email);

  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
  }));

  if (!result.Item) {
    return null;
  }

  const userRecord = result.Item as UserRecord;

  if (!userRecord.zerodhaApiKey || !userRecord.zerodhaApiSecret) {
    return null;
  }

  try {
    return {
      apiKey: decryptSecret(userRecord.zerodhaApiKey),
      apiSecret: decryptSecret(userRecord.zerodhaApiSecret),
    };
  } catch (error) {
    console.error('Failed to decrypt Zerodha credentials:', error);
    return null;
  }
}

export async function getMotilalCredentials(email: string): Promise<{
  clientId: string;
  password: string;
  totpSecret: string;
  apiSecret: string;
} | null> {
  const pk = getUserPk(email);

  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
  }));

  if (!result.Item) {
    return null;
  }

  const userRecord = result.Item as UserRecord;

  if (!userRecord.motilalClientId || !userRecord.motilalPassword ||
      !userRecord.motilalTotpSecret || !userRecord.motilalApiSecret) {
    return null;
  }

  try {
    return {
      clientId: decryptSecret(userRecord.motilalClientId),
      password: decryptSecret(userRecord.motilalPassword),
      totpSecret: decryptSecret(userRecord.motilalTotpSecret),
      apiSecret: decryptSecret(userRecord.motilalApiSecret),
    };
  } catch (error) {
    console.error('Failed to decrypt Motilal credentials:', error);
    return null;
  }
}

export async function getDhanCredentials(email: string): Promise<{ accessToken: string; clientId: string } | null> {
  const pk = getUserPk(email);

  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
  }));

  if (!result.Item) {
    return null;
  }

  const userRecord = result.Item as UserRecord;

  if (!userRecord.dhanAccessToken || !userRecord.dhanClientId) {
    return null;
  }

  try {
    return {
      accessToken: decryptSecret(userRecord.dhanAccessToken),
      clientId: decryptSecret(userRecord.dhanClientId),
    };
  } catch (error) {
    console.error('Failed to decrypt Dhan credentials:', error);
    return null;
  }
}

export async function getDhanTotpCredentials(email: string): Promise<{ clientId: string; pin: string; totpSecret: string } | null> {
  const pk = getUserPk(email);

  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
  }));

  if (!result.Item) {
    return null;
  }

  const userRecord = result.Item as UserRecord;

  if (!userRecord.dhanClientId || !userRecord.dhanPin || !userRecord.dhanTotpSecret) {
    return null;
  }

  try {
    return {
      clientId: decryptSecret(userRecord.dhanClientId),
      pin: decryptSecret(userRecord.dhanPin),
      totpSecret: decryptSecret(userRecord.dhanTotpSecret),
    };
  } catch (error) {
    console.error('Failed to decrypt Dhan TOTP credentials:', error);
    return null;
  }
}

export async function getAngelOneCredentials(email: string): Promise<{
  apiKey: string; clientId: string; pin: string; totpSecret: string;
} | null> {
  const pk = getUserPk(email);
  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
  }));
  if (!result.Item) return null;
  const r = result.Item as UserRecord;
  if (!r.angeloneApiKey || !r.angeloneClientId || !r.angelonePin || !r.angeloneTotpSecret) return null;
  try {
    return {
      apiKey: decryptSecret(r.angeloneApiKey),
      clientId: decryptSecret(r.angeloneClientId),
      pin: decryptSecret(r.angelonePin),
      totpSecret: decryptSecret(r.angeloneTotpSecret),
    };
  } catch (error) {
    console.error('Failed to decrypt AngelOne credentials:', error);
    return null;
  }
}

export async function getUpstoxCredentials(email: string): Promise<{
  apiKey: string; apiSecret: string; accessToken: string;
} | null> {
  const pk = getUserPk(email);
  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
  }));
  if (!result.Item) return null;
  const r = result.Item as UserRecord;
  if (!r.upstoxApiKey || !r.upstoxApiSecret || !r.upstoxAccessToken) return null;
  try {
    return {
      apiKey: decryptSecret(r.upstoxApiKey),
      apiSecret: decryptSecret(r.upstoxApiSecret),
      accessToken: decryptSecret(r.upstoxAccessToken),
    };
  } catch (error) {
    console.error('Failed to decrypt Upstox credentials:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth Middleware Helper
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthenticatedRequest {
  userId: string;
  email: string;
}

export function authenticateRequest(authHeader: string | undefined): AuthenticatedRequest | null {
  const token = extractTokenFromHeader(authHeader);
  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  return {
    userId: payload.userId,
    email: payload.email,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// User Activity Tracking (for SaaS resource optimization)
// ─────────────────────────────────────────────────────────────────────────────

// In-memory throttle: only update DynamoDB once per 5 minutes per user
const activityThrottle = new Map<string, number>();
const ACTIVITY_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Track user activity timestamp. Called on authenticated API requests.
 * Throttled to once per 5 min per user to minimize DynamoDB writes.
 * Background/fire-and-forget — never blocks the request.
 */
export function trackUserActivity(email: string): void {
  const now = Date.now();
  const lastTracked = activityThrottle.get(email) || 0;

  if (now - lastTracked < ACTIVITY_THROTTLE_MS) return;

  activityThrottle.set(email, now);

  // Fire-and-forget update
  docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { pk: getUserPk(email), sk: 'PROFILE' },
    UpdateExpression: 'SET lastActive = :now',
    ExpressionAttributeValues: { ':now': now },
  })).catch(err => console.error('Failed to track user activity:', err.message));
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Functions
// ─────────────────────────────────────────────────────────────────────────────

export async function isUserAdmin(email: string): Promise<boolean> {
  const user = await getUserProfile(email);
  return user?.role === 'admin';
}

export async function listAllUsers(): Promise<User[]> {
  const result = await docClient.send(new ScanCommand({
    TableName: USERS_TABLE,
    FilterExpression: 'sk = :sk',
    ExpressionAttributeValues: { ':sk': 'PROFILE' },
  }));

  if (!result.Items) {
    return [];
  }

  return result.Items.filter((item) => item.email && item.username).map((item) => {
    const userRecord = item as UserRecord;
    return {
      email: userRecord.email,
      username: userRecord.username,
      role: userRecord.role || 'user',
      createdAt: userRecord.createdAt,
      updatedAt: userRecord.updatedAt,
      lastLogin: userRecord.lastLogin,
      brokerType: userRecord.brokerType || 'none',
      hasZerodhaCredentials: !!(userRecord.zerodhaApiKey && userRecord.zerodhaApiSecret),
      hasMotilalCredentials: !!(userRecord.motilalClientId && userRecord.motilalPassword &&
                                userRecord.motilalTotpSecret && userRecord.motilalApiSecret),
      hasDhanCredentials: !!(userRecord.dhanAccessToken && userRecord.dhanClientId),
      hasAngelOneCredentials: !!(userRecord.angeloneApiKey && userRecord.angeloneClientId &&
                                  userRecord.angelonePin && userRecord.angeloneTotpSecret),
      hasUpstoxCredentials: !!(userRecord.upstoxApiKey && userRecord.upstoxApiSecret && userRecord.upstoxAccessToken),
      plan: userRecord.plan,
      planStatus: userRecord.planStatus,
      trialStartedAt: userRecord.trialStartedAt,
      trialEndsAt: userRecord.trialEndsAt,
      liveTradingEnabled: userRecord.liveTradingEnabled,
      accountEnabled: userRecord.accountEnabled,
      capitalLimit: userRecord.capitalLimit,
      lastActive: userRecord.lastActive,
      settings: userRecord.settings,
    };
  });
}

export async function updateUserRole(email: string, role: 'user' | 'admin'): Promise<User | null> {
  const pk = getUserPk(email);
  const now = Date.now();

  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
    UpdateExpression: 'SET #role = :role, updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#role': 'role' },
    ExpressionAttributeValues: { ':role': role, ':updatedAt': now },
  }));

  return getUserProfile(email);
}

export async function deleteUser(email: string): Promise<boolean> {
  const pk = getUserPk(email);

  try {
    await docClient.send(new DeleteCommand({
      TableName: USERS_TABLE,
      Key: { pk, sk: 'PROFILE' },
    }));
    return true;
  } catch (error) {
    console.error('Failed to delete user:', error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Password Reset
// ─────────────────────────────────────────────────────────────────────────────

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

export async function requestPasswordReset(email: string): Promise<{ success: boolean; resetToken?: string; error?: string }> {
  const emailLower = email.toLowerCase();
  const pk = getUserPk(emailLower);

  // Check if user exists
  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
  }));

  if (!result.Item) {
    // Don't reveal whether email exists
    return { success: true };
  }

  // Generate a 6-digit reset code
  const resetToken = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + RESET_TOKEN_EXPIRY_MS;

  // Store reset token in DynamoDB
  await docClient.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: {
      pk: `RESET#${emailLower}`,
      sk: 'TOKEN',
      resetToken,
      email: emailLower,
      expiresAt,
      createdAt: Date.now(),
    },
  }));

  // Send reset code via email
  await sendPasswordResetEmail(emailLower, resetToken);
  console.log(`Password reset email sent to ${emailLower}`);

  return { success: true };
}

export async function resetPassword(
  email: string,
  resetToken: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const emailLower = email.toLowerCase();

  // Look up the reset token
  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk: `RESET#${emailLower}`, sk: 'TOKEN' },
  }));

  if (!result.Item) {
    return { success: false, error: 'Invalid or expired reset code' };
  }

  const stored = result.Item;

  // Check token match
  if (stored.resetToken !== resetToken) {
    return { success: false, error: 'Invalid or expired reset code' };
  }

  // Check expiry
  if (Date.now() > stored.expiresAt) {
    // Clean up expired token
    await docClient.send(new DeleteCommand({
      TableName: USERS_TABLE,
      Key: { pk: `RESET#${emailLower}`, sk: 'TOKEN' },
    }));
    return { success: false, error: 'Reset code has expired. Please request a new one.' };
  }

  // Hash new password and update user
  const passwordHash = await hashPassword(newPassword);
  const pk = getUserPk(emailLower);

  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
    UpdateExpression: 'SET passwordHash = :hash, updatedAt = :now',
    ExpressionAttributeValues: {
      ':hash': passwordHash,
      ':now': Date.now(),
    },
  }));

  // Delete the used reset token
  await docClient.send(new DeleteCommand({
    TableName: USERS_TABLE,
    Key: { pk: `RESET#${emailLower}`, sk: 'TOKEN' },
  }));

  console.log(`Password reset completed for ${emailLower}`);

  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscription & Plan Management (Admin)
// ─────────────────────────────────────────────────────────────────────────────

export async function updateUserPlan(
  email: string,
  plan: PlanType | null,
  planStatus: PlanStatus
): Promise<User | null> {
  const pk = getUserPk(email);
  const now = Date.now();

  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
    UpdateExpression: 'SET #plan = :plan, planStatus = :planStatus, updatedAt = :now',
    ExpressionAttributeNames: { '#plan': 'plan' },
    ExpressionAttributeValues: {
      ':plan': plan,
      ':planStatus': planStatus,
      ':now': now,
    },
  }));

  return getUserProfile(email);
}

export async function extendUserTrial(email: string, days: number): Promise<User | null> {
  const pk = getUserPk(email);
  const now = Date.now();

  // Get current user to check existing trial
  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
  }));

  if (!result.Item) return null;

  const userRecord = result.Item as UserRecord;
  const currentEnd = userRecord.trialEndsAt ? new Date(userRecord.trialEndsAt) : new Date();
  const baseDate = currentEnd > new Date() ? currentEnd : new Date();
  const newEnd = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
    UpdateExpression: 'SET trialEndsAt = :trialEndsAt, planStatus = :planStatus, updatedAt = :now',
    ExpressionAttributeValues: {
      ':trialEndsAt': newEnd.toISOString(),
      ':planStatus': 'trial',
      ':now': now,
    },
  }));

  return getUserProfile(email);
}

export async function updateUserTradingControls(
  email: string,
  controls: {
    liveTradingEnabled?: boolean;
    accountEnabled?: boolean;
    capitalLimit?: number;
  }
): Promise<User | null> {
  const pk = getUserPk(email);
  const now = Date.now();

  const updateParts: string[] = ['updatedAt = :now'];
  const expressionValues: Record<string, any> = { ':now': now };

  if (controls.liveTradingEnabled !== undefined) {
    updateParts.push('liveTradingEnabled = :live');
    expressionValues[':live'] = controls.liveTradingEnabled;
  }
  if (controls.accountEnabled !== undefined) {
    updateParts.push('accountEnabled = :acct');
    expressionValues[':acct'] = controls.accountEnabled;
  }
  if (controls.capitalLimit !== undefined) {
    updateParts.push('capitalLimit = :cap');
    expressionValues[':cap'] = controls.capitalLimit;
  }

  await docClient.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { pk, sk: 'PROFILE' },
    UpdateExpression: 'SET ' + updateParts.join(', '),
    ExpressionAttributeValues: expressionValues,
  }));

  return getUserProfile(email);
}

export async function getSystemStats(): Promise<{
  totalUsers: number;
  activeLastDay: number;
  planBreakdown: Record<string, number>;
  liveTraders: number;
  trialUsers: number;
}> {
  const result = await docClient.send(new ScanCommand({
    TableName: USERS_TABLE,
    FilterExpression: 'sk = :sk',
    ExpressionAttributeValues: { ':sk': 'PROFILE' },
  }));

  const users = ((result.Items || []) as UserRecord[]).filter(u => u.email && u.username);
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;

  const planBreakdown: Record<string, number> = { starter: 0, pro: 0, premium: 0, none: 0 };

  let activeLastDay = 0;
  let liveTraders = 0;
  let trialUsers = 0;

  for (const u of users) {
    // Plan breakdown
    if (u.plan && planBreakdown[u.plan] !== undefined) {
      planBreakdown[u.plan]++;
    } else {
      planBreakdown['none']++;
    }

    // Active last 24h
    if (u.lastActive && u.lastActive > dayAgo) {
      activeLastDay++;
    } else if (u.lastLogin && u.lastLogin > dayAgo) {
      activeLastDay++;
    }

    // Live traders
    if (u.liveTradingEnabled) liveTraders++;

    // Trial users
    if (u.planStatus === 'trial') trialUsers++;
  }

  return {
    totalUsers: users.length,
    activeLastDay,
    planBreakdown,
    liveTraders,
    trialUsers,
  };
}

export type FeatureAccess = 'ai_trader' | 'nifty_scalper' | 'live_trading';

export function checkPlanAccess(
  user: User,
  feature: FeatureAccess
): { allowed: boolean; reason?: string } {
  // Admin always has access
  if (user.role === 'admin') return { allowed: true };

  // Account disabled
  if (user.accountEnabled === false) {
    return { allowed: false, reason: 'Your account has been disabled. Contact support.' };
  }

  // Check trial expiry
  if (user.planStatus === 'trial' && user.trialEndsAt) {
    if (new Date(user.trialEndsAt) < new Date()) {
      return { allowed: false, reason: 'Your free trial has expired. Please subscribe to continue.' };
    }
  }

  // Expired or cancelled plan
  if (user.planStatus === 'expired' || user.planStatus === 'cancelled') {
    return { allowed: false, reason: 'Your subscription has expired. Please renew to continue.' };
  }

  // Feature-level access
  const plan = user.plan;
  switch (feature) {
    case 'ai_trader':
      // All plans have AI Trader
      if (!plan) return { allowed: false, reason: 'Please subscribe to access AI Trader.' };
      return { allowed: true };

    case 'nifty_scalper':
      if (plan === 'pro' || plan === 'premium') return { allowed: true };
      return { allowed: false, reason: 'Nifty Scalper requires Pro or Premium plan.' };

    case 'live_trading':
      if (plan === 'pro' || plan === 'premium') return { allowed: true };
      return { allowed: false, reason: 'Live trading requires Pro or Premium plan.' };

    default:
      return { allowed: false, reason: 'Unknown feature.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin: Create User & Per-User Analytics
// ─────────────────────────────────────────────────────────────────────────────

export async function adminCreateUser(
  email: string,
  username: string,
  password: string,
  plan?: PlanType,
  planStatus?: PlanStatus
): Promise<AuthResult> {
  const result = await createUser(email, username, password);
  if (!result.success) return result;

  if (plan && planStatus) {
    await updateUserPlan(email.toLowerCase(), plan, planStatus);
    const updatedUser = await getUserProfile(email.toLowerCase());
    if (updatedUser) result.user = updatedUser;
  }

  return result;
}

export async function getAdminUserAnalytics(targetEmail: string) {
  const user = await getUserProfile(targetEmail);
  if (!user) return null;

  // Dynamic imports to avoid circular dependency (dashboard-api imports from auth)
  const { getPaperMetrics, getPaperPortfolio } = await import('../momentum-trader/dashboard-api.js');
  const { getCapitalSummary, getEngineState } = await import('../nifty-straddle/straddle-store.js');

  let momentumMetrics = null;
  let momentumPortfolio = null;
  let straddleCapital = null;
  let straddleRunning = false;

  try { momentumMetrics = await getPaperMetrics(targetEmail); } catch (_) { /* no trades */ }
  try { momentumPortfolio = await getPaperPortfolio(targetEmail); } catch (_) { /* no portfolio */ }
  try { straddleCapital = await getCapitalSummary(targetEmail); } catch (_) { /* no straddle */ }
  try { const s = await getEngineState(targetEmail); straddleRunning = s.running; } catch (_) { /* no engine */ }

  return {
    user,
    momentum: { metrics: momentumMetrics, portfolio: momentumPortfolio },
    niftyStraddle: { capital: straddleCapital, engineRunning: straddleRunning },
  };
}
