const net = require('net');
const { neon } = require('@neondatabase/serverless');

let sql;
let tablesReady;

function getSql() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required for IP moderation.');
    }
    sql ||= neon(process.env.DATABASE_URL);
    return sql;
}

function normalizeIpAddress(value) {
    let address = String(value || '').trim();
    if (address.startsWith('::ffff:')) address = address.slice(7);
    return net.isIP(address) ? address.toLowerCase() : null;
}

function initializeTables(database) {
    return (async () => {
        await database`
            CREATE TABLE IF NOT EXISTS ys_bot_ip_bans (
                ip_address INET PRIMARY KEY,
                reason TEXT NOT NULL DEFAULT '',
                banned_by_discord_id TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;
        await database`
            CREATE TABLE IF NOT EXISTS ys_bot_bot_users (
                discord_user_id TEXT PRIMARY KEY,
                discord_username TEXT NOT NULL,
                email TEXT,
                email_verified BOOLEAN NOT NULL DEFAULT FALSE,
                last_guild_id TEXT,
                last_ip INET,
                last_ip_seen_at TIMESTAMPTZ,
                last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                command_count BIGINT NOT NULL DEFAULT 0
            )
        `;
        await database`ALTER TABLE ys_bot_bot_users ADD COLUMN IF NOT EXISTS email TEXT`;
        await database`ALTER TABLE ys_bot_bot_users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE`;
        await database`
            CREATE TABLE IF NOT EXISTS ys_bot_discord_account_bans (
                discord_user_id TEXT PRIMARY KEY,
                discord_username TEXT NOT NULL,
                reason TEXT NOT NULL DEFAULT '',
                banned_by_discord_id TEXT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;
    })();
}

async function getReadySql() {
    const database = getSql();
    for (let attempt = 0; attempt < 2; attempt += 1) {
        tablesReady ||= initializeTables(database);
        try {
            await tablesReady;
            return database;
        } catch (error) {
            tablesReady = undefined;
            const schemaCreationRace = error?.code === '23505'
                && String(error.message || '').includes('pg_type_typname_nsp_index');
            if (!schemaCreationRace || attempt > 0) throw error;
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
    }
    return database;
}

async function isIpBanned(address) {
    const ip = normalizeIpAddress(address);
    if (!ip) return false;
    const database = await getReadySql();
    const rows = await database`
        SELECT 1 FROM ys_bot_ip_bans WHERE ip_address = ${ip}::inet LIMIT 1
    `;
    return rows.length > 0; 
}

async function addIpBan(address, reason, adminDiscordId) {
    const ip = normalizeIpAddress(address);
    if (!ip) throw new Error('Invalid IP address.');
    const database = await getReadySql();
    await database`
        INSERT INTO ys_bot_ip_bans (ip_address, reason, banned_by_discord_id)
        VALUES (${ip}::inet, ${String(reason || '').trim().slice(0, 240)}, ${String(adminDiscordId)})
        ON CONFLICT (ip_address) DO UPDATE SET
            reason = EXCLUDED.reason,
            banned_by_discord_id = EXCLUDED.banned_by_discord_id,
            created_at = NOW()
    `;
    return ip;
}

async function removeIpBan(address) {
    const ip = normalizeIpAddress(address);
    if (!ip) throw new Error('Invalid IP address.');
    const database = await getReadySql();
    const rows = await database`
        DELETE FROM ys_bot_ip_bans WHERE ip_address = ${ip}::inet RETURNING ip_address::text AS ip
    `;
    return rows.length > 0;
}

async function listIpBans() {
    const database = await getReadySql();
    return database`
        SELECT ip_address::text AS ip, reason, banned_by_discord_id AS "bannedBy", created_at AS "createdAt"
        FROM ys_bot_ip_bans
        ORDER BY created_at DESC
        LIMIT 500
    `;
}

async function listBotUsers() {
    const database = await getReadySql();
    return database`
        SELECT discord_user_id AS "discordUserId", discord_username AS username,
            last_guild_id AS "lastGuildId", last_ip::text AS ip,
            last_ip_seen_at AS "ipSeenAt", last_seen_at AS "lastSeenAt", command_count AS "commandCount"
        FROM ys_bot_bot_users
        ORDER BY last_seen_at DESC
        LIMIT 500
    `;
}

async function findBotUser(query) {
    const value = String(query || '').trim();
    if (!value || value.length > 100) return null;
    const database = await getReadySql();
    const rows = /^\d{17,20}$/.test(value)
        ? await database`SELECT discord_user_id AS "discordUserId", discord_username AS username, email, email_verified AS "emailVerified" FROM ys_bot_bot_users WHERE discord_user_id = ${value} LIMIT 2`
        : await database`SELECT discord_user_id AS "discordUserId", discord_username AS username, email, email_verified AS "emailVerified" FROM ys_bot_bot_users WHERE LOWER(discord_username) = LOWER(${value}) ORDER BY last_seen_at DESC LIMIT 2`;
    if (rows.length > 1) throw new Error('اسم المستخدم يطابق أكثر من حساب؛ استخدم Discord ID.');
    return rows[0] || null;
}

async function isDiscordUserBanned(discordUserId) {
    const database = await getReadySql();
    const rows = await database`SELECT reason FROM ys_bot_discord_account_bans WHERE discord_user_id = ${String(discordUserId)} LIMIT 1`;
    return rows[0] || null;
}

async function addDiscordAccountBan(user, reason, adminDiscordId) {
    const database = await getReadySql();
    await database`
        INSERT INTO ys_bot_discord_account_bans (discord_user_id, discord_username, reason, banned_by_discord_id)
        VALUES (${String(user.discordUserId)}, ${String(user.username).slice(0, 100)}, ${String(reason || '').trim().slice(0, 240)}, ${String(adminDiscordId)})
        ON CONFLICT (discord_user_id) DO UPDATE SET
            discord_username = EXCLUDED.discord_username,
            reason = EXCLUDED.reason,
            banned_by_discord_id = EXCLUDED.banned_by_discord_id,
            created_at = NOW()
    `;
}

async function removeDiscordAccountBan(discordUserId) {
    const database = await getReadySql();
    const rows = await database`DELETE FROM ys_bot_discord_account_bans WHERE discord_user_id = ${String(discordUserId)} RETURNING discord_user_id`;
    return rows.length > 0;
}

async function listDiscordAccountBans() {
    const database = await getReadySql();
    return database`SELECT discord_user_id AS "discordUserId", discord_username AS username, reason, banned_by_discord_id AS "bannedBy", created_at AS "createdAt" FROM ys_bot_discord_account_bans ORDER BY created_at DESC LIMIT 500`;
}

async function recordBotCommandUser(user, guildId) {
    const database = await getReadySql();
    await database`
        INSERT INTO ys_bot_bot_users (discord_user_id, discord_username, last_guild_id, last_seen_at, command_count)
        VALUES (${String(user.id)}, ${String(user.username).slice(0, 100)}, ${String(guildId)}, NOW(), 1)
        ON CONFLICT (discord_user_id) DO UPDATE SET
            discord_username = EXCLUDED.discord_username,
            last_guild_id = EXCLUDED.last_guild_id,
            last_seen_at = NOW(),
            command_count = ys_bot_bot_users.command_count + 1
    `;
}

async function getBotUserStats(userId) {
    const database = await getReadySql();
    const rows = await database`
        SELECT command_count AS "commandCount", last_seen_at AS "lastSeenAt"
        FROM ys_bot_bot_users
        WHERE discord_user_id = ${String(userId)}
        LIMIT 1
    `;
    return rows[0] || { commandCount: 0, lastSeenAt: null };
}

async function recordWebsiteUser(user, address) {
    const ip = normalizeIpAddress(address);
    const database = await getReadySql();
    await database`
        INSERT INTO ys_bot_bot_users (
            discord_user_id, discord_username, email, email_verified, last_ip, last_ip_seen_at, last_seen_at, command_count
        ) VALUES (
            ${String(user.id)}, ${String(user.username).slice(0, 100)}, ${user.verified === true && typeof user.email === 'string' ? user.email.toLowerCase().slice(0, 254) : null}, ${user.verified === true && typeof user.email === 'string'}, ${ip}::inet, NOW(), NOW(), 0
        )
        ON CONFLICT (discord_user_id) DO UPDATE SET
            discord_username = EXCLUDED.discord_username,
            email = COALESCE(EXCLUDED.email, ys_bot_bot_users.email),
            email_verified = ys_bot_bot_users.email_verified OR EXCLUDED.email_verified,
            last_ip = EXCLUDED.last_ip,
            last_ip_seen_at = NOW(),
            last_seen_at = NOW()
    `;
}

module.exports = {
    addIpBan,
    addDiscordAccountBan,
    findBotUser,
    isIpBanned,
    isDiscordUserBanned,
    listBotUsers,
    listDiscordAccountBans,
    listIpBans,
    normalizeIpAddress,
    recordBotCommandUser,
    getBotUserStats,
    recordWebsiteUser,
    removeIpBan,
    removeDiscordAccountBan
};
