const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

let sql;
let tablesReady;
let lastRateLimitCleanupAt = 0;

function getSql() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required for support verification.');
    }
    sql ||= neon(process.env.DATABASE_URL);
    return sql;
}

async function getReadySql() {
    const database = getSql();
    tablesReady ||= (async () => {
        await database`CREATE TABLE IF NOT EXISTS ys_bot_support_codes (
            email TEXT PRIMARY KEY,
            code_hash TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
        await database`CREATE TABLE IF NOT EXISTS ys_bot_support_verified_tokens (
            token_hash TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL
        )`;
        await database`CREATE TABLE IF NOT EXISTS ys_bot_support_requests (
            id BIGSERIAL PRIMARY KEY,
            email TEXT,
            discord_username TEXT NOT NULL,
            category TEXT NOT NULL CHECK (category IN ('refund', 'vulnerability', 'technical', 'other')),
            message TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
        await database`ALTER TABLE ys_bot_support_requests ADD COLUMN IF NOT EXISTS discord_username TEXT`;
        await database`ALTER TABLE ys_bot_support_requests ALTER COLUMN email DROP NOT NULL`;
        await database`UPDATE ys_bot_support_requests SET discord_username = email WHERE discord_username IS NULL`;
        await database`ALTER TABLE ys_bot_support_requests ALTER COLUMN discord_username SET NOT NULL`;
        await database`CREATE TABLE IF NOT EXISTS ys_bot_support_rate_limits (
            bucket_key TEXT PRIMARY KEY,
            window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            request_count INTEGER NOT NULL DEFAULT 0
        )`;
    })();
    try {
        await tablesReady;
    } catch (error) {
        tablesReady = undefined;
        throw error;
    }
    return database;
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

async function consumeRateLimit(scope, identity, limit, windowSeconds) {
    const database = await getReadySql();
    if (Date.now() - lastRateLimitCleanupAt > 60 * 60 * 1000) {
        lastRateLimitCleanupAt = Date.now();
        await database`DELETE FROM ys_bot_support_rate_limits WHERE window_started_at < NOW() - INTERVAL '2 days'`;
    }
    const bucketKey = hash(`${scope}:${identity}`);
    const rows = await database`
        INSERT INTO ys_bot_support_rate_limits (bucket_key, window_started_at, request_count)
        VALUES (${bucketKey}, NOW(), 1)
        ON CONFLICT (bucket_key) DO UPDATE SET
            request_count = CASE
                WHEN ys_bot_support_rate_limits.window_started_at <= NOW() - (${windowSeconds} * INTERVAL '1 second') THEN 1
                ELSE ys_bot_support_rate_limits.request_count + 1
            END,
            window_started_at = CASE
                WHEN ys_bot_support_rate_limits.window_started_at <= NOW() - (${windowSeconds} * INTERVAL '1 second') THEN NOW()
                ELSE ys_bot_support_rate_limits.window_started_at
            END
        RETURNING request_count
    `;
    return Number(rows[0]?.request_count || 0) <= limit;
}

function getTokenSecret() {
    return process.env.SUPPORT_TOKEN_SECRET || hash(process.env.DATABASE_URL || 'ys-bot-support-secret');
}

function createVerificationToken(email) {
    const secret = getTokenSecret();
    const payload = Buffer.from(JSON.stringify({ email, expiresAt: Date.now() + 24 * 60 * 60 * 1000 })).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${signature}`;
}

function readVerificationToken(token) {
    const secret = getTokenSecret();
    if (typeof token !== 'string') return null;
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return data.expiresAt > Date.now() && isValidEmail(data.email) ? data : null;
    } catch {
        return null;
    }
}

async function saveCode(email, code) {
    const database = await getReadySql();
    await database`
        INSERT INTO ys_bot_support_codes (email, code_hash, expires_at, attempts)
        VALUES (${email}, ${hash(code)}, NOW() + INTERVAL '10 minutes', 0)
        ON CONFLICT (email)
        DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, created_at = NOW()
    `;
}

async function verifyCode(email, code) {
    const database = await getReadySql();
    const rows = await database`
        SELECT code_hash, expires_at, attempts
        FROM ys_bot_support_codes
        WHERE email = ${email}
        LIMIT 1
    `;
    const record = rows[0];
    if (!record || new Date(record.expires_at).getTime() < Date.now() || record.attempts >= 5) return null;

    const matches = hash(code) === record.code_hash;
    if (!matches) {
        await database`UPDATE ys_bot_support_codes SET attempts = attempts + 1 WHERE email = ${email}`;
        return null;
    }

    await database`DELETE FROM ys_bot_support_codes WHERE email = ${email}`;
    const token = createVerificationToken(email);
    await database`
        INSERT INTO ys_bot_support_verified_tokens (token_hash, email, expires_at)
        VALUES (${hash(token)}, ${email}, NOW() + INTERVAL '24 hours')
    `;
    return token;
}

async function consumeVerificationToken(email, token) {
    const database = await getReadySql();
    const rows = await database`
        DELETE FROM ys_bot_support_verified_tokens
        WHERE token_hash = ${hash(token)} AND email = ${email} AND expires_at > NOW()
        RETURNING token_hash
    `;
    return rows.length > 0;
}

async function saveSupportRequest(email, discordUsername, category, message) {
    const database = await getReadySql();
    await database`
        INSERT INTO ys_bot_support_requests (email, discord_username, category, message)
        VALUES (${email}, ${discordUsername}, ${category}, ${message})
    `;
}

module.exports = { normalizeEmail, isValidEmail, saveCode, verifyCode, readVerificationToken, consumeVerificationToken, saveSupportRequest, consumeRateLimit };
