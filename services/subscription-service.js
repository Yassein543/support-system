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
        await database`
            CREATE TABLE IF NOT EXISTS ys_bot_wallets (
                owner_discord_id TEXT PRIMARY KEY,
                balance_cents BIGINT NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;
        await database`
            CREATE TABLE IF NOT EXISTS ys_bot_wallet_ledger (
                entry_id BIGSERIAL PRIMARY KEY,
                owner_discord_id TEXT NOT NULL,
                entry_type TEXT NOT NULL CHECK (entry_type IN ('topup', 'subscription')),
                amount_cents BIGINT NOT NULL,
                balance_after_cents BIGINT NOT NULL,
                reference_id TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;
        await database`
            CREATE TABLE IF NOT EXISTS ys_bot_wallet_topups (
                paypal_order_id TEXT PRIMARY KEY,
                owner_discord_id TEXT NOT NULL,
                pack_id TEXT NOT NULL,
                amount_cents BIGINT NOT NULL,
                status TEXT NOT NULL DEFAULT 'CREATED',
                paypal_capture_id TEXT UNIQUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                completed_at TIMESTAMPTZ
            )
        `;
        await database`
            CREATE TABLE IF NOT EXISTS ys_bot_wallet_purchase_requests (
                request_id UUID PRIMARY KEY,
                owner_discord_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                plan TEXT NOT NULL,
                billing_period TEXT NOT NULL,
                amount_cents BIGINT NOT NULL,
                status TEXT NOT NULL DEFAULT 'PENDING',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

async function getWalletBalance(ownerId) {
    const database = await readySql();
    const rows = await database`SELECT balance_cents FROM ys_bot_wallets WHERE owner_discord_id = ${String(ownerId)} LIMIT 1`;
    return Number(rows[0]?.balance_cents || 0);
}

async function saveCreatedTopup(topup) {
    const database = await readySql();
    await database`
        INSERT INTO ys_bot_wallet_topups (paypal_order_id, owner_discord_id, pack_id, amount_cents)
        VALUES (${topup.orderId}, ${String(topup.ownerId)}, ${topup.packId}, ${topup.amountCents})
    `;
}

async function getTopup(orderId) {
    const database = await readySql();
    const rows = await database`SELECT * FROM ys_bot_wallet_topups WHERE paypal_order_id = ${String(orderId)} LIMIT 1`;
    return rows[0] || null;
}

async function creditTopup(orderId, ownerId, captureId) {
    const database = await readySql();
    const rows = await database`
        WITH completed AS (
            UPDATE ys_bot_wallet_topups
            SET status = 'COMPLETED', paypal_capture_id = ${String(captureId)}, completed_at = NOW()
            WHERE paypal_order_id = ${String(orderId)} AND owner_discord_id = ${String(ownerId)} AND status = 'CREATED'
            RETURNING owner_discord_id, amount_cents, paypal_order_id
        ), credited AS (
            INSERT INTO ys_bot_wallets (owner_discord_id, balance_cents, updated_at)
            SELECT owner_discord_id, amount_cents, NOW() FROM completed
            ON CONFLICT (owner_discord_id) DO UPDATE
            SET balance_cents = ys_bot_wallets.balance_cents + EXCLUDED.balance_cents, updated_at = NOW()
            RETURNING owner_discord_id, balance_cents
        )
        INSERT INTO ys_bot_wallet_ledger (owner_discord_id, entry_type, amount_cents, balance_after_cents, reference_id, description)
        SELECT credited.owner_discord_id, 'topup', completed.amount_cents, credited.balance_cents,
            'topup:' || completed.paypal_order_id, 'رصيد مشحون عبر PayPal'
        FROM credited JOIN completed USING (owner_discord_id)
        RETURNING owner_discord_id, balance_after_cents
    `;
    if (rows[0]) return Number(rows[0].balance_after_cents);
    const topup = await getTopup(orderId);
    if (topup?.status === 'COMPLETED' && topup.paypal_capture_id === String(captureId) && topup.owner_discord_id === String(ownerId)) {
        return getWalletBalance(ownerId);
    }
    return null;
}

async function getWalletPurchaseRequest(requestId) {
    const database = await readySql();
    const rows = await database`SELECT * FROM ys_bot_wallet_purchase_requests WHERE request_id = ${String(requestId)}::uuid LIMIT 1`;
    return rows[0] || null;
}

async function purchaseSubscriptionWithWallet(purchase) {
    const database = await readySql();
    const start = new Date();
    const rows = await database`
        WITH claimed AS (
            INSERT INTO ys_bot_wallet_purchase_requests
                (request_id, owner_discord_id, guild_id, plan, billing_period, amount_cents)
            VALUES
                (${purchase.requestId}::uuid, ${String(purchase.ownerId)}, ${String(purchase.guildId)}, ${purchase.plan}, ${purchase.period}, ${purchase.amountCents})
            ON CONFLICT (request_id) DO NOTHING
            RETURNING request_id, owner_discord_id, guild_id, plan, billing_period, amount_cents
        ), debited AS (
            UPDATE ys_bot_wallets wallet
            SET balance_cents = wallet.balance_cents - claimed.amount_cents, updated_at = NOW()
            FROM claimed
            WHERE wallet.owner_discord_id = claimed.owner_discord_id
              AND wallet.balance_cents >= claimed.amount_cents
            RETURNING wallet.owner_discord_id, wallet.balance_cents, claimed.request_id, claimed.guild_id,
                claimed.plan, claimed.billing_period, claimed.amount_cents
        ), recorded AS (
            INSERT INTO ys_bot_wallet_ledger
                (owner_discord_id, entry_type, amount_cents, balance_after_cents, reference_id, description)
            SELECT owner_discord_id, 'subscription', -amount_cents, balance_cents,
                'purchase:' || request_id::text, 'اشتراك ' || plan || ' عبر الرصيد'
            FROM debited
            RETURNING owner_discord_id, balance_after_cents, reference_id
        ), subscription AS (
            INSERT INTO ys_bot_subscriptions
                (guild_id, owner_discord_id, plan, billing_period, starts_at, expires_at, paypal_capture_id, subscription_source, updated_at)
            SELECT debited.guild_id, debited.owner_discord_id, debited.plan, debited.billing_period,
                ${start.toISOString()}::timestamptz,
                GREATEST(COALESCE((SELECT expires_at FROM ys_bot_subscriptions WHERE guild_id = debited.guild_id), ${start.toISOString()}::timestamptz), ${start.toISOString()}::timestamptz)
                    + CASE WHEN debited.billing_period = 'yearly' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END,
                NULL, 'wallet', NOW()
            FROM debited JOIN recorded USING (owner_discord_id)
            ON CONFLICT (guild_id) DO UPDATE SET
                owner_discord_id = EXCLUDED.owner_discord_id,
                plan = EXCLUDED.plan,
                billing_period = EXCLUDED.billing_period,
                starts_at = EXCLUDED.starts_at,
                expires_at = GREATEST(ys_bot_subscriptions.expires_at, EXCLUDED.starts_at)
                    + CASE WHEN EXCLUDED.billing_period = 'yearly' THEN INTERVAL '1 year' ELSE INTERVAL '1 month' END,
                paypal_capture_id = NULL,
                subscription_source = 'wallet',
                updated_at = NOW()
            RETURNING guild_id, owner_discord_id, plan, billing_period, starts_at, expires_at
        ), finished AS (
            UPDATE ys_bot_wallet_purchase_requests request
            SET status = 'COMPLETED'
            FROM subscription
            WHERE request.request_id = ${purchase.requestId}::uuid
            RETURNING request.request_id, request.status
        ), insufficient AS (
            UPDATE ys_bot_wallet_purchase_requests request
            SET status = 'INSUFFICIENT_FUNDS'
            FROM claimed
            WHERE request.request_id = claimed.request_id
              AND NOT EXISTS (SELECT 1 FROM debited)
            RETURNING request.request_id, request.status
        )
        SELECT subscription.*, recorded.balance_after_cents, finished.status
        FROM subscription
        JOIN debited USING (owner_discord_id)
        JOIN recorded USING (owner_discord_id)
        JOIN finished ON TRUE
    `;
    if (rows[0]) return { ...rows[0], balance_cents: Number(rows[0].balance_after_cents) };
    const existing = await getWalletPurchaseRequest(purchase.requestId);
    if (existing) {
        const samePurchase = existing.owner_discord_id === String(purchase.ownerId) && existing.guild_id === String(purchase.guildId) &&
            existing.plan === purchase.plan && existing.billing_period === purchase.period && Number(existing.amount_cents) === purchase.amountCents;
        if (!samePurchase) return { conflict: true };
        if (existing.status === 'INSUFFICIENT_FUNDS') return { insufficient: true, balance_cents: await getWalletBalance(purchase.ownerId) };
        if (existing.status === 'COMPLETED') {
            const subscription = await getGuildSubscription(purchase.guildId);
            return { ...subscription, balance_cents: await getWalletBalance(purchase.ownerId) };
        }
    }
    return { insufficient: true, balance_cents: await getWalletBalance(purchase.ownerId) };
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

async function cancelGuildSubscription(guildId, ownerId) {
    const database = await readySql();
    const rows = await database`
        UPDATE ys_bot_subscriptions
        SET expires_at = NOW(), subscription_source = 'cancelled', updated_at = NOW()
        WHERE guild_id = ${String(guildId)}
          AND owner_discord_id = ${String(ownerId)}
          AND expires_at > NOW()
        RETURNING guild_id, owner_discord_id, plan, billing_period, expires_at
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

module.exports = {
    activatePayment, cancelGuildSubscription, claimPremiumOffer, creditTopup, getGuildSubscription, getPayment, getTopup,
    getWalletBalance, getWalletPurchaseRequest, isPremiumOwnerActive, purchaseSubscriptionWithWallet,
    saveCreatedPayment, saveCreatedTopup
};
