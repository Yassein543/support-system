'use strict';

const { neon } = require('@neondatabase/serverless');
let sql;
let ready;

function database() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for allocation links.');
    sql ||= neon(process.env.DATABASE_URL);
    return sql;
}

async function getDatabase() {
    const db = database();
    ready ||= db`
        CREATE TABLE IF NOT EXISTS ys_bot_allocation_links (
            token_hash TEXT PRIMARY KEY,
            guild_id TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            consumed_at TIMESTAMPTZ
        )
    `;
    try { await ready; } catch (error) { ready = undefined; throw error; }
    return db;
}

async function createAllocationLink(tokenHash, guildId, ownerId, expiresAt) {
    const db = await getDatabase();
    await db`INSERT INTO ys_bot_allocation_links (token_hash, guild_id, owner_id, expires_at)
        VALUES (${tokenHash}, ${guildId}, ${ownerId}, ${expiresAt})`;
}

async function getAllocationLink(tokenHash) {
    const db = await getDatabase();
    const rows = await db`SELECT guild_id AS "guildId", owner_id AS "ownerId", expires_at AS "expiresAt", consumed_at AS "consumedAt"
        FROM ys_bot_allocation_links WHERE token_hash = ${tokenHash} LIMIT 1`;
    return rows[0] || null;
}

async function consumeAllocationLink(tokenHash) {
    const db = await getDatabase();
    const rows = await db`UPDATE ys_bot_allocation_links SET consumed_at = NOW()
        WHERE token_hash = ${tokenHash} AND consumed_at IS NULL AND expires_at > NOW()
        RETURNING guild_id AS "guildId", owner_id AS "ownerId", expires_at AS "expiresAt"`;
    return rows[0] || null;
}

module.exports = { createAllocationLink, getAllocationLink, consumeAllocationLink };
