const { neon } = require('@neondatabase/serverless');

const SUPPORTED_LANGUAGES = new Set(['ar', 'en', 'fr', 'es', 'de', 'pt', 'ko', 'ja']);
const PROFILE_CARD_THEMES = new Set(['classic', 'midnight', 'ocean', 'cyber', 'emerald', 'sunset', 'crimson', 'rose', 'amethyst', 'forest', 'arctic', 'slate']);
let sql;
let tableReady;

function getSql() {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is required for user preferences.');
    }

    if (!sql) {
        sql = neon(process.env.DATABASE_URL);
    }

    return sql;
}

async function getReadySql() {
    const database = getSql();

    if (!tableReady) {
        tableReady = database`
            CREATE TABLE IF NOT EXISTS ys_bot_user_preferences (
                discord_user_id TEXT PRIMARY KEY,
                bot_language TEXT NOT NULL CHECK (bot_language IN ('ar', 'en', 'fr', 'es', 'de', 'pt', 'ko', 'ja')),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;
        tableReady = tableReady.then(() => database`
            ALTER TABLE ys_bot_user_preferences
            ADD COLUMN IF NOT EXISTS profile_card_theme TEXT NOT NULL DEFAULT 'classic'
        `);
        tableReady = tableReady.then(() => database`
            CREATE TABLE IF NOT EXISTS ys_bot_profile_card_images (
                discord_user_id TEXT PRIMARY KEY,
                image_data_url TEXT NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
    }

    try {
        await tableReady;
    } catch (error) {
        tableReady = undefined;
        throw error;
    }

    return database;
}

async function getBotLanguage(discordUserId, fallback = 'ar') {
    const database = await getReadySql();
    const rows = await database`
        SELECT bot_language
        FROM ys_bot_user_preferences
        WHERE discord_user_id = ${String(discordUserId)}
        LIMIT 1
    `;
    const language = rows[0]?.bot_language;
    return SUPPORTED_LANGUAGES.has(language) ? language : fallback;
}

async function setBotLanguage(discordUserId, language) {
    if (!SUPPORTED_LANGUAGES.has(language)) {
        throw new Error('Unsupported bot language.');
    }

    const database = await getReadySql();
    await database`
        INSERT INTO ys_bot_user_preferences (discord_user_id, bot_language)
        VALUES (${String(discordUserId)}, ${language})
        ON CONFLICT (discord_user_id)
        DO UPDATE SET bot_language = EXCLUDED.bot_language, updated_at = NOW()
    `;

    return language;
}

async function getProfileCardTheme(discordUserId) {
    const database = await getReadySql();
    const rows = await database`
        SELECT profile_card_theme
        FROM ys_bot_user_preferences
        WHERE discord_user_id = ${String(discordUserId)}
        LIMIT 1
    `;
    if (!rows.length) return null;
    const theme = rows[0]?.profile_card_theme;
    return PROFILE_CARD_THEMES.has(theme) ? theme : null;
}

async function setProfileCardTheme(discordUserId, theme) {
    if (!PROFILE_CARD_THEMES.has(theme)) throw new Error('Unsupported profile card theme.');
    const database = await getReadySql();
    await database`
        INSERT INTO ys_bot_user_preferences (discord_user_id, bot_language, profile_card_theme)
        VALUES (${String(discordUserId)}, 'ar', ${theme})
        ON CONFLICT (discord_user_id)
        DO UPDATE SET profile_card_theme = EXCLUDED.profile_card_theme, updated_at = NOW()
    `;
    return theme;
}

async function getProfileCardImage(discordUserId) {
    const database = await getReadySql();
    const rows = await database`SELECT image_data_url FROM ys_bot_profile_card_images WHERE discord_user_id = ${String(discordUserId)} LIMIT 1`;
    return rows[0]?.image_data_url || null;
}

async function setProfileCardImage(discordUserId, imageDataUrl) {
    const database = await getReadySql();
    await database`
        INSERT INTO ys_bot_profile_card_images (discord_user_id, image_data_url)
        VALUES (${String(discordUserId)}, ${imageDataUrl})
        ON CONFLICT (discord_user_id) DO UPDATE SET image_data_url = EXCLUDED.image_data_url, updated_at = NOW()
    `;
}

async function removeProfileCardImage(discordUserId) {
    const database = await getReadySql();
    await database`DELETE FROM ys_bot_profile_card_images WHERE discord_user_id = ${String(discordUserId)}`;
}

module.exports = { SUPPORTED_LANGUAGES, PROFILE_CARD_THEMES, getBotLanguage, setBotLanguage, getProfileCardTheme, setProfileCardTheme, getProfileCardImage, setProfileCardImage, removeProfileCardImage };
