
const Toast = (() => {
    let container;
    function getContainer() {
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none';
            document.body.appendChild(container);
        }
        return container;
    }
    const STYLES = {
        success: { bar: 'bg-emerald-500', icon: 'check-circle',   text: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-500/30' },
        error:   { bar: 'bg-rose-500',    icon: 'x-circle',       text: 'text-rose-700 dark:text-rose-300',       bg: 'bg-rose-50 dark:bg-rose-900/20 border-rose-200 dark:border-rose-500/30' },
        warning: { bar: 'bg-amber-500',   icon: 'alert-triangle',  text: 'text-amber-700 dark:text-amber-300',     bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-500/30' },
        info:    { bar: 'bg-brand-500',   icon: 'info',            text: 'text-brand-700 dark:text-brand-300',     bg: 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-500/30' },
    };
    function show(message, type = 'info', duration = 3000) {
        const s = STYLES[type] || STYLES.info;
        const el = document.createElement('div');
        el.className = `pointer-events-auto relative overflow-hidden flex items-start gap-3 w-80 px-4 py-3 rounded-2xl border shadow-lg backdrop-blur-sm ${s.bg} translate-x-full opacity-0 transition-all duration-300`;
        el.innerHTML = `
            <div class="absolute bottom-0 left-0 h-0.5 ${s.bar} toast-progress" style="width:100%"></div>
            <i data-lucide="${s.icon}" class="w-5 h-5 shrink-0 mt-0.5 ${s.text}"></i>
            <p class="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">${message}</p>
        `;
        getContainer().appendChild(el);
        lucide.createIcons({ nodes: [el] });
        requestAnimationFrame(() => requestAnimationFrame(() => {
            el.classList.remove('translate-x-full', 'opacity-0');
        }));
        const bar = el.querySelector('.toast-progress');
        bar.style.transition = `width ${duration}ms linear`;
        requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = '0%'; }));
        const dismiss = () => {
            el.classList.add('translate-x-full', 'opacity-0');
            el.addEventListener('transitionend', () => el.remove(), { once: true });
        };
        const timer = setTimeout(dismiss, duration);
        el.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
    }
    return { show };
})();
const ConfirmModal = (() => {
    function show({ title, message, confirmLabel = 'Confirm', onConfirm }) {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm fade-in';
        overlay.innerHTML = `
            <div class="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-sm slide-up overflow-hidden">
                <div class="px-8 pt-8 pb-6 text-center">
                    <div class="w-12 h-12 rounded-full bg-rose-100 dark:bg-rose-500/10 flex items-center justify-center mx-auto mb-4">
                        <i data-lucide="trash-2" class="w-6 h-6 text-rose-500"></i>
                    </div>
                    <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">${title}</h3>
                    <p class="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">${message}</p>
                </div>
                <div class="px-8 pb-8 flex gap-3">
                    <button id="confirm-cancel" class="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-semibold text-sm transition-all">Cancel</button>
                    <button id="confirm-ok" class="flex-1 px-4 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-semibold text-sm shadow-lg shadow-rose-500/30 hover:-translate-y-0.5 transition-all">${confirmLabel}</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        lucide.createIcons({ nodes: [overlay] });
        const close = () => overlay.remove();
        overlay.querySelector('#confirm-cancel').addEventListener('click', close);
        overlay.querySelector('#confirm-ok').addEventListener('click', () => { close(); onConfirm(); });
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    }
    return { show };
})();
