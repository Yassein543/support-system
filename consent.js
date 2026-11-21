(() => {
    const consentKey = 'ys-bot-legal-consent-v1';
    const language = (() => {
        try { return localStorage.getItem('ys-bot-language') || document.documentElement.lang || navigator.language || 'ar'; }
        catch { return document.documentElement.lang || navigator.language || 'ar'; }
    })().slice(0, 2).toLowerCase();
    const copy = {
        ar: { title: 'قبل ما تبدأ', intro: 'لاستخدام YS-Bot، لازم تقرأ وتوافق على سياسة الخصوصية وشروط الخدمة. تقدر تفتح كل وثيقة وتراجعها قبل الموافقة.', privacy: 'سياسة الخصوصية', terms: 'شروط الخدمة', check: 'قرأت سياسة الخصوصية وشروط الخدمة وأوافق عليهما.', accept: 'أوافق وأتابع للموقع', decline: 'لا أوافق — إغلاق الموقع', required: 'حدد المربع أولًا لتأكيد موافقتك.' },
        en: { title: 'Before you continue', intro: 'To use YS-Bot, please review and accept the Privacy Policy and Terms of Service. Open either document to read it before agreeing.', privacy: 'Privacy Policy', terms: 'Terms of Service', check: 'I have read and agree to the Privacy Policy and Terms of Service.', accept: 'Agree and continue', decline: 'I do not agree — leave the site', required: 'Check the box to confirm your agreement.' },
        fr: { title: 'Avant de continuer', intro: 'Pour utiliser YS-Bot, veuillez consulter et accepter la politique de confidentialité et les conditions de service.', privacy: 'Politique de confidentialité', terms: 'Conditions de service', check: 'J’ai lu et j’accepte ces deux documents.', accept: 'Accepter et continuer', decline: 'Refuser — quitter le site', required: 'Cochez la case pour confirmer votre accord.' },
        es: { title: 'Antes de continuar', intro: 'Para usar YS-Bot, revisa y acepta la Política de privacidad y los Términos del servicio.', privacy: 'Política de privacidad', terms: 'Términos del servicio', check: 'He leído y acepto ambos documentos.', accept: 'Aceptar y continuar', decline: 'No acepto — salir del sitio', required: 'Marca la casilla para confirmar.' },
        de: { title: 'Bevor du fortfährst', intro: 'Bitte lies und akzeptiere die Datenschutzerklärung und die Nutzungsbedingungen, um YS-Bot zu verwenden.', privacy: 'Datenschutzerklärung', terms: 'Nutzungsbedingungen', check: 'Ich habe beide Dokumente gelesen und stimme ihnen zu.', accept: 'Akzeptieren und fortfahren', decline: 'Ablehnen — Website verlassen', required: 'Bitte bestätige deine Zustimmung.' },
        pt: { title: 'Antes de continuar', intro: 'Para usar o YS-Bot, leia e aceite a Política de Privacidade e os Termos de Serviço.', privacy: 'Política de Privacidade', terms: 'Termos de Serviço', check: 'Li e aceito os dois documentos.', accept: 'Aceitar e continuar', decline: 'Não aceito — sair do site', required: 'Marque a caixa para confirmar.' },
        ko: { title: '계속하기 전에', intro: 'YS-Bot을 사용하려면 개인정보 처리방침과 서비스 약관을 확인하고 동의해 주세요.', privacy: '개인정보 처리방침', terms: '서비스 약관', check: '두 문서를 읽고 동의합니다.', accept: '동의하고 계속', decline: '동의하지 않음 — 사이트 나가기', required: '동의 확인란을 선택해 주세요.' },
        ja: { title: '続行する前に', intro: 'YS-Botを利用するには、プライバシーポリシーと利用規約を確認して同意してください。', privacy: 'プライバシーポリシー', terms: '利用規約', check: '両方の文書を読み、同意します。', accept: '同意して続行', decline: '同意しない — サイトを閉じる', required: '確認のためチェックボックスを選択してください。' }
    }[language] || {
        title: 'Before you continue', intro: 'To use YS-Bot, review and accept the Privacy Policy and Terms of Service. You can open either document before agreeing.',
        privacy: 'Privacy Policy', terms: 'Terms of Service', check: 'I have read and agree to both documents.', accept: 'Agree and continue', decline: 'I do not agree — leave the site', required: 'Check the box to confirm your agreement.'
    };

    // Let visitors read the legal documents before deciding whether to accept.
    if (['/privacy', '/privacy.html', '/terms', '/terms.html', '/refunds', '/refunds.html', '/acceptable-use', '/acceptable-use.html', '/cookies', '/cookies.html'].includes(location.pathname)) return;

    const readStoredConsent = () => {
        try { if (localStorage.getItem(consentKey) === 'accepted') return true; } catch {}
        try { return sessionStorage.getItem(consentKey) === 'accepted'; } catch { return false; }
    };
    if (readStoredConsent()) return;

    const styles = document.createElement('style');
    styles.textContent = `
        html.ys-consent-active, html.ys-consent-active body { overflow:hidden !important; }
        #ys-legal-consent { position:fixed; inset:0; z-index:2147483647; display:grid; place-items:center; box-sizing:border-box; padding:18px; background:rgba(2,8,15,.82); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); color:#edf7fa; font:500 16px/1.6 Tajawal,system-ui,sans-serif; }
        #ys-legal-consent[hidden] { display:none; }
        #ys-legal-consent .ys-consent-card { width:min(100%,540px); max-height:min(92dvh,720px); box-sizing:border-box; overflow:auto; padding:clamp(20px,5vw,32px); border:1px solid rgba(104,220,203,.27); border-radius:24px; background:linear-gradient(150deg,rgba(19,39,56,.98),rgba(8,19,32,.99)); box-shadow:0 30px 100px rgba(0,0,0,.56),0 0 55px rgba(42,190,171,.09),inset 0 1px rgba(255,255,255,.055); }
        #ys-legal-consent .ys-consent-brand { display:flex; align-items:center; gap:12px; margin-bottom:21px; }
        #ys-legal-consent .ys-consent-brand img { width:46px; height:46px; border:1px solid rgba(91,226,208,.36); border-radius:14px; }
        #ys-legal-consent .ys-consent-brand small { display:block; color:#76dcca; font-size:.68rem; font-weight:800; letter-spacing:.13em; }
        #ys-legal-consent h1 { margin:0; color:#f2fbfc; font-size:clamp(1.35rem,5vw,1.8rem); font-weight:900; }
        #ys-legal-consent p { margin:10px 0 0; color:#b3c4cf; font-size:.96rem; line-height:1.85; }
        #ys-legal-consent .ys-consent-links { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin:20px 0; }
        #ys-legal-consent .ys-consent-links a { display:flex; min-height:48px; align-items:center; justify-content:center; padding:8px 12px; border:1px solid rgba(111,168,191,.24); border-radius:12px; background:rgba(10,28,42,.76); color:#9debdc; font-weight:800; text-align:center; text-decoration:none; }
        #ys-legal-consent .ys-consent-links a:hover, #ys-legal-consent .ys-consent-links a:focus-visible { border-color:rgba(92,229,207,.6); background:rgba(31,126,119,.2); outline:2px solid transparent; }
        #ys-legal-consent .ys-consent-check { display:flex; align-items:flex-start; gap:11px; padding:14px; border:1px solid rgba(115,150,174,.18); border-radius:13px; background:rgba(5,16,28,.54); color:#dce9ee; cursor:pointer; }
        #ys-legal-consent .ys-consent-check input { width:19px; height:19px; flex:0 0 19px; margin:3px 0 0; accent-color:#21b7a3; }
        #ys-legal-consent .ys-consent-error { min-height:1.4em; margin:7px 2px 0; color:#ffb5a9; font-size:.8rem; }
        #ys-legal-consent .ys-consent-actions { display:grid; grid-template-columns:1fr auto; gap:10px; margin-top:13px; }
        #ys-legal-consent .ys-consent-actions button { min-height:48px; padding:10px 15px; border:1px solid transparent; border-radius:12px; color:#f2fbfc; font-family:inherit; font-size:.9rem; font-weight:800; line-height:1.3; cursor:pointer; }
        #ys-legal-consent .ys-consent-accept { border-color:rgba(128,245,224,.34)!important; background:linear-gradient(115deg,#168d83,#167ca4); box-shadow:0 8px 20px rgba(17,135,126,.2); }
        #ys-legal-consent .ys-consent-accept:disabled { opacity:.48; box-shadow:none; cursor:not-allowed; }
        #ys-legal-consent .ys-consent-decline { border-color:rgba(144,165,181,.18)!important; background:rgba(255,255,255,.035); color:#9eb1be!important; font-size:.78rem!important; }
        #ys-legal-consent :focus-visible { outline:2px solid #5fe0cf; outline-offset:3px; }
        @media(max-width:480px) { #ys-legal-consent { align-items:end; padding:10px 10px calc(10px + env(safe-area-inset-bottom)); } #ys-legal-consent .ys-consent-card { width:100%; max-height:94dvh; padding:21px 17px; border-radius:22px 22px 16px 16px; } #ys-legal-consent .ys-consent-links { gap:8px; margin:16px 0; } #ys-legal-consent .ys-consent-actions { grid-template-columns:1fr; } #ys-legal-consent .ys-consent-decline { min-height:40px!important; } }
        @media(prefers-reduced-motion:reduce) { #ys-legal-consent * { scroll-behavior:auto!important; transition:none!important; animation:none!important; } }
    `;
    (document.head || document.documentElement).appendChild(styles);
    document.documentElement.classList.add('ys-consent-active');

    const showDialog = () => {
        const dialog = document.createElement('section');
        dialog.id = 'ys-legal-consent';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'ys-consent-title');
        dialog.setAttribute('aria-describedby', 'ys-consent-description');
        dialog.innerHTML = `
            <div class="ys-consent-card" dir="${language === 'ar' ? 'rtl' : 'auto'}">
                <div class="ys-consent-brand"><img src="/ys-bot-avatar.svg" alt=""><div><small>YS-BOT · LEGAL</small><h1 id="ys-consent-title"></h1></div></div>
                <p id="ys-consent-description"></p>
                <div class="ys-consent-links"><a href="/privacy" target="_blank" rel="noopener noreferrer"></a><a href="/terms" target="_blank" rel="noopener noreferrer"></a></div>
                <label class="ys-consent-check"><input id="ys-consent-checkbox" type="checkbox"><span></span></label>
                <p class="ys-consent-error" id="ys-consent-error" role="status" aria-live="polite"></p>
                <div class="ys-consent-actions"><button class="ys-consent-accept" id="ys-consent-accept" type="button" disabled></button><button class="ys-consent-decline" id="ys-consent-decline" type="button"></button></div>
            </div>`;
        const [title, description, privacyLink, termsLink, checkboxLabel, acceptButton, declineButton] = [
            dialog.querySelector('#ys-consent-title'), dialog.querySelector('#ys-consent-description'), ...dialog.querySelectorAll('.ys-consent-links a'),
            dialog.querySelector('.ys-consent-check span'), dialog.querySelector('#ys-consent-accept'), dialog.querySelector('#ys-consent-decline')
        ];
        title.textContent = copy.title;
        description.textContent = copy.intro;
        privacyLink.textContent = copy.privacy;
        termsLink.textContent = copy.terms;
        checkboxLabel.textContent = copy.check;
        acceptButton.textContent = copy.accept;
        declineButton.textContent = copy.decline;
        document.body.appendChild(dialog);

        const checkbox = dialog.querySelector('#ys-consent-checkbox');
        const error = dialog.querySelector('#ys-consent-error');
        checkbox.addEventListener('change', () => {
            acceptButton.disabled = !checkbox.checked;
            error.textContent = '';
        });
        acceptButton.addEventListener('click', () => {
            if (!checkbox.checked) { error.textContent = copy.required; return; }
            let saved = false;
            try { localStorage.setItem(consentKey, 'accepted'); saved = true; } catch {}
            if (!saved) { try { sessionStorage.setItem(consentKey, 'accepted'); } catch {} }
            dialog.remove();
            document.documentElement.classList.remove('ys-consent-active');
        });
        declineButton.addEventListener('click', () => location.replace('about:blank'));
        dialog.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') { event.preventDefault(); return; }
            if (event.key !== 'Tab') return;
            const focusable = [...dialog.querySelectorAll('a[href], input:not(:disabled), button:not(:disabled)')];
            const first = focusable[0], last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        });
        checkbox.focus({ preventScroll: true });
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showDialog, { once: true });
    else showDialog();
})();
