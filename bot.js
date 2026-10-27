require('dotenv').config();

const { Client, GatewayIntentBits, AuditLogEvent, EmbedBuilder, SlashCommandBuilder, REST, Routes, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, Partials, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const { SUPPORTED_LANGUAGES, PROFILE_CARD_THEMES, getBotLanguage: getBotLanguageFromDb, getProfileCardTheme: getProfileCardThemeFromDb, getProfileCardImage: getProfileCardImageFromDb } = require('./services/user-preferences');
const { recordBotCommandUser: recordBotCommandUserInDb, getBotUserStats: getBotUserStatsFromDb } = require('./services/ip-ban-service');
const { DEFAULT_SETTINGS, getGuildSettings } = require('./services/guild-settings');
const { isPremiumOwnerActive } = require('./services/subscription-service');

const botMessages = {
    ar: {
        planTitle: '🛡️ حالة اشتراك YS-Bot',
        planDescription: (plan) => `الخطة الحالية لهذا السيرفر هي: **${plan}**`,
        planFooter: 'Yenson Security Services',
        upgradeRequired: '❌ هذه الخاصية متاحة فقط لمشتركي خطط **Basic** و **VIP** و **Premium**. يرجى الترقية من لوحة التحكم!',
        antiCrashEnabled: '✅ تم تفعيل نظام Anti-Crash بنجاح لهذا السيرفر!',
        dmOnly: '❌ هذا الأمر يمكن استخدامه فقط في الرسائل الخاصة مع البوت (DM) لحماية مفاتيحك السرية!'
    },
    en: {
        planTitle: '🛡️ YS-Bot subscription status',
        planDescription: (plan) => `This server is currently on the **${plan}** plan.`,
        planFooter: 'YS-Bot Services',
        upgradeRequired: '❌ This feature is available to **Basic**, **VIP**, and **Premium** subscribers. Please upgrade from the dashboard.',
        antiCrashEnabled: '✅ Anti-Crash has been enabled for this server!',
        dmOnly: '❌ This command can only be used in Direct Messages (DM) with the bot to protect your secret keys!'
    },
    fr: {
        planTitle: '🛡️ Abonnement YS-Bot', planDescription: (plan) => `Ce serveur utilise actuellement l’offre **${plan}**.`, planFooter: 'Services YS-Bot',
        upgradeRequired: '❌ Cette fonctionnalité est réservée aux abonnements **Basic**, **VIP** et **Premium**. Passez à une offre supérieure depuis le tableau de bord.',
        antiCrashEnabled: '✅ Anti-Crash est activé sur ce serveur !', dmOnly: '❌ Cette commande est disponible uniquement en message privé avec le bot pour protéger vos clés secrètes.'
    },
    es: {
        planTitle: '🛡️ Suscripción de YS-Bot', planDescription: (plan) => `Este servidor tiene actualmente el plan **${plan}**.`, planFooter: 'Servicios de YS-Bot',
        upgradeRequired: '❌ Esta función requiere un plan **Basic**, **VIP** o **Premium**. Actualízalo desde el panel de control.',
        antiCrashEnabled: '✅ Anti-Crash se activó en este servidor.', dmOnly: '❌ Usa este comando solo por mensaje directo con el bot para proteger tus claves secretas.'
    },
    de: {
        planTitle: '🛡️ YS-Bot-Abonnement', planDescription: (plan) => `Dieser Server nutzt derzeit den **${plan}**-Tarif.`, planFooter: 'YS-Bot-Dienste',
        upgradeRequired: '❌ Diese Funktion ist den Tarifen **Basic**, **VIP** und **Premium** vorbehalten. Upgrade über das Dashboard.',
        antiCrashEnabled: '✅ Anti-Crash wurde für diesen Server aktiviert.', dmOnly: '❌ Verwende diesen Befehl zum Schutz deiner geheimen Schlüssel nur per Direktnachricht mit dem Bot.'
    },
    pt: {
        planTitle: '🛡️ Assinatura YS-Bot', planDescription: (plan) => `Este servidor está no plano **${plan}**.`, planFooter: 'Serviços YS-Bot',
        upgradeRequired: '❌ Este recurso está disponível nos planos **Basic**, **VIP** e **Premium**. Faça upgrade pelo painel.',
        antiCrashEnabled: '✅ O Anti-Crash foi ativado neste servidor!', dmOnly: '❌ Use este comando apenas por mensagem direta com o bot para proteger suas chaves secretas.'
    },
    ko: {
        planTitle: '🛡️ YS-Bot 구독 상태', planDescription: (plan) => `이 서버의 현재 요금제는 **${plan}**입니다.`, planFooter: 'YS-Bot 서비스',
        upgradeRequired: '❌ 이 기능은 **Basic**, **VIP**, **Premium** 구독에서 사용할 수 있습니다. 대시보드에서 업그레이드하세요.',
        antiCrashEnabled: '✅ 이 서버에서 Anti-Crash가 활성화되었습니다!', dmOnly: '❌ 비밀 키 보호를 위해 봇과의 DM에서만 이 명령어를 사용할 수 있습니다.'
    },
    ja: {
        planTitle: '🛡️ YS-Bot のプラン状況', planDescription: (plan) => `このサーバーの現在のプランは **${plan}** です。`, planFooter: 'YS-Bot サービス',
        upgradeRequired: '❌ この機能は **Basic**、**VIP**、**Premium** プランで利用できます。ダッシュボードからアップグレードしてください。',
        antiCrashEnabled: '✅ このサーバーで Anti-Crash を有効にしました！', dmOnly: '❌ 秘密キーを保護するため、このコマンドはボットとのDMでのみ使用できます。'
    }
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Message, Partials.Channel, Partials.User]
});

const dbPath = './subscriptions.json';
const statePath = path.join(__dirname, 'bot-state.json');
let botState = {};
try { botState = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { botState = {}; }
let stateWriteTimer;
function saveBotState() {
    clearTimeout(stateWriteTimer);
    stateWriteTimer = setTimeout(() => {
        const temporaryPath = `${statePath}.tmp`;
        try {
            fs.writeFileSync(temporaryPath, JSON.stringify(botState), 'utf8');
            fs.renameSync(temporaryPath, statePath);
        } catch (error) {
            console.error('Could not persist bot state:', error.message);
        }
    }, 300);
}

function guildState(guildId) {
    if (!botState[guildId]) botState[guildId] = { warnings: {}, levels: {}, invites: {}, backups: {}, suggestionVotes: {}, religiousReminders: {} };
    const data = botState[guildId];
    data.warnings ||= {};
    data.levels ||= {};
    data.invites ||= {};
    data.backups ||= {};
    data.suggestionVotes ||= {};
    data.religiousReminders ||= {};
    return data;
}

async function sendGuildLog(guild, settings, text, color = 0x64748b) {
    const advanced = settings.advancedSettings || {};
    if (!advanced.modLogChannelId) return;
    const channel = await guild.channels.fetch(advanced.modLogChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const embed = new EmbedBuilder().setColor(color).setDescription(String(text).slice(0, 4000)).setTimestamp().setFooter({ text: 'YS-Audit' });
    await channel.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});
}

async function createProfileCard(user, member, stats, guildStats, language = 'ar', themeName = 'classic', customImageDataUrl = null) {
    const width = 1200;
    const height = 620;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    const themes = {
        classic:  { bg: ['#071421', '#101d31', '#102a35'], glow: '#21d4c2', grid: 'rgba(140,220,220,.08)', frame: 'rgba(7,17,31,.84)', border: 'rgba(140,180,205,.2)', header: '#75e2d3', muted: '#71839b', ring: '#38d6c4', name: '#f2f7fc', username: '#91a2b8', badge: '#142e3b', badgeText: '#7be5d8', tile: 'rgba(18,34,52,.94)', tileBorder: 'rgba(125,160,185,.2)', label: '#90a3ba', value: '#f5fbff', caption: '#62d8ca', soft: '#a8b6c8', footer: '#5dd9ca' },
        midnight: { bg: ['#09091b', '#17152d', '#252044'], glow: '#9b87ff', grid: 'rgba(185,170,255,.09)', frame: 'rgba(12,10,29,.88)', border: 'rgba(165,150,220,.24)', header: '#c0b4ff', muted: '#8f8ba9', ring: '#a18bff', name: '#f7f4ff', username: '#aaa3c5', badge: '#27213f', badgeText: '#c2b5ff', tile: 'rgba(31,27,52,.95)', tileBorder: 'rgba(163,145,220,.24)', label: '#aaa3c5', value: '#fbf9ff', caption: '#ab98ff', soft: '#bdb6d4', footer: '#b29fff' },
        ocean:    { bg: ['#061526', '#0b2c4a', '#07506a'], glow: '#24b9ee', grid: 'rgba(110,200,255,.09)', frame: 'rgba(4,20,37,.88)', border: 'rgba(100,190,230,.24)', header: '#7bdcff', muted: '#779ab4', ring: '#32c6f4', name: '#f1faff', username: '#95b6ca', badge: '#10364c', badgeText: '#86e2ff', tile: 'rgba(12,43,65,.95)', tileBorder: 'rgba(93,183,225,.24)', label: '#8fb4ca', value: '#f4fbff', caption: '#55cafa', soft: '#a8c7d8', footer: '#60d4ff' },
        cyber:    { bg: ['#080b19', '#111b32', '#102d42'], glow: '#00f0c8', grid: 'rgba(0,240,200,.1)', frame: 'rgba(6,13,29,.88)', border: 'rgba(0,220,210,.25)', header: '#00f0c8', muted: '#7898a8', ring: '#00f0c8', name: '#efffff', username: '#8db3be', badge: '#10373d', badgeText: '#5affdf', tile: 'rgba(11,35,48,.96)', tileBorder: 'rgba(0,220,200,.25)', label: '#8bb2bb', value: '#f1ffff', caption: '#00e2c1', soft: '#a5c4c8', footer: '#00efc5' },
        emerald:  { bg: ['#071810', '#10291f', '#164b35'], glow: '#35d783', grid: 'rgba(100,240,160,.08)', frame: 'rgba(7,22,16,.88)', border: 'rgba(110,205,145,.22)', header: '#8af0b4', muted: '#829d8b', ring: '#43df8b', name: '#f3fff6', username: '#a1b9a8', badge: '#193c2b', badgeText: '#98f2b8', tile: 'rgba(20,47,32,.95)', tileBorder: 'rgba(116,202,146,.23)', label: '#9eb9a5', value: '#f7fff8', caption: '#62e59a', soft: '#b3c8b8', footer: '#67e9a0' },
        sunset:   { bg: ['#21101d', '#422034', '#713a36'], glow: '#ff9c57', grid: 'rgba(255,180,120,.08)', frame: 'rgba(29,14,26,.88)', border: 'rgba(235,150,120,.23)', header: '#ffc18a', muted: '#aa8290', ring: '#ff9d65', name: '#fff7f1', username: '#c5a2a4', badge: '#4d2934', badgeText: '#ffc092', tile: 'rgba(62,32,42,.95)', tileBorder: 'rgba(230,148,117,.22)', label: '#c9a4a2', value: '#fffaf5', caption: '#ffa36d', soft: '#d3b4ae', footer: '#ffad73' },
        crimson:  { bg: ['#1b0a12', '#35131f', '#571b2b'], glow: '#ff4d70', grid: 'rgba(255,100,130,.08)', frame: 'rgba(24,8,15,.9)', border: 'rgba(225,90,120,.24)', header: '#ff8fa5', muted: '#a37b87', ring: '#ff5878', name: '#fff4f6', username: '#c19aa4', badge: '#49202e', badgeText: '#ff9bad', tile: 'rgba(55,24,35,.96)', tileBorder: 'rgba(220,92,120,.23)', label: '#c49da6', value: '#fff8f9', caption: '#ff6685', soft: '#d0adb5', footer: '#ff718c' },
        rose:     { bg: ['#1b101b', '#382039', '#59344e'], glow: '#f17dc2', grid: 'rgba(255,155,220,.08)', frame: 'rgba(24,13,26,.9)', border: 'rgba(220,140,195,.24)', header: '#ffa6d8', muted: '#a3889d', ring: '#f17dc2', name: '#fff5fc', username: '#c2a5bc', badge: '#45283f', badgeText: '#ffb0dc', tile: 'rgba(55,31,51,.96)', tileBorder: 'rgba(216,135,190,.23)', label: '#c1a3bb', value: '#fff9fd', caption: '#f58aca', soft: '#d2b8cd', footer: '#f894ce' },
        amethyst: { bg: ['#120d24', '#24183d', '#3c2760'], glow: '#b18cff', grid: 'rgba(190,150,255,.08)', frame: 'rgba(17,11,33,.9)', border: 'rgba(175,135,225,.24)', header: '#d0b1ff', muted: '#9585ad', ring: '#b48aff', name: '#faf5ff', username: '#b2a0c7', badge: '#34234e', badgeText: '#d2b4ff', tile: 'rgba(39,29,59,.96)', tileBorder: 'rgba(166,132,220,.24)', label: '#b2a0c4', value: '#fcf9ff', caption: '#bd95ff', soft: '#c3b3d5', footer: '#c39eff' },
        forest:   { bg: ['#0c1713', '#192820', '#2c4531'], glow: '#a4c96a', grid: 'rgba(185,220,130,.08)', frame: 'rgba(11,20,15,.9)', border: 'rgba(165,192,125,.22)', header: '#c1db8d', muted: '#929d82', ring: '#a4c96a', name: '#f8fff1', username: '#b0b99f', badge: '#303d27', badgeText: '#d0e99e', tile: 'rgba(36,48,31,.96)', tileBorder: 'rgba(166,190,125,.22)', label: '#b4bd9f', value: '#fbfff6', caption: '#b5d879', soft: '#c6ceb8', footer: '#c0df7d' },
        arctic:   { bg: ['#0b1a2b', '#16324a', '#28526b'], glow: '#80ddff', grid: 'rgba(150,225,255,.1)', frame: 'rgba(8,22,38,.88)', border: 'rgba(140,215,245,.25)', header: '#b5edff', muted: '#8ba9b9', ring: '#82e0ff', name: '#f2fbff', username: '#aac5d0', badge: '#1c4054', badgeText: '#b4efff', tile: 'rgba(24,55,73,.96)', tileBorder: 'rgba(137,211,239,.24)', label: '#aac8d4', value: '#f8fdff', caption: '#8ce1ff', soft: '#c0d7df', footer: '#8ce4ff' },
        slate:    { bg: ['#131923', '#262e3b', '#3b4654'], glow: '#aab8c7', grid: 'rgba(200,215,230,.08)', frame: 'rgba(16,21,30,.9)', border: 'rgba(175,190,205,.22)', header: '#d1dbe5', muted: '#909daa', ring: '#b1c1d1', name: '#f8fafc', username: '#b4bec9', badge: '#343e4b', badgeText: '#d3dee8', tile: 'rgba(42,51,63,.96)', tileBorder: 'rgba(170,186,202,.22)', label: '#bac4cf', value: '#ffffff', caption: '#bdcbd8', soft: '#c6ced6', footer: '#c5d2dd' }
    };
    const theme = themes[themeName] || themes.classic;
    const background = ctx.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, theme.bg[0]);
    background.addColorStop(0.55, theme.bg[1]);
    background.addColorStop(1, theme.bg[2]);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = theme.glow;
    ctx.beginPath(); ctx.arc(1110, 20, 250, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = theme.grid;
    for (let x = 30; x < width; x += 42) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 24; y < height; y += 42) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }

    ctx.save(); ctx.beginPath(); ctx.roundRect(30, 30, width - 60, height - 60, 34); ctx.clip();
    if (customImageDataUrl) {
        try {
            const customImage = await loadImage(customImageDataUrl);
            const scale = Math.max((width - 60) / customImage.width, (height - 60) / customImage.height);
            const imageWidth = customImage.width * scale, imageHeight = customImage.height * scale;
            ctx.drawImage(customImage, 30 + ((width - 60) - imageWidth) / 2, 30 + ((height - 60) - imageHeight) / 2, imageWidth, imageHeight);
            ctx.fillStyle = 'rgba(5,12,24,.58)'; ctx.fillRect(30, 30, width - 60, height - 60);
        } catch { ctx.fillStyle = theme.frame; ctx.fillRect(30, 30, width - 60, height - 60); }
    } else { ctx.fillStyle = theme.frame; ctx.fillRect(30, 30, width - 60, height - 60); }
    ctx.restore();
    ctx.beginPath(); ctx.roundRect(30, 30, width - 60, height - 60, 34);
    ctx.strokeStyle = theme.border; ctx.lineWidth = 2; ctx.stroke();

    const cardLabels = {
        ar: { header: 'YS-BOT  /  بطاقة العضو', member: 'عضو في السيرفر', level: 'المستوى', xp: 'الخبرة', rank: 'ترتيب السيرفر', commands: 'الأوامر', currentServer: 'السيرفر الحالي', totalXp: 'مجموع الخبرة', byExperience: 'حسب الخبرة', botCommands: 'أوامر البوت', accountAge: 'عمر الحساب', memberFor: 'عضو في السيرفر منذ', days: 'يوم' },
        en: { header: 'YS-BOT  /  MEMBER PROFILE', member: 'SERVER MEMBER', level: 'LEVEL', xp: 'EXPERIENCE', rank: 'SERVER RANK', commands: 'COMMANDS', currentServer: 'CURRENT SERVER', totalXp: 'TOTAL XP', byExperience: 'BY EXPERIENCE', botCommands: 'BOT COMMANDS', accountAge: 'ACCOUNT AGE', memberFor: 'SERVER MEMBER FOR', days: 'DAYS' },
        fr: { header: 'YS-BOT  /  PROFIL MEMBRE', member: 'MEMBRE DU SERVEUR', level: 'NIVEAU', xp: 'EXPÉRIENCE', rank: 'RANG SERVEUR', commands: 'COMMANDES', currentServer: 'SERVEUR ACTUEL', totalXp: 'XP TOTAL', byExperience: 'PAR EXPÉRIENCE', botCommands: 'COMMANDES DU BOT', accountAge: 'ÂGE DU COMPTE', memberFor: 'MEMBRE DEPUIS', days: 'JOURS' },
        es: { header: 'YS-BOT  /  PERFIL DE MIEMBRO', member: 'MIEMBRO DEL SERVIDOR', level: 'NIVEL', xp: 'EXPERIENCIA', rank: 'RANGO DEL SERVIDOR', commands: 'COMANDOS', currentServer: 'SERVIDOR ACTUAL', totalXp: 'XP TOTAL', byExperience: 'POR EXPERIENCIA', botCommands: 'COMANDOS DEL BOT', accountAge: 'EDAD DE CUENTA', memberFor: 'MIEMBRO DESDE', days: 'DÍAS' },
        de: { header: 'YS-BOT  /  MITGLIEDSPROFIL', member: 'SERVER-MITGLIED', level: 'LEVEL', xp: 'ERFAHRUNG', rank: 'SERVER-RANG', commands: 'BEFEHLE', currentServer: 'AKTUELLER SERVER', totalXp: 'GESAMT-XP', byExperience: 'NACH ERFAHRUNG', botCommands: 'BOT-BEFEHLE', accountAge: 'KONTOALTER', memberFor: 'MITGLIED SEIT', days: 'TAGE' },
        pt: { header: 'YS-BOT  /  PERFIL DO MEMBRO', member: 'MEMBRO DO SERVIDOR', level: 'NÍVEL', xp: 'EXPERIÊNCIA', rank: 'RANK DO SERVIDOR', commands: 'COMANDOS', currentServer: 'SERVIDOR ATUAL', totalXp: 'XP TOTAL', byExperience: 'POR EXPERIÊNCIA', botCommands: 'COMANDOS DO BOT', accountAge: 'IDADE DA CONTA', memberFor: 'MEMBRO HÁ', days: 'DIAS' },
        ko: { header: 'YS-BOT  /  멤버 프로필', member: '서버 멤버', level: '레벨', xp: '경험치', rank: '서버 순위', commands: '명령어', currentServer: '현재 서버', totalXp: '총 경험치', byExperience: '경험치 기준', botCommands: '봇 명령어', accountAge: '계정 생성 후', memberFor: '서버 가입 후', days: '일' },
        ja: { header: 'YS-BOT  /  メンバープロフィール', member: 'サーバーメンバー', level: 'レベル', xp: '経験値', rank: 'サーバー順位', commands: 'コマンド', currentServer: '現在のサーバー', totalXp: '合計XP', byExperience: '経験値順', botCommands: 'ボットコマンド', accountAge: 'アカウント作成から', memberFor: 'サーバー参加から', days: '日' }
    };
    const labels = cardLabels[language] || cardLabels.ar;
    const numberLocale = { ar: 'ar', en: 'en-US', fr: 'fr-FR', es: 'es-ES', de: 'de-DE', pt: 'pt-PT', ko: 'ko-KR', ja: 'ja-JP' }[language] || 'en-US';
    ctx.fillStyle = theme.header; ctx.font = '700 21px Arial';
    ctx.fillText(labels.header, 76, 88);
    ctx.textAlign = 'right'; ctx.fillStyle = theme.muted; ctx.font = '600 17px Arial';
    ctx.fillText(String(member.guild.name || 'DISCORD SERVER').toUpperCase().slice(0, 35), width - 76, 88);
    ctx.textAlign = 'left';

    const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));
    ctx.save(); ctx.beginPath(); ctx.arc(160, 220, 83, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(avatar, 77, 137, 166, 166); ctx.restore();
    ctx.beginPath(); ctx.arc(160, 220, 89, 0, Math.PI * 2);
    ctx.strokeStyle = theme.ring; ctx.lineWidth = 5; ctx.stroke();

    const displayName = String(member.displayName || user.globalName || user.username);
    ctx.fillStyle = theme.name; ctx.font = '700 46px Arial';
    ctx.fillText(displayName.slice(0, 24), 285, 190, 720);
    ctx.fillStyle = theme.username; ctx.font = '500 25px Arial';
    ctx.fillText(`@${String(user.username).slice(0, 30)}`, 288, 234, 700);
    ctx.beginPath(); ctx.roundRect(286, 258, 190, 42, 18); ctx.fillStyle = theme.badge; ctx.fill();
    ctx.fillStyle = theme.badgeText; ctx.font = '700 16px Arial'; ctx.fillText(labels.member, 307, 285);

    const tiles = [
        [labels.level, guildStats.level, labels.currentServer],
        [labels.xp, guildStats.xp.toLocaleString(numberLocale), labels.totalXp],
        [labels.rank, guildStats.rank, labels.byExperience],
        [labels.commands, Number(stats.commandCount || 0).toLocaleString(numberLocale), labels.botCommands]
    ];
    const tileWidth = 246, gap = 20, startX = 76, y = 350;
    tiles.forEach(([label, value, caption], index) => {
        const x = startX + index * (tileWidth + gap);
        ctx.beginPath(); ctx.roundRect(x, y, tileWidth, 144, 20);
        ctx.fillStyle = theme.tile; ctx.fill();
        ctx.strokeStyle = theme.tileBorder; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = theme.label; ctx.font = '700 15px Arial'; ctx.fillText(label, x + 20, y + 32);
        ctx.fillStyle = theme.value; ctx.font = '700 36px Arial'; ctx.fillText(String(value), x + 20, y + 83, tileWidth - 40);
        ctx.fillStyle = theme.caption; ctx.font = '600 13px Arial'; ctx.fillText(caption, x + 20, y + 119);
    });

    const accountDays = Math.max(0, Math.floor((Date.now() - user.createdTimestamp) / 86400000));
    const memberDays = member.joinedTimestamp ? Math.max(0, Math.floor((Date.now() - member.joinedTimestamp) / 86400000)) : 0;
    ctx.fillStyle = theme.soft; ctx.font = '500 16px Arial';
    ctx.fillText(`${labels.accountAge}  ${accountDays} ${labels.days}`, 78, 548);
    ctx.fillText(`${labels.memberFor}  ${memberDays} ${labels.days}`, 420, 548);
    ctx.textAlign = 'right'; ctx.fillStyle = theme.footer; ctx.font = '700 17px Arial';
    ctx.fillText(labels.footer, width - 78, 548);
    return canvas.toBuffer('image/png');
}

async function showUserProfile(interaction) {
    if (!interaction.guild) return interaction.reply({ content: 'استخدم الأمر داخل السيرفر لعرض إحصاءات العضو فيه.', ephemeral: true });
    await interaction.deferReply();
    const settings = await loadGuildSettings(interaction.guild.id);
    let language = 'ar';
    try { language = await getBotLanguage(interaction.user.id, 'ar'); } catch {}
    const profileText = {
        ar: { missing: 'هذا المستخدم ليس عضوًا في السيرفر الحالي.', disabled: 'غير مفعّل', title: (name) => `إحصاءات ${name}`, description: (server) => `بطاقة العضو في **${server}**`, footer: 'YS-Bot • إحصاءات العضو' },
        en: { missing: 'This user is not a member of this server.', disabled: 'OFF', title: (name) => `${name}'s profile`, description: (server) => `Member card for **${server}**`, footer: 'YS-Bot • Member statistics' },
        fr: { missing: 'Cet utilisateur ne fait pas partie de ce serveur.', disabled: 'DÉSACTIVÉ', title: (name) => `Profil de ${name}`, description: (server) => `Carte du membre sur **${server}**`, footer: 'YS-Bot • Statistiques du membre' },
        es: { missing: 'Este usuario no es miembro de este servidor.', disabled: 'DESACTIVADO', title: (name) => `Perfil de ${name}`, description: (server) => `Tarjeta del miembro en **${server}**`, footer: 'YS-Bot • Estadísticas del miembro' },
        de: { missing: 'Dieser Nutzer ist kein Mitglied dieses Servers.', disabled: 'AUS', title: (name) => `Profil von ${name}`, description: (server) => `Mitgliederkarte für **${server}**`, footer: 'YS-Bot • Mitgliederstatistik' },
        pt: { missing: 'Este usuário não é membro deste servidor.', disabled: 'DESATIVADO', title: (name) => `Perfil de ${name}`, description: (server) => `Cartão do membro em **${server}**`, footer: 'YS-Bot • Estatísticas do membro' },
        ko: { missing: '이 사용자는 현재 서버의 멤버가 아닙니다.', disabled: '사용 안 함', title: (name) => `${name}님의 프로필`, description: (server) => `**${server}** 서버 멤버 카드`, footer: 'YS-Bot • 멤버 통계' },
        ja: { missing: 'このユーザーは現在のサーバーのメンバーではありません。', disabled: '無効', title: (name) => `${name} のプロフィール`, description: (server) => `**${server}** のメンバーカード`, footer: 'YS-Bot • メンバー統計' }
    }[language] || {
        missing: 'This user is not a member of this server.', disabled: 'OFF', title: (name) => `${name}'s profile`,
        description: (server) => `Member card for **${server}**`, footer: 'YS-Bot • Member statistics'
    };
    const user = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member) return interaction.editReply({ content: profileText.missing });

    const data = guildState(interaction.guild.id);
    const levelEntries = Object.entries(data.levels || {}).sort((a, b) => Number(b[1]?.xp || 0) - Number(a[1]?.xp || 0));
    const userLevel = data.levels?.[user.id] || { xp: 0 };
    const xp = Math.max(0, Number(userLevel.xp || 0));
    const level = Math.floor(Math.sqrt(xp / 100));
    const rankIndex = levelEntries.findIndex(([userId]) => userId === user.id);
    const rank = rankIndex >= 0 ? `#${rankIndex + 1}` : '—';
    let stats = { commandCount: 0 };
    try { stats = await getBotUserStats(user.id); } catch (error) {
        if (!userTrackingWarningShown) {
            console.error('User profile command statistics unavailable.');
            userTrackingWarningShown = true;
        }
    }

    const levelingEnabled = Boolean(settings.advancedSettings?.levelSystemEnabled);
    const profileTheme = await getBotProfileCardTheme(user.id);
    let customProfileImage = null;
    try { customProfileImage = await getBotProfileCardImage(user.id); } catch { /* Continue with the selected theme if the image service is temporarily unavailable. */ }
    const card = await createProfileCard(user, member, stats, {
        level: levelingEnabled ? level : profileText.disabled,
        xp: levelingEnabled ? xp : 0,
        rank: levelingEnabled ? rank : '—'
    }, language, profileTheme || 'classic', customProfileImage);
    const attachment = new AttachmentBuilder(card, { name: 'ys-member-profile.png' });
    const embed = new EmbedBuilder()
        .setColor(0x27c8b7)
        .setTitle(profileText.title(member.displayName))
        .setDescription(profileText.description(interaction.guild.name))
        .setImage('attachment://ys-member-profile.png')
        .setFooter({ text: profileText.footer })
        .setTimestamp();
    return interaction.editReply({ embeds: [embed], files: [attachment], allowedMentions: { parse: [] } });
}

async function postWarning(message, settings, content, action = 'delete') {
    if (action === 'delete' && message.deletable) await message.delete().catch(() => {});
    const notice = await message.channel.send({ content: `⚠️ ${message.author} ${content}`, allowedMentions: { users: [message.author.id] } }).catch(() => null);
    if (notice) setTimeout(() => notice.delete().catch(() => {}), 7000);
    if (settings.advancedSettings?.logModerationActions) {
        await sendGuildLog(message.guild, settings, `أزيلت/حُذّرت رسالة من <@${message.author.id}> في <#${message.channel.id}>: ${content}`, 0xf59e0b);
    }
}

function formatMemberText(template, member) {
    return String(template || '')
        .replaceAll('{user}', member.user.username)
        .replaceAll('{mention}', `${member}`)
        .replaceAll('{server}', member.guild.name)
        .replaceAll('{memberCount}', String(member.guild.memberCount));
}

const inviteSnapshots = new Map();
const memberJoinTimes = new Map();
const raidTriggeredAt = new Map();
const antiNukeEventTimes = new Map();
const antiNukeTriggeredAt = new Map();
const textCooldowns = new Map();
const duplicateMessages = new Map();
const channelSlowmodeOriginals = new Map();
const verificationTimers = new Map();

async function getSubscription(guildId) {
    if (process.env.BOT_API_SECRET) {
        const baseUrl = (process.env.BOT_API_URL || 'https://ys-bot.vercel.app').replace(/\/$/, '');
        try {
            const response = await fetch(`${baseUrl}/api/internal/bot/subscriptions/${encodeURIComponent(guildId)}`, {
                headers: { authorization: `Bearer ${process.env.BOT_API_SECRET}` },
                cache: 'no-store',
                signal: AbortSignal.timeout(8000)
            });
            if (!response.ok) return 'Free';
            const subscription = await response.json();
            return subscription.active && ['Basic', 'VIP', 'Premium'].includes(subscription.plan) ? subscription.plan : 'Free';
        } catch (error) {
            console.error('Cloud subscription lookup failed; using Free plan:', error.message);
            return 'Free';
        }
    }
    if (!fs.existsSync(dbPath)) return 'Free';
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    return data[guildId] ? data[guildId].plan : 'Free';
}

function buildProtectionStatusEmbed(guildSettings, language = 'ar') {
    const english = language === 'en';
    const advanced = guildSettings?.advancedSettings || {};
    const states = english ? [
        `Anti-spam: ${guildSettings?.antiSpam ? 'On' : 'Off'}`,
        `Link protection: ${guildSettings?.antiLinks ? 'On' : 'Off'}`,
        `Anti-raid: ${advanced.antiRaidEnabled ? 'On' : 'Off'}`,
        `Anti-nuke: ${advanced.antiNukeEnabled ? 'On' : 'Off'}`
    ] : [
        `مكافحة السبام: ${guildSettings?.antiSpam ? 'مفعّلة' : 'متوقفة'}`,
        `حماية الروابط: ${guildSettings?.antiLinks ? 'مفعّلة' : 'متوقفة'}`,
        `حماية الغارات: ${advanced.antiRaidEnabled ? 'مفعّلة' : 'متوقفة'}`,
        `حماية التخريب: ${advanced.antiNukeEnabled ? 'مفعّلة' : 'متوقفة'}`
    ];
    return new EmbedBuilder().setColor(0x35cdb7)
        .setTitle(english ? 'Server protection status' : 'حالة أنظمة الحماية')
        .setDescription(`${states.join('\n')}\n\n${english ? 'To change these settings, use the server dashboard.' : 'لتغييرها، افتح إعدادات السيرفر في لوحة التحكم.'}`)
        .setFooter({ text: 'YS-Bot' });
}

// تسجيل أوامر السلاش أوتوماتيكياً فور تشغيل البوت
client.on('ready', async () => {
    console.log(`🤖 YS-Bot جاهز ويعمل باسم: ${client.user.tag}`);

    const commands = [
        new SlashCommandBuilder()
            .setName('add-2fa')
            .setDescription('إضافة مفتاح مصادقة ثنائية جديد (خاص فقط)')
            .addStringOption(option => 
                option.setName('site_name')
                    .setDescription('اسم الموقع (مثال: Google, Discord)')
                    .setRequired(true))
            .addStringOption(option => 
                option.setName('secret_key')
                    .setDescription('المفتاح السري النصي من خطوتين الحساب')
                    .setRequired(true)),
                    
        new SlashCommandBuilder()
            .setName('get-2fa')
            .setDescription('جلب وتوليد أكواد التحقق الستة الحالية لحساباتك (خاص فقط)'),
        new SlashCommandBuilder()
            .setName('ticket')
            .setDescription('فتح تذكرة خاصة مع فريق الدعم')
            .addStringOption(option => option.setName('reason').setDescription('سبب فتح التذكرة').setMaxLength(1000)),
        new SlashCommandBuilder()
            .setName('suggest')
            .setDescription('إرسال اقتراح للسيرفر')
            .addStringOption(option => option.setName('text').setDescription('اكتب اقتراحك').setMaxLength(1000).setRequired(true)),
        new SlashCommandBuilder()
            .setName('poll')
            .setDescription('إنشاء تصويت بسيط')
            .addStringOption(option => option.setName('question').setDescription('سؤال التصويت').setMaxLength(250).setRequired(true)),
        new SlashCommandBuilder()
            .setName('warn')
            .setDescription('تسجيل تحذير لعضو')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
            .addUserOption(option => option.setName('member').setDescription('العضو').setRequired(true))
            .addStringOption(option => option.setName('reason').setDescription('سبب التحذير').setMaxLength(300)),
        new SlashCommandBuilder()
            .setName('verify')
            .setDescription('تأكيد التحقق من حسابك'),
        new SlashCommandBuilder()
            .setName('support')
            .setDescription('عرض قناة الدعم لهذا السيرفر'),
        new SlashCommandBuilder()
            .setName('invites')
            .setDescription('عرض عدد الدعوات المسجلة لك')
            .addUserOption(option => option.setName('member').setDescription('عضو آخر (للمشرفين فقط)')),
        new SlashCommandBuilder()
            .setName('profile')
            .setDescription('عرض بطاقة إحصاءاتك أو إحصاءات عضو')
            .addUserOption(option => option.setName('user').setDescription('اختر عضوًا لعرض إحصاءاته')),
        new SlashCommandBuilder()
            .setName('embed')
            .setDescription('إرسال الإمبيد المخصص من إعدادات لوحة التحكم')
            .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
        new SlashCommandBuilder()
            .setName('help')
            .setDescription('عرض أوامر YS-Bot المتاحة'),
        new SlashCommandBuilder()
            .setName('plan')
            .setDescription('عرض خطة اشتراك هذا السيرفر'),
        new SlashCommandBuilder()
            .setName('anticrash')
            .setDescription('عرض حالة أنظمة الحماية لهذا السيرفر')
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('جاري تسجيل أوامر السلاش...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ تم تسجيل أوامر السلاش بنجاح على مستوى العالم!');
    } catch (error) {
        console.error('حدث خطأ أثناء تسجيل الأوامر:', error);
    }
    await syncTicketPanels();
    await initializeInviteSnapshots();
    setInterval(() => syncTicketPanels().catch((error) => console.error('Ticket panel sync failed:', error.message)), 60000);
    setInterval(() => runGuildAutomations().catch((error) => console.error('Guild automation failed:', error.message)), 60000);
    setInterval(() => processEmbedQueue().catch((error) => console.error('Embed queue processing failed:', error.message)), 4000);
    processEmbedQueue().catch((error) => console.error('Embed queue processing failed:', error.message));
    setInterval(() => processServerTasks().catch((error) => console.error('Server backup processing failed:', error.message)), 5000);
    processServerTasks().catch((error) => console.error('Server backup processing failed:', error.message));
});

client.on('guildCreate', async (guild) => {
    try {
        const owner = await guild.fetchOwner().catch(() => null);
        if (!owner) {
            console.warn(`Could not find owner for newly joined guild ${guild.id}.`);
            return;
        }
        const welcomeMessage = [
            '<:image:1564474128784691200> Thanks for adding YS-Bot!',
            '<:image:1564469759981133865> Welcome to the YS-Bot security system!',
            'Thank you for choosing YS-Bot to help protect your Discord server.',
            '🚀 **Getting Started**',
            '',
            '- 1 <:image:1564470161430544547> Configure your server\'s protection settings.',
            '- 2 <:image:1564471000190554174> Review the available security features.',
            '- 3 <:image:1564473668292321391> Check the bot\'s permissions to ensure everything works correctly.',
            '',
            '- 4 <:image:1564472130698084432> Need help? Visit our website',
            '- 5 <:image:1564472473687167096> https://ys-bot.vercel.app/',
            '- 6 <:image:1564470641598668810> Thanks for trusting YS-Bot!',
            'Stay safe. Stay protected. <:image:1564469759981133865>'
        ].join('\n');
        await owner.send({ content: welcomeMessage, allowedMentions: { parse: [] } });
        console.log(`Sent welcome DM to the owner of guild ${guild.id}.`);
    } catch (error) {
        console.warn(`Could not send welcome DM for guild ${guild.id}: ${error.message}`);
    }
});

let preferenceWarningShown = false;
let userTrackingWarningShown = false;
let guildSettingsWarningShown = false;
let guildSettingsBridgeConnected = false;
const guildSettingsCache = new Map();
const recentMessages = new Map();
const autoReplyCooldowns = new Map();
const spamNoticeTimes = new Map();
const linkNoticeTimes = new Map();

async function loadGuildSettings(guildId) {
    const cached = guildSettingsCache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) return cached.settings;
    try {
        let settings;
        if (process.env.BOT_API_SECRET) {
            const baseUrl = (process.env.BOT_API_URL || 'https://ys-bot.vercel.app').replace(/\/$/, '');
            const response = await fetch(`${baseUrl}/api/internal/bot/guild-settings/${encodeURIComponent(guildId)}`, {
                headers: { authorization: `Bearer ${process.env.BOT_API_SECRET}` },
                signal: AbortSignal.timeout(8000)
            });
            if (!response.ok) throw new Error(`Settings API returned ${response.status}`);
            settings = await response.json();
            if (!guildSettingsBridgeConnected) {
                console.log('Website settings bridge connected.');
                guildSettingsBridgeConnected = true;
            }
        } else {
            settings = await getGuildSettings(guildId);
        }
        guildSettingsCache.set(guildId, { settings, expiresAt: Date.now() + 5000 });
        return settings;
    } catch (error) {
        if (!guildSettingsWarningShown) {
            console.error('Server settings unavailable; using safe defaults:', error.message);
            guildSettingsWarningShown = true;
        }
        const settings = { ...DEFAULT_SETTINGS };
        guildSettingsCache.set(guildId, { settings, expiresAt: Date.now() + 5000 });
        return settings;
    }
}

async function botBridgeRequest(route, options = {}) {
    const baseUrl = (process.env.BOT_API_URL || 'https://ys-bot.vercel.app').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}${route}`, {
        ...options,
        headers: {
            authorization: `Bearer ${process.env.BOT_API_SECRET || ''}`,
            ...(options.body ? { 'content-type': 'application/json' } : {}),
            ...options.headers
        },
        signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`Bot bridge returned ${response.status}`);
    return response;
}

async function getBotLanguage(userId, fallback = 'ar') {
    if (!process.env.BOT_API_SECRET) return getBotLanguageFromDb(userId, fallback);
    const response = await botBridgeRequest(`/api/internal/bot/user-language/${encodeURIComponent(userId)}`);
    const result = await response.json();
    return SUPPORTED_LANGUAGES.has(result.language) ? result.language : fallback;
}

async function getBotProfileCardTheme(userId) {
    if (!process.env.BOT_API_SECRET) return getProfileCardThemeFromDb(userId);
    const response = await botBridgeRequest(`/api/internal/bot/user-profile-theme/${encodeURIComponent(userId)}`);
    const result = await response.json();
    return PROFILE_CARD_THEMES.has(result.profileCardTheme) ? result.profileCardTheme : null;
}

async function getBotProfileCardImage(userId) {
    if (!process.env.BOT_API_SECRET) return await isPremiumOwnerActive(userId) ? getProfileCardImageFromDb(userId) : null;
    const response = await botBridgeRequest(`/api/internal/bot/user-profile-image/${encodeURIComponent(userId)}`);
    const result = await response.json();
    return typeof result.imageDataUrl === 'string' ? result.imageDataUrl : null;
}

async function getBotUserStats(userId) {
    if (!process.env.BOT_API_SECRET) return getBotUserStatsFromDb(userId);
    const response = await botBridgeRequest(`/api/internal/bot/user-stats/${encodeURIComponent(userId)}`);
    return response.json();
}

async function recordBotCommandUser(user, guildId) {
    if (!process.env.BOT_API_SECRET) return recordBotCommandUserInDb(user, guildId);
    await botBridgeRequest('/api/internal/bot/user-command', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, username: user.username, guildId })
    });
}

const COLOR_VALUES = { teal: 0x18b6a0, blue: 0x5865f2, purple: 0x8b5cf6, green: 0x22c55e, red: 0xef4444, gold: 0xf59e0b };
const BUTTON_STYLES = { primary: ButtonStyle.Primary, secondary: ButtonStyle.Secondary, success: ButtonStyle.Success, danger: ButtonStyle.Danger };
function safeImageUrl(value) { try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : null; } catch { return null; } }

function buildConfiguredEmbeds(advanced) {
    let definitions = [];
    try {
        const parsed = JSON.parse(String(advanced.customEmbedsJson || '[]'));
        if (Array.isArray(parsed)) definitions = parsed.slice(0, 10);
    } catch {}
    if (!definitions.length) definitions = [{
        title: advanced.customEmbedTitle,
        description: advanced.customEmbedDescription,
        thumbnail: advanced.customEmbedThumbnailUrl,
        image: advanced.customEmbedImageUrl,
        color: advanced.customEmbedColor
    }];
    return definitions.map((definition) => {
        const title = String(definition?.title || '').trim().slice(0, 256);
        const description = String(definition?.description || '').trim().slice(0, 4000);
        if (!title && !description) return null;
        const rawColor = String(definition?.color || '#5865f2');
        const color = /^#[\da-f]{6}$/i.test(rawColor) ? Number.parseInt(rawColor.slice(1), 16) : 0x5865f2;
        const embed = new EmbedBuilder().setColor(color);
        if (title) embed.setTitle(title);
        if (description) embed.setDescription(description);
        const thumbnail = safeImageUrl(definition?.thumbnail);
        const image = safeImageUrl(definition?.image);
        if (thumbnail) embed.setThumbnail(thumbnail);
        if (image) embed.setImage(image);
        return { embed, channelId: String(definition?.channelId || advanced.customEmbedChannelId || '').trim() };
    }).filter(Boolean);
}

async function sendConfiguredEmbed(interaction) {
    if (!interaction.guild) return interaction.reply({ content: 'استخدم الأمر داخل السيرفر.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.editReply('تحتاج صلاحية إدارة السيرفر لإرسال الإمبيد.');
    }
    const settings = await loadGuildSettings(interaction.guild.id);
    const advanced = settings.advancedSettings || {};
    const configuredEmbeds = buildConfiguredEmbeds(advanced);
    if (!configuredEmbeds.length) return interaction.editReply('اكتب عنوانًا أو رسالة في قسم «إدارة الإمبيدات» بلوحة التحكم ثم احفظ.');
    const destinations = [];
    for (let index = 0; index < configuredEmbeds.length; index++) {
        const channelId = configuredEmbeds[index].channelId;
        if (!/^\d{17,20}$/.test(channelId)) return interaction.editReply(`معرّف الروم غير صحيح للإمبيد رقم ${index + 1}.`);
        const destination = await interaction.guild.channels.fetch(channelId).catch(() => null);
        if (!destination?.isTextBased() || !destination.send) return interaction.editReply(`الروم المحدد للإمبيد رقم ${index + 1} غير صالح أو لا يستطيع البوت الكتابة فيه.`);
        destinations.push(destination);
    }

    try {
        for (let index = 0; index < configuredEmbeds.length; index++) await destinations[index].send({ embeds: [configuredEmbeds[index].embed], allowedMentions: { parse: [] } });
        return interaction.editReply(`تم إرسال ${configuredEmbeds.length} إمبيد إلى الرومات المحددة.`);
    } catch (error) {
        console.error('Could not send configured embed:', error.message);
        return interaction.editReply('تعذر إرسال الإمبيد. تأكد أن البوت يستطيع عرض القناة وإرسال الرسائل فيها.');
    }
}

async function publishConfiguredEmbed(guildId) {
    const guild = client.guilds.cache.get(String(guildId)) || await client.guilds.fetch(String(guildId)).catch(() => null);
    if (!guild) throw new Error('البوت غير موجود في السيرفر أو يحتاج إعادة إضافته.');
    guildSettingsCache.delete(String(guildId));
    const settings = await loadGuildSettings(guild.id);
    const advanced = settings.advancedSettings || {};
    const configuredEmbeds = buildConfiguredEmbeds(advanced);
    if (!configuredEmbeds.length) throw new Error('أضف عنوانًا أو رسالة واحدة على الأقل في قسم إدارة الإمبيدات.');
    const destinations = [];
    for (let index = 0; index < configuredEmbeds.length; index++) {
        const channelId = configuredEmbeds[index].channelId;
        if (!/^\d{17,20}$/.test(channelId)) throw new Error(`معرّف الروم غير صحيح للإمبيد رقم ${index + 1}.`);
        const destination = await guild.channels.fetch(channelId).catch(() => null);
        if (!destination?.isTextBased() || !destination.send) throw new Error(`الروم المحدد للإمبيد رقم ${index + 1} غير صالح أو لا يستطيع البوت الكتابة فيه.`);
        destinations.push(destination);
    }
    for (let index = 0; index < configuredEmbeds.length; index++) await destinations[index].send({ embeds: [configuredEmbeds[index].embed], allowedMentions: { parse: [] } });
    return `تم إرسال ${configuredEmbeds.length} إمبيد إلى الرومات المحددة.`;
}

let processingEmbedQueue = false;
let embedQueueWarningShown = false;
async function processEmbedQueue() {
    if (processingEmbedQueue || !process.env.BOT_API_SECRET) return;
    processingEmbedQueue = true;
    try {
        const response = await botBridgeRequest('/api/internal/bot/embed-queue');
        const { requests = [] } = await response.json();
        for (const request of requests) {
            let status = 'sent';
            let result;
            try {
                result = await publishConfiguredEmbed(request.guildId);
            } catch (error) {
                status = 'failed';
                result = error.message || 'تعذر إرسال الإمبيد.';
                console.error(`Embed send failed for guild ${request.guildId}:`, result);
            }
            await botBridgeRequest(`/api/internal/bot/embed-queue/${encodeURIComponent(request.id)}/complete`, {
                method: 'POST', body: JSON.stringify({ status, result })
            });
        }
        embedQueueWarningShown = false;
    } catch (error) {
        if (!embedQueueWarningShown) {
            console.error('Embed queue bridge unavailable:', error.message);
            embedQueueWarningShown = true;
        }
    } finally {
        processingEmbedQueue = false;
    }
}

async function updateServerTaskProgress(task, progress, message) {
    await botBridgeRequest(`/api/internal/bot/server-tasks/${encodeURIComponent(task.id)}/progress`, {
        method: 'POST', body: JSON.stringify({ progress, message })
    });
}

async function collectServerSnapshot(task, guild) {
    const settings = await loadGuildSettings(guild.id);
    const roles = [...guild.roles.cache.values()]
        .filter((role) => !role.managed && role.id !== guild.id)
        .sort((a, b) => a.position - b.position)
        .map((role) => ({ id: role.id, name: role.name, color: role.color, hoist: role.hoist, mentionable: role.mentionable, permissions: role.permissions.bitfield.toString(), position: role.position }));
    await updateServerTaskProgress(task, 35, `تمت قراءة ${roles.length} رتبة. جارٍ جمع القنوات والصلاحيات...`);
    const channelsCollection = await guild.channels.fetch();
    const supportedTypes = new Set([ChannelType.GuildCategory, ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice, ChannelType.GuildStageVoice, ChannelType.GuildForum]);
    const channels = [...channelsCollection.values()]
        .filter((channel) => supportedTypes.has(channel.type))
        .sort((a, b) => (a.type === ChannelType.GuildCategory ? -1 : 0) - (b.type === ChannelType.GuildCategory ? -1 : 0) || a.position - b.position)
        .map((channel) => ({
            id: channel.id, name: channel.name, type: channel.type, position: channel.position,
            parentId: channel.parentId || null, topic: channel.topic || null, nsfw: Boolean(channel.nsfw),
            rateLimitPerUser: Number(channel.rateLimitPerUser || 0), bitrate: channel.bitrate || null, userLimit: channel.userLimit || 0,
            permissionOverwrites: channel.permissionOverwrites.cache.map((overwrite) => ({
                id: overwrite.id, type: overwrite.type, allow: overwrite.allow.bitfield.toString(), deny: overwrite.deny.bitfield.toString()
            }))
        }));
    await updateServerTaskProgress(task, 75, `تم جمع ${channels.length} قناة. جارٍ حفظ إعدادات البوت...`);
    const snapshot = {
        version: 1, guildId: guild.id, guildName: guild.name, createdAt: new Date().toISOString(),
        roles, channels,
        settings: { commandPrefix: settings.commandPrefix, antiSpam: settings.antiSpam, antiLinks: settings.antiLinks, advancedSettings: settings.advancedSettings, updatedBy: task.requestedBy }
    };
    const size = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
    if (size > 2_500_000) throw new Error('حجم نسخة السيرفر تجاوز الحد الآمن للتخزين.');
    return snapshot;
}

function restoredPermissionOverwrites(overwrites, guild, roleMap) {
    return (overwrites || []).flatMap((overwrite) => {
        let id = overwrite.id;
        if (id === guild.id) id = guild.roles.everyone.id;
        else if (overwrite.type === 0 || roleMap.has(id)) id = roleMap.get(id) || (guild.roles.cache.has(id) ? id : null);
        else if (!guild.members.cache.has(id)) id = null;
        if (!id) return [];
        return [{ id, type: overwrite.type, allow: BigInt(overwrite.allow || 0), deny: BigInt(overwrite.deny || 0) }];
    });
}

async function restoreServerSnapshot(task, guild, snapshot) {
    if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.roles) || !Array.isArray(snapshot.channels)) throw new Error('ملف النسخة غير صالح أو غير مدعوم.');
    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    if (!me?.permissions.has(PermissionFlagsBits.ManageRoles) || !me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        throw new Error('يحتاج البوت صلاحيتَي إدارة الرتب وإدارة القنوات لاسترجاع هيكل السيرفر.');
    }
    const blockedRoles = snapshot.roles
        .map((roleData) => guild.roles.cache.get(roleData.id) || guild.roles.cache.find((role) => !role.managed && role.name === roleData.name))
        .filter((role) => role && !role.editable);
    if (blockedRoles.length) throw new Error(`ارفع رتبة البوت أعلى من الرتب التالية ثم أعد المحاولة: ${blockedRoles.slice(0, 4).map((role) => role.name).join('، ')}`);
    const roleMap = new Map([[guild.id, guild.roles.everyone.id]]);
    await updateServerTaskProgress(task, 5, 'جارٍ مطابقة الرتب وإنشاء الرتب المفقودة...');
    for (let index = 0; index < snapshot.roles.length; index += 1) {
        const roleData = snapshot.roles[index];
        let role = guild.roles.cache.get(roleData.id) || guild.roles.cache.find((entry) => !entry.managed && entry.name === roleData.name);
        if (!role) {
            role = await guild.roles.create({
                name: String(roleData.name || 'رتبة مستعادة').slice(0, 100),
                color: Number(roleData.color) || 0,
                hoist: Boolean(roleData.hoist),
                mentionable: Boolean(roleData.mentionable),
                permissions: BigInt(roleData.permissions || 0),
                reason: `YS-Bot server restore task ${task.id}`
            });
        } else {
            await role.edit({
                name: String(roleData.name || role.name).slice(0, 100),
                color: Number(roleData.color) || 0,
                hoist: Boolean(roleData.hoist),
                mentionable: Boolean(roleData.mentionable),
                permissions: BigInt(roleData.permissions || 0),
                reason: `YS-Bot server restore task ${task.id}`
            });
        }
        roleMap.set(roleData.id, role.id);
        if (index % 5 === 0) await updateServerTaskProgress(task, 5 + Math.round(((index + 1) / Math.max(snapshot.roles.length, 1)) * 35), `مطابقة الرتب: ${index + 1} من ${snapshot.roles.length}...`);
    }

    const channelMap = new Map();
    const categoryRecords = snapshot.channels.filter((channel) => channel.type === ChannelType.GuildCategory);
    const otherRecords = snapshot.channels.filter((channel) => channel.type !== ChannelType.GuildCategory);
    const records = [...categoryRecords, ...otherRecords];
    await updateServerTaskProgress(task, 42, 'جارٍ إنشاء التصنيفات والقنوات المفقودة...');
    for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        const mappedParent = record.parentId ? channelMap.get(record.parentId) : null;
        const namedMatches = [...guild.channels.cache.values()].filter((channel) => channel.name === record.name && channel.type === record.type);
        const byId = guild.channels.cache.get(record.id);
        const existing = byId?.type === record.type ? byId : namedMatches.find((channel) => (channel.parentId || null) === (mappedParent || null)) || namedMatches[0];
        if (existing) {
            const editOptions = {
                name: String(record.name || existing.name).slice(0, 100),
                position: Math.max(0, Number(record.position) || 0),
                parent: mappedParent || null,
                permissionOverwrites: restoredPermissionOverwrites(record.permissionOverwrites, guild, roleMap),
                reason: `YS-Bot server restore task ${task.id}`
            };
            if ([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(record.type)) {
                editOptions.topic = record.topic ? String(record.topic).slice(0, 1024) : null;
                editOptions.nsfw = Boolean(record.nsfw);
                if (record.type === ChannelType.GuildText) editOptions.rateLimitPerUser = Math.max(0, Number(record.rateLimitPerUser) || 0);
            }
            if ([ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(record.type)) {
                editOptions.bitrate = Math.max(8000, Number(record.bitrate) || 64000);
                editOptions.userLimit = Math.max(0, Number(record.userLimit) || 0);
            }
            await existing.edit(editOptions);
            channelMap.set(record.id, existing.id);
            continue;
        }
        const options = {
            name: String(record.name || 'قناة مستعادة').slice(0, 100),
            type: record.type,
            position: Math.max(0, Number(record.position) || 0),
            permissionOverwrites: restoredPermissionOverwrites(record.permissionOverwrites, guild, roleMap),
            reason: `YS-Bot server restore task ${task.id}`
        };
        if (mappedParent) options.parent = mappedParent;
        if ([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(record.type)) {
            if (record.topic) options.topic = String(record.topic).slice(0, 1024);
            options.nsfw = Boolean(record.nsfw);
            if (record.type === ChannelType.GuildText) options.rateLimitPerUser = Math.max(0, Number(record.rateLimitPerUser) || 0);
        }
        if ([ChannelType.GuildVoice, ChannelType.GuildStageVoice].includes(record.type)) {
            options.bitrate = Math.max(8000, Number(record.bitrate) || 64000);
            options.userLimit = Math.max(0, Number(record.userLimit) || 0);
        }
        const created = await guild.channels.create(options);
        channelMap.set(record.id, created.id);
        if (index % 3 === 0) await updateServerTaskProgress(task, 42 + Math.round(((index + 1) / Math.max(records.length, 1)) * 50), `استعادة القنوات: ${index + 1} من ${records.length}...`);
    }
    const summary = `اكتملت الاستعادة: ${snapshot.roles.length} رتبة و${snapshot.channels.length} قناة/تصنيف. أُعيدت إعدادات المطابق منها وأُنشئ المفقود؛ لم تُحذف عناصر.`;
    await updateServerTaskProgress(task, 96, 'اكتمل الهيكل. جارٍ استعادة إعدادات YS-Bot...');
    if (snapshot.settings) {
        guildSettingsCache.delete(guild.id);
        await botBridgeRequest(`/api/internal/bot/guild-settings/${encodeURIComponent(guild.id)}/restore`, {
            method: 'POST',
            body: JSON.stringify({ updatedBy: snapshot.settings.updatedBy || task.requestedBy, settings: snapshot.settings })
        });
        guildSettingsCache.delete(guild.id);
    }
    return summary;
}

let processingServerTasks = false;
let serverTasksWarningShown = false;
async function processServerTasks() {
    if (processingServerTasks || !process.env.BOT_API_SECRET) return;
    processingServerTasks = true;
    try {
        const response = await botBridgeRequest('/api/internal/bot/server-tasks');
        const { tasks = [] } = await response.json();
        for (const task of tasks) {
            try {
                const guild = client.guilds.cache.get(String(task.guildId)) || await client.guilds.fetch(String(task.guildId)).catch(() => null);
                if (!guild) throw new Error('البوت غير موجود في هذا السيرفر. أعد إضافته ثم حاول مجددًا.');
                let message;
                let backupId = null;
                let snapshot = null;
                if (task.taskType === 'backup') {
                    await updateServerTaskProgress(task, 10, 'جارٍ قراءة إعدادات السيرفر والرتب...');
                    snapshot = await collectServerSnapshot(task, guild);
                    message = `اكتمل النسخ: ${snapshot.roles.length} رتبة و${snapshot.channels.length} قناة/تصنيف. النسخة محفوظة بأمان.`;
                } else if (task.taskType === 'restore') {
                    await updateServerTaskProgress(task, 3, 'جارٍ تحميل النسخة الاحتياطية...');
                    const backupResponse = await botBridgeRequest(`/api/internal/bot/server-backups/${encodeURIComponent(guild.id)}/${encodeURIComponent(task.backupId)}`);
                    ({ snapshot } = await backupResponse.json());
                    message = await restoreServerSnapshot(task, guild, snapshot);
                    backupId = task.backupId;
                } else {
                    throw new Error('نوع المهمة غير معروف.');
                }
                await botBridgeRequest(`/api/internal/bot/server-tasks/${encodeURIComponent(task.id)}/complete`, {
                    method: 'POST', body: JSON.stringify({ status: 'completed', message, snapshot, backupId })
                });
            } catch (error) {
                const message = error.message || 'تعذر إكمال العملية.';
                console.error(`Server ${task.taskType} task ${task.id} failed:`, message);
                await botBridgeRequest(`/api/internal/bot/server-tasks/${encodeURIComponent(task.id)}/complete`, {
                    method: 'POST', body: JSON.stringify({ status: 'failed', message })
                }).catch((completionError) => console.error('Could not report server task failure:', completionError.message));
            }
        }
        serverTasksWarningShown = false;
    } catch (error) {
        if (!serverTasksWarningShown) {
            console.error('Server backup queue bridge unavailable:', error.message);
            serverTasksWarningShown = true;
        }
    } finally {
        processingServerTasks = false;
    }
}
function ticketPanelComponents(advanced) {
    const button = new ButtonBuilder().setCustomId('ys_ticket_open').setLabel(String(advanced.ticketPanelButtonLabel || 'فتح تذكرة').slice(0, 80)).setStyle(BUTTON_STYLES[advanced.ticketPanelButtonStyle] || ButtonStyle.Primary);
    if (advanced.ticketPanelButtonEmoji) button.setEmoji(advanced.ticketPanelButtonEmoji);
    return [new ActionRowBuilder().addComponents(button)];
}
function ticketReasonModal(advanced) {
    return new ModalBuilder().setCustomId('ys_ticket_reason').setTitle(String(advanced.ticketReasonTitle || 'سبب فتح التذكرة').slice(0, 45)).addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('كيف يمكن لفريق الدعم مساعدتك؟').setStyle(TextInputStyle.Paragraph).setPlaceholder(String(advanced.ticketReasonPlaceholder || 'اكتب تفاصيل طلبك باختصار...').slice(0, 100)).setMaxLength(1000).setRequired(true))
    );
}

async function syncTicketPanels() {
    for (const guild of client.guilds.cache.values()) {
        const settings = await loadGuildSettings(guild.id);
        const advanced = settings.advancedSettings || {};
        if (!advanced.ticketEnabled || !advanced.ticketPanelChannelId) continue;
        const channel = await guild.channels.fetch(advanced.ticketPanelChannelId).catch(() => null);
        if (!channel?.isTextBased() || !channel.messages) continue;
        const recent = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        const panelMessage = recent?.find((message) => message.author.id === client.user.id && message.components.some((row) => row.components.some((component) => component.customId === 'ys_ticket_open')));
        const embed = new EmbedBuilder()
            .setColor(COLOR_VALUES[advanced.ticketPanelColor] || COLOR_VALUES.teal)
            .setTitle(advanced.ticketPanelTitle || 'تحتاج مساعدة؟')
            .setDescription(advanced.ticketPanelDescription || 'اضغط الزر أدناه لفتح قناة خاصة مع فريق الدعم.')
            .setFooter({ text: 'YS-Bot • نظام التذاكر' });
        const panelPayload = { embeds: [embed], components: ticketPanelComponents(advanced) };
        await (panelMessage ? panelMessage.edit(panelPayload) : channel.send(panelPayload)).catch((error) => {
            console.error(`Could not post ticket panel in guild ${guild.id}:`, error.message);
        });
    }
}

async function createTicket(interaction, submittedReason = '') {
    if (!submittedReason && interaction.isButton()) {
        const current = await loadGuildSettings(interaction.guildId);
        if (current.advancedSettings?.ticketAskReason !== false) return interaction.showModal(ticketReasonModal(current.advancedSettings || {}));
    }
    if (!submittedReason && interaction.isChatInputCommand()) {
        const current = await loadGuildSettings(interaction.guildId);
        if (current.advancedSettings?.ticketAskReason !== false) return interaction.showModal(ticketReasonModal(current.advancedSettings || {}));
        submittedReason = interaction.options.getString('reason') || '';
    }
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild || !interaction.member) return interaction.editReply('استخدم فتح التذكرة داخل السيرفر.');
    const settings = await loadGuildSettings(interaction.guild.id);
    const advanced = settings.advancedSettings || {};
    if (!advanced.ticketEnabled) return interaction.editReply('نظام التذاكر غير مفعّل. فعّله من لوحة الموقع واحفظ الإعدادات.');

    const existing = interaction.guild.channels.cache.filter((channel) => channel.topic === `ys-ticket-owner:${interaction.user.id}`);
    const maxOpen = Math.max(1, Number(advanced.ticketMaxOpen || 1));
    if (existing.size >= maxOpen) return interaction.editReply(`وصلت للحد الأقصى من التذاكر المفتوحة (${maxOpen}).`);

    const category = advanced.ticketCategoryId ? await interaction.guild.channels.fetch(advanced.ticketCategoryId).catch(() => null) : null;
    if (advanced.ticketCategoryId && category?.type !== ChannelType.GuildCategory) {
        return interaction.editReply('معرّف تصنيف التذاكر غير صحيح. راجعه في لوحة الموقع.');
    }
    const permissions = [
        { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AttachFiles] },
        { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] }
    ];
    const supportRole = advanced.ticketSupportRoleId ? interaction.guild.roles.cache.get(advanced.ticketSupportRoleId) : null;
    if (supportRole) permissions.push({ id: supportRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });

    const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 60) || 'member';
    const prefix = String(advanced.ticketNamePrefix || 'ticket').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20) || 'ticket';
    let channel;
    try {
        channel = await interaction.guild.channels.create({
            name: `${prefix}-${safeName}`.slice(0, 90),
            type: ChannelType.GuildText,
            parent: category?.id,
            topic: `ys-ticket-owner:${interaction.user.id}`,
            permissionOverwrites: permissions,
            reason: `Support ticket opened by ${interaction.user.tag}`
        });
    } catch (error) {
        console.error('Could not create ticket channel:', error.message);
        return interaction.editReply('تعذر إنشاء التذكرة. تأكد أن للبوت صلاحية إدارة القنوات وأن ترتيب رتبته يسمح بذلك.');
    }

    const supportMention = supportRole ? `${supportRole}` : 'فريق الدعم';
    const welcome = String(advanced.ticketWelcomeMessage || 'أهلًا {user}، اشرح مشكلتك هنا وسيرد عليك فريق الدعم.')
        .replaceAll('{user}', interaction.user.username).replaceAll('{mention}', `${interaction.user}`)
        .replaceAll('{server}', interaction.guild.name).replaceAll('{reason}', submittedReason || 'لم يُذكر سبب.').replaceAll('{channel}', `${channel}`);
    const embed = new EmbedBuilder()
        .setColor(COLOR_VALUES[advanced.ticketWelcomeColor] || COLOR_VALUES.blue)
        .setTitle(advanced.ticketWelcomeTitle || 'تذكرة دعم جديدة')
        .setDescription(`${welcome}${advanced.ticketNotifySupport ? `\n\n${supportMention}` : ''}`)
        .setFooter({ text: 'يمكنك إغلاق التذكرة بالزر أدناه.' });
    const welcomeImage = safeImageUrl(advanced.ticketWelcomeImageUrl);
    if (welcomeImage) embed.setImage(welcomeImage);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ys_ticket_close').setLabel(String(advanced.ticketCloseButtonLabel || 'إغلاق التذكرة').slice(0, 80)).setStyle(BUTTON_STYLES[advanced.ticketCloseButtonStyle] || ButtonStyle.Danger)
    );
    await channel.send({ content: advanced.ticketNotifySupport && supportRole ? `${supportRole}` : undefined, embeds: [embed], components: [row], allowedMentions: { users: [interaction.user.id], roles: advanced.ticketNotifySupport && supportRole ? [supportRole.id] : [] } });
    return interaction.editReply(String(advanced.ticketConfirmationMessage || 'تم فتح تذكرتك: {channel}').replaceAll('{channel}', `${channel}`));
}

async function closeTicket(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;
    const ownerId = channel?.topic?.match(/^ys-ticket-owner:(\d{17,20})$/)?.[1];
    if (!ownerId || !interaction.guild) return interaction.editReply('هذا الزر ليس داخل تذكرة صالحة.');
    const settings = await loadGuildSettings(interaction.guild.id);
    const advanced = settings.advancedSettings || {};
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    const isSupport = member?.permissions?.has(PermissionFlagsBits.ManageChannels)
        || (advanced.ticketSupportRoleId && member?.roles?.cache?.has(advanced.ticketSupportRoleId));
    if (interaction.user.id !== ownerId && !isSupport) return interaction.editReply('يمكن لصاحب التذكرة أو فريق الدعم إغلاقها فقط.');
    if (interaction.user.id === ownerId && advanced.ticketAllowMemberClose === false) return interaction.editReply('إغلاق التذكرة متاح لفريق الدعم فقط.');

    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    const transcript = messages
        ? [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp).map((message) => {
            const body = message.content || message.embeds.map((embed) => embed.description || embed.title || '').join(' ');
            return `[${new Date(message.createdTimestamp).toISOString()}] ${message.author.tag}: ${body}`;
        }).join('\n')
        : 'تعذر جلب سجل الرسائل.';
    if (advanced.ticketTranscriptEnabled !== false && advanced.ticketTranscriptChannelId) {
        const logChannel = await interaction.guild.channels.fetch(advanced.ticketTranscriptChannelId).catch(() => null);
        if (logChannel?.isTextBased()) {
            const attachment = new AttachmentBuilder(Buffer.from(transcript || 'لا توجد رسائل.', 'utf8'), { name: `${channel.name}-transcript.txt` });
            await logChannel.send({ content: `سجل التذكرة **${channel.name}** • صاحبها <@${ownerId}>`, files: [attachment], allowedMentions: { users: [] } }).catch((error) => console.error('Could not send ticket transcript:', error.message));
        }
    }

    await interaction.editReply('تم إغلاق التذكرة وحفظ سجلها إن كانت قناة الأرشيف مضبوطة.');
    await channel.send(advanced.ticketCloseMessage || 'تم إغلاق التذكرة.').catch(() => {});
    await channel.setTopic(`ys-ticket-closed:${ownerId}`).catch(() => {});
    const deleteAfter = Number(advanced.ticketCloseDeleteAfterMinutes || 0);
    if (deleteAfter > 0) setTimeout(() => channel.delete('Closed ticket retention elapsed').catch(() => {}), deleteAfter * 60000);
    else {
        await channel.permissionOverwrites.edit(ownerId, { ViewChannel: false, SendMessages: false }).catch(() => {});
        await channel.setName(`closed-${channel.name}`.slice(0, 100)).catch(() => {});
    }
}

async function submitSuggestion(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild) return interaction.editReply('استخدم الاقتراحات داخل السيرفر.');
    const settings = await loadGuildSettings(interaction.guild.id);
    const advanced = settings.advancedSettings || {};
    if (!advanced.suggestionEnabled) return interaction.editReply('الاقتراحات غير مفعّلة. فعّلها من لوحة الموقع واحفظ الإعدادات.');
    const destinationId = advanced.suggestionChannelId || advanced.suggestionReviewChannelId;
    const destination = destinationId ? await interaction.guild.channels.fetch(destinationId).catch(() => null) : null;
    if (!destination?.isTextBased()) return interaction.editReply('لم أجد قناة الاقتراحات. أضف معرّف قناة صحيحة من لوحة الموقع.');

    const suggestionText = interaction.options.getString('text', true).trim();
    const minLength = Number(advanced.suggestionMinLength || 5);
    const maxLength = Number(advanced.suggestionMaxLength || 1000);
    if (suggestionText.length < minLength || suggestionText.length > maxLength) return interaction.editReply(`طول الاقتراح يجب أن يكون بين ${minLength} و${maxLength} حرفًا.`);
    const embed = new EmbedBuilder()
        .setColor(COLOR_VALUES[advanced.suggestionEmbedColor] || COLOR_VALUES.teal)
        .setTitle(advanced.suggestionEmbedTitle || 'اقتراح جديد')
        .setDescription(suggestionText.slice(0, 4000))
        .setFooter({ text: advanced.suggestionAnonymousEnabled ? 'اقتراح مجهول' : `من ${interaction.user.tag} • ${interaction.user.id}` })
        .setTimestamp();
    if (!advanced.suggestionAnonymousEnabled) embed.setAuthor({ name: interaction.user.globalName || interaction.user.username, iconURL: interaction.user.displayAvatarURL() });
    const suggestionImage = safeImageUrl(advanced.suggestionEmbedImageUrl);
    if (suggestionImage) embed.setImage(suggestionImage);
    let post;
    try {
        post = await destination.send({ embeds: [embed], components: [suggestionVoteRow(advanced, 0, 0)], allowedMentions: { parse: [] } });
    } catch (error) {
        console.error('Could not publish suggestion:', error.message);
        return interaction.editReply('تعذر نشر الاقتراح. تأكد أن للبوت صلاحية إرسال الرسائل وإضافة التفاعلات في القناة.');
    }

    const reviewId = advanced.suggestionReviewChannelId;
    if (reviewId && reviewId !== destination.id) {
        const reviewChannel = await interaction.guild.channels.fetch(reviewId).catch(() => null);
        if (reviewChannel?.isTextBased()) {
            const reviewText = String(advanced.suggestionReviewMessage || 'اقتراح جديد للمراجعة من {user}').replaceAll('{user}', advanced.suggestionAnonymousEnabled ? 'مجهول' : `<@${interaction.user.id}>`).replaceAll('{server}', interaction.guild.name);
            await reviewChannel.send({ content: reviewText, embeds: [embed], allowedMentions: { users: advanced.suggestionAnonymousEnabled ? [] : [interaction.user.id] } }).catch((error) => console.error('Could not mirror suggestion to review channel:', error.message));
        }
    }
    return interaction.editReply(String(advanced.suggestionConfirmationMessage || 'وصل اقتراحك إلى فريق السيرفر، شكرًا لك!').replaceAll('{channel}', `${destination}`));
}

function suggestionVoteRow(advanced, up, down) {
    const upButton = new ButtonBuilder().setCustomId('ys_suggest_vote:up').setLabel(`${advanced.suggestionUpvoteLabel || 'موافق'} ${up}`).setStyle(BUTTON_STYLES[advanced.suggestionUpvoteStyle] || ButtonStyle.Success);
    const downButton = new ButtonBuilder().setCustomId('ys_suggest_vote:down').setLabel(`${advanced.suggestionDownvoteLabel || 'غير موافق'} ${down}`).setStyle(BUTTON_STYLES[advanced.suggestionDownvoteStyle] || ButtonStyle.Secondary);
    if (advanced.suggestionUpvoteEmoji) upButton.setEmoji(advanced.suggestionUpvoteEmoji);
    if (advanced.suggestionDownvoteEmoji) downButton.setEmoji(advanced.suggestionDownvoteEmoji);
    return new ActionRowBuilder().addComponents(upButton, downButton);
}

async function handleSuggestionVote(interaction) {
    const [, vote] = interaction.customId.split(':');
    const advanced = (await loadGuildSettings(interaction.guildId)).advancedSettings || {};
    const data = guildState(interaction.guildId);
    const votes = data.suggestionVotes[interaction.message.id] ||= { up: [], down: [] };
    const other = vote === 'up' ? 'down' : 'up';
    votes[other] = votes[other].filter((id) => id !== interaction.user.id);
    if (votes[vote].includes(interaction.user.id)) votes[vote] = votes[vote].filter((id) => id !== interaction.user.id);
    else votes[vote].push(interaction.user.id);
    saveBotState();
    await interaction.update({ components: [suggestionVoteRow(advanced, votes.up.length, votes.down.length)] });
}

async function submitPoll(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild || !interaction.channel?.isTextBased()) return interaction.editReply('استخدم التصويت داخل قناة نصية في السيرفر.');
    const settings = await loadGuildSettings(interaction.guild.id);
    const advanced = settings.advancedSettings || {};
    if (!advanced.pollEnabled) return interaction.editReply('التصويت غير مفعّل في لوحة الموقع.');
    const allowedChannels = (advanced.pollChannelIds || '').split(/[\s,]+/).filter(Boolean);
    if (allowedChannels.length && !allowedChannels.includes(interaction.channel.id)) return interaction.editReply('التصويت غير مسموح في هذه القناة.');
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle('تصويت جديد').setDescription(interaction.options.getString('question', true)).setFooter({ text: `بواسطة ${interaction.user.username}` }).setTimestamp();
    const poll = await interaction.channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    await poll.react('👍');
    await poll.react('👎');
    await interaction.editReply(`تم نشر التصويت: ${poll}`);
}

async function warnMember(interaction) {
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) return interaction.editReply('تحتاج صلاحية إدارة الرسائل لإصدار تحذير.');
    const settings = await loadGuildSettings(interaction.guild.id);
    const advanced = settings.advancedSettings || {};
    const target = interaction.options.getUser('member', true);
    const reason = interaction.options.getString('reason') || 'لم يُذكر سبب.';
    const guildData = guildState(interaction.guild.id);
    const cutoff = Date.now() - Number(advanced.auditRetentionDays || 30) * 86400000;
    guildData.warnings[target.id] = (guildData.warnings[target.id] || []).filter((warning) => warning.at >= cutoff);
    guildData.warnings[target.id].push({ at: Date.now(), by: interaction.user.id, reason });
    const count = guildData.warnings[target.id].length;
    saveBotState();
    if (advanced.logModerationActions) await sendGuildLog(interaction.guild, settings, `تحذير ${count} لـ <@${target.id}> بواسطة <@${interaction.user.id}>. السبب: ${reason}`, 0xf59e0b);
    let result = `تم تسجيل التحذير (${count}).`;
    if (advanced.warningEscalationEnabled && count >= Number(advanced.warningLimit || 3)) {
        const member = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (member?.moderatable) {
            const applied = await member.timeout(Number(advanced.warningTimeoutMinutes || 10) * 60000, `وصل إلى ${count} تحذيرات`).then(() => true).catch(() => false);
            if (applied) {
                result += ` تم تطبيق مهلة ${advanced.warningTimeoutMinutes || 10} دقيقة.`;
                if (advanced.logModerationActions) await sendGuildLog(interaction.guild, settings, `تم تقييد <@${target.id}> بعد ${count} تحذيرات.`, 0xef4444);
            } else result += ' تعذر تطبيق المهلة؛ تحقق من صلاحيات البوت وترتيب رتبته.';
        } else {
            result += ' تعذر تطبيق المهلة؛ تحقق من صلاحيات البوت وترتيب رتبته.';
        }
    }
    return interaction.editReply(result);
}

async function verifyMember(interaction) {
    if (!interaction.guild) return interaction.reply({ content: 'استخدم التحقق داخل السيرفر.', ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const settings = await loadGuildSettings(interaction.guild.id);
    const advanced = settings.advancedSettings || {};
    if (!advanced.verificationEnabled || !advanced.verificationRoleId) return interaction.editReply('التحقق غير مفعّل أو لم تُحدد رتبته في لوحة الموقع.');
    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member?.roles.cache.has(advanced.verificationRoleId)) return interaction.editReply('لا توجد عليك رتبة التحقق المطلوبة.');
    const minimumAge = Number(advanced.verificationMinAccountAgeDays || 0) * 86400000;
    if (Date.now() - interaction.user.createdTimestamp < minimumAge) return interaction.editReply(`عمر حسابك أقل من الحد المطلوب (${advanced.verificationMinAccountAgeDays} يومًا).`);
    const removed = await member.roles.remove(advanced.verificationRoleId, 'Member completed /verify').then(() => true).catch(() => false);
    if (!removed) return interaction.editReply('تعذر إكمال التحقق. تأكد أن رتبة البوت أعلى من رتبة التحقق.');
    const timer = verificationTimers.get(`${interaction.guild.id}:${interaction.user.id}`);
    if (timer) clearTimeout(timer);
    verificationTimers.delete(`${interaction.guild.id}:${interaction.user.id}`);
    return interaction.editReply('تم التحقق من حسابك بنجاح.');
}

async function showSupportChannel(interaction) {
    if (!interaction.guild) return interaction.reply({ content: 'استخدم الأمر داخل السيرفر.', ephemeral: true });
    const settings = await loadGuildSettings(interaction.guild.id);
    const channelId = settings.advancedSettings?.supportChannelId;
    const channel = channelId ? await interaction.guild.channels.fetch(channelId).catch(() => null) : null;
    return interaction.reply({ content: channel ? `قناة الدعم: ${channel}` : 'لم تُحدد قناة دعم في لوحة الموقع.', ephemeral: true });
}

async function showInviteCount(interaction) {
    if (!interaction.guild) return interaction.reply({ content: 'استخدم الأمر داخل السيرفر.', ephemeral: true });
    const settings = await loadGuildSettings(interaction.guild.id);
    if (!settings.advancedSettings?.inviteTrackingEnabled) return interaction.reply({ content: 'تتبع الدعوات غير مفعّل في لوحة الموقع.', ephemeral: true });
    const requested = interaction.options.getUser('member') || interaction.user;
    if (requested.id !== interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: 'تحتاج صلاحية إدارة السيرفر لعرض دعوات عضو آخر.', ephemeral: true });
    }
    const count = Number(guildState(interaction.guild.id).invites[requested.id] || 0);
    return interaction.reply({ content: `${requested} لديه ${count} دعوة مسجلة.`, ephemeral: true, allowedMentions: { users: [] } });
}

async function getReplyMessages(userId, forcedLanguage) {
    try {
        const language = await getBotLanguage(userId, forcedLanguage || 'ar');
        return botMessages[language] || botMessages.ar;
    } catch (error) {
        if (!preferenceWarningShown) {
            console.error('Bot language preferences unavailable; using Arabic.');
            preferenceWarningShown = true;
        }
        return botMessages[forcedLanguage] || botMessages.ar;
    }
}

const slashEmojiBufferCache = new Map();
const SLASH_COMMAND_EMOJI = Object.freeze({
    help: 'ys-info', plan: 'ys-premium', anticrash: 'ys-shield', profile: 'ys-stats',
    ticket: 'ys-ticket-open', suggest: 'ys-suggestion', poll: 'ys-poll', warn: 'ys-warning',
    verify: 'ys-shield-check', support: 'ys-support', invites: 'ys-users', embed: 'ys-message'
});
async function getSlashEmojiBuffer(emojiName) {
    if (!/^ys-[a-z0-9-]{1,64}$/.test(String(emojiName || ''))) return null;
    if (slashEmojiBufferCache.has(emojiName)) return slashEmojiBufferCache.get(emojiName);
    const emojiPath = path.join(__dirname, 'emojis', `${emojiName}.svg`);
    if (!fs.existsSync(emojiPath)) return null;
    const image = await loadImage(fs.readFileSync(emojiPath));
    const canvas = createCanvas(128, 128);
    canvas.getContext('2d').drawImage(image, 0, 0, 128, 128);
    const buffer = canvas.toBuffer('image/png');
    slashEmojiBufferCache.set(emojiName, buffer);
    return buffer;
}

function addSlashReplyEmoji(interaction) {
    const emojiName = SLASH_COMMAND_EMOJI[interaction.commandName];
    if (!emojiName) return;
    const decoratedMethods = ['reply', 'editReply', 'followUp'];
    for (const methodName of decoratedMethods) {
        const original = interaction[methodName]?.bind(interaction);
        if (!original) continue;
        interaction[methodName] = async (payload, ...rest) => {
            let image;
            try { image = await getSlashEmojiBuffer(emojiName); }
            catch (error) {
                console.error(`Could not render slash reply emoji ${emojiName}:`, error.message);
                return original(payload, ...rest);
            }
            if (!image) return original(payload, ...rest);
            const options = typeof payload === 'string' ? { content: payload } : { ...payload };
            const embeds = [...(options.embeds || [])];
            const attachmentName = 'ys-command-emoji.png';
            if (embeds.length) {
                const first = EmbedBuilder.from(embeds[0]);
                if (!first.data.thumbnail) first.setThumbnail(`attachment://${attachmentName}`);
                embeds[0] = first;
            } else if (typeof options.content === 'string' && options.content.length <= 4096) {
                const description = options.content;
                delete options.content;
                embeds.push(new EmbedBuilder().setColor(0x35cdb7).setDescription(description).setThumbnail(`attachment://${attachmentName}`));
            } else {
                embeds.push(new EmbedBuilder().setColor(0x35cdb7).setThumbnail(`attachment://${attachmentName}`));
            }
            options.embeds = embeds;
            options.files = [...(options.files || []), new AttachmentBuilder(image, { name: attachmentName })];
            return original(options, ...rest);
        };
    }
}

// معالجة أوامر السلاش (Interaction)
client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton()) {
        if (interaction.customId === 'ys_ticket_open') return createTicket(interaction);
        if (interaction.customId === 'ys_ticket_close') return closeTicket(interaction);
        if (interaction.customId.startsWith('ys_suggest_vote:')) return handleSuggestionVote(interaction);
        return;
    }
    if (interaction.isModalSubmit() && interaction.customId === 'ys_ticket_reason') {
        return createTicket(interaction, interaction.fields.getTextInputValue('reason').trim());
    }
    if (!interaction.isChatInputCommand()) return;

    let guildSettings = null;
    if (interaction.guild) {
        try { await recordBotCommandUser(interaction.user, interaction.guild.id); } catch (error) {
            if (!userTrackingWarningShown) {
                console.error('Bot command statistics unavailable; command usage tracking skipped.');
                userTrackingWarningShown = true;
            }
        }
        guildSettings = await loadGuildSettings(interaction.guild.id);
        if (guildSettings.advancedSettings?.logBotCommands) {
            await sendGuildLog(interaction.guild, guildSettings, `<@${interaction.user.id}> استخدم الأمر /${interaction.commandName}.`);
        }
    }
    const messages = await getReplyMessages(interaction.user.id, guildSettings?.advancedSettings?.commandLanguage);

    if (guildSettings?.advancedSettings) addSlashReplyEmoji(interaction);

    if (interaction.commandName === 'profile') return showUserProfile(interaction);
    if (interaction.commandName === 'ticket') return createTicket(interaction);
    if (interaction.commandName === 'suggest') return submitSuggestion(interaction);
    if (interaction.commandName === 'poll') return submitPoll(interaction);
    if (interaction.commandName === 'warn') return warnMember(interaction);
    if (interaction.commandName === 'verify') return verifyMember(interaction);
    if (interaction.commandName === 'support') return showSupportChannel(interaction);
    if (interaction.commandName === 'invites') return showInviteCount(interaction);
    if (interaction.commandName === 'embed') return sendConfiguredEmbed(interaction);

    if (interaction.commandName === 'help') {
        const english = guildSettings?.advancedSettings?.commandLanguage === 'en';
        const embed = new EmbedBuilder()
            .setColor(0x35cdb7)
            .setTitle(english ? 'YS-Bot commands' : 'أوامر YS-Bot')
            .setDescription(english
                ? '`/profile` member stats · `/ticket` open support ticket · `/suggest` submit suggestion · `/poll` create poll · `/warn` warn a member · `/verify` finish verification · `/support` support channel · `/invites` invite count · `/plan` subscription · `/anticrash` protection status · `/embed` send the configured embed.'
                : '`/profile` إحصاءات عضو · `/ticket` فتح تذكرة · `/suggest` إرسال اقتراح · `/poll` إنشاء تصويت · `/warn` تحذير عضو · `/verify` إكمال التحقق · `/support` قناة الدعم · `/invites` عدد الدعوات · `/plan` حالة الاشتراك · `/anticrash` حالة الحماية · `/embed` إرسال الإمبيد المحفوظ.')
            .setFooter({ text: english ? 'YS-Bot • Use / to browse commands' : 'YS-Bot • اكتب / لاستعراض الأوامر' });
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.commandName === 'plan') {
        if (!interaction.guild) return interaction.reply({ content: 'استخدم /plan داخل السيرفر.', ephemeral: true });
        const plan = await getSubscription(interaction.guild.id);
        const status = botMessages[guildSettings?.advancedSettings?.commandLanguage || 'ar'] || botMessages.ar;
        const embed = new EmbedBuilder().setColor(plan === 'Premium' ? 0x8b5cf6 : plan === 'VIP' ? 0xffd700 : plan === 'Basic' ? 0x00b894 : 0x68768a)
            .setTitle(status.planTitle).setDescription(status.planDescription(plan)).setFooter({ text: status.planFooter });
        return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (interaction.commandName === 'anticrash') {
        if (!interaction.guild) return interaction.reply({ content: 'استخدم /anticrash داخل السيرفر.', ephemeral: true });
        const language = guildSettings?.advancedSettings?.commandLanguage || 'ar';
        return interaction.reply({ embeds: [buildProtectionStatusEmbed(guildSettings, language)], ephemeral: true });
    }

    // حظر تشغيل الأوامر السرية داخل السيرفرات وقصرها على الخاص
    if (interaction.commandName === 'add-2fa' || interaction.commandName === 'get-2fa') {
        if (interaction.guildId !== null) {
            return interaction.reply({ content: messages.dmOnly, ephemeral: true });
        }
    }

    // 1. أمر إضافة المفتاح
    if (interaction.commandName === 'add-2fa') {
        const siteName = interaction.options.getString('site_name');
        const secretKey = interaction.options.getString('secret_key').replace(/\s+/g, '');

        await interaction.deferReply();

                // تنظيف المفتاح تماماً من أي فراغات وتحويل الحروف إلى كابيتال (كبيرة) لتتوافق مع Base32
        const cleanSecret = secretKey.replace(/\s+/g, '').toUpperCase();

        // تشغيل بايثون باستخدام الاختصار المضمون لويندوز (py) وتغليف المفتاح بعلامات تنصيص
        exec(`py 2fa.py get "${cleanSecret}"`, (error, stdout) => {
            if (error || stdout.includes('Error') || !stdout.trim()) {
                console.error("بايثون أرجع خطأ:", stdout || error);
                return interaction.editReply({ 
                    content: '❌ عذراً، المفتاح السري الذي أدخلته غير متوافق أو يحتوي على أخطاء برمجية.' 
                });
            }

            const currentCode = stdout.trim();
            let dbData = {};
            if (fs.existsSync(dbPath)) {
                try { dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) { dbData = {}; }
            }

            const userId = interaction.user.id;
            if (!dbData[userId]) dbData[userId] = {};
            if (!dbData[userId].accounts) dbData[userId].accounts = [];

            dbData[userId].accounts.push({ site_name: siteName, secret_key: secretKey });
            fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8');

            return interaction.editReply({
                content: `✅ **تم حفظ حساب التحقق بنجاح!**\n🌐 الموقع: **\${siteName}**\n🔢 الكود السداسي الحالي: \`\${currentCode}\`\n\nيمكنك الآن كتابة \`/get-2fa\` في أي وقت هنا لتوليد الأكواد الجديدة مباشرة.`
            });
        });
    }

    // 2. أمر توليد الأرقام الستة حية داخل الخاص
    if (interaction.commandName === 'get-2fa') {
        let dbData = {};
        if (fs.existsSync(dbPath)) {
            try { dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8')); } catch (e) { dbData = {}; }
        }

        const userId = interaction.user.id;
        const userAccounts = dbData[userId]?.accounts || [];

        if (userAccounts.length === 0) {
            return interaction.reply({ content: '⚠️ ليس لديك أي حسابات مضافة حالياً. استخدم `/add-2fa` أولاً لتسجيل حسابك!' });
        }

        await interaction.deferReply();

        const promises = userAccounts.map(acc => {
            return new Promise((resolve) => {
                exec(`python 2fa.py get \${acc.secret_key}`, (error, stdout) => {
                    resolve(`🌐 **\${acc.site_name}**: \`${error ? "000000" : stdout.trim()}\``);
                });
            });
        });

        const results = await Promise.all(promises);
        return interaction.editReply({
            content: `🔒 **أكواد التحقق الحالية الخاصة بك (تتغير كل 30 ثانية):**\n\n${results.join('\n')}`
        });
    }
});

// معالجة الأوامر النصية القديمة (!plan و !anticrash) داخل غرف السيرفرات
async function initializeInviteSnapshots() {
    for (const guild of client.guilds.cache.values()) {
        const invites = await guild.invites.fetch().catch(() => null);
        if (invites) inviteSnapshots.set(guild.id, new Map(invites.map((invite) => [invite.code, invite.uses || 0])));
    }
}

async function runGuildAutomations() {
    const now = Date.now();
    for (const guild of client.guilds.cache.values()) {
        const settings = await loadGuildSettings(guild.id);
        const advanced = settings.advancedSettings || {};
        const data = guildState(guild.id);
        const cutoff = now - Number(advanced.auditRetentionDays || 30) * 86400000;
        for (const [userId, warnings] of Object.entries(data.warnings)) {
            data.warnings[userId] = warnings.filter((warning) => warning.at >= cutoff);
            if (!data.warnings[userId].length) delete data.warnings[userId];
        }

        if (advanced.modLogChannelId && now - Number(data.lastAuditSweepAt || 0) >= 6 * 3600000) {
            const auditChannel = await guild.channels.fetch(advanced.modLogChannelId).catch(() => null);
            if (auditChannel?.isTextBased() && auditChannel.messages) {
                const recentLogs = await auditChannel.messages.fetch({ limit: 100 }).catch(() => null);
                for (const auditMessage of recentLogs?.values() || []) {
                    const isAuditLog = auditMessage.author.id === client.user.id && auditMessage.embeds.some((embed) => embed.footer?.text === 'YS-Audit');
                    if (isAuditLog && auditMessage.createdTimestamp < cutoff) await auditMessage.delete().catch(() => {});
                }
            }
            data.lastAuditSweepAt = now;
            saveBotState();
        }

        const scheduledMessages = [
            { key: 'azkar', enabled: advanced.azkarEnabled, channelId: advanced.azkarChannelId, message: advanced.azkarMessage, intervalHours: advanced.azkarIntervalHours, heading: '📿 أذكار' },
            { key: 'quran', enabled: advanced.quranReminderEnabled, channelId: advanced.quranChannelId, message: advanced.quranMessage, intervalHours: advanced.quranIntervalHours, heading: '📖 تذكير بالقرآن الكريم' }
        ];
        for (const reminder of scheduledMessages) {
            const messageText = String(reminder.message || '').trim();
            if (!reminder.enabled || !reminder.channelId || !messageText) continue;
            const interval = Number(reminder.intervalHours || 24) * 3600000;
            if (now - Number(data.religiousReminders[reminder.key] || 0) < interval) continue;
            const destination = await guild.channels.fetch(reminder.channelId).catch(() => null);
            if (!destination?.isTextBased() || typeof destination.send !== 'function') continue;
            const sent = await destination.send({ content: `${reminder.heading}\n${messageText}`.slice(0, 2000), allowedMentions: { parse: [] } }).catch((error) => {
                console.error(`Could not send ${reminder.key} reminder in guild ${guild.id}:`, error.message);
                return null;
            });
            if (sent) data.religiousReminders[reminder.key] = now;
        }

        if (advanced.scheduledAnnouncementEnabled) {
            const channelId = String(advanced.scheduledAnnouncementChannelId || '').trim();
            const messageText = String(advanced.scheduledAnnouncementMessage || '').trim();
            const interval = Number(advanced.scheduledAnnouncementIntervalHours || 24) * 3600000;
            const lastSentAt = Number(data.religiousReminders.scheduledAnnouncement || 0);
            if (channelId && messageText && !lastSentAt) {
                data.religiousReminders.scheduledAnnouncement = now;
                saveBotState();
            } else if (channelId && messageText && now - lastSentAt >= interval) {
                const destination = await guild.channels.fetch(channelId).catch(() => null);
                if (destination?.isTextBased() && typeof destination.send === 'function') {
                    const embed = new EmbedBuilder()
                        .setColor(COLOR_VALUES[advanced.scheduledAnnouncementColor] || COLOR_VALUES.teal)
                        .setDescription(messageText.slice(0, 4000))
                        .setTimestamp();
                    const title = String(advanced.scheduledAnnouncementTitle || '').trim();
                    if (title) embed.setTitle(title.slice(0, 100));
                    const image = safeImageUrl(advanced.scheduledAnnouncementImageUrl);
                    if (image) embed.setImage(image);
                    const sent = await destination.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch((error) => {
                        console.error(`Could not send scheduled announcement in guild ${guild.id}:`, error.message);
                        return null;
                    });
                    if (sent) {
                        data.religiousReminders.scheduledAnnouncement = now;
                        saveBotState();
                    }
                }
            }
        }

        if (!advanced.autorunBackupEnabled) continue;
        const interval = Number(advanced.autorunBackupIntervalHours || 24) * 3600000;
        if (now - Number(data.backups.lastAt || 0) < interval) continue;
        const destinationId = advanced.modLogChannelId || advanced.supportChannelId;
        const destination = destinationId ? await guild.channels.fetch(destinationId).catch(() => null) : null;
        if (!destination?.isTextBased()) continue;
        const backup = {
            guild: guild.id,
            createdAt: new Date(now).toISOString(),
            commandPrefix: settings.commandPrefix,
            antiSpam: settings.antiSpam,
            antiLinks: settings.antiLinks,
            advancedSettings: advanced
        };
        const file = new AttachmentBuilder(Buffer.from(JSON.stringify(backup, null, 2), 'utf8'), { name: `ys-settings-${guild.id}-${new Date(now).toISOString().slice(0, 10)}.json` });
        await destination.send({ content: 'نسخة احتياطية من إعدادات البوت لهذا السيرفر.', files: [file] }).catch(() => null);
        data.backups.lastAt = now;
        saveBotState();
    }
    saveBotState();
}

async function handleRaidJoin(member, settings) {
    const advanced = settings.advancedSettings || {};
    if (!advanced.antiRaidEnabled) return false;
    const minimumAccountAgeDays = Math.max(0, Math.min(365, Number(advanced.antiRaidMinAccountAgeDays) || 0));
    const accountAgeDays = member.user?.createdTimestamp ? (Date.now() - member.user.createdTimestamp) / 86400000 : Infinity;
    if (minimumAccountAgeDays > 0 && accountAgeDays < minimumAccountAgeDays) {
        const action = ['kick', 'ban'].includes(advanced.antiRaidYoungAccountAction) ? advanced.antiRaidYoungAccountAction : 'alert';
        const alertId = advanced.antiRaidAlertChannelId || advanced.modLogChannelId;
        const alertChannel = alertId ? await member.guild.channels.fetch(alertId).catch(() => null) : null;
        const roleId = advanced.antiRaidAlertRoleId && member.guild.roles.cache.has(advanced.antiRaidAlertRoleId) ? advanced.antiRaidAlertRoleId : '';
        const rolePrefix = roleId ? `<@&${roleId}> ` : '';
        const alertText = `${rolePrefix}⚠️ انضم حساب حديث عمره أقل من ${minimumAccountAgeDays} يومًا إلى السيرفر: ${member.user.tag}. الإجراء: ${action === 'alert' ? 'تنبيه فقط' : action === 'kick' ? 'طرد' : 'حظر'}.`;
        if (alertChannel?.isTextBased()) await alertChannel.send({ content: alertText, allowedMentions: { parse: [], roles: roleId ? [roleId] : [] } }).catch(() => {});
        await sendGuildLog(member.guild, settings, alertText.replace(rolePrefix, ''), 0xf59e0b);
        if (action === 'kick' && member.kickable) {
            const removed = await member.kick(`YS-Bot: Discord account younger than ${minimumAccountAgeDays} days`).then(() => true).catch(() => false);
            if (removed) return true;
        } else if (action === 'ban' && member.bannable) {
            const removed = await member.ban({ reason: `YS-Bot: Discord account younger than ${minimumAccountAgeDays} days`, deleteMessageSeconds: 0 }).then(() => true).catch(() => false);
            if (removed) return true;
        }
    }
    const now = Date.now();
    const recent = (memberJoinTimes.get(member.guild.id) || []).filter((time) => now - time < Number(advanced.antiRaidWindowSeconds || 30) * 1000);
    recent.push(now);
    memberJoinTimes.set(member.guild.id, recent);
    if (recent.length < Number(advanced.antiRaidJoinLimit || 10)) return false;
    if (now - (raidTriggeredAt.get(member.guild.id) || 0) < 5 * 60 * 1000) return false;
    raidTriggeredAt.set(member.guild.id, now);

    const alertId = advanced.antiRaidAlertChannelId || advanced.modLogChannelId;
    const alertChannel = alertId ? await member.guild.channels.fetch(alertId).catch(() => null) : null;
    if (alertChannel?.isTextBased()) {
        const roleId = advanced.antiRaidAlertRoleId && member.guild.roles.cache.has(advanced.antiRaidAlertRoleId) ? advanced.antiRaidAlertRoleId : '';
        const rolePrefix = roleId ? `<@&${roleId}> ` : '';
        await alertChannel.send({ content: `${rolePrefix}⚠️ تم رصد ${recent.length} انضمام خلال ${advanced.antiRaidWindowSeconds || 30} ثانية.`, allowedMentions: { parse: [], roles: roleId ? [roleId] : [] } }).catch(() => {});
    }
    await sendGuildLog(member.guild, settings, `تم بلوغ حد الحماية من الغارات: ${recent.length} أعضاء خلال ${advanced.antiRaidWindowSeconds || 30} ثانية.`, 0xef4444);
    if (advanced.antiRaidAction !== 'lockdown') return false;

    const everyoneId = member.guild.roles.everyone.id;
    const excludedChannelIds = new Set((advanced.antiRaidLockdownExcludeChannelIds || '').split(/[\s,]+/).filter(Boolean));
    const changes = [];
    for (const channel of member.guild.channels.cache.values()) {
        if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type) || excludedChannelIds.has(channel.id)) continue;
        const overwrite = channel.permissionOverwrites.cache.get(everyoneId);
        const oldSend = overwrite?.deny.has(PermissionFlagsBits.SendMessages) ? false : overwrite?.allow.has(PermissionFlagsBits.SendMessages) ? true : null;
        const ok = await channel.permissionOverwrites.edit(everyoneId, { SendMessages: false }, { reason: 'Temporary anti-raid lockdown' }).then(() => true).catch(() => false);
        if (ok) changes.push({ channel, oldSend, hadOverwrite: Boolean(overwrite) });
    }
    setTimeout(async () => {
        for (const { channel, oldSend, hadOverwrite } of changes) {
            if (hadOverwrite) await channel.permissionOverwrites.edit(everyoneId, { SendMessages: oldSend }, { reason: 'End temporary anti-raid lockdown' }).catch(() => {});
            else await channel.permissionOverwrites.delete(everyoneId, 'End temporary anti-raid lockdown').catch(() => {});
        }
    }, Math.max(1, Math.min(60, Number(advanced.antiRaidLockdownDurationMinutes) || 5)) * 60 * 1000);
    return false;
}

const antiNukeAuditEvents = {
    [AuditLogEvent.ChannelCreate]: ['antiNukeChannelCreateEnabled', 'antiNukeChannelCreateLimit', 'إنشاء قناة'],
    [AuditLogEvent.ChannelDelete]: ['antiNukeChannelDeleteEnabled', 'antiNukeChannelDeleteLimit', 'حذف قناة'],
    [AuditLogEvent.RoleCreate]: ['antiNukeRoleCreateEnabled', 'antiNukeRoleCreateLimit', 'إنشاء رتبة'],
    [AuditLogEvent.RoleDelete]: ['antiNukeRoleDeleteEnabled', 'antiNukeRoleDeleteLimit', 'حذف رتبة'],
    [AuditLogEvent.RoleUpdate]: ['antiNukeRoleUpdateEnabled', 'antiNukeRoleUpdateLimit', 'تعديل رتبة'],
    [AuditLogEvent.MemberBanAdd]: ['antiNukeBanEnabled', 'antiNukeBanLimit', 'حظر عضو'],
    [AuditLogEvent.WebhookCreate]: ['antiNukeWebhookCreateEnabled', 'antiNukeWebhookCreateLimit', 'إنشاء Webhook'],
    [AuditLogEvent.WebhookDelete]: ['antiNukeWebhookDeleteEnabled', 'antiNukeWebhookDeleteLimit', 'حذف Webhook'],
    [AuditLogEvent.EmojiDelete]: ['antiNukeEmojiDeleteEnabled', 'antiNukeEmojiDeleteLimit', 'حذف إيموجي'],
    [AuditLogEvent.StickerDelete]: ['antiNukeStickerDeleteEnabled', 'antiNukeStickerDeleteLimit', 'حذف ملصق']
};

client.on('guildAuditLogEntryCreate', async (entry, guild) => {
    try {
        const eventConfig = antiNukeAuditEvents[entry.action];
        if (!eventConfig || !entry.executorId || entry.executorId === client.user?.id) return;
        const settings = await loadGuildSettings(guild.id);
        const advanced = settings.advancedSettings || {};
        if (!advanced.antiNukeEnabled || !advanced[eventConfig[0]]) return;

        const splitIds = (value) => String(value || '').split(/[\s,،]+/).map((id) => id.trim()).filter(Boolean);
        const allowedUsers = splitIds(advanced.antiNukeAllowlistedUserIds);
        const allowedRoles = splitIds(advanced.antiNukeAllowlistedRoleIds);
        if (allowedUsers.includes(entry.executorId) || entry.executorId === guild.ownerId) return;

        const executor = await guild.members.fetch(entry.executorId).catch(() => null);
        if (executor && executor.roles.cache.some((role) => allowedRoles.includes(role.id))) return;

        const now = Date.now();
        const windowMs = Math.max(1, Number(advanced.antiNukeWindowSeconds) || 10) * 1000;
        const eventKey = `${guild.id}:${entry.executorId}:${entry.action}`;
        const timestamps = (antiNukeEventTimes.get(eventKey) || []).filter((time) => now - time < windowMs);
        timestamps.push(now);
        antiNukeEventTimes.set(eventKey, timestamps);

        const alertId = advanced.antiNukeAlertChannelId || advanced.modLogChannelId;
        const alertChannel = alertId ? await guild.channels.fetch(alertId).catch(() => null) : null;
        const actionName = eventConfig[2];
        if (advanced.antiNukeLogAllEvents && alertChannel?.isTextBased()) {
            await alertChannel.send({ content: `🔎 رصد النظام ${actionName} بواسطة ${executor?.user?.tag || entry.executorId}.`, allowedMentions: { parse: [] } }).catch(() => {});
        }

        const limit = Math.max(1, Number(advanced[eventConfig[1]]) || 3);
        if (timestamps.length < limit) return;
        const cooldownKey = `${guild.id}:${entry.executorId}`;
        const cooldownMs = Math.max(0, Number(advanced.antiNukeCooldownSeconds) || 0) * 1000;
        if (now - (antiNukeTriggeredAt.get(cooldownKey) || 0) < cooldownMs) return;
        antiNukeTriggeredAt.set(cooldownKey, now);

        const selectedAction = ['timeout', 'kick', 'ban'].includes(advanced.antiNukeAction) ? advanced.antiNukeAction : 'alert';
        const alertRoleId = String(advanced.antiNukeAlertRoleId || '').trim();
        const rolePrefix = alertRoleId && guild.roles.cache.has(alertRoleId) ? `<@&${alertRoleId}> ` : '';
        const actionLabel = { alert: 'تنبيه المشرفين فقط', timeout: 'مهلة', kick: 'طرد', ban: 'حظر' }[selectedAction];
        if (alertChannel?.isTextBased()) {
            await alertChannel.send({
                content: `${rolePrefix}🚨 **تنبيه Anti-Nuke**: نفّذ ${executor?.user?.tag || `المستخدم ${entry.executorId}`} عملية **${actionName}** ${timestamps.length} مرات خلال ${advanced.antiNukeWindowSeconds || 10} ثوانٍ. الإجراء المحدد: **${actionLabel}**.`,
                allowedMentions: { parse: [], roles: alertRoleId && guild.roles.cache.has(alertRoleId) ? [alertRoleId] : [] }
            }).catch(() => {});
        }

        const reason = `Anti-Nuke: تجاوز حد ${actionName} (${timestamps.length}/${limit})`;
        if (executor && executor.id !== guild.ownerId && executor.id !== client.user?.id) {
            if (selectedAction === 'timeout') await executor.timeout(Math.max(1, Number(advanced.antiNukeTimeoutMinutes) || 10) * 60000, reason).catch((error) => console.error('Anti-Nuke timeout failed:', error.message));
            else if (selectedAction === 'kick') await executor.kick(reason).catch((error) => console.error('Anti-Nuke kick failed:', error.message));
            else if (selectedAction === 'ban') await executor.ban({ reason, deleteMessageSeconds: 0 }).catch((error) => console.error('Anti-Nuke ban failed:', error.message));
        }

        if (!advanced.antiNukeLockdownEnabled) return;
        const everyoneId = guild.roles.everyone.id;
        const duration = Math.max(1, Number(advanced.antiNukeLockdownDurationMinutes) || 5) * 60000;
        const changed = [];
        for (const channel of guild.channels.cache.values()) {
            if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) continue;
            const overwrite = channel.permissionOverwrites.cache.get(everyoneId);
            const previous = overwrite?.deny.has(PermissionFlagsBits.SendMessages) ? false : overwrite?.allow.has(PermissionFlagsBits.SendMessages) ? true : null;
            const applied = await channel.permissionOverwrites.edit(everyoneId, { SendMessages: false }, { reason: 'Temporary Anti-Nuke lockdown' }).then(() => true).catch(() => false);
            if (applied) changed.push({ channel, previous, hadOverwrite: Boolean(overwrite) });
        }
        setTimeout(async () => {
            for (const { channel, previous, hadOverwrite } of changed) {
                if (hadOverwrite) await channel.permissionOverwrites.edit(everyoneId, { SendMessages: previous }, { reason: 'End temporary Anti-Nuke lockdown' }).catch(() => {});
                else await channel.permissionOverwrites.delete(everyoneId, 'End temporary Anti-Nuke lockdown').catch(() => {});
            }
        }, duration);
    } catch (error) {
        console.error(`Anti-Nuke audit handler failed for guild ${guild?.id || 'unknown'}:`, error);
    }
});

client.on('guildMemberAdd', async (member) => {
    const settings = await loadGuildSettings(member.guild.id);
    const advanced = settings.advancedSettings || {};
    const removedByYoungAccountProtection = await handleRaidJoin(member, settings);
    if (removedByYoungAccountProtection) return;

    if (advanced.inviteTrackingEnabled) {
        const current = await member.guild.invites.fetch().catch(() => null);
        const previous = inviteSnapshots.get(member.guild.id) || new Map();
        const usedInvite = current?.find((invite) => (invite.uses || 0) > (previous.get(invite.code) || 0));
        if (current) inviteSnapshots.set(member.guild.id, new Map(current.map((invite) => [invite.code, invite.uses || 0])));
        if (usedInvite?.inviter) {
            const data = guildState(member.guild.id);
            const count = Number(data.invites[usedInvite.inviter.id] || 0) + 1;
            data.invites[usedInvite.inviter.id] = count;
            saveBotState();
            const threshold = Number(advanced.inviteRewardThreshold || 5);
            const role = advanced.inviteRewardRoleId ? member.guild.roles.cache.get(advanced.inviteRewardRoleId) : null;
            if (role && count >= threshold) {
                const inviter = await member.guild.members.fetch(usedInvite.inviter.id).catch(() => null);
                if (inviter && !inviter.roles.cache.has(role.id)) await inviter.roles.add(role, 'Reached invite reward threshold').catch(() => {});
            }
        }
    }

    // Prefer the single current auto-role setting; keep the old welcomeRoleId as a fallback for existing servers.
    const autoRoleId = advanced.autoRoleEnabled && advanced.autoRoleId ? advanced.autoRoleId : advanced.welcomeRoleId;
    if (autoRoleId) {
        const role = member.guild.roles.cache.get(autoRoleId);
        if (role) await member.roles.add(role, 'Auto role configured in YS-Bot dashboard').catch(() => {});
    }
    if (advanced.verificationEnabled && advanced.verificationRoleId) {
        const role = member.guild.roles.cache.get(advanced.verificationRoleId);
        if (role) {
            await member.roles.add(role, 'Member verification required').catch(() => {});
            const key = `${member.guild.id}:${member.id}`;
            const timer = setTimeout(async () => {
                const pending = await member.guild.members.fetch(member.id).catch(() => null);
                if (pending?.roles.cache.has(role.id) && pending.moderatable) {
                    await pending.timeout(Number(advanced.verificationTimeoutMinutes || 10) * 60 * 1000, 'Verification timeout expired').catch(() => {});
                    await sendGuildLog(member.guild, settings, `تم تقييد <@${member.id}> لانتهاء مهلة التحقق.`, 0xf59e0b);
                }
                verificationTimers.delete(key);
            }, Number(advanced.verificationTimeoutMinutes || 10) * 60000);
            verificationTimers.set(key, timer);
        }
    }

    if (advanced.logMemberJoins) await sendGuildLog(member.guild, settings, `انضم <@${member.id}> إلى السيرفر.`, 0x22c55e);
    if (advanced.welcomeIgnoreBots && member.user.bot) return;
    if (advanced.welcomeEnabled && advanced.welcomeChannelId) {
        const channel = await member.guild.channels.fetch(advanced.welcomeChannelId).catch(() => null);
        if (channel?.isTextBased()) await channel.send(formatMemberText(advanced.welcomeMessage, member), { allowedMentions: { users: [member.id] } }).catch(() => {});
    }
    if (advanced.welcomeSendDm && advanced.welcomeDmMessage) await member.send(formatMemberText(advanced.welcomeDmMessage, member)).catch(() => {});
});

client.on('guildMemberRemove', async (member) => {
    const settings = await loadGuildSettings(member.guild.id);
    const advanced = settings.advancedSettings || {};
    if (advanced.farewellEnabled && advanced.farewellChannelId) {
        const channel = await member.guild.channels.fetch(advanced.farewellChannelId).catch(() => null);
        if (channel?.isTextBased()) await channel.send(formatMemberText(advanced.farewellMessage, member), { allowedMentions: { parse: [] } }).catch(() => {});
    }
    if (advanced.logMemberLeaves) await sendGuildLog(member.guild, settings, `غادر ${member.user.tag} السيرفر.`, 0x64748b);
});

client.on('guildMemberUpdate', async (before, after) => {
    const added = after.roles.cache.filter((role) => !before.roles.cache.has(role.id));
    const removed = before.roles.cache.filter((role) => !after.roles.cache.has(role.id));
    if (!added.size && !removed.size) return;
    const settings = await loadGuildSettings(after.guild.id);
    if (!settings.advancedSettings?.logRoleChanges) return;
    const changes = [...added.map((role) => `+ ${role.name}`), ...removed.map((role) => `- ${role.name}`)].join(', ');
    await sendGuildLog(after.guild, settings, `تغيّرت رتب <@${after.id}>: ${changes}`, 0x8b5cf6);
});

client.on('channelCreate', async (channel) => {
    if (!channel.guild) return;
    const settings = await loadGuildSettings(channel.guild.id);
    if (settings.advancedSettings?.logChannelChanges) await sendGuildLog(channel.guild, settings, `أُنشئت قناة <#${channel.id}>.`, 0x22c55e);
});

client.on('channelDelete', async (channel) => {
    if (!channel.guild) return;
    const settings = await loadGuildSettings(channel.guild.id);
    if (settings.advancedSettings?.logChannelChanges) await sendGuildLog(channel.guild, settings, `حُذفت القناة **${channel.name}**.`, 0xef4444);
});

client.on('channelUpdate', async (before, after) => {
    if (!after.guild || (before.name === after.name && before.parentId === after.parentId)) return;
    const settings = await loadGuildSettings(after.guild.id);
    if (settings.advancedSettings?.logChannelChanges) await sendGuildLog(after.guild, settings, `تغيّرت القناة **${before.name}** إلى **${after.name}**.`, 0x8b5cf6);
});

client.on('messageDelete', async (message) => {
    if (!message.guild) return;
    const settings = await loadGuildSettings(message.guild.id);
    if (!settings.advancedSettings?.logDeletedMessages) return;
    if (message.partial) message = await message.fetch().catch(() => message);
    if (message.author?.bot) return;
    const author = message.author ? `<@${message.author.id}>` : 'عضو غير معروف';
    await sendGuildLog(message.guild, settings, `حُذفت رسالة في <#${message.channel.id}> من ${author}: ${(message.content || '[بدون نص]').slice(0, 1800)}`, 0xef4444);
});

client.on('messageUpdate', async (before, after) => {
    if (!after.guild || before.content === after.content) return;
    const settings = await loadGuildSettings(after.guild.id);
    if (!settings.advancedSettings?.logEditedMessages) return;
    if (before.partial) before = await before.fetch().catch(() => before);
    if (after.author?.bot) return;
    await sendGuildLog(after.guild, settings, `عُدّلت رسالة في <#${after.channel.id}> بواسطة <@${after.author?.id}>.\nقبل: ${(before.content || '[غير متاح]').slice(0, 900)}\nبعد: ${(after.content || '[فارغ]').slice(0, 900)}`, 0xf59e0b);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const settings = await loadGuildSettings(message.guild.id);
    const advanced = settings.advancedSettings || {};
    const canDeleteMessages = message.guild.members.me?.permissionsIn(message.channel).has(PermissionFlagsBits.ManageMessages);
    const isModerator = message.member?.permissions.has(PermissionFlagsBits.ManageMessages);
    const bypassLink = isModerator || (message.member?.roles.cache.some((role) => (advanced.antiLinksIgnoreRoleIds || '').split(/[\s,]+/).includes(role.id)) ?? false);
    const ignoredLinkChannels = (advanced.antiLinksIgnoreChannels || '').split(/[\s,]+/).filter(Boolean);
    const links = message.content.match(/(?:https?:\/\/|www\.)[^\s<>()]+/gi) || [];
    const allowedDomains = (advanced.antiLinksAllowedDomains || '').split(/[\s,]+/).map((domain) => domain.trim().toLowerCase()).filter(Boolean);
    const externalBlocked = advanced.antiLinksBlockExternal !== false && links.some((link) => {
        const normalized = link.startsWith('www.') ? `https://${link}` : link;
        try {
            const host = new URL(normalized).hostname.toLowerCase();
            return !allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
        } catch {
            return true;
        }
    });
    const inviteBlocked = advanced.antiLinksBlockInvites !== false && /(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)/i.test(message.content);
    const linkFilterEnabled = settings.antiLinks && !bypassLink && !ignoredLinkChannels.includes(message.channel.id);

    if (linkFilterEnabled && (externalBlocked || inviteBlocked)) {
        if (canDeleteMessages && message.deletable) {
            await message.delete().catch(() => {});
        }
        const key = `${message.guild.id}:${message.author.id}`;
        const now = Date.now();
        if (now - (linkNoticeTimes.get(key) || 0) > 15000) {
            linkNoticeTimes.set(key, now);
            message.channel.send(`⚠️ ${message.author} ${advanced.antiLinksWarning || 'الروابط غير مسموحة في هذا السيرفر.'}`)
                .then((notice) => setTimeout(() => notice.delete().catch(() => {}), 5000))
                .catch(() => {});
        }
        return;
    }

    const spamExemptChannels = (advanced.antiSpamIgnoreChannels || '').split(/[\s,]+/).filter(Boolean);
    const spamCanBypass = advanced.antiSpamIgnoreAdmins !== false && isModerator;
    if (settings.antiSpam && !spamCanBypass && !spamExemptChannels.includes(message.channel.id)) {
        const key = `${message.guild.id}:${message.author.id}`;
        const now = Date.now();
        const windowMs = Number(advanced.antiSpamWindowSeconds) * 1000 || 8000;
        const limit = Number(advanced.antiSpamLimit) || 5;
        const timestamps = (recentMessages.get(key) || []).filter((time) => now - time < windowMs);
        timestamps.push(now);
        recentMessages.set(key, timestamps);
        if (timestamps.length >= limit) {
            const timeoutMinutes = Math.max(1, Math.min(1440, Number(advanced.antiSpamTimeoutMinutes) || 5));
            const timeoutApplied = Boolean(advanced.antiSpamTimeoutEnabled && message.member?.moderatable)
                && await message.member.timeout(timeoutMinutes * 60 * 1000, 'YS-Bot anti-spam protection').then(() => true).catch(() => false);
            if (!timeoutApplied && advanced.antiSpamAction !== 'warn' && canDeleteMessages && message.deletable) await message.delete().catch(() => {});
            if (now - (spamNoticeTimes.get(key) || 0) > 15000) {
                spamNoticeTimes.set(key, now);
                const actionMessage = timeoutApplied ? `تم إسكات العضو لمدة ${timeoutMinutes} دقيقة بسبب تكرار الرسائل.` : (advanced.antiSpamWarning || 'تم رصد رسائل متكررة بسرعة.');
                message.channel.send(`⚠️ ${message.author} ${actionMessage}`)
                    .then((notice) => setTimeout(() => notice.delete().catch(() => {}), 5000))
                    .catch(() => {});
            }
            return;
        }
    }

    const plainText = message.content.trim();
    if (advanced.capsFilterEnabled && plainText.length >= Number(advanced.capsMinimumLength || 12)) {
        const letters = plainText.match(/[A-Za-z]/g) || [];
        const upper = plainText.match(/[A-Z]/g) || [];
        if (letters.length && upper.length / letters.length * 100 >= Number(advanced.capsThresholdPercent || 75)) {
            await postWarning(message, settings, 'تجنب الكتابة بالأحرف الكبيرة.', advanced.capsAction || 'delete');
            return;
        }
    }

    if (advanced.duplicateFilterEnabled) {
        const key = `${message.guild.id}:${message.author.id}`;
        const duplicateKey = `${key}:${plainText.toLowerCase()}`;
        const now = Date.now();
        const windowMs = Number(advanced.duplicateWindowSeconds || 15) * 1000;
        const timestamps = (duplicateMessages.get(duplicateKey) || []).filter((time) => now - time < windowMs);
        timestamps.push(now);
        duplicateMessages.set(duplicateKey, timestamps);
        if (timestamps.length >= Number(advanced.duplicateMessageLimit || 3)) {
            await postWarning(message, settings, 'تجنب تكرار الرسالة نفسها.', 'delete');
            return;
        }
    }

    if (advanced.mentionSpamEnabled) {
        const mentionCount = message.mentions.users.size + message.mentions.roles.size + (message.mentions.everyone ? 1 : 0);
        if (mentionCount >= Number(advanced.mentionLimit || 5)) {
            await postWarning(message, settings, 'عدد الإشارات في رسالتك أعلى من المسموح.', advanced.mentionSpamAction || 'delete');
            return;
        }
    }

    if (advanced.blockedWordsEnabled) {
        const blocked = String(advanced.blockedWords || '').split(/[\n,،]+/).map((word) => word.trim()).filter(Boolean);
        if (blocked.some((word) => plainText.toLocaleLowerCase().includes(word.toLocaleLowerCase()))) {
            await postWarning(message, settings, 'رسالتك تحتوي على كلمة محظورة.', advanced.blockedWordsAction || 'delete');
            return;
        }
    }

    if (advanced.emojiSpamEnabled) {
        const unicodeEmojiCount = [...plainText.matchAll(/\p{Extended_Pictographic}/gu)].length;
        const customEmojiCount = [...plainText.matchAll(/<a?:[\w~]+:\d{17,20}>/g)].length;
        if (unicodeEmojiCount + customEmojiCount >= Number(advanced.emojiLimit || 12)) {
            await postWarning(message, settings, 'رسالتك تحتوي على عدد كبير من الإيموجي.', advanced.emojiSpamAction || 'delete');
            return;
        }
    }

    if (advanced.lineSpamEnabled && plainText.split(/\r?\n/).length >= Number(advanced.lineSpamLimit || 8)) {
        await postWarning(message, settings, 'رسالتك تحتوي على أسطر كثيرة.', advanced.lineSpamAction || 'delete');
        return;
    }

    if (advanced.repeatedCharacterFilterEnabled) {
        const repeated = plainText.match(/([\p{L}\p{N}])\1+/giu) || [];
        const longestRun = repeated.reduce((longest, run) => Math.max(longest, [...run].length), 0);
        if (longestRun >= Number(advanced.repeatedCharacterLimit || 12)) {
            await postWarning(message, settings, 'تجنب تكرار الحرف أو الرقم مرات كثيرة متتالية.', advanced.repeatedCharacterAction || 'delete');
            return;
        }
    }

    if (advanced.zalgoFilterEnabled) {
        const combiningMarks = [...plainText.matchAll(/\p{M}/gu)].length;
        if (combiningMarks >= Number(advanced.zalgoMarkLimit || 8)) {
            await postWarning(message, settings, 'الرموز أو العلامات المشوهة غير مسموحة.', advanced.zalgoFilterAction || 'delete');
            return;
        }
    }

    if (advanced.autoReplyEnabled && plainText) {
        const ignoredChannels = String(advanced.autoReplyIgnoreChannelIds || '').split(/[\s,]+/).filter(Boolean);
        const cooldownKey = `${message.guild.id}:${message.author.id}`;
        const cooldownMs = Number(advanced.autoReplyCooldownSeconds || 0) * 1000;
        const lastReplyAt = autoReplyCooldowns.get(cooldownKey) || 0;
        if (!ignoredChannels.includes(message.channel.id) && (!cooldownMs || Date.now() - lastReplyAt >= cooldownMs)) {
            const caseSensitive = Boolean(advanced.autoReplyCaseSensitive);
            const incoming = caseSensitive ? plainText : plainText.toLocaleLowerCase();
            const mode = advanced.autoReplyMatchMode || 'includes';
            const match = String(advanced.autoReplyRules || '').split(/\r?\n/).slice(0, 100).map((line) => {
                const separator = line.indexOf('=>');
                return separator < 0 ? null : { trigger: line.slice(0, separator).trim(), response: line.slice(separator + 2).trim() };
            }).find((rule) => {
                if (!rule?.trigger || !rule.response) return false;
                const trigger = caseSensitive ? rule.trigger : rule.trigger.toLocaleLowerCase();
                if (mode === 'exact') return incoming === trigger;
                if (mode === 'startsWith') return incoming.startsWith(trigger);
                return incoming.includes(trigger);
            });
            if (match) {
                const response = match.response
                    .replaceAll('{user}', message.author.username)
                    .replaceAll('{mention}', `<@${message.author.id}>`)
                    .replaceAll('{server}', message.guild.name)
                    .replaceAll('{memberCount}', String(message.guild.memberCount));
                const includesMention = response.includes(`<@${message.author.id}>`);
                const sent = await message.channel.send({
                    content: response.slice(0, 2000),
                    allowedMentions: includesMention ? { users: [message.author.id], parse: [] } : { parse: [] }
                }).catch((error) => {
                    console.error(`Could not send automatic reply in guild ${message.guild.id}:`, error.message);
                    return null;
                });
                if (sent) {
                    autoReplyCooldowns.set(cooldownKey, Date.now());
                    if (autoReplyCooldowns.size > 5000) autoReplyCooldowns.delete(autoReplyCooldowns.keys().next().value);
                }
            }
        }
    }

    const slowmode = Number(advanced.slowmodeSeconds || 0);
    if (message.channel.isTextBased() && 'setRateLimitPerUser' in message.channel && message.channel.manageable) {
        const tracked = channelSlowmodeOriginals.get(message.channel.id);
        if (slowmode > 0 && message.channel.rateLimitPerUser !== slowmode) {
            if (!tracked) channelSlowmodeOriginals.set(message.channel.id, message.channel.rateLimitPerUser);
            await message.channel.setRateLimitPerUser(slowmode, 'Slowmode configured in YS-Bot dashboard').catch(() => {});
        } else if (slowmode === 0 && tracked !== undefined) {
            channelSlowmodeOriginals.delete(message.channel.id);
            await message.channel.setRateLimitPerUser(tracked, 'Dashboard slowmode disabled').catch(() => {});
        }
    }

    if (advanced.levelSystemEnabled && plainText.length > 0 && !message.webhookId) {
        const data = guildState(message.guild.id);
        const userLevel = data.levels[message.author.id] || { xp: 0, lastMessageAt: 0 };
        const now = Date.now();
        if (now - userLevel.lastMessageAt >= Number(advanced.levelCooldownSeconds || 60) * 1000) {
            const oldLevel = Math.floor(Math.sqrt(userLevel.xp / 100));
            userLevel.xp += 5 + Math.floor(Math.random() * 6);
            userLevel.lastMessageAt = now;
            const newLevel = Math.floor(Math.sqrt(userLevel.xp / 100));
            data.levels[message.author.id] = userLevel;
            saveBotState();
            if (newLevel > oldLevel) {
                const target = advanced.levelAnnouncementChannelId ? await message.guild.channels.fetch(advanced.levelAnnouncementChannelId).catch(() => null) : message.channel;
                if (target?.isTextBased()) {
                    const announcement = String(advanced.levelUpMessage || 'مبروك {user} وصلت للمستوى {level}!')
                        .replaceAll('{user}', `${message.author}`)
                        .replaceAll('{level}', String(newLevel))
                        .replaceAll('{server}', message.guild.name);
                    await target.send({ content: announcement, allowedMentions: { users: [message.author.id] } }).catch(() => {});
                }
            }
        }
    }

    const content = plainText;
    if (!content.startsWith(settings.commandPrefix)) return;
    const command = content.slice(settings.commandPrefix.length).trim().toLowerCase();
    if (!['plan', 'anticrash', 'help', 'support'].includes(command)) return;

    if (advanced.commandsEnabled === false) return;
    if (advanced.commandsAllowedChannelIds) {
        const allowedChannels = advanced.commandsAllowedChannelIds.split(/[\s,]+/).filter(Boolean);
        if (!allowedChannels.includes(message.channel.id)) return;
    }
    if (advanced.commandsRoleId && !message.member?.roles.cache.has(advanced.commandsRoleId)) {
        await message.reply('ليس لديك رتبة استخدام أوامر البوت المطلوبة.').catch(() => {});
        return;
    }
    const cooldownKey = `${message.guild.id}:${message.author.id}`;
    const now = Date.now();
    const cooldownMs = Number(advanced.commandCooldownSeconds || 0) * 1000;
    if (cooldownMs && now - (textCooldowns.get(cooldownKey) || 0) < cooldownMs) return;
    textCooldowns.set(cooldownKey, now);

    try {
        await recordBotCommandUser(message.author, message.guild.id);
    } catch (error) {
        if (!userTrackingWarningShown) {
            console.error('Bot user tracking unavailable; activity logging skipped.');
            userTrackingWarningShown = true;
        }
    }

    const messages = await getReplyMessages(message.author.id, advanced.commandLanguage);
    if (advanced.logBotCommands) await sendGuildLog(message.guild, settings, `<@${message.author.id}> استخدم الأمر ${command} في <#${message.channel.id}>.`);

    if (command === 'help') {
        const sent = await message.reply(`أوامري: ${settings.commandPrefix}plan، ${settings.commandPrefix}anticrash، ${settings.commandPrefix}support، ${settings.commandPrefix}help`);
        if (advanced.commandDeleteAfterUse) await message.delete().catch(() => {});
        return sent;
    }
    if (command === 'support') {
        const channelId = advanced.supportChannelId;
        const channel = channelId ? await message.guild.channels.fetch(channelId).catch(() => null) : null;
        const sent = await message.reply(channel ? `قناة الدعم: ${channel}` : 'لم تُحدد قناة دعم في لوحة الموقع.');
        if (advanced.commandDeleteAfterUse) await message.delete().catch(() => {});
        return sent;
    }

    if (command === 'plan') {
        const plan = await getSubscription(message.guild.id);
        const embed = new EmbedBuilder()
            .setTitle(messages.planTitle)
            .setDescription(messages.planDescription(plan))
            .setFooter({ text: messages.planFooter })
            .setColor(plan === 'Premium' ? 0x8b5cf6 : plan === 'VIP' ? 0xffd700 : plan === 'Basic' ? 0x00ff00 : 0x808080);
        
        const sent = await message.reply({ embeds: [embed] });
        if (advanced.commandDeleteAfterUse) await message.delete().catch(() => {});
        return sent;
    }

    if (command === 'anticrash') {
        const sent = await message.reply({ embeds: [buildProtectionStatusEmbed(settings, advanced.commandLanguage)] });
        if (advanced.commandDeleteAfterUse) await message.delete().catch(() => {});
        return sent;
    }
});

client.login(process.env.DISCORD_TOKEN);
