(() => {
    const controlSelector = 'button, input[type="button"], input[type="submit"], input[type="reset"], a.btn, a.btn-primary, a.btn-secondary, a.btn-discord, a.premium-link, .top-action, .site-menu-link, [role="button"]';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const styles = document.createElement('style');

    styles.textContent = `
        .ys-button-pressing { animation: ys-button-press 380ms cubic-bezier(.2,.8,.2,1) !important; }
        .ys-button-glow { filter: brightness(1.16) !important; }
        .ys-tap-ring { position: fixed; z-index: 2147483646; width: 14px; height: 14px; border: 2px solid rgba(120, 240, 221, .9); border-radius: 50%; pointer-events: none; transform: translate(-50%, -50%); animation: ys-ring 580ms ease-out forwards; }
        .ys-tap-spark { position: fixed; z-index: 2147483647; width: 8px; height: 8px; border-radius: 2px; background: hsl(var(--ys-hue), 95%, 72%); box-shadow: 0 0 10px hsl(var(--ys-hue), 95%, 68%); clip-path: polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%); pointer-events: none; animation: ys-spark 650ms cubic-bezier(.14,.72,.28,1) forwards; }
        @keyframes ys-button-press { 0% { transform: scale(1); filter: brightness(1); } 32% { transform: scale(.965); filter: brightness(1.22); } 100% { transform: scale(1); filter: brightness(1); } }
        @keyframes ys-ring { from { width: 14px; height: 14px; opacity: .72; } to { width: 112px; height: 112px; opacity: 0; } }
        @keyframes ys-spark { 0% { opacity: 0; transform: translate(0, 0) scale(.25) rotate(0); } 18% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--ys-dx), var(--ys-dy)) scale(0) rotate(100deg); } }
        @media (prefers-reduced-motion: reduce) { .ys-button-pressing { animation: none !important; } .ys-button-glow { transition: filter 120ms linear; } }
    `;
    document.head.append(styles);

    function findControl(target) {
        if (!(target instanceof Element)) return null;
        const control = target.closest(controlSelector);
        if (!control || control.matches(':disabled, [aria-disabled="true"]')) return null;
        return control;
    }

    function play(control, x, y) {
        control.classList.remove('ys-button-pressing', 'ys-button-glow');
        if (reducedMotion.matches) {
            control.classList.add('ys-button-glow');
            window.setTimeout(() => control.classList.remove('ys-button-glow'), 150);
            return;
        }

        void control.offsetWidth;
        control.classList.add('ys-button-pressing');
        window.setTimeout(() => control.classList.remove('ys-button-pressing'), 420);

        const ring = document.createElement('span');
        ring.className = 'ys-tap-ring';
        ring.style.left = `${x}px`;
        ring.style.top = `${y}px`;
        document.body.append(ring);
        window.setTimeout(() => ring.remove(), 650);

        for (let i = 0; i < 6; i += 1) {
            const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.28;
            const distance = 24 + Math.random() * 24;
            const spark = document.createElement('span');
            spark.className = 'ys-tap-spark';
            spark.style.left = `${x}px`;
            spark.style.top = `${y}px`;
            spark.style.setProperty('--ys-dx', `${Math.cos(angle) * distance}px`);
            spark.style.setProperty('--ys-dy', `${Math.sin(angle) * distance}px`);
            spark.style.setProperty('--ys-hue', `${155 + Math.round(Math.random() * 95)}`);
            document.body.append(spark);
            window.setTimeout(() => spark.remove(), 700);
        }
    }

    document.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return;
        const control = findControl(event.target);
        if (control) play(control, event.clientX, event.clientY);
    }, true);

    document.addEventListener('keydown', (event) => {
        if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
        const control = findControl(event.target);
        if (!control) return;
        const bounds = control.getBoundingClientRect();
        play(control, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    }, true);
})();
