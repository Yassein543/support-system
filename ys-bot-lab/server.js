'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const ROOT = __dirname;
const WORKSPACES = path.join(ROOT, '.workspaces');
const SETTINGS_FILE = path.join(ROOT, 'settings.json');
const ENV_FILE = path.join(ROOT, '.env');
const PORT = Math.max(1024, Math.min(65535, Number(process.env.PORT) || 3210));
const SESSION_KEY = crypto.randomBytes(32).toString('hex');
const pendingCommands = new Map();
const MAX_BODY = 3 * 1024 * 1024;
const EXCLUDED = new Set(['.env', '.git', 'node_modules', '.workspaces']);
function isExcluded(name) {
    const normalized = name.toLowerCase();
    return EXCLUDED.has(normalized) || normalized === '.env' || normalized.startsWith('.env.');
}
fs.mkdirSync(WORKSPACES, { recursive: true });

function readLocalEnv(file = ENV_FILE) {
    try {
        const raw = fs.readFileSync(file, 'utf8');
        const values = {};
        for (const line of raw.split(/\r?\n/)) {
            const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
            if (!match) continue;
            let value = match[2].trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
            values[match[1]] = value.replace(/\\n/g, '\n');
        }
        return values;
    } catch { return {}; }
}

function saveEnvValues(file, updates) {
    let lines = [];
    try { lines = fs.readFileSync(file, 'utf8').split(/\r?\n/); } catch {}
    for (const [key, value] of Object.entries(updates)) {
        if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(key)) throw new Error('اسم المفتاح غير صالح.');
        const escaped = String(value).replace(/\\/g, '\\\\').replace(/\r/g, '').replace(/\n/g, '\\n').replace(/"/g, '\\"');
        const line = `${key}="${escaped}"`;
        const index = lines.findIndex((entry) => new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(entry));
        if (index >= 0) lines[index] = line;
        else lines.push(line);
    }
    fs.writeFileSync(file, `${lines.filter((line, index) => index !== lines.length - 1 || line.trim()).join('\n').trimEnd()}\n`, { mode: 0o600 });
}

function loadSettings() {
    let saved = {};
    try { saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch {}
    const env = readLocalEnv();
    return {
        baseUrl: saved.baseUrl || env.AI_BASE_URL || 'https://api.openai.com/v1',
        model: saved.model || env.AI_MODEL || '',
        hasKey: Boolean(env.AI_API_KEY),
        provider: saved.provider || 'openai-compatible'
    };
}

function validWorkspaceId(value) {
    return typeof value === 'string' && /^[\p{L}\p{N}][\p{L}\p{N}-]{0,39}$/u.test(value);
}

function getWorkspace(id) {
    if (!validWorkspaceId(id)) throw new Error('اسم المشروع غير صالح.');
    const target = path.join(WORKSPACES, id);
    const stat = fs.lstatSync(target);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('مساحة المشروع غير صالحة.');
    return target;
}

function safePath(workspace, relative = '') {
    if (typeof relative !== 'string' || relative.includes('\0')) throw new Error('مسار الملف غير صالح.');
    const normalized = relative.replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = normalized.split('/').filter(Boolean);
    if (parts.some((part) => part === '.' || part === '..' || isExcluded(part))) throw new Error('المسار يتضمن ملفًا محميًا أو غير مسموح.');
    const root = path.resolve(workspace);
    const result = path.resolve(root, ...parts);
    if (result !== root && !result.startsWith(`${root}${path.sep}`)) throw new Error('المسار خارج المشروع.');
    let current = root;
    for (const part of parts) {
        current = path.join(current, part);
        try {
            const stat = fs.lstatSync(current);
            if (stat.isSymbolicLink()) throw new Error('لا يمكن عبور رابط رمزي من داخل المشروع.');
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return result;
}

function listFiles(directory, prefix = '', depth = 0) {
    if (depth > 8) return [];
    let entries = [];
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return []; }
    return entries
        .filter((entry) => !isExcluded(entry.name) && !entry.isSymbolicLink())
        .sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))
        .flatMap((entry) => {
            const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) return [{ name: entry.name, path: relative, kind: 'folder', children: listFiles(path.join(directory, entry.name), relative, depth + 1) }];
            let size = 0;
            try { size = fs.statSync(path.join(directory, entry.name)).size; } catch {}
            return [{ name: entry.name, path: relative, kind: 'file', size }];
        });
}

function listWorkspaces() {
    return fs.readdirSync(WORKSPACES, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink() && validWorkspaceId(entry.name))
        .map((entry) => ({ id: entry.name, name: entry.name.replace(/-/g, ' ') }))
        .sort((a, b) => a.name.localeCompare(b.name));
}

function sendJson(response, status, value) {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    response.end(JSON.stringify(value));
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        request.setEncoding('utf8');
        request.on('data', (chunk) => {
            body += chunk;
            if (Buffer.byteLength(body) > MAX_BODY) {
                reject(new Error('حجم الطلب أكبر من المسموح.'));
                request.destroy();
            }
        });
        request.on('end', () => {
            try { resolve(body ? JSON.parse(body) : {}); }
            catch { reject(new Error('صيغة البيانات غير صحيحة.')); }
        });
        request.on('error', reject);
    });
}

function checkLocalRequest(request, response) {
    const remote = request.socket.remoteAddress || '';
    const local = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
    const host = String(request.headers.host || '').split(':')[0].toLowerCase();
    const allowedHost = host === '127.0.0.1' || host === 'localhost' || host === '[::1]';
    if (!local || !allowedHost) {
        sendJson(response, 403, { error: 'الأداة تقبل الاتصالات المحلية فقط.' });
        return false;
    }
    const origin = request.headers.origin;
    if (origin) {
        try {
            const parsed = new URL(origin);
            if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) || parsed.port !== String(PORT)) throw new Error('origin');
        } catch {
            sendJson(response, 403, { error: 'تم رفض الطلب من مصدر غير محلي.' });
            return false;
        }
    }
    if (request.method !== 'GET' && request.headers['x-ys-lab-session'] !== SESSION_KEY) {
        sendJson(response, 403, { error: 'انتهت جلسة الأداة؛ حدّث الصفحة.' });
        return false;
    }
    return true;
}

async function runApprovedCommand(command, workspace, subdirectory = '') {
    if (typeof command !== 'string' || !command.trim() || command.length > 1200) throw new Error('الأمر غير صالح.');
    const cwd = safePath(workspace, subdirectory);
    fs.mkdirSync(cwd, { recursive: true });
    const projectEnv = readLocalEnv(path.join(workspace, '.env'));
    return new Promise((resolve) => {
        const child = spawn(command, { cwd, shell: true, windowsHide: true, env: { ...process.env, ...projectEnv } });
        let output = '';
        let finished = false;
        const append = (chunk) => { output = (output + chunk.toString()).slice(-60000); };
        child.stdout.on('data', append);
        child.stderr.on('data', append);
        const timer = setTimeout(() => {
            child.kill('SIGTERM');
            output += '\n[YS Bot Lab] انتهت مهلة الأمر بعد 120 ثانية.';
        }, 120000);
        child.on('error', (error) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            resolve({ code: 1, output: `${output}\n${error.message}`.trim() });
        });
        child.on('close', (code) => {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            resolve({ code: Number.isInteger(code) ? code : 1, output: output || '(لا يوجد ناتج)' });
        });
    });
}

const toolDefinitions = [
    { type: 'function', function: { name: 'list_files', description: 'اعرض ملفات ومجلدات المشروع فقط.', parameters: { type: 'object', properties: { path: { type: 'string' } }, additionalProperties: false } } },
    { type: 'function', function: { name: 'read_file', description: 'اقرأ ملفًا نصيًا من المشروع. ملفات الأسرار مستثناة.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false } } },
    { type: 'function', function: { name: 'create_directory', description: 'أنشئ مجلدًا داخل مساحة المشروع.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false } } },
    { type: 'function', function: { name: 'write_file', description: 'أنشئ أو حدّث ملفًا نصيًا داخل المشروع. لا تكتب ملفات .env أو مفاتيح سرية.', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'], additionalProperties: false } } },
    { type: 'function', function: { name: 'request_secret', description: 'اطلب من الواجهة فتح حقل محلي مخفي لإضافة سر إلى ملف .env الخاص بهذا المشروع. لا تطلب من المستخدم كتابة السر في المحادثة.', parameters: { type: 'object', properties: { name: { type: 'string', description: 'اسم متغير البيئة بحروف كبيرة مثل DISCORD_TOKEN' }, reason: { type: 'string' } }, required: ['name', 'reason'], additionalProperties: false } } },
    { type: 'function', function: { name: 'request_command', description: 'اطلب موافقة المستخدم لتشغيل أمر واضح داخل المشروع. لن ينفذ الأمر قبل الموافقة.', parameters: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string' }, reason: { type: 'string' } }, required: ['command', 'reason'], additionalProperties: false } } }
];

async function callAi(body, workspace, events) {
    const env = readLocalEnv();
    const settings = loadSettings();
    if (!settings.model.trim()) throw new Error('اكتب اسم نموذج AI في الإعدادات.');
    if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 12000) throw new Error('اكتب طلبًا من 1 إلى 12000 حرف.');

    const history = Array.isArray(body.history) ? body.history.slice(-16).filter((item) => ['user', 'assistant'].includes(item.role) && typeof item.content === 'string').map((item) => ({ role: item.role, content: item.content.slice(0, 12000) })) : [];
    const messages = [
        { role: 'system', content: `أنت مساعد برمجة داخل YS Bot Lab. ساعد المستخدم بأي مشروع برمجي وبلغة رسالته. أنشئ الملفات والمجلدات المطلوبة داخل مساحة المشروع فقط واستعمل الأدوات بدل إعطاء تعليمات نظرية عندما يمكن تنفيذها. لا تقرأ أو تكتب .env أو أي ملف أسرار. عندما تحتاج مفتاحًا استعمل request_secret حتى يكتبه المستخدم في حقل محلي مخفي. لا تطلب أسرارًا في الدردشة. لا تشغّل أوامر؛ اطلبها عبر request_command ليوافق المستخدم ويشاهدها أولًا. قبل حذف أو استبدال عمل مهم، وضّح ما سيتغير واطلب من المستخدم تأكيدًا في نص الرد. مساحة العمل: ${path.basename(workspace)}.` },
        ...history,
        { role: 'user', content: body.prompt.trim() }
    ];
    const apiBase = String(settings.baseUrl || '').replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(apiBase)) throw new Error('رابط مزود AI لازم يبدأ بـ https:// أو http://.');
    const apiHost = new URL(apiBase).hostname;
    const localProvider = ['localhost', '127.0.0.1', '::1'].includes(apiHost);
    if (!env.AI_API_KEY && !localProvider) throw new Error('أضف مفتاح مزود الذكاء الاصطناعي من الإعدادات، أو استخدم نموذجًا محليًا.');

    for (let turn = 0; turn < 6; turn += 1) {
        const response = await fetch(`${apiBase}/chat/completions`, {
            method: 'POST',
            headers: { ...(env.AI_API_KEY ? { authorization: `Bearer ${env.AI_API_KEY}` } : {}), 'content-type': 'application/json' },
            body: JSON.stringify({ model: settings.model, messages, tools: toolDefinitions, tool_choice: 'auto', temperature: 0.25 }),
            signal: AbortSignal.timeout(90000)
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error?.message || `مزود AI رجّع HTTP ${response.status}.`);
        const assistant = result.choices?.[0]?.message;
        if (!assistant) throw new Error('استجابة مزود AI غير مكتملة.');
        messages.push(assistant);
        if (!assistant.tool_calls?.length) return String(assistant.content || 'خلصت الخطوة.').slice(0, 12000);

        for (const call of assistant.tool_calls) {
            let args;
            try { args = JSON.parse(call.function.arguments || '{}'); }
            catch { args = {}; }
            let output;
            try {
                const relative = typeof args.path === 'string' ? args.path : '';
                if (call.function.name === 'list_files') {
                    output = listFiles(safePath(workspace, relative));
                } else if (call.function.name === 'read_file') {
                    const file = safePath(workspace, relative);
                    if (!fs.statSync(file).isFile()) throw new Error('المسار ليس ملفًا.');
                    if (fs.statSync(file).size > 100000) throw new Error('الملف أكبر من حد القراءة (100KB).');
                    output = fs.readFileSync(file, 'utf8');
                } else if (call.function.name === 'create_directory') {
                    fs.mkdirSync(safePath(workspace, relative), { recursive: true });
                    events.filesChanged = true;
                    output = { created: relative };
                } else if (call.function.name === 'write_file') {
                    const file = safePath(workspace, relative);
                    if (!relative || typeof args.content !== 'string' || Buffer.byteLength(args.content) > 500000) throw new Error('الملف فارغ المسار أو أكبر من حد الكتابة (500KB).');
                    fs.mkdirSync(path.dirname(file), { recursive: true });
                    fs.writeFileSync(file, args.content, 'utf8');
                    events.filesChanged = true;
                    output = { saved: relative, bytes: Buffer.byteLength(args.content) };
                } else if (call.function.name === 'request_secret') {
                    const name = String(args.name || '').trim();
                    if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(name)) throw new Error('اسم السر يجب أن يكون اسم متغير بيئة بحروف كبيرة.');
                    events.secretRequests.push({ name, reason: String(args.reason || '').slice(0, 300) });
                    output = { requested: true, message: `أظهر للمستخدم حقلًا محليًا لإدخال ${name}. لا تطلب قيمة السر داخل المحادثة.` };
                } else if (call.function.name === 'request_command') {
                    const id = crypto.randomUUID();
                    const command = String(args.command || '').trim();
                    const cwd = String(args.cwd || '').trim();
                    if (!command || command.length > 1200) throw new Error('الأمر غير صالح.');
                    safePath(workspace, cwd);
                    pendingCommands.set(id, { command, cwd, workspace, createdAt: Date.now() });
                    events.commands.push({ id, command, cwd, reason: String(args.reason || '').slice(0, 300) });
                    output = { approvalRequired: true, id, message: 'الأمر ينتظر موافقة المستخدم من الواجهة.' };
                } else {
                    throw new Error('هذه الأداة غير متاحة.');
                }
            } catch (error) { output = { error: error.message }; }
            messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(output).slice(0, 60000) });
        }
    }
    return 'جهزت التغييرات، لكن توقفت بعد عدة خطوات آلية. راجع الملفات ثم أكمل بطلب جديد.';
}

async function route(request, response) {
    const url = new URL(request.url, `http://${request.headers.host || `127.0.0.1:${PORT}`}`);
    if (request.method === 'GET' && url.pathname === '/') {
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
        response.end(fs.readFileSync(path.join(ROOT, 'index.html')));
        return;
    }
    if (!url.pathname.startsWith('/api/')) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
    }
    if (!checkLocalRequest(request, response)) return;

    const settings = loadSettings();
    if (request.method === 'GET' && url.pathname === '/api/bootstrap') {
        return sendJson(response, 200, { csrf: SESSION_KEY, workspaces: listWorkspaces(), settings: { baseUrl: settings.baseUrl, model: settings.model, hasKey: settings.hasKey } });
    }
    if (request.method === 'GET' && url.pathname === '/api/workspace/files') {
        try { return sendJson(response, 200, { files: listFiles(getWorkspace(url.searchParams.get('workspace'))) }); }
        catch (error) { return sendJson(response, 400, { error: error.message }); }
    }
    if (request.method === 'GET' && url.pathname === '/api/workspace/file') {
        try {
            const file = safePath(getWorkspace(url.searchParams.get('workspace')), url.searchParams.get('path') || '');
            if (!fs.statSync(file).isFile()) return sendJson(response, 400, { error: 'المسار ليس ملفًا.' });
            if (fs.statSync(file).size > 100000) return sendJson(response, 413, { error: 'الملف أكبر من حد المحرر (100KB). استخدم Terminal أو افتحه بمحرر خارجي.' });
            return sendJson(response, 200, { content: fs.readFileSync(file, 'utf8') });
        } catch (error) { return sendJson(response, 400, { error: error.message || 'تعذر فتح الملف.' }); }
    }

    let body;
    try { body = await readBody(request); }
    catch (error) { return sendJson(response, 400, { error: error.message }); }

    if (request.method === 'POST' && url.pathname === '/api/workspaces') {
        const raw = String(body.name || 'my-project').normalize('NFKC').toLowerCase().trim().replace(/[^\p{L}\p{N}-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || `project-${Date.now().toString(36)}`;
        let id = raw;
        for (let suffix = 2; fs.existsSync(path.join(WORKSPACES, id)); suffix += 1) id = `${raw.slice(0, 36)}-${suffix}`;
        fs.mkdirSync(path.join(WORKSPACES, id), { recursive: true });
        fs.writeFileSync(path.join(WORKSPACES, id, '.gitignore'), '.env\n.env.*\nnode_modules/\n', 'utf8');
        return sendJson(response, 201, { id });
    }
    if (request.method === 'POST' && url.pathname === '/api/settings') {
        const currentEnv = readLocalEnv();
        const baseUrl = String(body.baseUrl || '').trim().replace(/\/+$/, '');
        const model = String(body.model || '').trim().slice(0, 160);
        const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
        if (!/^https?:\/\//i.test(baseUrl) || !model) return sendJson(response, 400, { error: 'تحقق من رابط المزود واسم النموذج.' });
        if (apiKey && apiKey.length > 1000) return sendJson(response, 400, { error: 'مفتاح AI أطول من الحد.' });
        fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ baseUrl, model, provider: 'openai-compatible' }, null, 2), 'utf8');
        saveEnvValues(ENV_FILE, { AI_BASE_URL: baseUrl, AI_MODEL: model, ...(apiKey ? { AI_API_KEY: apiKey } : currentEnv.AI_API_KEY ? {} : { AI_API_KEY: '' }) });
        return sendJson(response, 200, { saved: true, hasKey: Boolean(apiKey || currentEnv.AI_API_KEY) });
    }
    if (request.method === 'POST' && url.pathname === '/api/workspace/file') {
        try {
            const workspace = getWorkspace(String(body.workspace || ''));
            const file = safePath(workspace, String(body.path || ''));
            if (!body.path || typeof body.content !== 'string' || Buffer.byteLength(body.content) > 500000) throw new Error('المسار أو محتوى الملف غير صالح.');
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, body.content, 'utf8');
            return sendJson(response, 200, { saved: true });
        } catch (error) { return sendJson(response, 400, { error: error.message }); }
    }
    if (request.method === 'POST' && url.pathname === '/api/workspace/folder') {
        try {
            const workspace = getWorkspace(String(body.workspace || ''));
            if (!body.path) throw new Error('اكتب اسم المجلد.');
            fs.mkdirSync(safePath(workspace, body.path), { recursive: true });
            return sendJson(response, 201, { created: true });
        } catch (error) { return sendJson(response, 400, { error: error.message }); }
    }
    if (request.method === 'POST' && url.pathname === '/api/workspace/secret') {
        try {
            const workspace = getWorkspace(String(body.workspace || ''));
            const name = String(body.name || '').trim();
            if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(name) || typeof body.value !== 'string' || !body.value.trim()) throw new Error('اسم السر أو قيمته غير صالحين.');
            saveEnvValues(path.join(workspace, '.env'), { [name]: body.value.trim() });
            return sendJson(response, 200, { saved: true, name });
        } catch (error) { return sendJson(response, 400, { error: error.message }); }
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/chat') {
        try {
            const workspace = getWorkspace(String(body.workspace || ''));
            const events = { filesChanged: false, secretRequests: [], commands: [] };
            const answer = await callAi(body, workspace, events);
            return sendJson(response, 200, { answer, ...events });
        } catch (error) { return sendJson(response, 400, { error: error.message || 'تعذر الاتصال بمزود AI.' }); }
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/request-command') {
        try {
            const workspace = getWorkspace(String(body.workspace || ''));
            const command = String(body.command || '').trim();
            const cwd = String(body.cwd || '').trim();
            if (!command || command.length > 1200) throw new Error('الأمر غير صالح.');
            safePath(workspace, cwd);
            const id = crypto.randomUUID();
            pendingCommands.set(id, { command, cwd, workspace, createdAt: Date.now() });
            return sendJson(response, 200, { id, command, cwd });
        } catch (error) { return sendJson(response, 400, { error: error.message }); }
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/approve-command') {
        const pending = pendingCommands.get(String(body.id || ''));
        if (!pending || Date.now() - pending.createdAt > 5 * 60 * 1000) return sendJson(response, 404, { error: 'انتهت صلاحية طلب الأمر.' });
        if (body.workspace && body.workspace !== path.basename(pending.workspace)) return sendJson(response, 403, { error: 'طلب الأمر تابع لمشروع مختلف.' });
        pendingCommands.delete(String(body.id));
        try {
            const result = await runApprovedCommand(pending.command, pending.workspace, pending.cwd);
            return sendJson(response, 200, result);
        } catch (error) { return sendJson(response, 400, { error: error.message }); }
    }
    if (request.method === 'POST' && url.pathname === '/api/agent/reject-command') {
        pendingCommands.delete(String(body.id || ''));
        return sendJson(response, 200, { rejected: true });
    }
    return sendJson(response, 404, { error: 'المسار غير موجود.' });
}

const server = http.createServer((request, response) => {
    route(request, response).catch((error) => {
        console.error('[YS Bot Lab]', error.message);
        if (!response.headersSent) sendJson(response, 500, { error: 'حدث خطأ محلي داخل الأداة.' });
    });
});
server.listen(PORT, '127.0.0.1', () => {
    console.log(`YS Bot Lab يعمل محليًا: http://127.0.0.1:${PORT}`);
    console.log('الأداة محلية فقط؛ المفاتيح تبقى على هذا الجهاز. اضغط Ctrl+C للإيقاف.');
});
