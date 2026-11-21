'use strict';

const { neon } = require('@neondatabase/serverless');

let sql;
let ready;

function getSql() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for server activity statistics.');
    sql ||= neon(process.env.DATABASE_URL);
    return sql;
}

async function getReadySql() {
    const database = getSql();
    ready ||= database`
        CREATE TABLE IF NOT EXISTS ys_bot_server_activity_daily (
            guild_id TEXT NOT NULL,
            activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
            interactions BIGINT NOT NULL DEFAULT 0,
            virtual_credits BIGINT NOT NULL DEFAULT 0,
            last_active_at TIMESTAMPTZ,
            PRIMARY KEY (guild_id, activity_date)
        )
    `;
    try {
        await ready;
    } catch (error) {
        ready = undefined;
        throw error;
    }
    return database;
}

async function recordServerActivity(guildId, interactions) {
    const count = Number(interactions);
    if (!Number.isInteger(count) || count < 1 || count > 1000) throw new Error('Invalid activity count.');
    const database = await getReadySql();
    await database`
        INSERT INTO ys_bot_server_activity_daily (guild_id, activity_date, interactions, virtual_credits, last_active_at)
        VALUES (${String(guildId)}, (NOW() AT TIME ZONE 'UTC')::date, ${count}, ${count}, NOW())
        ON CONFLICT (guild_id, activity_date) DO UPDATE SET
            interactions = ys_bot_server_activity_daily.interactions + EXCLUDED.interactions,
            virtual_credits = ys_bot_server_activity_daily.virtual_credits + EXCLUDED.virtual_credits,
            last_active_at = GREATEST(ys_bot_server_activity_daily.last_active_at, EXCLUDED.last_active_at)
    `;
}

async function getServerActivity(guildId) {
    const database = await getReadySql();
    const [summaryRows, dailyRows] = await Promise.all([
        database`
            SELECT COALESCE(SUM(interactions), 0)::text AS interactions,
                   COALESCE(SUM(virtual_credits), 0)::text AS "virtualCredits",
                   MAX(last_active_at) AS "lastActiveAt"
            FROM ys_bot_server_activity_daily WHERE guild_id = ${String(guildId)}
        `,
        database`
            SELECT TO_CHAR(activity_date, 'YYYY-MM-DD') AS date,
                   interactions::text AS interactions,
                   virtual_credits::text AS "virtualCredits"
            FROM ys_bot_server_activity_daily
            WHERE guild_id = ${String(guildId)} AND activity_date >= (NOW() AT TIME ZONE 'UTC')::date - INTERVAL '6 days'
            ORDER BY activity_date ASC
        `
    ]);
    const byDate = new Map(dailyRows.map((row) => [row.date, row]));
    const daily = [];
    for (let offset = 6; offset >= 0; offset--) {
        const day = new Date();
        day.setUTCHours(0, 0, 0, 0);
        day.setUTCDate(day.getUTCDate() - offset);
        const date = day.toISOString().slice(0, 10);
        const row = byDate.get(date);
        daily.push({ date, interactions: Number(row?.interactions || 0), virtualCredits: Number(row?.virtualCredits || 0) });
    }
    const summary = summaryRows[0] || {};
    return {
        totalInteractions: Number(summary.interactions || 0),
        virtualCredits: Number(summary.virtualCredits || 0),
        lastActiveAt: summary.lastActiveAt || null,
        daily
    };
}

module.exports = { recordServerActivity, getServerActivity };
