export const LazyLoader = {
    skeletonTemplates: {
        card: `<div class="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width: 80%;"></div>
        </div>`,
        chart: `<div class="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
            <div class="skeleton skeleton-title mb-4"></div>
            <div class="skeleton skeleton-chart"></div>
        </div>`,
        metric: `<div class="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div class="skeleton" style="height: 0.75rem; width: 50%; margin-bottom: 0.5rem;"></div>
            <div class="skeleton" style="height: 1.5rem; width: 70%;"></div>
        </div>`,
    },
    
    createSkeleton(type, count = 1) {
        const template = this.skeletonTemplates[type];
        if (!template) return '';
        return Array(count).fill(template).join('');
    },
    
    wrapWithFadeIn(html, id) {
        return `<div id="${id}" class="fade-in-skeleton">${html}</div>`;
    },
    
    fadeInElement(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.add('fade-in-complete');
        setTimeout(() => el.classList.remove('fade-in-skeleton'), 500);
    }
};
