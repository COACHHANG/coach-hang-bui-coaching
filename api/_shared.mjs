import crypto from 'node:crypto';

export const PRICE_VND = 499000;
export const PRODUCT_NAME = 'Phiên coaching khám phá 45 phút';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu cấu hình ${name}`);
  return value;
}

export function getAppConfig() {
  return {
    supabaseUrl: requiredEnv('SUPABASE_URL').replace(/\/$/, ''),
    supabaseServiceRoleKey: requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    accountNumber: requiredEnv('SEPAY_ACCOUNT_NUMBER'),
    bankCode: process.env.SEPAY_BANK_CODE || 'MBBank',
    paymentPrefix: process.env.PAYMENT_PREFIX || 'CHB',
  };
}

export async function supabaseRequest(path, options = {}) {
  const { supabaseUrl, supabaseServiceRoleKey } = getAppConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase trả về ${response.status}: ${detail}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

export function createReference(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export function createPublicToken() {
  return crypto.randomBytes(24).toString('base64url');
}

export function getQrUrl({ accountNumber, bankCode, amount, reference }) {
  const query = new URLSearchParams({
    acc: accountNumber,
    bank: bankCode,
    amount: String(amount),
    des: reference,
    template: 'compact',
    showinfo: 'true',
  });
  return `https://vietqr.app/img?${query.toString()}`;
}

export async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(left || '');
  const rightBuffer = Buffer.from(right || '');
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
