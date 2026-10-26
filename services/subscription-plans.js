const PLAN_RANK = Object.freeze({ Free: 0, Basic: 1, VIP: 2, Premium: 3 });

const PAID_SETTINGS = Object.freeze({
    antiSpamTimeoutEnabled: 'Basic',
    antiSpamTimeoutMinutes: 'Basic',
    antiRaidMinAccountAgeDays: 'Basic',
    antiRaidYoungAccountAction: 'Basic',
    antiRaidLockdownDurationMinutes: 'VIP',
    antiRaidLockdownExcludeChannelIds: 'VIP',
    antiRaidAlertRoleId: 'VIP'
});

function normalizePlan(plan) {
    return Object.prototype.hasOwnProperty.call(PLAN_RANK, plan) ? plan : 'Free';
}

function minimumPlanForSetting(key) {
    return PAID_SETTINGS[key] || 'Free';
}

function canAccessSetting(plan, key) {
    return PLAN_RANK[normalizePlan(plan)] >= PLAN_RANK[minimumPlanForSetting(key)];
}

function getLockedSettings(plan, schema) {
    return Object.keys(schema).filter((key) => !canAccessSetting(plan, key));
}

function applyPlanSettings(settings, plan, defaults, schema) {
    const safe = { ...defaults, ...(settings || {}) };
    for (const key of getLockedSettings(plan, schema)) safe[key] = defaults[key];
    return safe;
}

function mergePlanSettings(incoming, current, plan, schema) {
    const merged = { ...(current || {}) };
    for (const [key, value] of Object.entries(incoming || {})) {
        if (schema[key] && canAccessSetting(plan, key)) merged[key] = value;
    }
    return merged;
}

module.exports = { normalizePlan, minimumPlanForSetting, canAccessSetting, getLockedSettings, applyPlanSettings, mergePlanSettings };
