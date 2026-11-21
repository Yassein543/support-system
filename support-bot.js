require('dotenv').config();

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Client,
    EmbedBuilder,
    GatewayIntentBits,
    StringSelectMenuBuilder
} = require('discord.js');

const SUPPORT_CHANNEL_ID = '1552286844350234715';
const TRANSLATE_BUTTON_ID = 'ys_support_rules_translate';
const LANGUAGE_MENU_ID = 'ys_support_rules_language';
const SUPPORT_TOKEN = process.env.SUPPORT_DISCORD_TOKEN;

const rules = {
    en: {
        language: 'English', title: 'YS-Bot Support Server Rules', intro: 'Please follow these rules so our support team can help everyone safely and efficiently.',
        items: [
            'Be respectful to members and staff. Harassment, hate speech, threats, and personal attacks are not allowed.',
            'Use the right support channel and keep messages on topic. Do not spam, flood, or repeatedly ping staff.',
            'Explain your issue clearly and include useful steps or screenshots when relevant. Never post passwords, API tokens, or private account details.',
            'Do not send staff unsolicited direct messages. Open a support ticket and wait for a reply there.',
            'Do not share another person’s private information or publish private ticket conversations without permission.',
            'Report security issues privately to the staff. Do not exploit, disrupt, or test vulnerabilities against servers or accounts.',
            'Follow Discord’s Terms of Service and Community Guidelines while using this server.',
            'Staff may move or close duplicate, off-topic, or inactive support conversations to keep the server organized.',
            'False reports, abuse of support tools, or repeated rule violations may result in restricted access or removal from the server.'
        ], footer: 'YS-Bot Support • Choose a language to read these rules in your preferred language.', translate: 'Translate', choose: 'Choose your language'
    },
    ar: {
        language: 'العربية', title: 'قوانين سيرفر دعم YS-Bot', intro: 'يرجى الالتزام بالقوانين حتى يقدر فريق الدعم يساعد الجميع بأمان وبشكل مرتب.',
        items: [
            'احترم الأعضاء وفريق الدعم. يُمنع التنمر وخطاب الكراهية والتهديد والإساءة الشخصية.',
            'استخدم قناة الدعم المناسبة والتزم بموضوعها. يُمنع الإغراق وتكرار الرسائل ومنشن المشرفين بلا داعٍ.',
            'اشرح مشكلتك بوضوح وأرفق خطوات أو صورًا مفيدة عند الحاجة. لا تنشر كلمات المرور أو مفاتيح API أو بيانات حسابك الخاصة.',
            'لا تراسل فريق الدعم خاصًا من دون طلب. افتح تذكرة وانتظر الرد فيها.',
            'لا تنشر معلومات خاصة عن الآخرين أو محادثات التذاكر الخاصة دون إذن.',
            'أرسل بلاغات الثغرات الأمنية إلى الفريق بشكل خاص. لا تستغل الثغرات ولا تعطل السيرفرات أو الحسابات.',
            'التزم بشروط خدمة Discord وإرشادات المجتمع أثناء استخدام السيرفر.',
            'قد ينقل فريق الدعم أو يغلق المحادثات المكررة أو الخارجة عن الموضوع أو غير النشطة للمحافظة على ترتيب السيرفر.',
            'قد يؤدي البلاغ الكاذب أو إساءة استخدام أدوات الدعم أو تكرار مخالفة القوانين إلى تقييد الوصول أو إزالة العضو.'
        ], footer: 'دعم YS-Bot • اختر اللغة التي تفضلها لقراءة القوانين.', translate: 'ترجمة القوانين', choose: 'اختر لغتك'
    },
    fr: {
        language: 'Français', title: 'Règles du serveur d’assistance YS-Bot', intro: 'Veuillez respecter ces règles afin que notre équipe puisse aider chacun efficacement et en toute sécurité.',
        items: [
            'Respectez les membres et le personnel. Le harcèlement, les menaces, les propos haineux et les attaques personnelles sont interdits.',
            'Utilisez le bon salon d’assistance et restez dans le sujet. Évitez le spam et les mentions répétées du personnel.',
            'Décrivez clairement le problème et ajoutez des étapes ou captures utiles si nécessaire. Ne publiez jamais de mot de passe, jeton API ou donnée privée.',
            'Ne contactez pas le personnel en message privé sans y être invité. Ouvrez un ticket et attendez la réponse dans celui-ci.',
            'Ne partagez pas les informations privées d’autrui ni le contenu d’un ticket privé sans autorisation.',
            'Signalez les problèmes de sécurité en privé. N’exploitez pas de vulnérabilité et ne perturbez aucun serveur ou compte.',
            'Respectez les Conditions d’utilisation et les Règles de la communauté de Discord.',
            'Le personnel peut déplacer ou fermer les demandes en double, hors sujet ou inactives.',
            'Les faux signalements, l’abus des outils d’assistance ou les infractions répétées peuvent entraîner une restriction ou une exclusion.'
        ], footer: 'Assistance YS-Bot • Choisissez une langue pour lire ces règles.', translate: 'Traduire', choose: 'Choisissez votre langue'
    },
    es: {
        language: 'Español', title: 'Reglas del servidor de soporte de YS-Bot', intro: 'Sigue estas reglas para que el equipo pueda ayudar a todos de forma segura y eficaz.',
        items: [
            'Respeta a los miembros y al equipo. No se permite el acoso, el discurso de odio, las amenazas ni los ataques personales.',
            'Usa el canal de soporte adecuado y mantén el tema. No envíes spam ni menciones repetidamente al equipo.',
            'Explica el problema con claridad y añade pasos o capturas útiles cuando sea necesario. Nunca publiques contraseñas, tokens API ni datos privados.',
            'No envíes mensajes privados al equipo sin que te lo pidan. Abre un ticket y espera allí la respuesta.',
            'No compartas información privada de otras personas ni conversaciones privadas de tickets sin permiso.',
            'Informa de los problemas de seguridad en privado. No explotes vulnerabilidades ni interrumpas servidores o cuentas.',
            'Cumple los Términos del servicio y las Normas de la comunidad de Discord.',
            'El equipo puede mover o cerrar solicitudes duplicadas, fuera de tema o inactivas.',
            'Los informes falsos, el abuso de las herramientas de soporte o las infracciones repetidas pueden limitar el acceso o causar la expulsión.'
        ], footer: 'Soporte YS-Bot • Elige un idioma para leer estas reglas.', translate: 'Traducir', choose: 'Elige tu idioma'
    },
    de: {
        language: 'Deutsch', title: 'Regeln des YS-Bot-Supportservers', intro: 'Bitte halte dich an diese Regeln, damit unser Team allen sicher und effizient helfen kann.',
        items: [
            'Behandle Mitglieder und Teammitglieder respektvoll. Belästigung, Hassrede, Drohungen und persönliche Angriffe sind untersagt.',
            'Nutze den passenden Supportkanal und bleibe beim Thema. Spam und wiederholtes Anpingen des Teams sind nicht erlaubt.',
            'Beschreibe dein Problem klar und füge bei Bedarf hilfreiche Schritte oder Screenshots hinzu. Teile niemals Passwörter, API-Tokens oder private Kontodaten.',
            'Schreibe Teammitgliedern nicht unaufgefordert privat. Eröffne ein Ticket und warte dort auf eine Antwort.',
            'Veröffentliche keine privaten Informationen anderer oder private Ticketgespräche ohne Erlaubnis.',
            'Melde Sicherheitsprobleme privat. Nutze keine Schwachstellen aus und störe keine Server oder Konten.',
            'Befolge die Nutzungsbedingungen und Community-Richtlinien von Discord.',
            'Das Team kann doppelte, themenfremde oder inaktive Supportgespräche verschieben oder schließen.',
            'Falsche Meldungen, missbräuchliche Nutzung der Supporttools oder wiederholte Verstöße können zu Einschränkungen oder einem Ausschluss führen.'
        ], footer: 'YS-Bot Support • Wähle eine Sprache, um diese Regeln zu lesen.', translate: 'Übersetzen', choose: 'Sprache auswählen'
    },
    pt: {
        language: 'Português', title: 'Regras do servidor de suporte YS-Bot', intro: 'Siga estas regras para que a equipa possa ajudar todos com segurança e eficiência.',
        items: [
            'Respeite os membros e a equipa. Assédio, discurso de ódio, ameaças e ataques pessoais não são permitidos.',
            'Use o canal de suporte adequado e mantenha-se no assunto. Não envie spam nem marque repetidamente a equipa.',
            'Explique o problema com clareza e inclua passos ou capturas úteis quando necessário. Nunca publique palavras-passe, tokens de API ou dados privados.',
            'Não envie mensagens privadas à equipa sem ser solicitado. Abra um ticket e aguarde a resposta nele.',
            'Não partilhe informações privadas de outras pessoas nem conversas de tickets privados sem autorização.',
            'Reporte problemas de segurança em privado. Não explore vulnerabilidades nem interrompa servidores ou contas.',
            'Cumpra os Termos de Serviço e as Diretrizes da Comunidade do Discord.',
            'A equipa pode mover ou fechar pedidos duplicados, fora do assunto ou inativos.',
            'Denúncias falsas, abuso das ferramentas de suporte ou infrações repetidas podem restringir o acesso ou resultar na remoção do servidor.'
        ], footer: 'Suporte YS-Bot • Escolha um idioma para ler estas regras.', translate: 'Traduzir', choose: 'Escolha o seu idioma'
    },
    ko: {
        language: '한국어', title: 'YS-Bot 지원 서버 규칙', intro: '지원팀이 모두를 안전하고 효율적으로 도울 수 있도록 아래 규칙을 지켜 주세요.',
        items: [
            '멤버와 운영진을 존중해 주세요. 괴롭힘, 혐오 발언, 협박 및 인신공격은 금지됩니다.',
            '알맞은 지원 채널을 사용하고 주제에 맞게 대화해 주세요. 스팸이나 운영진을 반복해서 멘션하지 마세요.',
            '문제를 명확히 설명하고 필요한 경우 재현 단계나 스크린샷을 첨부해 주세요. 비밀번호, API 토큰, 계정의 개인 정보를 절대 올리지 마세요.',
            '요청받지 않은 운영진 DM은 보내지 마세요. 티켓을 열고 그곳에서 답변을 기다려 주세요.',
            '허가 없이 타인의 개인 정보나 비공개 티켓 대화를 공유하지 마세요.',
            '보안 문제는 운영진에게 비공개로 신고해 주세요. 취약점을 악용하거나 서버 또는 계정을 방해하지 마세요.',
            'Discord 서비스 약관과 커뮤니티 가이드라인을 준수해 주세요.',
            '운영진은 중복되거나 주제에서 벗어나거나 비활성 상태인 지원 대화를 이동하거나 닫을 수 있습니다.',
            '허위 신고, 지원 기능 악용 또는 반복적인 규칙 위반은 이용 제한이나 서버 퇴장으로 이어질 수 있습니다.'
        ], footer: 'YS-Bot 지원 • 원하는 언어를 선택해 규칙을 읽으세요.', translate: '번역', choose: '언어를 선택하세요'
    },
    ja: {
        language: '日本語', title: 'YS-Bot サポートサーバーのルール', intro: 'サポートチームが安全かつ円滑に対応できるよう、以下のルールを守ってください。',
        items: [
            'メンバーとスタッフを尊重してください。嫌がらせ、ヘイトスピーチ、脅迫、個人攻撃は禁止です。',
            '適切なサポートチャンネルを使い、話題に沿って投稿してください。スパムやスタッフへの連続メンションは禁止です。',
            '問題を分かりやすく説明し、必要に応じて手順やスクリーンショットを添えてください。パスワード、APIトークン、個人情報は投稿しないでください。',
            'スタッフから案内がない限り、個別DMを送らないでください。チケットを作成し、そこで返信をお待ちください。',
            '許可なく他人の個人情報や非公開チケットの内容を共有しないでください。',
            'セキュリティ上の問題はスタッフに非公開で報告してください。脆弱性を悪用したり、サーバーやアカウントを妨害したりしないでください。',
            'Discordの利用規約とコミュニティガイドラインを守ってください。',
            '重複、話題違い、または長期間動きのないサポート会話は、スタッフが移動または終了する場合があります。',
            '虚偽の報告、サポート機能の悪用、または繰り返しの違反は、利用制限やサーバーからの退出につながる場合があります。'
        ], footer: 'YS-Bot サポート • 言語を選んでルールを読んでください。', translate: '翻訳', choose: '言語を選択'
    }
};

function createRulesEmbed(language = 'en') {
    const copy = rules[language] || rules.en;
    const description = `${copy.intro}\n\n${copy.items.map((item, index) => `**${String(index + 1).padStart(2, '0')}.** ${item}`).join('\n\n')}`;
    return new EmbedBuilder()
        .setColor(0x20b6aa)
        .setTitle(copy.title)
        .setDescription(description)
        .setFooter({ text: copy.footer });
}

function createRulesComponents() {
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(TRANSLATE_BUTTON_ID)
            .setLabel(rules.en.translate)
            .setStyle(ButtonStyle.Secondary)
    )];
}

function createLanguageMenu() {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(LANGUAGE_MENU_ID)
        .setPlaceholder(rules.en.choose)
        .addOptions(Object.entries(rules).map(([value, copy]) => ({
            label: copy.language,
            value,
            description: copy.title.slice(0, 100)
        })));
    return new ActionRowBuilder().addComponents(menu);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
    console.log(`YS-Bot Support online as ${client.user.tag}`);
    try {
        const channel = await client.channels.fetch(SUPPORT_CHANNEL_ID);
        if (!channel?.isTextBased() || !channel.messages?.fetch) {
            throw new Error(`Support channel ${SUPPORT_CHANNEL_ID} is unavailable or is not a text channel.`);
        }
        const recentMessages = await channel.messages.fetch({ limit: 50 }).catch(() => null);
        const existingRulesMessage = recentMessages?.find((message) =>
            message.author.id === client.user.id &&
            message.components.some((row) => row.components.some((component) => component.customId === TRANSLATE_BUTTON_ID))
        );
        if (existingRulesMessage) {
            console.log('Support rules message already exists; leaving it unchanged.');
            return;
        }
        await channel.send({ embeds: [createRulesEmbed('en')], components: createRulesComponents(), allowedMentions: { parse: [] } });
        console.log(`Posted support rules to channel ${SUPPORT_CHANNEL_ID}.`);
    } catch (error) {
        console.error('Could not post support rules:', error.message);
    }
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isButton() && interaction.customId === TRANSLATE_BUTTON_ID) {
            return interaction.reply({ content: rules.en.choose, components: [createLanguageMenu()], ephemeral: true });
        }
        if (interaction.isStringSelectMenu() && interaction.customId === LANGUAGE_MENU_ID) {
            const language = interaction.values[0];
            return interaction.update({ content: '', embeds: [createRulesEmbed(language)], components: [] });
        }
    } catch (error) {
        console.error('Support rules interaction failed:', error.message);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Could not load the selected translation. Please try again.', ephemeral: true }).catch(() => {});
        }
    }
});

if (!SUPPORT_TOKEN) {
    console.error('Missing SUPPORT_DISCORD_TOKEN. Add it to the local .env file before starting the support bot.');
    process.exit(1);
}

client.login(SUPPORT_TOKEN).catch((error) => {
    console.error('Support bot login failed. Check the support bot token and intents.', error.message);
    process.exit(1);
});
