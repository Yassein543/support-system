#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail

APP_NAME="ys-bot"
SUPPORT_APP_NAME="ys-bot-support"
REPO_URL="https://github.com/Yassein543/support-system.git"
BOT_DIR="${YSBOT_DIR:-$HOME/ys-bot}"
BOOT_DIR="$HOME/.termux/boot"
BOOT_FILE="$BOOT_DIR/ys-bot"

say() { printf '\n[YS-Bot] %s\n' "$*"; }
fail() { say "خطأ: $*" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }

need_termux() {
  [[ -n "${PREFIX:-}" && "$PREFIX" == *com.termux* ]] || fail "شغّل هذا الملف داخل تطبيق Termux على أندرويد."
}

install_tools() {
  need_termux
  pkg update -y
  pkg install -y git nodejs-lts python
  npm install -g pm2
  say "تم تجهيز Git وNode.js وPython ومدير العمليات PM2."
}

ensure_project() {
  need_termux
  has git || fail "Git غير موجود. نفّذ الخيار 1 أولًا."
  if [[ ! -d "$BOT_DIR/.git" ]]; then
    [[ ! -e "$BOT_DIR" ]] || fail "المسار $BOT_DIR موجود لكنه ليس نسخة Git. غيّر YSBOT_DIR أو انقله."
    git clone "$REPO_URL" "$BOT_DIR"
  fi
  cd "$BOT_DIR"
}

configure_secrets() {
  ensure_project
  printf 'الصق Discord Bot Token (لن يظهر أثناء الكتابة): '
  IFS= read -r -s discord_token
  printf '\nالصق BOT_API_SECRET المطابق لإعداد Vercel (لن يظهر): '
  IFS= read -r -s api_secret
  printf '\n'
  [[ -n "$discord_token" ]] || fail "Discord Bot Token مطلوب."
  [[ -n "$api_secret" ]] || fail "BOT_API_SECRET مطلوب لربط البوت بلوحة الموقع."

  DISCORD_TOKEN="$discord_token" BOT_API_SECRET="$api_secret" BOT_API_URL="https://ys-bot.vercel.app" node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(process.cwd(), '.env');
const updates = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  BOT_API_SECRET: process.env.BOT_API_SECRET,
  BOT_API_URL: process.env.BOT_API_URL,
};
let lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
lines = lines.filter((line) => !Object.keys(updates).some((key) => new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`).test(line)));
while (lines.length && lines[lines.length - 1] === '') lines.pop();
for (const [key, value] of Object.entries(updates)) lines.push(`${key}=${JSON.stringify(value)}`);
fs.writeFileSync(file, `${lines.join('\n')}\n`, { mode: 0o600 });
fs.chmodSync(file, 0o600);
NODE
  unset discord_token api_secret
  say "انحفظت المفاتيح محليًا في ملف .env بصلاحيات خاصة. ما ترفع الملف إلى GitHub ولا ترسله لأحد."
}

install_project() {
  ensure_project
  say "تثبيت اعتماديات المشروع من package-lock.json..."
  npm ci
  say "إذا ما أعددت المفاتيح بعد، اختَر إعداد المفاتيح من القائمة."
}

start_bot() {
  ensure_project
  [[ -f .env ]] || fail "ما لقيت .env؛ اختَر إعداد المفاتيح أولًا."
  has pm2 || fail "PM2 غير موجود. نفّذ الخيار 1 أولًا."
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$APP_NAME" --update-env
  else
    pm2 start bot.js --name "$APP_NAME" --time
  fi
  pm2 save
  say "البوت يعمل بالخلفية. استخدم الخيار 5 لمشاهدة حالته."
}

stop_bot() {
  has pm2 || fail "PM2 غير موجود."
  pm2 stop "$APP_NAME" || say "البوت متوقف أصلًا."
  pm2 save
}

update_project() {
  ensure_project
  has pm2 || fail "PM2 غير موجود. نفّذ الخيار 1 أولًا."
  say "سأجلب فقط التغييرات المنشورة على GitHub."
  git pull --ff-only origin main || fail "تعذر التحديث دون دمج آمن. لم أغيّر ملفاتك؛ افحص نسخة GitHub أو حالة Git يدويًا."
  npm ci
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$APP_NAME" --update-env
    pm2 save
  else
    say "تم التحديث. شغّل البوت من القائمة."
  fi
  if pm2 describe "$SUPPORT_APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$SUPPORT_APP_NAME" --update-env
    pm2 save
  fi
}

configure_support_token() {
  ensure_project
  printf 'الصق توكن بوت الدعم (لن يظهر أثناء الكتابة): '
  IFS= read -r -s support_token
  printf '\n'
  [[ -n "$support_token" ]] || fail "توكن بوت الدعم مطلوب."

  SUPPORT_DISCORD_TOKEN="$support_token" node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const file = path.join(process.cwd(), '.env');
const token = process.env.SUPPORT_DISCORD_TOKEN;
let lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
lines = lines.filter((line) => !/^\s*(?:export\s+)?SUPPORT_DISCORD_TOKEN\s*=/.test(line));
while (lines.length && lines[lines.length - 1] === '') lines.pop();
lines.push(`SUPPORT_DISCORD_TOKEN=${JSON.stringify(token)}`);
fs.writeFileSync(file, `${lines.join('\n')}\n`, { mode: 0o600 });
fs.chmodSync(file, 0o600);
NODE
  unset support_token
  say "انحفظ توكن بوت الدعم محليًا في .env، ولم يُعرض أو يُرسل إلى GitHub."
}

start_support_bot() {
  ensure_project
  has pm2 || fail "PM2 غير موجود. نفّذ الخيار 1 أولًا."
  if ! node -e "require('dotenv').config(); process.exit(process.env.SUPPORT_DISCORD_TOKEN ? 0 : 1)"; then
    configure_support_token
  fi
  if pm2 describe "$SUPPORT_APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$SUPPORT_APP_NAME" --update-env
  else
    pm2 start support-bot.js --name "$SUPPORT_APP_NAME" --time
  fi
  pm2 save
  say "بوت الدعم يعمل كعملية مستقلة، وسيرسل القوانين إلى روم الدعم عند اتصاله."
}

stop_support_bot() {
  has pm2 || fail "PM2 غير موجود. نفّذ الخيار 1 أولًا."
  pm2 stop "$SUPPORT_APP_NAME" || say "بوت الدعم متوقف أصلًا."
  pm2 save
}

enable_boot() {
  need_termux
  has pm2 || fail "PM2 غير موجود. نفّذ الخيار 1 أولًا."
  mkdir -p "$BOOT_DIR"
  cat > "$BOOT_FILE" <<'BOOT'
#!/data/data/com.termux/files/usr/bin/sh
termux-wake-lock
sleep 10
pm2 resurrect
BOOT
  chmod 700 "$BOOT_FILE"
  say "أُعدّ التشغيل عند إقلاع الهاتف. ثبّت Termux:Boot من نفس مصدر Termux، وافتحه مرة واحدة، واسمح لـTermux بالعمل دون قيود البطارية."
}

show_menu() {
  printf '\nYS-Bot | مدير Termux\n'
  printf 'المجلد: %s\n\n' "$BOT_DIR"
  printf '1) تثبيت الأدوات المطلوبة\n'
  printf '2) تنزيل/تثبيت المشروع\n'
  printf '3) إعداد مفاتيح Discord وربط الموقع\n'
  printf '4) تشغيل أو إعادة تشغيل البوت\n'
  printf '5) عرض الحالة\n'
  printf '6) عرض السجلات\n'
  printf '7) تحديث الكود من GitHub\n'
  printf '8) إيقاف البوت\n'
  printf '9) تشغيل تلقائي بعد إعادة تشغيل الهاتف\n'
  printf '10) إعداد/تغيير توكن بوت الدعم\n'
  printf '11) تشغيل أو إعادة تشغيل بوت الدعم\n'
  printf '12) عرض حالة بوت الدعم\n'
  printf '13) عرض سجلات بوت الدعم\n'
  printf '14) إيقاف بوت الدعم\n'
  printf '0) خروج\n\n'
  read -r -p 'اختَر رقمًا: ' choice
  case "$choice" in
    1) install_tools ;;
    2) install_project ;;
    3) configure_secrets ;;
    4) start_bot ;;
    5) has pm2 && pm2 status "$APP_NAME" || fail "PM2 غير موجود. نفّذ الخيار 1 أولًا." ;;
    6) has pm2 && pm2 logs "$APP_NAME" --lines 80 || fail "PM2 غير موجود. نفّذ الخيار 1 أولًا." ;;
    7) update_project ;;
    8) stop_bot ;;
    9) enable_boot ;;
    10) configure_support_token ;;
    11) start_support_bot ;;
    12) has pm2 && pm2 status "$SUPPORT_APP_NAME" || fail "PM2 غير موجود. نفّذ الخيار 1 أولًا." ;;
    13) has pm2 && pm2 logs "$SUPPORT_APP_NAME" --lines 80 || fail "PM2 غير موجود. نفّذ الخيار 1 أولًا." ;;
    14) stop_support_bot ;;
    0) exit 0 ;;
    *) fail "اختيار غير معروف." ;;
  esac
}

if [[ "${1:-}" == "--boot-start" ]]; then
  start_bot
  exit 0
fi

while true; do
  show_menu
done
