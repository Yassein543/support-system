const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const SECRETS_FILE = path.join(__dirname, '2fa-secrets.json');

function loadSecrets() {
    try {
        if (fs.existsSync(SECRETS_FILE)) {
            const data = fs.readFileSync(SECRETS_FILE, 'utf8');
            return JSON.parse(data);
        }
        return {};
    } catch (error) {
        console.error('خطأ في تحميل أسرار 2FA:', error.message);
        return {};
    }
}

function saveSecrets(secrets) {
    try {
        fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets, null, 2));
        return true;
    } catch (error) {
        console.error('خطأ في حفظ أسرار 2FA:', error.message);
        return false;
    }
}

function generateSecret(userId, username) {
    const secret = speakeasy.generateSecret({
        name: `YS-Bot (${username})`,
        issuer: 'YS-Bot',
        length: 20
    });

    const secrets = loadSecrets();
    secrets[userId] = {
        secret: secret.base32,
        enabled: false,
        createdAt: new Date().toISOString()
    };
    saveSecrets(secrets);

    return secret;
}

function enable2FA(userId, code) {
    const secrets = loadSecrets();
    const userSecret = secrets[userId];

    if (!userSecret) {
        return { success: false, error: 'لم يتم العثور على السر' };
    }

    const verified = speakeasy.totp.verify({
        secret: userSecret.secret,
        encoding: 'base32',
        token: code,
        window: 2
    });

    if (verified) {
        userSecret.enabled = true;
        saveSecrets(secrets);
        return { success: true };
    }

    return { success: false, error: 'الكود غير صحيح' };
}

function disable2FA(userId, code) {
    const secrets = loadSecrets();
    const userSecret = secrets[userId];

    if (!userSecret) {
        return { success: false, error: 'لم يتم العثور على السر' };
    }

    const verified = speakeasy.totp.verify({
        secret: userSecret.secret,
        encoding: 'base32',
        token: code,
        window: 2
    });

    if (verified) {
        delete secrets[userId];
        saveSecrets(secrets);
        return { success: true };
    }

    return { success: false, error: 'الكود غير صحيح' };
}

function verifyCode(userId, code) {
    const secrets = loadSecrets();
    const userSecret = secrets[userId];

    if (!userSecret || !userSecret.enabled) {
        return { success: false, error: '2FA غير مفعّل' };
    }

    const verified = speakeasy.totp.verify({
        secret: userSecret.secret,
        encoding: 'base32',
        token: code,
        window: 2
    });

    return { success: verified };
}

function is2FAEnabled(userId) {
    const secrets = loadSecrets();
    const userSecret = secrets[userId];
    return userSecret && userSecret.enabled;
}

async function generateQRCode(secret) {
    try {
        const qrCodeDataURL = await QRCode.toDataURL(secret.otpauth_url);
        return qrCodeDataURL;
    } catch (error) {
        console.error('خطأ في توليد QR Code:', error.message);
        return null;
    }
}

module.exports = {
    generateSecret,
    enable2FA,
    disable2FA,
    verifyCode,
    is2FAEnabled,
    generateQRCode
};
