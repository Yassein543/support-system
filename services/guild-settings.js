const { neon } = require('@neondatabase/serverless');

let sql;
let ready;

const EXTRA_SETTING_SCHEMA = {
    protectionLevel: { type: 'choice', default: 'custom', values: ['custom', 'green', 'yellow', 'orange', 'red'] },
    commandCooldownSeconds: { type: 'number', default: 2, min: 0, max: 60 },
    commandsEnabled: { type: 'boolean', default: true },
    commandsRoleId: { type: 'text', default: '', maxLength: 24 },
    commandsAllowedChannelIds: { type: 'text', default: '', maxLength: 500 },
    commandLanguage: { type: 'choice', default: 'ar', values: ['ar', 'en'] },
    commandDeleteAfterUse: { type: 'boolean', default: false },
    antiSpamLimit: { type: 'number', default: 5, min: 2, max: 30 },
    antiSpamWindowSeconds: { type: 'number', default: 8, min: 2, max: 60 },
    antiSpamAction: { type: 'choice', default: 'delete', values: ['delete', 'warn'] },
    antiSpamTimeoutEnabled: { type: 'boolean', default: false },
    antiSpamTimeoutMinutes: { type: 'number', default: 5, min: 1, max: 1440 },
    antiSpamWarning: { type: 'text', default: 'خفف سرعة إرسال الرسائل.', maxLength: 180 },
    antiSpamIgnoreAdmins: { type: 'boolean', default: true },
    antiSpamIgnoreChannels: { type: 'text', default: '', maxLength: 500 },
    antiLinksBlockInvites: { type: 'boolean', default: true },
    antiLinksBlockExternal: { type: 'boolean', default: true },
    antiLinksAllowedDomains: { type: 'text', default: '', maxLength: 500 },
    antiLinksWarning: { type: 'text', default: 'الروابط غير مسموحة في هذا السيرفر.', maxLength: 180 },
    antiLinksIgnoreChannels: { type: 'text', default: '', maxLength: 500 },
    antiLinksIgnoreRoleIds: { type: 'text', default: '', maxLength: 500 },
    capsFilterEnabled: { type: 'boolean', default: false },
    capsThresholdPercent: { type: 'number', default: 75, min: 50, max: 100 },
    capsMinimumLength: { type: 'number', default: 12, min: 4, max: 100 },
    capsAction: { type: 'choice', default: 'delete', values: ['delete', 'warn'] },
    duplicateFilterEnabled: { type: 'boolean', default: false },
    duplicateMessageLimit: { type: 'number', default: 3, min: 2, max: 10 },
    duplicateWindowSeconds: { type: 'number', default: 15, min: 3, max: 120 },
    mentionSpamEnabled: { type: 'boolean', default: false },
    mentionLimit: { type: 'number', default: 5, min: 2, max: 30 },
    mentionSpamAction: { type: 'choice', default: 'delete', values: ['delete', 'warn'] },
    blockedWordsEnabled: { type: 'boolean', default: false },
    blockedWords: { type: 'text', default: '', maxLength: 1000 },
    blockedWordsAction: { type: 'choice', default: 'delete', values: ['delete', 'warn'] },
    emojiSpamEnabled: { type: 'boolean', default: false },
    emojiLimit: { type: 'number', default: 12, min: 3, max: 50 },
    emojiSpamAction: { type: 'choice', default: 'delete', values: ['delete', 'warn'] },
    lineSpamEnabled: { type: 'boolean', default: false },
    lineSpamLimit: { type: 'number', default: 8, min: 3, max: 30 },
    lineSpamAction: { type: 'choice', default: 'delete', values: ['delete', 'warn'] },
    repeatedCharacterFilterEnabled: { type: 'boolean', default: false },
    repeatedCharacterLimit: { type: 'number', default: 12, min: 4, max: 50 },
    repeatedCharacterAction: { type: 'choice', default: 'delete', values: ['delete', 'warn'] },
    zalgoFilterEnabled: { type: 'boolean', default: false },
    zalgoMarkLimit: { type: 'number', default: 8, min: 2, max: 40 },
    zalgoFilterAction: { type: 'choice', default: 'delete', values: ['delete', 'warn'] },
    autoReplyEnabled: { type: 'boolean', default: false },
    autoReplyRules: { type: 'text', default: '', maxLength: 4000 },
    autoReplyMatchMode: { type: 'choice', default: 'includes', values: ['exact', 'includes', 'startsWith'] },
    autoReplyIgnoreChannelIds: { type: 'text', default: '', maxLength: 500 },
    autoReplyCooldownSeconds: { type: 'number', default: 3, min: 0, max: 3600 },
    autoReplyCaseSensitive: { type: 'boolean', default: false },
    scheduledAnnouncementEnabled: { type: 'boolean', default: false },
    scheduledAnnouncementChannelId: { type: 'text', default: '', maxLength: 24 },
    scheduledAnnouncementMessage: { type: 'text', default: '', maxLength: 1500 },
    scheduledAnnouncementIntervalHours: { type: 'number', default: 24, min: 1, max: 720 },
    scheduledAnnouncementTitle: { type: 'text', default: '', maxLength: 100 },
    scheduledAnnouncementColor: { type: 'choice', default: 'teal', values: ['teal', 'blue', 'purple', 'green', 'red', 'gold'] },
    scheduledAnnouncementImageUrl: { type: 'text', default: '', maxLength: 500 },
    modLogChannelId: { type: 'text', default: '', maxLength: 24 },
    logDeletedMessages: { type: 'boolean', default: false },
    logEditedMessages: { type: 'boolean', default: false },
    logMemberJoins: { type: 'boolean', default: false },
    logMemberLeaves: { type: 'boolean', default: false },
    logModerationActions: { type: 'boolean', default: false },
    logRoleChanges: { type: 'boolean', default: false },
    logChannelChanges: { type: 'boolean', default: false },
    logBotCommands: { type: 'boolean', default: false },
    welcomeEnabled: { type: 'boolean', default: false },
    welcomeChannelId: { type: 'text', default: '', maxLength: 24 },
    welcomeMessage: { type: 'text', default: 'أهلًا {user} في {server}!', maxLength: 500 },
    welcomeRoleId: { type: 'text', default: '', maxLength: 24 },
    welcomeSendDm: { type: 'boolean', default: false },
    welcomeDmMessage: { type: 'text', default: 'أهلًا بك في السيرفر!', maxLength: 500 },
    welcomeIgnoreBots: { type: 'boolean', default: true },
    farewellEnabled: { type: 'boolean', default: false },
    farewellChannelId: { type: 'text', default: '', maxLength: 24 },
    farewellMessage: { type: 'text', default: 'غادر {user} السيرفر.', maxLength: 500 },
    verificationEnabled: { type: 'boolean', default: false },
    verificationRoleId: { type: 'text', default: '', maxLength: 24 },
    verificationChannelId: { type: 'text', default: '', maxLength: 24 },
    verificationTimeoutMinutes: { type: 'number', default: 10, min: 1, max: 1440 },
    verificationMinAccountAgeDays: { type: 'number', default: 7, min: 0, max: 365 },
    autoRoleEnabled: { type: 'boolean', default: false },
    autoRoleId: { type: 'text', default: '', maxLength: 24 },
    warningEscalationEnabled: { type: 'boolean', default: false },
    warningLimit: { type: 'number', default: 3, min: 2, max: 10 },
    warningTimeoutMinutes: { type: 'number', default: 10, min: 1, max: 10080 },
    slowmodeSeconds: { type: 'number', default: 0, min: 0, max: 21600 },
    supportChannelId: { type: 'text', default: '', maxLength: 24 },
    reportEnabled: { type: 'boolean', default: false },
    reportChannelId: { type: 'text', default: '', maxLength: 24 },
    starboardEnabled: { type: 'boolean', default: false },
    starboardChannelId: { type: 'text', default: '', maxLength: 24 },
    starboardThreshold: { type: 'number', default: 3, min: 1, max: 50 },
    starboardEmoji: { type: 'text', default: '⭐', maxLength: 32 },
    countingEnabled: { type: 'boolean', default: false },
    countingChannelId: { type: 'text', default: '', maxLength: 24 },
    featurePingEnabled: { type: 'boolean', default: true },
    featureServerInfoEnabled: { type: 'boolean', default: true },
    featureUserInfoEnabled: { type: 'boolean', default: true },
    featureAvatarEnabled: { type: 'boolean', default: true },
    featureServerIconEnabled: { type: 'boolean', default: true },
    featureMemberCountEnabled: { type: 'boolean', default: true },
    featureRoleInfoEnabled: { type: 'boolean', default: true },
    featureChannelInfoEnabled: { type: 'boolean', default: true },
    featureBotInfoEnabled: { type: 'boolean', default: true },
    featureQuoteEnabled: { type: 'boolean', default: true },
    featureChooseEnabled: { type: 'boolean', default: true },
    featureRollEnabled: { type: 'boolean', default: true },
    featureCoinflipEnabled: { type: 'boolean', default: true },
    featureNicknameEnabled: { type: 'boolean', default: true },
    featureAnnounceEnabled: { type: 'boolean', default: true },
    featureSayEnabled: { type: 'boolean', default: true },
    featureLockEnabled: { type: 'boolean', default: true },
    featureUnlockEnabled: { type: 'boolean', default: true },
    featureSlowmodeEnabled: { type: 'boolean', default: true },
    featureRoleListEnabled: { type: 'boolean', default: true },
    autoReactionEnabled: { type: 'boolean', default: false },
    autoReactionChannelId: { type: 'text', default: '', maxLength: 24 },
    autoReactionEmoji: { type: 'text', default: '✨', maxLength: 32 },
    mediaOnlyEnabled: { type: 'boolean', default: false },
    mediaOnlyChannelId: { type: 'text', default: '', maxLength: 24 },
    keywordAlertEnabled: { type: 'boolean', default: false },
    keywordAlertWords: { type: 'text', default: '', maxLength: 1000 },
    keywordAlertChannelId: { type: 'text', default: '', maxLength: 24 },
    stickyMessageEnabled: { type: 'boolean', default: false },
    stickyMessageChannelId: { type: 'text', default: '', maxLength: 24 },
    stickyMessageText: { type: 'text', default: '', maxLength: 1800 },
    autoPublishEnabled: { type: 'boolean', default: false },
    voiceLogEnabled: { type: 'boolean', default: false },
    selfRolesEnabled: { type: 'boolean', default: false },
    selfRoleAllowedIds: { type: 'text', default: '', maxLength: 500 },
    afkEnabled: { type: 'boolean', default: false },
    birthdayEnabled: { type: 'boolean', default: false },
    birthdayChannelId: { type: 'text', default: '', maxLength: 24 },
    remindersEnabled: { type: 'boolean', default: false },
    confessionsEnabled: { type: 'boolean', default: false },
    confessionsChannelId: { type: 'text', default: '', maxLength: 24 },
    tempRoleEnabled: { type: 'boolean', default: false },
    topicCommandEnabled: { type: 'boolean', default: false },
    moveCommandEnabled: { type: 'boolean', default: false },
    roleColorCommandEnabled: { type: 'boolean', default: false },
    timestampCommandEnabled: { type: 'boolean', default: false },
    eightBallEnabled: { type: 'boolean', default: false },
    randomRangeEnabled: { type: 'boolean', default: false },
    reverseTextEnabled: { type: 'boolean', default: false },
    mockTextEnabled: { type: 'boolean', default: false },
    auditRetentionDays: { type: 'number', default: 30, min: 1, max: 365 },
    antiRaidEnabled: { type: 'boolean', default: false },
    antiRaidJoinLimit: { type: 'number', default: 10, min: 2, max: 100 },
    antiRaidWindowSeconds: { type: 'number', default: 30, min: 5, max: 600 },
    antiRaidAction: { type: 'choice', default: 'alert', values: ['alert', 'lockdown'] },
    antiRaidLockdownDurationMinutes: { type: 'number', default: 5, min: 1, max: 60 },
    antiRaidLockdownExcludeChannelIds: { type: 'text', default: '', maxLength: 500 },
    antiRaidAlertRoleId: { type: 'text', default: '', maxLength: 24 },
    antiRaidMinAccountAgeDays: { type: 'number', default: 0, min: 0, max: 365 },
    antiRaidYoungAccountAction: { type: 'choice', default: 'alert', values: ['alert', 'kick', 'ban'] },
    antiRaidAlertChannelId: { type: 'text', default: '', maxLength: 24 },
    antiNukeEnabled: { type: 'boolean', default: false },
    antiNukeChannelCreateEnabled: { type: 'boolean', default: false },
    antiNukeChannelCreateLimit: { type: 'number', default: 3, min: 1, max: 20 },
    antiNukeChannelDeleteEnabled: { type: 'boolean', default: false },
    antiNukeChannelDeleteLimit: { type: 'number', default: 2, min: 1, max: 20 },
    antiNukeRoleCreateEnabled: { type: 'boolean', default: false },
    antiNukeRoleCreateLimit: { type: 'number', default: 3, min: 1, max: 20 },
    antiNukeRoleDeleteEnabled: { type: 'boolean', default: false },
    antiNukeRoleDeleteLimit: { type: 'number', default: 2, min: 1, max: 20 },
    antiNukeRoleUpdateEnabled: { type: 'boolean', default: false },
    antiNukeRoleUpdateLimit: { type: 'number', default: 3, min: 1, max: 20 },
    antiNukeBanEnabled: { type: 'boolean', default: false },
    antiNukeBanLimit: { type: 'number', default: 3, min: 1, max: 20 },
    antiNukeWebhookCreateEnabled: { type: 'boolean', default: false },
    antiNukeWebhookCreateLimit: { type: 'number', default: 3, min: 1, max: 20 },
    antiNukeWebhookDeleteEnabled: { type: 'boolean', default: false },
    antiNukeWebhookDeleteLimit: { type: 'number', default: 2, min: 1, max: 20 },
    antiNukeEmojiDeleteEnabled: { type: 'boolean', default: false },
    antiNukeEmojiDeleteLimit: { type: 'number', default: 3, min: 1, max: 20 },
    antiNukeStickerDeleteEnabled: { type: 'boolean', default: false },
    antiNukeStickerDeleteLimit: { type: 'number', default: 3, min: 1, max: 20 },
    antiNukeWindowSeconds: { type: 'number', default: 10, min: 1, max: 600 },
    antiNukeAction: { type: 'choice', default: 'alert', values: ['alert', 'timeout', 'kick', 'ban'] },
    antiNukeTimeoutMinutes: { type: 'number', default: 10, min: 1, max: 1440 },
    antiNukeAlertChannelId: { type: 'text', default: '', maxLength: 24 },
    antiNukeAlertRoleId: { type: 'text', default: '', maxLength: 24 },
    antiNukeAllowlistedUserIds: { type: 'text', default: '', maxLength: 500 },
    antiNukeAllowlistedRoleIds: { type: 'text', default: '', maxLength: 500 },
    antiNukeCooldownSeconds: { type: 'number', default: 300, min: 0, max: 3600 },
    antiNukeLockdownEnabled: { type: 'boolean', default: false },
    antiNukeLockdownDurationMinutes: { type: 'number', default: 5, min: 1, max: 60 },
    antiNukeLogAllEvents: { type: 'boolean', default: false },
    antiMentionRaidEnabled: { type: 'boolean', default: false },
    antiMentionRaidBlockEveryone: { type: 'boolean', default: true },
    antiMentionRaidBlockHere: { type: 'boolean', default: true },
    antiMentionRaidLimit: { type: 'number', default: 5, min: 2, max: 30 },
    antiMentionRaidWindowSeconds: { type: 'number', default: 10, min: 3, max: 120 },
    antiMentionRaidMessageLimit: { type: 'number', default: 4, min: 2, max: 20 },
    antiMentionRaidTimeoutEnabled: { type: 'boolean', default: false },
    antiMentionRaidTimeoutMinutes: { type: 'number', default: 3, min: 1, max: 1440 },
    antiSuspiciousActivityEnabled: { type: 'boolean', default: false },
    antiSuspiciousActivityThreshold: { type: 'number', default: 4, min: 2, max: 20 },
    antiSuspiciousActivityWindowSeconds: { type: 'number', default: 30, min: 5, max: 600 },
    antiSuspiciousAutoLockdownEnabled: { type: 'boolean', default: false },
    antiSuspiciousLockdownDurationMinutes: { type: 'number', default: 5, min: 1, max: 60 },
    antiPermissionAbuseEnabled: { type: 'boolean', default: false },
    antiPermissionAbuseRevertEnabled: { type: 'boolean', default: false },
    antiBotEnabled: { type: 'boolean', default: false },
    antiBotApprovedIds: { type: 'text', default: '', maxLength: 1000 },
    antiImpersonationEnabled: { type: 'boolean', default: false },
    antiImpersonationStaffRoleIds: { type: 'text', default: '', maxLength: 500 },
    antiAltEnabled: { type: 'boolean', default: false },
    antiAltMinAccountAgeDays: { type: 'number', default: 14, min: 1, max: 365 },
    antiAltAction: { type: 'choice', default: 'alert', values: ['alert', 'timeout', 'kick'] },
    antiAltTimeoutMinutes: { type: 'number', default: 10, min: 1, max: 1440 },
    antiAltClusterLimit: { type: 'number', default: 3, min: 2, max: 20 },
    antiAltWindowSeconds: { type: 'number', default: 60, min: 10, max: 600 },
    inviteTrackingEnabled: { type: 'boolean', default: false },
    inviteRewardRoleId: { type: 'text', default: '', maxLength: 24 },
    inviteRewardThreshold: { type: 'number', default: 5, min: 1, max: 100 },
    ticketEnabled: { type: 'boolean', default: false },
    ticketPanelChannelId: { type: 'text', default: '', maxLength: 24 },
    ticketPanelTitle: { type: 'text', default: 'تحتاج مساعدة؟', maxLength: 100 },
    ticketPanelDescription: { type: 'text', default: 'اضغط الزر أدناه لفتح قناة خاصة مع فريق الدعم.', maxLength: 1000 },
    ticketPanelColor: { type: 'choice', default: 'teal', values: ['teal', 'blue', 'purple', 'green', 'red', 'gold'] },
    ticketPanelButtonLabel: { type: 'text', default: 'فتح تذكرة', maxLength: 80 },
    ticketPanelButtonStyle: { type: 'choice', default: 'primary', values: ['primary', 'secondary', 'success', 'danger'] },
    ticketPanelButtonEmoji: { type: 'text', default: '🎫', maxLength: 32 },
    ticketAskReason: { type: 'boolean', default: true },
    ticketReasonTitle: { type: 'text', default: 'سبب فتح التذكرة', maxLength: 100 },
    ticketReasonPlaceholder: { type: 'text', default: 'اكتب تفاصيل طلبك باختصار...', maxLength: 100 },
    ticketMaxOpen: { type: 'number', default: 1, min: 1, max: 5 },
    ticketCategoryId: { type: 'text', default: '', maxLength: 24 },
    ticketSupportRoleId: { type: 'text', default: '', maxLength: 24 },
    ticketTranscriptChannelId: { type: 'text', default: '', maxLength: 24 },
    ticketTranscriptEnabled: { type: 'boolean', default: true },
    ticketNotifySupport: { type: 'boolean', default: true },
    ticketWelcomeTitle: { type: 'text', default: 'تذكرة دعم جديدة', maxLength: 100 },
    ticketWelcomeMessage: { type: 'text', default: 'أهلًا {user}، اشرح مشكلتك هنا وسيرد عليك فريق الدعم.', maxLength: 1500 },
    ticketWelcomeColor: { type: 'choice', default: 'blue', values: ['teal', 'blue', 'purple', 'green', 'red', 'gold'] },
    ticketWelcomeImageUrl: { type: 'text', default: '', maxLength: 500 },
    ticketCloseButtonLabel: { type: 'text', default: 'إغلاق التذكرة', maxLength: 80 },
    ticketCloseButtonStyle: { type: 'choice', default: 'danger', values: ['primary', 'secondary', 'success', 'danger'] },
    ticketAllowMemberClose: { type: 'boolean', default: true },
    ticketCloseMessage: { type: 'text', default: 'تم إغلاق التذكرة.', maxLength: 300 },
    ticketCloseDeleteAfterMinutes: { type: 'number', default: 0, min: 0, max: 1440 },
    ticketConfirmationMessage: { type: 'text', default: 'تم فتح تذكرتك: {channel}', maxLength: 200 },
    ticketNamePrefix: { type: 'text', default: 'ticket', maxLength: 24 },
    suggestionEnabled: { type: 'boolean', default: false },
    suggestionChannelId: { type: 'text', default: '', maxLength: 24 },
    suggestionReviewChannelId: { type: 'text', default: '', maxLength: 24 },
    suggestionEmbedTitle: { type: 'text', default: 'اقتراح جديد', maxLength: 100 },
    suggestionEmbedColor: { type: 'choice', default: 'teal', values: ['teal', 'blue', 'purple', 'green', 'red', 'gold'] },
    suggestionAnonymousEnabled: { type: 'boolean', default: false },
    suggestionMinLength: { type: 'number', default: 5, min: 1, max: 500 },
    suggestionMaxLength: { type: 'number', default: 1000, min: 10, max: 1000 },
    suggestionUpvoteLabel: { type: 'text', default: 'موافق', maxLength: 40 },
    suggestionDownvoteLabel: { type: 'text', default: 'غير موافق', maxLength: 40 },
    suggestionUpvoteEmoji: { type: 'text', default: '👍', maxLength: 32 },
    suggestionDownvoteEmoji: { type: 'text', default: '👎', maxLength: 32 },
    suggestionUpvoteStyle: { type: 'choice', default: 'success', values: ['primary', 'secondary', 'success', 'danger'] },
    suggestionDownvoteStyle: { type: 'choice', default: 'secondary', values: ['primary', 'secondary', 'success', 'danger'] },
    suggestionConfirmationMessage: { type: 'text', default: 'وصل اقتراحك إلى فريق السيرفر، شكرًا لك!', maxLength: 200 },
    suggestionReviewMessage: { type: 'text', default: 'اقتراح جديد للمراجعة من {user}', maxLength: 300 },
    suggestionEmbedImageUrl: { type: 'text', default: '', maxLength: 500 },
    customEmbedChannelId: { type: 'text', default: '', maxLength: 24 },
    customEmbedTitle: { type: 'text', default: '', maxLength: 256 },
    customEmbedDescription: { type: 'text', default: '', maxLength: 4000 },
    customEmbedThumbnailUrl: { type: 'text', default: '', maxLength: 500 },
    customEmbedImageUrl: { type: 'text', default: '', maxLength: 500 },
    customEmbedColor: { type: 'color', default: '#5865f2' },
    customEmbedsJson: { type: 'text', default: '[]', maxLength: 50000 },
    gamesEnabled: { type: 'boolean', default: true },
    gameChannelIds: { type: 'text', default: '', maxLength: 500 },
    gamesCooldownSeconds: { type: 'number', default: 8, min: 0, max: 300 },
    gamesTriviaEnabled: { type: 'boolean', default: true },
    gamesPictureGuessEnabled: { type: 'boolean', default: true },
    gamesSpotDifferenceEnabled: { type: 'boolean', default: true },
    gamesScrambleEnabled: { type: 'boolean', default: true },
    gamesRiddleEnabled: { type: 'boolean', default: true },
    gamesMathEnabled: { type: 'boolean', default: true },
    gamesMemoryEnabled: { type: 'boolean', default: true },
    gamesRpsEnabled: { type: 'boolean', default: true },
    gamesDiceEnabled: { type: 'boolean', default: true },
    gamesTicTacToeEnabled: { type: 'boolean', default: true },
    gamesEmojiPuzzleEnabled: { type: 'boolean', default: true },
    gamesTrueFalseEnabled: { type: 'boolean', default: true },
    gamesGeographyEnabled: { type: 'boolean', default: true },
    gamesWordGuessEnabled: { type: 'boolean', default: true },
    gamesTypingEnabled: { type: 'boolean', default: true },
    gamesOddOneEnabled: { type: 'boolean', default: true },
    gamesNumberGuessEnabled: { type: 'boolean', default: true },
    gamesCoinEnabled: { type: 'boolean', default: true },
    gamesHigherLowerEnabled: { type: 'boolean', default: true },
    pollEnabled: { type: 'boolean', default: false },
    pollChannelIds: { type: 'text', default: '', maxLength: 500 },
    levelSystemEnabled: { type: 'boolean', default: false },
    levelAnnouncementChannelId: { type: 'text', default: '', maxLength: 24 },
    levelUpMessage: { type: 'text', default: 'مبروك {user} وصلت للمستوى {level}!', maxLength: 300 },
    levelCooldownSeconds: { type: 'number', default: 60, min: 5, max: 3600 },
    autorunBackupEnabled: { type: 'boolean', default: false },
    autorunBackupIntervalHours: { type: 'number', default: 24, min: 1, max: 168 },
    azkarEnabled: { type: 'boolean', default: false },
    azkarChannelId: { type: 'text', default: '', maxLength: 24 },
    azkarMessage: { type: 'text', default: '', maxLength: 1500 },
    azkarIntervalHours: { type: 'number', default: 24, min: 1, max: 168 },
    quranReminderEnabled: { type: 'boolean', default: false },
    quranChannelId: { type: 'text', default: '', maxLength: 24 },
    quranMessage: { type: 'text', default: '', maxLength: 1500 },
    quranIntervalHours: { type: 'number', default: 24, min: 1, max: 168 }
};

const EXTRA_DEFAULTS = Object.freeze(Object.fromEntries(
    Object.entries(EXTRA_SETTING_SCHEMA).map(([key, definition]) => [key, definition.default])
));

function getSql() {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for server settings.');
    sql ||= neon(process.env.DATABASE_URL);
    return sql;
}

async function getReadySql() {
    const database = getSql();
    ready ||= (async () => {
        await database`
            CREATE TABLE IF NOT EXISTS ys_bot_guild_settings (
                guild_id TEXT PRIMARY KEY,
                updated_by TEXT NOT NULL,
                command_prefix TEXT NOT NULL DEFAULT '!',
                anti_spam BOOLEAN NOT NULL DEFAULT FALSE,
                anti_links BOOLEAN NOT NULL DEFAULT FALSE,
                extra_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;
        await database`ALTER TABLE ys_bot_guild_settings ADD COLUMN IF NOT EXISTS extra_settings JSONB NOT NULL DEFAULT '{}'::jsonb`;
        await database`
            CREATE TABLE IF NOT EXISTS ys_bot_embed_queue (
                id BIGSERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                requested_by TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                result TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;
        await database`
            CREATE TABLE IF NOT EXISTS ys_bot_server_backups (
                id BIGSERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                created_by TEXT NOT NULL,
                snapshot JSONB NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;
        await database`
            CREATE TABLE IF NOT EXISTS ys_bot_server_tasks (
                id BIGSERIAL PRIMARY KEY,
                guild_id TEXT NOT NULL,
                requested_by TEXT NOT NULL,
                task_type TEXT NOT NULL,
                backup_id BIGINT,
                status TEXT NOT NULL DEFAULT 'pending',
                progress INTEGER NOT NULL DEFAULT 0,
                message TEXT NOT NULL DEFAULT '',
                result_backup_id BIGINT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `;
        await database`CREATE INDEX IF NOT EXISTS ys_bot_server_backups_guild_created_idx ON ys_bot_server_backups (guild_id, created_at DESC)`;
        await database`CREATE INDEX IF NOT EXISTS ys_bot_server_tasks_queue_idx ON ys_bot_server_tasks (status, created_at)`;
    })();
    try {
        await ready;
    } catch (error) {
        ready = undefined;
        throw error;
    }
    return database;
}

const DEFAULT_SETTINGS = Object.freeze({ commandPrefix: '!', antiSpam: false, antiLinks: false });

async function getGuildSettings(guildId) {
    const database = await getReadySql();
    const rows = await database`
        SELECT command_prefix AS "commandPrefix", anti_spam AS "antiSpam", anti_links AS "antiLinks", extra_settings AS "extraSettings"
        FROM ys_bot_guild_settings WHERE guild_id = ${String(guildId)} LIMIT 1
    `;
    const row = rows[0];
    return {
        ...DEFAULT_SETTINGS,
        ...(row || {}),
        advancedSettings: { ...EXTRA_DEFAULTS, ...(row?.extraSettings || {}) }
    };
}

function validateExtraSettings(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid advanced settings.');
    const clean = { ...EXTRA_DEFAULTS };
    for (const [key, entry] of Object.entries(value)) {
        const definition = EXTRA_SETTING_SCHEMA[key];
        if (!definition) throw new Error(`Unknown setting: ${key}`);
        if (definition.type === 'boolean') {
            if (typeof entry !== 'boolean') throw new Error(`Invalid boolean setting: ${key}`);
            clean[key] = entry;
        } else if (definition.type === 'number') {
            const number = Number(entry);
            if (!Number.isInteger(number) || number < definition.min || number > definition.max) throw new Error(`Invalid number setting: ${key}`);
            clean[key] = number;
        } else if (definition.type === 'choice') {
            if (!definition.values.includes(entry)) throw new Error(`Invalid choice setting: ${key}`);
            clean[key] = entry;
        } else if (definition.type === 'color') {
            if (typeof entry !== 'string' || !/^#[\da-f]{6}$/i.test(entry)) throw new Error(`Invalid color setting: ${key}`);
            clean[key] = entry.toLowerCase();
        } else {
            if (typeof entry !== 'string' || entry.length > definition.maxLength || entry.includes('\0')) throw new Error(`Invalid text setting: ${key}`);
            clean[key] = entry.trim();
        }
    }
    return clean;
}

async function saveGuildSettings(guildId, updatedBy, settings) {
    const database = await getReadySql();
    const advancedSettings = validateExtraSettings(settings.advancedSettings || {});
    const rows = await database`
        INSERT INTO ys_bot_guild_settings (guild_id, updated_by, command_prefix, anti_spam, anti_links, extra_settings)
        VALUES (${String(guildId)}, ${String(updatedBy)}, ${settings.commandPrefix}, ${settings.antiSpam}, ${settings.antiLinks}, ${JSON.stringify(advancedSettings)}::jsonb)
        ON CONFLICT (guild_id) DO UPDATE SET
            updated_by = EXCLUDED.updated_by,
            command_prefix = EXCLUDED.command_prefix,
            anti_spam = EXCLUDED.anti_spam,
            anti_links = EXCLUDED.anti_links,
            extra_settings = EXCLUDED.extra_settings,
            updated_at = NOW()
        RETURNING command_prefix AS "commandPrefix", anti_spam AS "antiSpam", anti_links AS "antiLinks", extra_settings AS "extraSettings"
    `;
    return { ...rows[0], advancedSettings };
}

async function enqueueEmbedSend(guildId, requestedBy) {
    const database = await getReadySql();
    const rows = await database`
        INSERT INTO ys_bot_embed_queue (guild_id, requested_by)
        VALUES (${String(guildId)}, ${String(requestedBy)})
        RETURNING id
    `;
    return String(rows[0].id);
}

async function getEmbedSendRequest(guildId, requestId, requestedBy) {
    const database = await getReadySql();
    const rows = await database`
        SELECT status, result FROM ys_bot_embed_queue
        WHERE id = ${String(requestId)} AND guild_id = ${String(guildId)} AND requested_by = ${String(requestedBy)}
        LIMIT 1
    `;
    return rows[0] || null;
}

async function claimEmbedSendRequests(limit = 5) {
    const database = await getReadySql();
    return database`
        WITH pending AS (
            SELECT id FROM ys_bot_embed_queue
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT ${Math.max(1, Math.min(Number(limit) || 5, 20))}
            FOR UPDATE SKIP LOCKED
        )
        UPDATE ys_bot_embed_queue AS queue
        SET status = 'processing', updated_at = NOW()
        FROM pending
        WHERE queue.id = pending.id
        RETURNING queue.id, queue.guild_id AS "guildId"
    `;
}

async function completeEmbedSendRequest(requestId, status, result) {
    if (!['sent', 'failed'].includes(status)) throw new Error('Invalid embed queue status.');
    const database = await getReadySql();
    await database`
        UPDATE ys_bot_embed_queue
        SET status = ${status}, result = ${String(result || '').slice(0, 300)}, updated_at = NOW()
        WHERE id = ${String(requestId)}
    `;
}

async function createServerTask(guildId, requestedBy, taskType, backupId = null) {
    if (!['backup', 'restore', 'verification-panel'].includes(taskType)) throw new Error('Invalid server task type.');
    const database = await getReadySql();
    const rows = await database`
        INSERT INTO ys_bot_server_tasks (guild_id, requested_by, task_type, backup_id)
        VALUES (${String(guildId)}, ${String(requestedBy)}, ${taskType}, ${backupId === null ? null : String(backupId)})
        RETURNING id
    `;
    return String(rows[0].id);
}

async function listServerBackups(guildId) {
    const database = await getReadySql();
    return database`
        SELECT id, created_at AS "createdAt", snapshot->>'guildName' AS "guildName",
            jsonb_array_length(COALESCE(snapshot->'channels', '[]'::jsonb)) AS "channelCount",
            jsonb_array_length(COALESCE(snapshot->'roles', '[]'::jsonb)) AS "roleCount"
        FROM ys_bot_server_backups WHERE guild_id = ${String(guildId)}
        ORDER BY created_at DESC LIMIT 25
    `;
}

async function getServerBackup(guildId, backupId) {
    const database = await getReadySql();
    const rows = await database`
        SELECT id, snapshot FROM ys_bot_server_backups
        WHERE guild_id = ${String(guildId)} AND id = ${String(backupId)} LIMIT 1
    `;
    return rows[0] || null;
}

async function getServerTask(taskId, guildId, requestedBy) {
    const database = await getReadySql();
    const rows = await database`
        SELECT id, status, progress, message, result_backup_id AS "backupId"
        FROM ys_bot_server_tasks
        WHERE id = ${String(taskId)} AND guild_id = ${String(guildId)} AND requested_by = ${String(requestedBy)}
        LIMIT 1
    `;
    return rows[0] || null;
}

async function claimServerTasks(limit = 2) {
    const database = await getReadySql();
    return database`
        WITH pending AS (
            SELECT id FROM ys_bot_server_tasks
            WHERE status = 'pending' OR (status = 'processing' AND updated_at < NOW() - INTERVAL '3 minutes')
            ORDER BY created_at ASC
            LIMIT ${Math.max(1, Math.min(Number(limit) || 2, 5))}
            FOR UPDATE SKIP LOCKED
        )
        UPDATE ys_bot_server_tasks AS task
        SET status = 'processing', updated_at = NOW()
        FROM pending WHERE task.id = pending.id
        RETURNING task.id, task.guild_id AS "guildId", task.requested_by AS "requestedBy", task.task_type AS "taskType", task.backup_id AS "backupId"
    `;
}

async function getServerBackupForBot(guildId, backupId) {
    const backup = await getServerBackup(guildId, backupId);
    return backup?.snapshot || null;
}

async function updateServerTask(taskId, progress, message) {
    const database = await getReadySql();
    await database`
        UPDATE ys_bot_server_tasks
        SET status = 'processing', progress = ${Math.max(0, Math.min(Number(progress) || 0, 99))},
            message = ${String(message || '').slice(0, 300)}, updated_at = NOW()
        WHERE id = ${String(taskId)} AND status = 'processing'
    `;
}

async function completeServerTask(taskId, { status, message, snapshot = null, backupId = null }) {
    if (!['completed', 'failed'].includes(status)) throw new Error('Invalid server task status.');
    const database = await getReadySql();
    if (status === 'completed' && snapshot) {
        const taskRows = await database`SELECT guild_id, requested_by FROM ys_bot_server_tasks WHERE id = ${String(taskId)} AND status = 'processing' LIMIT 1`;
        if (!taskRows[0]) return;
        await database`
            WITH backup AS (
                INSERT INTO ys_bot_server_backups (guild_id, created_by, snapshot)
                VALUES (${taskRows[0].guild_id}, ${taskRows[0].requested_by}, ${JSON.stringify(snapshot)}::jsonb)
                RETURNING id
            )
            UPDATE ys_bot_server_tasks SET status = 'completed', progress = 100,
                message = ${String(message || 'اكتمل النسخ الاحتياطي.').slice(0, 300)},
                result_backup_id = (SELECT id FROM backup), updated_at = NOW()
            WHERE id = ${String(taskId)}
        `;
        await database`
            DELETE FROM ys_bot_server_backups
            WHERE guild_id = ${taskRows[0].guild_id}
              AND id NOT IN (
                  SELECT id FROM ys_bot_server_backups
                  WHERE guild_id = ${taskRows[0].guild_id}
                  ORDER BY created_at DESC LIMIT 25
              )
        `;
        return;
    }
    await database`
        UPDATE ys_bot_server_tasks SET status = ${status}, progress = ${status === 'completed' ? 100 : 0},
            message = ${String(message || '').slice(0, 300)},
            result_backup_id = ${backupId === null ? null : String(backupId)}, updated_at = NOW()
        WHERE id = ${String(taskId)}
    `;
}

module.exports = { DEFAULT_SETTINGS, EXTRA_DEFAULTS, EXTRA_SETTING_SCHEMA, getGuildSettings, saveGuildSettings, validateExtraSettings, enqueueEmbedSend, getEmbedSendRequest, claimEmbedSendRequests, completeEmbedSendRequest, createServerTask, listServerBackups, getServerBackup, getServerTask, claimServerTasks, getServerBackupForBot, updateServerTask, completeServerTask };
