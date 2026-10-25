const { neon } = require('@neondatabase/serverless');

let sql;
let schemaPromise;

function getSql() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for subscription storage.');
    sql ||= neon(process.env.DATABASE_URL);
    return sql;
}

async function readySql() {
    const database = getSql();
    schemaPromise ||= (async () => {
        await database`
            CREATE TABLE IF NOT EXISTS ys_bot_subscriptions (
                guild_id TEXT PRIMARY KEY,
                owner_discord_id TEXT NOT NULL,
                plan TEXT NOT NULL CHECK (plan IN ('Basic', 'VIP', 'Premium')),
                billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
                starts_at TIMESTAMPTZ NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                paypal_capture_id TEXT UNIQUE,
                subscription_source TEXT NOT NULL DEFAULT 'paypal',
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;
        await database`ALTER TABLE ys_bot_subscriptions DROP CONSTRAINT IF EXISTS ys_bot_subscriptions_plan_check`;
        await database`ALTER TABLE ys_bot_subscriptions ADD CONSTRAINT ys_bot_subscriptions_plan_check CHECK (plan IN ('Basic', 'VIP', 'Premium'))`;
        await database`ALTER TABLE ys_bot_subscriptions ALTER COLUMN paypal_capture_id DROP NOT NULL`;
        await database`ALTER TABLE ys_bot_subscriptions ADD COLUMN IF NOT EXISTS subscription_source TEXT NOT NULL DEFAULT 'paypal'`;
        await database`
            CREATE TABLE IF NOT EXISTS ys_bot_subscription_payments (
                paypal_order_id TEXT PRIMARY KEY,
                owner_discord_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                plan TEXT NOT NULL CHECK (plan IN ('Basic', 'VIP')),
                billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'yearly')),
                amount NUMERIC(10, 2) NOT NULL,
                currency_code TEXT NOT NULL DEFAULT 'USD',
                status TEXT NOT NULL DEFAULT 'CREATED',
                paypal_capture_id TEXT UNIQUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                completed_at TIMESTAMPTZ
            )
        `;
        await database`
            CREATE TABLE IF NOT EXISTS ys_bot_premium_offer_claims (
                guild_id TEXT PRIMARY KEY,
                owner_discord_id TEXT NOT NULL UNIQUE,
                claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL
            )
        `;
    })();
    try {
        await schemaPromise;
    } catch (error) {
        schemaPromise = undefined;
        throw error;
    }
    return database;
}

async function saveCreatedPayment(payment) {
    const database = await readySql();
    await database`
        INSERT INTO ys_bot_subscription_payments
            (paypal_order_id, owner_discord_id, guild_id, plan, billing_period, amount, currency_code)
        VALUES
            (${payment.orderId}, ${payment.ownerId}, ${payment.guildId}, ${payment.plan}, ${payment.period}, ${payment.amount}, 'USD')
    `;
}

async function getPayment(orderId) {
    const database = await readySql();
    const rows = await database`SELECT * FROM ys_bot_subscription_payments WHERE paypal_order_id = ${orderId} LIMIT 1`;
    return rows[0] || null;
}

async function activatePayment(orderId, captureId) {
    const database = await readySql();
    const payment = await getPayment(orderId);
    if (!payment) return null;
    if (payment.status === 'COMPLETED' && payment.paypal_capture_id === captureId) {
        return getGuildSubscription(payment.guild_id);
    }

    const startsAt = new Date();
    const existing = await getGuildSubscription(payment.guild_id);
    const currentExpiry = existing && new Date(existing.expires_at) > startsAt ? new Date(existing.expires_at) : startsAt;
    const expiresAt = new Date(currentExpiry);
    const day = expiresAt.getUTCDate();
    expiresAt.setUTCDate(1);
    if (payment.billing_period === 'yearly') expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);
    else expiresAt.setUTCMonth(expiresAt.getUTCMonth() + 1);
    const finalDay = new Date(Date.UTC(expiresAt.getUTCFullYear(), expiresAt.getUTCMonth() + 1, 0)).getUTCDate();
    expiresAt.setUTCDate(Math.min(day, finalDay));

    const rows = await database`
        WITH completed_payment AS (
            UPDATE ys_bot_subscription_payments
            SET status = 'COMPLETED', paypal_capture_id = ${captureId}, completed_at = NOW()
            WHERE paypal_order_id = ${orderId} AND owner_discord_id = ${payment.owner_discord_id} AND status = 'CREATED'
            RETURNING owner_discord_id, guild_id, plan, billing_period
        )
        INSERT INTO ys_bot_subscriptions
            (guild_id, owner_discord_id, plan, billing_period, starts_at, expires_at, paypal_capture_id, subscription_source, updated_at)
        SELECT guild_id, owner_discord_id, plan, billing_period, ${startsAt.toISOString()}, ${expiresAt.toISOString()}, ${captureId}, 'paypal', NOW()
        FROM completed_payment
        ON CONFLICT (guild_id) DO UPDATE SET
            owner_discord_id = EXCLUDED.owner_discord_id,
            plan = EXCLUDED.plan,
            billing_period = EXCLUDED.billing_period,
            starts_at = EXCLUDED.starts_at,
            expires_at = EXCLUDED.expires_at,
            paypal_capture_id = EXCLUDED.paypal_capture_id,
            subscription_source = 'paypal',
            updated_at = NOW()
        RETURNING guild_id, owner_discord_id, plan, billing_period, starts_at, expires_at, paypal_capture_id
    `;
    if (!rows.length) {
        const latest = await getGuildSubscription(payment.guild_id);
        return latest?.paypal_capture_id === captureId ? latest : null;
    }
    return rows[0] || null;
}

async function claimPremiumOffer(guildId, ownerId, offerEndsAt) {
    const database = await readySql();
    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000);
    const rows = await database`
        WITH offer_claim AS (
            INSERT INTO ys_bot_premium_offer_claims (guild_id, owner_discord_id, expires_at)
            SELECT ${String(guildId)}, ${String(ownerId)}, ${expiresAt.toISOString()}
            WHERE NOW() < ${offerEndsAt.toISOString()}::timestamptz
              AND NOT EXISTS (
                  SELECT 1 FROM ys_bot_subscriptions
                  WHERE guild_id = ${String(guildId)} AND expires_at > NOW()
              )
            ON CONFLICT DO NOTHING
            RETURNING guild_id, owner_discord_id, expires_at
        )
        INSERT INTO ys_bot_subscriptions
            (guild_id, owner_discord_id, plan, billing_period, starts_at, expires_at, paypal_capture_id, subscription_source, updated_at)
        SELECT guild_id, owner_discord_id, 'Premium', 'monthly', ${startsAt.toISOString()}, expires_at, NULL, 'launch_offer', NOW()
        FROM offer_claim
        ON CONFLICT (guild_id) DO UPDATE SET
            owner_discord_id = EXCLUDED.owner_discord_id,
            plan = EXCLUDED.plan,
            billing_period = EXCLUDED.billing_period,
            starts_at = EXCLUDED.starts_at,
            expires_at = EXCLUDED.expires_at,
            paypal_capture_id = NULL,
            subscription_source = 'launch_offer',
            updated_at = NOW()
        RETURNING guild_id, owner_discord_id, plan, billing_period, starts_at, expires_at, subscription_source
    `;
    return rows[0] || null;
}

async function getGuildSubscription(guildId) {
    const database = await readySql();
    const rows = await database`
        SELECT guild_id, owner_discord_id, plan, billing_period, starts_at, expires_at, paypal_capture_id
        FROM ys_bot_subscriptions WHERE guild_id = ${String(guildId)} LIMIT 1
    `;
    return rows[0] || null;
}

async function isPremiumOwnerActive(ownerId) {
    const database = await readySql();
    const rows = await database`
        SELECT 1 FROM ys_bot_subscriptions
        WHERE owner_discord_id = ${String(ownerId)} AND plan = 'Premium' AND expires_at > NOW()
        LIMIT 1
    `;
    return rows.length > 0;
}

module.exports = { activatePayment, claimPremiumOffer, getGuildSubscription, getPayment, isPremiumOwnerActive, saveCreatedPayment };
