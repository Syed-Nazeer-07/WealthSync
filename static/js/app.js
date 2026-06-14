// Data Synchronization Layer
const DataSync = {
    // Track which views depend on which data types
    dependencies: {
        transactions: ['dashboard', 'budgets', 'insights', 'health'],
        budgets: ['dashboard', 'insights'],
        goals: ['dashboard', 'forecasting'],
        investments: ['dashboard', 'portfolio', 'net-worth']
    },
    
    // Mutation handlers that trigger dependent re-fetches
    async onTransactionChange() {
        App.render(true);
    },
    
    async onBudgetChange() {
        App.render(true);
    },
    
    async onGoalChange() {
        // Re-fetch forecasts since they depend on goals
        await App.fetchGoalForecasts();
        App.render(true);
    },
    
    async onInvestmentChange() {
        App.render(true);
    },
    
    // Trigger full sync after critical mutations
    async fullSync() {
        await Promise.all([
            App.fetchTransactions(),
            App.fetchBudgets(),
            App.fetchGoals(),
            App.fetchInvestments()
        ]);
    }
};

const LazyLoader = {
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

const App = {
    state: {
        activeTab: 'dashboard',
        isMobileMenuOpen: false,
        sidebarCollapsed: localStorage.getItem('sidebarCollapsed') === 'true',
        darkMode: localStorage.getItem('theme') === 'dark',
        modal: { isOpen: false, type: null, entityId: null },
        txFormType: 'expense',
        charts: {},
        chartsInitializing: false,
        txSearchQuery: '',
        txFilterCategory: '',
        roadmap: [],
        categories: [],
        transactions: [],
        txLoading: false,
        txError: null,
        currentUser: null,
        profile: null,
        settings: null,
        budgets: [],
        savings: [],
        goalForecasts: [],
        investments: [],
        renderTimer: null,
        txSelected: new Set(),
        pendingCategorySelect: null,
        initialized: false,
    },
    init() {
        if (this.state.initialized) return;
        this.state.initialized = true;
        if (this.state.darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        this.updateThemeIcons();
        this.updateLogos();
        this._applySidebarCollapsed();
        this.renderSidebarMenu();
        this.fetchCurrentUser();
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                if (this.state.isMobileMenuOpen) this.closeMobileSidebar();
                if (this.state.modal.isOpen) this.closeModal();
            }
        });
        // Handle backdrop click to close modal
        document.addEventListener('click', e => {
            if (this.state.modal.isOpen && e.target?.id === 'modal-container') {
                const overlay = e.target.querySelector('.fixed');
                if (overlay && e.target === overlay.parentElement) this.closeModal();
            }
        });
        // Handle window resize for chart responsiveness
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (this.state.activeTab === 'dashboard' || this.state.activeTab === 'investments') {
                    Object.values(this.state.charts).forEach(chart => {
                        if (chart && chart.resize) chart.resize();
                    });
                }
            }, 250);
        });
    },
    toggleSidebar() {
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
        localStorage.setItem('sidebarCollapsed', this.state.sidebarCollapsed);
        this._applySidebarCollapsed();
    },
    _applySidebarCollapsed() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        const chevron = document.getElementById('sidebar-chevron');
        const chevronIcon = document.getElementById('sidebar-chevron-icon');
        if (this.state.sidebarCollapsed) {
            sidebar.classList.add('sidebar-collapsed');
            if (chevron) chevron.style.left = 'calc(64px - 12px)';
            if (chevronIcon) chevronIcon.setAttribute('data-lucide', 'chevron-right');
        } else {
            sidebar.classList.remove('sidebar-collapsed');
            if (chevron) chevron.style.left = 'calc(260px - 12px)';
            if (chevronIcon) chevronIcon.setAttribute('data-lucide', 'chevron-left');
        }
        if (chevron) lucide.createIcons({ nodes: [chevron] });
    },
    async fetchCurrentUser() {
        const res = await fetch('/api/auth/me');
        if (res.status === 401) { window.location.href = '/login'; return; }
        this.state.currentUser = await res.json();
        const el = document.getElementById('sidebar-username');
        if (el) el.textContent = this.state.currentUser.name;
        const verifiedEl = document.getElementById('sidebar-verified-status');
        if (verifiedEl) {
            verifiedEl.textContent = this.state.currentUser.email_verified ? 'Verified' : 'Unverified';
            verifiedEl.className = this.state.currentUser.email_verified
                ? 'text-xs text-emerald-500 dark:text-emerald-400'
                : 'text-xs text-amber-500 dark:text-amber-400';
        }
        const profileRes = await fetch('/api/profile');
        if (profileRes.ok) {
            const profile = await profileRes.json();
            this.state.profile = profile;
            if (!profile.onboarding_completed) { window.location.href = '/onboarding'; return; }
        }
        const settingsRes = await fetch('/api/settings');
        if (settingsRes.ok) {
            const settings = await settingsRes.json();
            this.state.settings = settings;
            this.state.darkMode = settings.theme === 'dark';
            if (this.state.darkMode) document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', settings.theme);
            this.updateThemeIcons();
            this.state.sidebarCollapsed = settings.sidebar_collapsed;
            localStorage.setItem('sidebarCollapsed', settings.sidebar_collapsed);
            this._applySidebarCollapsed();
        }
        // Load critical dashboard data before rendering
        await Promise.all([
            this.fetchTransactions(),
            this.fetchCategories(),
            this.fetchBudgets(),
            this.fetchGoals(),
            this.fetchInvestments()
        ]);
        await this.fetchGoalForecasts();
    },
    async fetchCategories() {
        const res = await fetch('/api/categories');
        if (res.ok) {
            this.state.categories = await res.json();
            this.render();
        }
    },
    async fetchBudgets() {
        const res = await fetch('/api/budgets');
        if (res.ok) {
            this.state.budgets = await res.json();
            this.render();
        }
    },
    async fetchGoals() {
        const res = await fetch('/api/goals');
        if (res.ok) {
            this.state.savings = await res.json();
            this.fetchGoalForecasts();
            this.render();
        }
    },
    async fetchGoalForecasts() {
        const res = await fetch('/api/goals/forecast');
        if (res.ok) {
            this.state.goalForecasts = await res.json();
            this.render();
        }
    },
    async fetchInvestments() {
        const res = await fetch('/api/investments');
        if (res.ok) {
            this.state.investments = await res.json();
            this.render();
        }
    },
    async logout() {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    },
    async fetchTransactions() {
        this.state.txLoading = true;
        this.state.txError = null;
        this.render();
        try {
            const res = await fetch('/api/transactions');
            if (res.status === 401) { window.location.href = '/login'; return; }
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            this.state.transactions = await res.json();
        } catch (err) {
            this.state.txError = err.message;
        } finally {
            this.state.txLoading = false;
            this.render();
        }
    },
    toggleTheme() {
        this.state.darkMode = !this.state.darkMode;
        const newTheme = this.state.darkMode ? 'dark' : 'light';
        // Destroy charts before switching theme to avoid canvas reuse error
        if (this.state.charts.nw) this.state.charts.nw.destroy();
        if (this.state.charts.expense) this.state.charts.expense.destroy();
        if (this.state.darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('theme', newTheme);
        this.saveSetting('theme', newTheme);
        this.updateThemeIcons();
        this.updateLogos();
        this.render(); // Re-render to recreate charts with new theme
    },
    updateThemeIcons() {
        const iconStr = this.state.darkMode ? 'sun' : 'moon';
        const deskIcon = document.getElementById('theme-icon');
        const mobIcon = document.getElementById('theme-icon-mobile');
        if (deskIcon) deskIcon.setAttribute('data-lucide', iconStr);
        if (mobIcon) mobIcon.setAttribute('data-lucide', iconStr);
        lucide.createIcons();
    },
    updateLogos() {
        const logoPath = this.state.darkMode ? '/static/branding/logo2.png' : '/static/branding/logo1.png';
        const sidebarLogo = document.getElementById('sidebar-logo');
        const sidebarLogoIcon = document.getElementById('sidebar-logo-icon');
        const mobileLogo = document.getElementById('mobile-logo');
        if (sidebarLogo) sidebarLogo.src = logoPath;
        if (sidebarLogoIcon) sidebarLogoIcon.src = logoPath;
        if (mobileLogo) mobileLogo.src = logoPath;
    },
    getCurrencySymbol() {
        const SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', AED: 'د.إ', SGD: 'S$' };
        return SYMBOLS[this.state.settings?.currency] || '₹';
    },
    getCurrencyLocale() {
        const LOCALES = { INR: 'en-IN', USD: 'en-US', EUR: 'de-DE', GBP: 'en-GB', AED: 'ar-AE', SGD: 'en-SG' };
        return LOCALES[this.state.settings?.currency] || 'en-IN';
    },
    formatCurrency(amount) {
        const s = this.state.settings;
        return new Intl.NumberFormat(this.getCurrencyLocale(), {
            style: 'currency',
            currency: s?.currency || 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    },
    getCategoryNames(type = null) {
        return this.getSortedCategories(type).map(c => c.name);
    },
    getCategoryEmoji(name) {
        const cat = this.state.categories.find(c => c.name === name);
        return cat ? cat.emoji : '📦';
    },
    getCategoryColor(name) {
        const cat = this.state.categories.find(c => c.name === name);
        return cat ? cat.color : '#3b82f6';
    },
    getSortedCategories(type = null) {
        let cats = type ? this.state.categories.filter(c => c.category_type === type) : this.state.categories;
        return cats.sort((a, b) => {
            if (a.is_default && !b.is_default) return -1;
            if (!a.is_default && b.is_default) return 1;
            return a.name.localeCompare(b.name);
        });
    },
    getSkeletonCard() {
        return `<div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
            <div class="skeleton skeleton-text" style="width: 80%;"></div>
        </div>`;
    },
    getSkeletonChart() {
        return `<div class="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-chart"></div>
        </div>`;
    },
    getDashboardSkeleton() {
        return `
            <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
                ${Array(4).fill(this.getSkeletonCard()).join('')}
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                ${Array(2).fill(this.getSkeletonChart()).join('')}
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                ${Array(3).fill(this.getSkeletonCard()).join('')}
            </div>
        `;
    },
    validateCategoryName(name, catId = null) {
        name = name.trim();
        if (!name) return 'Category name cannot be empty';
        if (name.length > 50) return 'Category name must be 50 characters or less';
        if (/^\s+$/.test(name)) return 'Category name cannot be only whitespace';
        const exists = this.state.categories.find(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== catId);
        if (exists) return 'Category already exists';
        return null;
    },
    async categoryManager_create(name, type = 'expense', emoji = '📦', color = '#3b82f6') {
        const validationError = this.validateCategoryName(name);
        if (validationError) {
            Toast.show(validationError, 'error');
            return null;
        }
        const res = await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), category_type: type, emoji, color })
        });
        if (!res.ok) {
            const data = await res.json();
            Toast.show(data.error || 'Failed to create category', 'error');
            return null;
        }
        const newCat = await res.json();
        this.state.categories.push(newCat);
        return newCat;
    },
    async categoryManager_update(catId, updates) {
        const cat = this.state.categories.find(c => c.id === catId);
        if (!cat) {
            return false;
        }
        if (updates.name) {
            const validationError = this.validateCategoryName(updates.name, catId);
            if (validationError) {
                Toast.show(validationError, 'error');
                return false;
            }
        }
        const res = await fetch(`/api/categories/${catId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        if (!res.ok) {
            const data = await res.json();
            Toast.show(data.error || 'Failed to update category', 'error');
            return false;
        }
        const updated = await res.json();
        const idx = this.state.categories.findIndex(c => c.id === catId);
        if (idx !== -1) this.state.categories[idx] = updated;
        this.render();
        return true;
    },
    async categoryManager_delete(catId) {
        const cat = this.state.categories.find(c => c.id === catId);
        if (!cat) {
            Toast.show('Category not found', 'error');
            return false;
        }
        if (cat.is_default) {
            Toast.show('Cannot delete default categories', 'error');
            return false;
        }
        const inUse = this.state.transactions.some(tx => tx.category === cat.name);
        if (inUse && !confirm(`"${cat.name}" is used in transactions. Delete anyway? (Transactions will need reassignment)`)) {
            return false;
        }
        const res = await fetch(`/api/categories/${catId}`, { method: 'DELETE' });
        if (!res.ok) {
            const data = await res.json();
            Toast.show(data.error || 'Failed to delete category', 'error');
            return false;
        }
        this.state.categories = this.state.categories.filter(c => c.id !== catId);
        this.render();
        return true;
    },
    _getSeparators() {
        if (this._sepCache) return this._sepCache;
        const parts = new Intl.NumberFormat(this.getCurrencyLocale()).formatToParts(1234567.89);
        const decimal  = parts.find(p => p.type === 'decimal')?.value  || '.';
        const group    = parts.find(p => p.type === 'group')?.value    || ',';
        this._sepCache = { decimal, group };
        return this._sepCache;
    },
    _parseMoney(str) {
        const { decimal, group } = this._getSeparators();
        const groupRe = new RegExp('\\' + group, 'g');
        const clean = str.replace(groupRe, '').replace(decimal, '.');
        return parseFloat(clean);
    },
    formatMoneyInput(value) {
        const n = typeof value === 'string' ? this._parseMoney(value) : value;
        if (isNaN(n) || value === '' || value === '-') return String(value);
        return new Intl.NumberFormat(this.getCurrencyLocale(), { maximumFractionDigits: 2 }).format(n);
    },
    handleMoneyInput(e) {
        const input = e.target;
        const { decimal } = this._getSeparators();
        const raw = input.value;
        const decEsc = decimal === '.' ? '\\.' : decimal;
        if (!raw || raw === '-' || new RegExp(`^-?\\d*${decEsc}\\d*$`).test(raw.replace(new RegExp('\\' + (decimal === '.' ? ',' : '.'), 'g'), ''))) {
            if (raw.endsWith(decimal) || raw.endsWith(decimal + '0') || raw === '-') return;
        }
        const num = this._parseMoney(raw);
        if (isNaN(num)) { return; } 
        const pos = input.selectionStart;
        const charsAfterCursor = raw.slice(pos).replace(/\D/g, '').length;
        const formatted = new Intl.NumberFormat(this.getCurrencyLocale(), { maximumFractionDigits: 2 }).format(num);
        if (formatted === raw) return; 
        input.value = formatted;
        let digitsSeen = 0;
        let newPos = formatted.length;
        for (let i = formatted.length - 1; i >= 0; i--) {
            if (/\d/.test(formatted[i])) digitsSeen++;
            if (digitsSeen === charsAfterCursor) { newPos = i + 1; break; }
            if (digitsSeen > charsAfterCursor) { newPos = i + 1; break; }
        }
        input.setSelectionRange(newPos, newPos);
    },
    formatDate(dateString) {
        const [y, m, d] = dateString.split('-').map(Number);
        return new Intl.DateTimeFormat(this.getCurrencyLocale(), {
            month: 'short', day: 'numeric', year: 'numeric',
            timeZone: this.state.settings?.timezone || 'UTC'
        }).format(new Date(y, m - 1, d));
    },
    getCalculations() {
        try {
            const p = this.state.profile || {};
            const isCashFlow = p.account_mode === 'cashflow';
            
            const current_savings  = Number(p.current_savings || 0) || 0;
            const monthly_income   = Number(p.monthly_income || 0) || 0;
            const monthly_expenses = Number(p.monthly_expenses || 0) || 0;
            
            const txs = Array.isArray(this.state.transactions) ? this.state.transactions : [];
            const invs = Array.isArray(this.state.investments) ? this.state.investments : [];
            const budgets = Array.isArray(this.state.budgets) ? this.state.budgets : [];
            const savings = Array.isArray(this.state.savings) ? this.state.savings : [];

            // Core Transaction Math
            const txIncome = txs.filter(t => t.type === 'income').reduce((acc, t) => acc + Number(t.amount || 0), 0);
            const txExpenses = txs.filter(t => t.type === 'expense').reduce((acc, t) => acc + Number(t.amount || 0), 0);
            const totalIncome = Number(txIncome || monthly_income) || 0;
            const totalExpenses = Number(txExpenses || monthly_expenses) || 0;

            // Portfolio Math
            const activeAssets = invs.filter(inv => Number(inv.shares) > 0 && Number(inv.avgCost) > 0 && Number(inv.currentPrice) > 0);
            const activeInvestmentCost = activeAssets.reduce((acc, inv) => acc + (Number(inv.shares) * Number(inv.avgCost)), 0);
            const unrealizedValue = activeAssets.reduce((acc, inv) => acc + (Number(inv.shares) * Number(inv.currentPrice)), 0);
            const unrealizedProfit = unrealizedValue - activeInvestmentCost;

            const totalReturned = txs.filter(t => t.category === 'Investment Returns' && t.type === 'income').reduce((acc, t) => acc + Number(t.amount || 0), 0);
            const realizedCost = txs.filter(t => t.category === 'Investment Cost Basis' && t.type === 'expense').reduce((acc, t) => acc + Number(t.amount || 0), 0);
            const realizedProfit = totalReturned - realizedCost;
            const netProfitLoss = realizedProfit + unrealizedProfit;

            const totalInvestmentValue = unrealizedValue;
            const totalInvestmentCost = activeInvestmentCost;
            const investmentProfit = unrealizedProfit;

            // Balance & Net Worth Math
            const currentCash = txIncome - txExpenses - activeInvestmentCost;
            const availableBalance = isCashFlow ? (current_savings + currentCash) : (currentCash + current_savings + totalInvestmentValue);
            const netWorth = currentCash + current_savings + totalInvestmentValue;

            const now = new Date();
            const thisYM  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
            const lastDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
            const lastYM  = `${lastDate.getFullYear()}-${String(lastDate.getMonth()+1).padStart(2,'0')}`;
            const txThisMonth = txs.filter(t => t.date.startsWith(thisYM));
            const txLastMonth = txs.filter(t => t.date.startsWith(lastYM));
            const netThisMonth = txThisMonth.reduce((s,t) => s + (t.type==='income' ? t.amount : -t.amount), 0);
            const netLastMonth = txLastMonth.reduce((s,t) => s + (t.type==='income' ? t.amount : -t.amount), 0);
            let netWorthGrowth = 0;
            if (netLastMonth !== 0) {
                netWorthGrowth = ((netThisMonth - netLastMonth) / Math.abs(netLastMonth)) * 100;
            } else if (netThisMonth > 0) {
                netWorthGrowth = 100;
            }

            const budgetProgress = budgets.map(budget => {
                const spent = txs.filter(t => t.type === 'expense' && t.category === budget.category).reduce((acc, curr) => acc + curr.amount, 0);
                return { ...budget, spent };
            });

            let healthScore = 0, breakdown = {};
            if (isCashFlow) {
                let spendingScore = 15;
                if (txIncome > 0) {
                    const spendRate = txExpenses / txIncome;
                    spendingScore = spendRate <= 0.7 ? 30 : spendRate <= 0.85 ? 20 : spendRate <= 1.0 ? 10 : 5;
                }
                let budgetScore = budgetProgress.length > 0
                    ? (budgetProgress.filter(b => b.spent <= b.limit).length / budgetProgress.length) * 20
                    : 10;
                let goalScore = 10;
                if (savings.length > 0) {
                    const avgProgress = savings.reduce((sum, g) => sum + Math.min(100, g.target > 0 ? (g.current / g.target) * 100 : 0), 0) / savings.length;
                    goalScore = (avgProgress / 100) * 25;
                }
                const trendScore = currentCash > 0 ? 15 : currentCash > -1000 ? 8 : 3;
                const consistencyScore = Math.min(10, txs.length / 5);
                healthScore = Math.round(spendingScore + budgetScore + goalScore + trendScore + consistencyScore);
                breakdown = { spendingScore: Math.round(spendingScore), budgetScore: Math.round(budgetScore), goalScore: Math.round(goalScore), trendScore: Math.round(trendScore), consistencyScore: Math.round(consistencyScore) };
            } else {
                const monthlyIncomeLocal = monthly_income || (txIncome / Math.max(1, txs.length));
                const savingsRate = current_savings / (monthlyIncomeLocal * 12 || 1);
                const savingsRateScore = Math.min(20, savingsRate * 100);
                const emergencyMonths = current_savings / (monthly_expenses || totalExpenses || 1);
                const emergencyFundScore = Math.min(20, (emergencyMonths / 6) * 20);
                let budgetScore = budgetProgress.length > 0
                    ? (budgetProgress.filter(b => b.spent <= b.limit).length / budgetProgress.length) * 15
                    : 10;
                let goalScore = 5;
                if (savings.length > 0) {
                    const avgProgress = savings.reduce((sum, g) => sum + Math.min(100, g.target > 0 ? (g.current / g.target) * 100 : 0), 0) / savings.length;
                    goalScore = (avgProgress / 100) * 15;
                }
                const invRatio = current_savings > 0 ? (totalInvestmentValue / current_savings) : (totalInvestmentValue > 0 ? 1 : 0);
                const investmentScore = Math.min(15, invRatio * 15);
                const monthlyExp = {};
                txs.filter(t => t.type === 'expense').forEach(t => {
                    const ym = t.date.substring(0, 7);
                    monthlyExp[ym] = (monthlyExp[ym] || 0) + t.amount;
                });
                let stabilityScore = 5;
                if (Object.keys(monthlyExp).length >= 2) {
                    const expValues = Object.values(monthlyExp);
                    const avgExp = expValues.reduce((a, b) => a + b, 0) / expValues.length;
                    const variance = expValues.reduce((sum, val) => sum + Math.pow(val - avgExp, 2), 0) / expValues.length;
                    const cv = avgExp > 0 ? Math.sqrt(variance) / avgExp : 1;
                    stabilityScore = Math.max(0, 10 * (1 - Math.min(1, cv)));
                }
                const growthScore = netWorth > 0 ? 5 : 2;
                healthScore = Math.round(savingsRateScore + emergencyFundScore + budgetScore + goalScore + investmentScore + stabilityScore + growthScore);
                breakdown = { savingsRateScore: Math.round(savingsRateScore), emergencyFundScore: Math.round(emergencyFundScore), budgetScore: Math.round(budgetScore), goalScore: Math.round(goalScore), investmentScore: Math.round(investmentScore), stabilityScore: Math.round(stabilityScore), growthScore: Math.round(growthScore) };
            }

            return {
                totalIncome, totalExpenses, currentCash, current_savings, monthly_income, monthly_expenses,
                totalInvestmentValue, totalInvestmentCost, investmentProfit,
                totalReturned, realizedCost, realizedProfit, netProfitLoss,
                netWorth, availableBalance, netWorthGrowth, budgetProgress, healthScore,
                breakdown, isCashFlow
            };
        } catch (error) {
            console.error("Dashboard calculation error:", error);
            return {
                totalIncome: 0, totalExpenses: 0, currentCash: 0, current_savings: 0, monthly_income: 0, monthly_expenses: 0,
                totalInvestmentValue: 0, totalInvestmentCost: 0, investmentProfit: 0,
                netWorth: 0, availableBalance: 0, netWorthGrowth: 0, budgetProgress: [], healthScore: 0,
                breakdown: {}, isCashFlow: false
            };
        }
    },
    getBadges() {
        const calc = this.getCalculations();
        const p = this.state.profile || {};
        return [
            {
                id: 1, icon: 'shield-check', title: 'Emergency Funded',
                earned: calc.current_savings >= ((p.monthly_expenses || 0) * 6)
            },
            {
                id: 2, icon: 'target', title: 'Budget Master',
                earned: this.state.budgets.length > 0 && calc.budgetProgress.every(b => b.spent <= b.limit)
            },
            {
                id: 3, icon: 'rocket', title: 'Net Worth +25%',
                earned: calc.netWorthGrowth >= 25
            }
        ];
    },
    _todayInTz() {
        const tz = this.state.settings?.timezone || 'UTC';
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
        const p = {};
        parts.forEach(x => { p[x.type] = x.value; });
        return `${p.year}-${p.month}-${p.day}`;
    },
    _prevDay(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dt = new Date(y, m - 1, d - 1);
        return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
    },
    getStreak() {
        const dates = new Set(this.state.transactions.map(t => t.date));
        let streak = 0;
        let day = this._todayInTz();
        while (dates.has(day)) {
            streak++;
            day = this._prevDay(day);
        }
        return streak;
    },
    getRuleBasedInsights() {
        const insights = [];
        const calc = this.getCalculations();
        if (calc.healthScore < 60) {
            insights.push({ type: 'danger', icon: 'alert-triangle', text: 'Financial health score is dropping. Priority: Reduce non-essential spending.' });
        }
        const overBudget = calc.budgetProgress.find(b => b.spent > b.limit);
        if (overBudget) {
            insights.push({ type: 'warning', icon: 'pie-chart', text: `You have exceeded your ${overBudget.category} budget by ${this.formatCurrency(overBudget.spent - overBudget.limit)}.` });
        }
        if (calc.current_savings > 0 && calc.totalInvestmentValue === 0) {
            insights.push({ type: 'info', icon: 'trending-up', text: 'You have savings but no investments. Consider starting a systematic investment plan (SIP).' });
        }
        if (insights.length === 0) {
            const streak = this.getStreak();
            const streakText = streak > 0 ? ` Keep up the ${streak}-day activity streak!` : '';
            insights.push({ type: 'success', icon: 'check-circle', text: `Your finances are well optimized.${streakText}` });
        }
        return insights;
    },
    _currentYM() {
        const today = this._todayInTz();
        return today.slice(0, 7);
    },
    _lastYM() {
        const today = this._todayInTz();
        const [y, m] = today.split('-').map(Number);
        const prev = new Date(y, m - 2, 1);
        return `${prev.getFullYear()}-${String(prev.getMonth()+1).padStart(2,'0')}`;
    },
    getMonthlyReport() {
        const ym = this._currentYM();
        const lym = this._lastYM();
        const txThis = this.state.transactions.filter(t => t.date.startsWith(ym));
        const txLast = this.state.transactions.filter(t => t.date.startsWith(lym));
        const income   = txThis.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
        const expenses = txThis.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
        const lastIncome   = txLast.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
        const lastExpenses = txLast.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
        const savings = income - expenses;
        const savingsRate = income > 0 ? (savings / income) * 100 : 0;
        const netChange = savings - (lastIncome - lastExpenses);
        const catThis = {};
        txThis.filter(t => t.type === 'expense').forEach(t => { catThis[t.category] = (catThis[t.category] || 0) + t.amount; });
        const catLast = {};
        txLast.filter(t => t.type === 'expense').forEach(t => { catLast[t.category] = (catLast[t.category] || 0) + t.amount; });
        const topCat = Object.entries(catThis).sort((a,b) => b[1]-a[1])[0];
        let fastestCat = null, fastestGrowth = 0;
        Object.entries(catThis).forEach(([cat, amt]) => {
            const prev = catLast[cat] || 0;
            const growth = amt - prev;
            if (growth > fastestGrowth) { fastestGrowth = growth; fastestCat = cat; }
        });
        const score = this.getCalculations().healthScore;
        const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
        const gradeColor = { A: 'text-emerald-500', B: 'text-brand-500', C: 'text-amber-500', D: 'text-orange-500', F: 'text-rose-500' }[grade];
        return { income, expenses, savings, savingsRate, netChange, topCat, fastestCat, fastestGrowth, grade, gradeColor, lastIncome, lastExpenses };
    },
    getSmartInsights(period = 'month') {
        const today = this._todayInTz();
        const [ty, tm, td] = today.split('-').map(Number);
        let startThis, startLast;
        if (period === 'week') {
            const thisMonday = new Date(ty, tm-1, td - ((new Date(ty,tm-1,td).getDay() + 6) % 7));
            const lastMonday = new Date(thisMonday); lastMonday.setDate(lastMonday.getDate() - 7);
            const lastSunday = new Date(thisMonday); lastSunday.setDate(lastSunday.getDate() - 1);
            startThis = thisMonday.toISOString().slice(0,10);
            startLast = lastMonday.toISOString().slice(0,10);
            var endLast  = lastSunday.toISOString().slice(0,10);
        } else if (period === 'year') {
            startThis = `${ty}-01-01`;
            startLast = `${ty-1}-01-01`;
            var endLast  = `${ty-1}-12-31`;
        } else {
            startThis = `${ty}-${String(tm).padStart(2,'0')}-01`;
            const prevM = new Date(ty, tm-2, 1);
            startLast = `${prevM.getFullYear()}-${String(prevM.getMonth()+1).padStart(2,'0')}-01`;
            const lastDay = new Date(ty, tm-1, 0);
            var endLast  = `${prevM.getFullYear()}-${String(prevM.getMonth()+1).padStart(2,'0')}-${String(lastDay.getDate()).padStart(2,'0')}`;
        }
        const txThis = this.state.transactions.filter(t => t.date >= startThis && t.date <= today);
        const txLast = this.state.transactions.filter(t => t.date >= startLast && t.date <= endLast);
        const catThis = {}, catLast = {};
        txThis.filter(t => t.type==='expense').forEach(t => { catThis[t.category] = (catThis[t.category]||0) + t.amount; });
        txLast.filter(t => t.type==='expense').forEach(t => { catLast[t.category] = (catLast[t.category]||0) + t.amount; });
        const incThis = txThis.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
        const expThis = txThis.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
        const incLast = txLast.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
        const expLast = txLast.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
        const insights = [];
        const allCats = new Set([...Object.keys(catThis), ...Object.keys(catLast)]);
        allCats.forEach(cat => {
            const curr = catThis[cat] || 0;
            const prev = catLast[cat] || 0;
            if (prev === 0 && curr === 0) return;
            const diff = curr - prev;
            const pct = prev > 0 ? Math.round((diff / prev) * 100) : null;
            if (Math.abs(diff) < 1) return;
            if (diff > 0) {
                const label = pct !== null ? `(+${pct}%)` : '(new)';
                insights.push({ type: 'warning', icon: 'trending-up',
                    text: `${cat} spending increased by ${this.formatCurrency(diff)} ${label}.` });
            } else {
                const label = pct !== null ? `(${pct}%)` : '';
                insights.push({ type: 'success', icon: 'trending-down',
                    text: `${cat} spending decreased by ${this.formatCurrency(Math.abs(diff))} ${label}.` });
            }
        });
        const srThis = incThis > 0 ? ((incThis-expThis)/incThis*100) : null;
        const srLast = incLast > 0 ? ((incLast-expLast)/incLast*100) : null;
        if (srThis !== null && srLast !== null && Math.abs(srThis - srLast) >= 1) {
            const dir = srThis > srLast ? 'improved' : 'dropped';
            const typ = srThis > srLast ? 'success' : 'warning';
            insights.push({ type: typ, icon: 'percent',
                text: `Savings rate ${dir} from ${srLast.toFixed(0)}% to ${srThis.toFixed(0)}%.` });
        }
        const netThis = incThis - expThis;
        if (netThis !== 0) {
            insights.push({ type: netThis > 0 ? 'success' : 'warning', icon: netThis > 0 ? 'arrow-up-circle' : 'arrow-down-circle',
                text: `Net cash flow ${netThis > 0 ? 'positive' : 'negative'}: ${this.formatCurrency(Math.abs(netThis))} ${netThis > 0 ? 'gained' : 'spent more than earned'}.` });
        }
        const calc = this.getCalculations();
        const overBudgets = calc.budgetProgress.filter(b => b.spent > b.limit);
        if (overBudgets.length === 0 && calc.budgets?.length > 0) {
            insights.push({ type: 'success', icon: 'check-circle', text: 'You remained within all budgets this period.' });
        }
        if (insights.length === 0) {
            insights.push({ type: 'info', icon: 'info', text: 'Add transactions to see spending insights for this period.' });
        }
        insights.sort((a, b) => {
            if (a.type === 'warning' && b.type !== 'warning') return -1;
            if (b.type === 'warning' && a.type !== 'warning') return 1;
            return 0;
        });
        return insights.slice(0, 6);
    },
    getGoalForecast(goalId) {
        return this.state.goalForecasts.find(f => f.goalId === goalId) || null;
    },
    getRecentActivity() {
        const today = this._todayInTz();
        const yesterday = this._prevDay(today);
        const groups = { today: [], yesterday: [], earlier: [] };
        [...this.state.transactions]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 20)
            .forEach(tx => {
                if (tx.date === today) groups.today.push(tx);
                else if (tx.date === yesterday) groups.yesterday.push(tx);
                else groups.earlier.push(tx);
            });
        return groups;
    },
    setActiveTab(tab) {
        if (this.state.activeTab === tab) return;
        this.state.activeTab = tab;
        this.renderSidebarMenu();
        if (window.innerWidth < 768) {
            this.state.isMobileMenuOpen = false;
            this.updateMobileSidebar();
        }
        this.render();
    },
    toggleMobileMenu() {
        this.state.isMobileMenuOpen = !this.state.isMobileMenuOpen;
        this._updateMobileOverlay();
    },
    closeMobileSidebar() {
        this.state.isMobileMenuOpen = false;
        this._updateMobileOverlay();
    },
    _updateMobileOverlay() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        const icon = document.getElementById('mobile-menu-icon');
        if (this.state.isMobileMenuOpen) {
            sidebar.classList.add('mobile-open');
            overlay.classList.remove('hidden');
            if (icon) icon.setAttribute('data-lucide', 'x');
        } else {
            sidebar.classList.remove('mobile-open');
            overlay.classList.add('hidden');
            if (icon) icon.setAttribute('data-lucide', 'menu');
        }
        lucide.createIcons();
    },
    updateMobileSidebar() { this._updateMobileOverlay(); },
    handleTxSearch(e) {
        this.state.txSearchQuery = e.target.value;
        clearTimeout(this._txSearchTimer);
        this._txSearchTimer = setTimeout(() => this._renderTxTable(), 200);
    },
    handleTxFilter(e) {
        this.state.txFilterCategory = e.target.value;
        this._renderTxTable();
    },
    clearTxSearch() {
        this.state.txSearchQuery = '';
        const input = document.getElementById('tx-search-input');
        if (input) { input.value = ''; input.focus(); }
        const clearBtn = document.getElementById('tx-search-clear');
        if (clearBtn) clearBtn.classList.add('hidden');
        this._renderTxTable();
    },
    _renderTxTable() {
        const tbody = document.getElementById('tx-table-body');
        if (!tbody) return; 
        tbody.innerHTML = this._getTxRows();
        lucide.createIcons({ nodes: [tbody] });
        const clearBtn = document.getElementById('tx-search-clear');
        if (clearBtn) clearBtn.classList.toggle('hidden', !this.state.txSearchQuery);
    },
    async saveSetting(key, value) {
        const res = await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [key]: value })
        });
        if (!res.ok) { Toast.show('Failed to save setting', 'error'); return; }
        const updated = await res.json();
        this.state.settings = updated;
        if (key === 'currency') this._sepCache = null;
        if (key === 'theme') {
            this.state.darkMode = value === 'dark';
            document.documentElement.classList.toggle('dark', this.state.darkMode);
            localStorage.setItem('theme', value);
            this.updateThemeIcons();
        }
        if (key === 'sidebar_collapsed') {
            this.state.sidebarCollapsed = value;
            localStorage.setItem('sidebarCollapsed', value);
            this._applySidebarCollapsed();
        }
        this.render();
    },
    async saveSettingName() {
        const name = (document.getElementById('settings-name')?.value || '').trim();
        if (!name) return;
        const res = await fetch('/api/settings/update-name', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (!res.ok) { Toast.show(data.error || 'Failed', 'error'); return; }
        this.state.currentUser.name = data.name;
        const el = document.getElementById('sidebar-username');
        if (el) el.textContent = data.name;
        Toast.show('Name updated', 'success');
        this.render();
    },
    async saveSettingPassword() {
        const cur = document.getElementById('settings-pw-current')?.value || '';
        const nw  = document.getElementById('settings-pw-new')?.value || '';
        const err = document.getElementById('settings-pw-err');
        const res = await fetch('/api/settings/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: cur, new_password: nw })
        });
        const data = await res.json();
        if (!res.ok) {
            if (err) { err.textContent = data.error; err.classList.remove('hidden'); }
            return;
        }
        Toast.show('Password changed successfully', 'success');
        if (err) err.classList.add('hidden');
        document.getElementById('settings-pw-current').value = '';
        document.getElementById('settings-pw-new').value = '';
    },
    async resendVerification() {
        const res = await fetch('/api/settings/resend-verification', { method: 'POST' });
        Toast.show(res.ok ? 'Verification email sent' : 'Failed to send', res.ok ? 'success' : 'error');
    },
    formatNumber(num) {
        return new Intl.NumberFormat(this.getCurrencyLocale(), { maximumFractionDigits: 0 }).format(num || 0);
    },
    async saveMonthlyIncome() {
        const parseNum = (val) => parseFloat((val || '').replace(/,/g, '')) || 0;
        const monthly_income = parseNum(document.getElementById('profile-monthly-income')?.value);
        
        const res = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ monthly_income })
        });
        
        if (!res.ok) {
            Toast.show('Failed to save income', 'error');
            return;
        }
        
        this.state.profile.monthly_income = monthly_income;
        Toast.show('Monthly income saved', 'success');
        this.render();
    },
    dangerAction(action) {
        const configs = {
            'clear-transactions':  { title: 'Delete All Transactions',    msg: 'This will permanently delete all your transaction records.' },
            'clear-financial-data':{ title: 'Delete All Financial Data',  msg: 'This will delete transactions, budgets, goals, investments and roadmap.' },
            'delete-account':      { title: 'Delete Account',             msg: 'This will permanently delete your account and all data. This cannot be undone.', needsPassword: true },
        };
        const cfg = configs[action];
        if (!cfg) return;
        if (cfg.needsPassword && this.state.currentUser?.has_password) {
            const overlay = document.createElement('div');
            overlay.className = 'fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm modal-overlay';
            overlay.innerHTML = `
                <div class="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 p-8 modal-standard">
                    <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">${cfg.title}</h3>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">${cfg.msg}</p>
                    <input id="danger-pw" type="password" placeholder="Enter your password to confirm" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 mb-4">
                    <p id="danger-pw-err" class="text-rose-500 text-xs mb-3 hidden"></p>
                    <div class="flex gap-3">
                        <button id="danger-cancel" class="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300">Cancel</button>
                        <button id="danger-confirm" class="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold">Delete Account</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            overlay.querySelector('#danger-cancel').onclick = () => overlay.remove();
            overlay.querySelector('#danger-confirm').onclick = async () => {
                const pw = overlay.querySelector('#danger-pw').value;
                const r = await fetch(`/api/danger/${action}`, { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({password: pw}) });
                if (!r.ok) {
                    const d = await r.json();
                    const errEl = overlay.querySelector('#danger-pw-err');
                    errEl.textContent = d.error; errEl.classList.remove('hidden');
                    return;
                }
                window.location.href = '/login';
            };
        } else {
            ConfirmModal.show({
                title: cfg.title,
                message: cfg.msg + '<br><br>This action cannot be undone.',
                confirmLabel: 'Confirm',
                onConfirm: async () => {
                    const r = await fetch(`/api/danger/${action}`, { method: 'DELETE' });
                    if (!r.ok) { Toast.show('Action failed', 'error'); return; }
                    if (action === 'delete-account') { window.location.href = '/login'; return; }
                    this.state.transactions = [];
                    this.state.budgets = [];
                    this.state.savings = [];
                    this.state.investments = [];
                    this.state.roadmap = [];
                    Toast.show('Data deleted successfully', 'success');
                    this.render();
                }
            });
        }
    },
    renderSidebarMenu() {
        const navItems = [
            { id: 'dashboard',    label: 'Dashboard',       icon: 'layout-dashboard' },
            { id: 'transactions', label: 'Transactions',    icon: 'receipt' },
            { id: 'budgets',      label: 'Budgets & Alerts',icon: 'pie-chart' },
            { id: 'savings',      label: 'Goal Forecasting',icon: 'target' },
            { id: 'investments',  label: 'Portfolio',       icon: 'trending-up' },
            null, 
            { id: 'settings',     label: 'Settings',        icon: 'settings' },
        ];
        document.getElementById('nav-menu').innerHTML = navItems.map(item => {
            if (!item) return `<div class="sidebar-section-divider mx-3 my-2 border-t border-slate-100 dark:border-slate-700"></div>`;
            const isActive = this.state.activeTab === item.id;
            const activeClasses = isActive
                ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 font-semibold shadow-sm ring-1 ring-brand-500'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white';
            const iconClass = isActive ? 'text-brand-500 dark:text-brand-400' : 'text-slate-400 dark:text-slate-500';
            return `<button onclick="App.setActiveTab('${item.id}')"
                class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${activeClasses}"
                title="${item.label}">
                <i data-lucide="${item.icon}" class="nav-icon w-5 h-5 shrink-0 ${iconClass}"></i>
                <span class="sidebar-text">${item.label}</span>
            </button>`;
        }).join('');
        lucide.createIcons({ nodes: [document.getElementById('sidebar')] });
    },
    renderDashboardOnly() {
        if (this.state.activeTab !== 'dashboard') return;
        const content = document.getElementById('main-content');
        
        // Show skeleton first for instant feel
        if (!this.state.profile || !this.state.transactions.length) {
            content.innerHTML = this.getDashboardSkeleton();
            setTimeout(() => {
                if (this.state.profile && this.state.transactions.length) {
                    content.innerHTML = this.getDashboardHTML();
                    lucide.createIcons();
                    this.initDashboardCharts();
                }
            }, 100);
            return;
        }
        
        content.innerHTML = this.getDashboardHTML();
        lucide.createIcons();
        setTimeout(() => {
            if (!this.state.chartsInitializing) {
                this.state.chartsInitializing = true;
                this.initDashboardCharts().finally(() => { this.state.chartsInitializing = false; });
            }
        }, 50);
    },
    renderTransactionsOnly() {
        if (this.state.activeTab !== 'transactions') return;
        this._renderTxTable();
    },
    renderBudgetsOnly() {
        if (this.state.activeTab !== 'budgets') return;
        const content = document.getElementById('main-content');
        content.innerHTML = this.getBudgetsHTML();
        lucide.createIcons();
    },
    renderSavingsOnly() {
        if (this.state.activeTab !== 'savings') return;
        const content = document.getElementById('main-content');
        content.innerHTML = this.getSavingsHTML();
        lucide.createIcons();
    },
    renderInvestmentsOnly() {
        if (this.state.activeTab !== 'investments') return;
        const content = document.getElementById('main-content');
        content.innerHTML = this.getInvestmentsHTML();
        lucide.createIcons();
        setTimeout(() => this.initInvestmentCharts(), 50);
    },
    render(force = false) {
        // Debounce render to prevent double initialization
        clearTimeout(this.state.renderTimer);
        this.state.renderTimer = setTimeout(() => this._doRender(force), 50);
    },
    _doRender(force = false) {
        if (!force && this.state.activeTab === 'transactions' && !this.state.txLoading && !this.state.txError) {
            const focused = document.activeElement;
            const txContent = document.getElementById('tx-table-body');
            if (focused && focused.closest('#main-content') && txContent) {
                this._renderTxTable();
                return;
            }
        }
        const content = document.getElementById('main-content');
        Object.values(this.state.charts).forEach(chart => chart.destroy());
        this.state.charts = {};
        if (this.state.txLoading) {
            content.innerHTML = `<div class="flex items-center justify-center h-full"><div class="text-slate-500 dark:text-slate-400 flex items-center gap-3"><i data-lucide="loader" class="w-5 h-5 animate-spin"></i> Loading transactions…</div></div>`;
            lucide.createIcons();
            return;
        }
        if (this.state.txError) {
            content.innerHTML = `<div class="flex items-center justify-center h-full"><div class="text-rose-500 flex flex-col items-center gap-3 text-center"><i data-lucide="wifi-off" class="w-8 h-8"></i><p class="font-semibold">Failed to load transactions</p><p class="text-sm text-slate-500 dark:text-slate-400">${this.state.txError}</p><button onclick="App.fetchTransactions()" class="mt-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors">Retry</button></div></div>`;
            lucide.createIcons();
            return;
        }
        let html = '';
        switch (this.state.activeTab) {
            case 'dashboard':
                // Show skeleton while preparing dashboard
                html = LazyLoader.wrapWithFadeIn(
                    LazyLoader.createSkeleton('metric', 4) + 
                    LazyLoader.createSkeleton('chart', 3),
                    'dashboard-skeleton'
                );
                break;
            case 'transactions': html = this.getTransactionsHTML(); break;
            case 'budgets':      html = this.getBudgetsHTML(); break;
            case 'savings':      html = this.getSavingsHTML(); break;
            case 'investments':  html = this.getInvestmentsHTML(); break;
            case 'settings':     html = this.getSettingsHTML(); break;
        }
        content.innerHTML = html;
        lucide.createIcons();
        
        // Load dashboard content after skeleton displays
        if (this.state.activeTab === 'dashboard') {
            requestAnimationFrame(() => {
                const dashboardHTML = this.getDashboardHTML();
                content.innerHTML = dashboardHTML;
                lucide.createIcons();
                if (window.tailwind && window.tailwind.process) {
                    window.tailwind.process();
                }
                this._initChartsWithLazyLoading();
            });
        } else {
            // Force Tailwind CDN to process new classes
            if (window.tailwind && window.tailwind.process) {
                window.tailwind.process();
            }
            setTimeout(async () => {
                if (!this.state.chartsInitializing) {
                    this.state.chartsInitializing = true;
                    try {
                        if (this.state.activeTab === 'investments') this.initInvestmentCharts();
                    } finally {
                        this.state.chartsInitializing = false;
                    }
                }
            }, 50);
        }
    },
    
    _initChartsWithLazyLoading() {
        if (this.state.chartsInitializing) return;
        this.state.chartsInitializing = true;
        
        // Lazy load charts with slight delays for smooth rendering
        const chartElements = document.querySelectorAll('[data-chart-type]');
        let delay = 0;
        
        chartElements.forEach((el, idx) => {
            setTimeout(() => {
                if (el && el.offsetHeight > 0) { // Only init if visible
                    el.classList.add('fade-in-skeleton');
                }
            }, delay);
            delay += 100;
        });
        
        setTimeout(async () => {
            try {
                if (this.state.activeTab === 'dashboard') await this.initDashboardCharts();
            } finally {
                this.state.chartsInitializing = false;
                // Fade in charts
                chartElements.forEach(el => {
                    if (el) el.classList.add('fade-in-complete');
                });
            }
        }, delay + 50);
    },
    openModal(type, id = null) {
        this.state.modal = { isOpen: true, type, entityId: id };
        if (type === 'transaction') {
            if (id) {
                const item = this.state.transactions.find(t => t.id === id);
                if (item) this.state.txFormType = item.type;
            } else {
                this.state.txFormType = 'expense';
            }
        }
        this.renderModal();
    },
    closeModal() {
        this.state.modal = { isOpen: false, type: null, entityId: null };
        this.renderModal();
    },
    setTxType(type) {
        this.state.txFormType = type;
        const expBtn = document.getElementById('btn-expense');
        const incBtn = document.getElementById('btn-income');
        if (type === 'expense') {
            expBtn.className = "py-2.5 rounded-xl text-sm font-bold border-2 transition-all border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400";
            incBtn.className = "py-2.5 rounded-xl text-sm font-bold border-2 transition-all border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400";
        } else {
            incBtn.className = "py-2.5 rounded-xl text-sm font-bold border-2 transition-all border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
            expBtn.className = "py-2.5 rounded-xl text-sm font-bold border-2 transition-all border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400";
        }
    },
    async handleFormSubmit(event) {
        event.preventDefault();
        const fd = new FormData(event.target);
        const { type, entityId } = this.state.modal;
        const id = entityId || Date.now();
        if (type === 'transaction') {
            const payload = {
                description: fd.get('description'),
                amount:      this._parseMoney(fd.get('amount') || '0'),
                date:        fd.get('date'),
                category:    fd.get('category'),
                type:        this.state.txFormType,
            };
            const submitBtn = event.target.querySelector('[type=submit]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Saving…';
            try {
                const url = entityId ? `/api/transactions/${entityId}` : '/api/transactions';
                const method = entityId ? 'PUT' : 'POST';
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Request failed');
                
                // Update state directly instead of fetching
                if (entityId) {
                    const idx = this.state.transactions.findIndex(t => t.id === entityId);
                    if (idx !== -1) this.state.transactions[idx] = data;
                } else {
                    this.state.transactions.unshift(data);
                }
            } catch (err) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Save Record';
                const errEl = event.target.querySelector('#form-error');
                if (errEl) errEl.textContent = err.message;
                Toast.show(err.message, 'error');
                return;
            }
            this.closeModal();
            Toast.show(entityId ? 'Transaction updated successfully' : 'Transaction created successfully', 'success');
            // Sync dependent views
            await DataSync.onTransactionChange();
            return;
        } else if (type === 'budget') {
            const payload = { category: fd.get('category'), limit: this._parseMoney(fd.get('limit') || '0') };
            const url = entityId ? `/api/budgets/${entityId}` : '/api/budgets';
            const method = entityId ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) { Toast.show('Failed to save budget', 'error'); return; }
            const data = await res.json();
            
            // Update state directly
            if (entityId) {
                const idx = this.state.budgets.findIndex(b => b.id === entityId);
                if (idx !== -1) this.state.budgets[idx] = data;
            } else {
                this.state.budgets.push(data);
            }
            
            this.closeModal();
            Toast.show(entityId ? 'Budget updated' : 'Budget created', 'success');
            await DataSync.onBudgetChange();
            return;
        } else if (type === 'saving') {
            const _m = s => this._parseMoney(s || '0');
            const payload = { name: fd.get('name'), target: _m(fd.get('target')),
                current: _m(fd.get('current')),
                monthlyContribution: _m(fd.get('monthlyContribution')),
                date: fd.get('date') };
            const url = entityId ? `/api/goals/${entityId}` : '/api/goals';
            const method = entityId ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) { Toast.show('Failed to save goal', 'error'); return; }
            const data = await res.json();
            
            // Update state directly
            if (entityId) {
                const idx = this.state.savings.findIndex(s => s.id === entityId);
                if (idx !== -1) this.state.savings[idx] = data;
            } else {
                this.state.savings.push(data);
            }
            
            this.closeModal();
            Toast.show(entityId ? 'Goal updated' : 'Goal created', 'success');
            await DataSync.onGoalChange();
            return;
        } else if (type === 'investment') {
            const payload = { symbol: fd.get('symbol'), type: fd.get('invType'),
                shares: parseFloat(fd.get('shares')), avgCost: this._parseMoney(fd.get('avgCost') || '0'),
                currentPrice: this._parseMoney(fd.get('currentPrice') || '0') };
            const url = entityId ? `/api/investments/${entityId}` : '/api/investments';
            const method = entityId ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) { Toast.show('Failed to save investment', 'error'); return; }
            const data = await res.json();
            
            // Update state directly
            if (entityId) {
                const idx = this.state.investments.findIndex(i => i.id === entityId);
                if (idx !== -1) this.state.investments[idx] = data;
            } else {
                this.state.investments.push(data);
            }
            
            this.closeModal();
            Toast.show(entityId ? 'Investment updated' : 'Investment added', 'success');
            await DataSync.onInvestmentChange();
            return;
        } else if (type === 'roadmap') {
            const payload = { title: fd.get('title'), icon: fd.get('icon'), status: 'pending' };
            const res = await fetch('/api/roadmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const newItem = await res.json();
                this.state.roadmap.push(newItem);
            }
        }
        this.closeModal();
        this.render();
    },
    async deleteItem(type, id) {
        if (type === 'transaction') {
            ConfirmModal.show({
                title: 'Delete Transaction',
                message: 'Are you sure you want to delete this transaction?<br>This action cannot be undone.',
                confirmLabel: 'Delete',
                onConfirm: async () => {
                    try {
                        const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
                        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
                        
                        // Update state directly
                        this.state.transactions = this.state.transactions.filter(t => t.id !== id);
                        
                        Toast.show('Transaction deleted successfully', 'success');
                        await DataSync.onTransactionChange();
                    } catch (err) {
                        Toast.show(`Failed to delete transaction: ${err.message}`, 'error');
                    }
                }
            });
            return;
        }
        if (type === 'budget') {
            ConfirmModal.show({
                title: 'Delete Budget',
                message: 'Are you sure you want to delete this budget?<br>This action cannot be undone.',
                confirmLabel: 'Delete',
                onConfirm: async () => {
                    const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
                    if (!res.ok) { Toast.show('Failed to delete budget', 'error'); return; }
                    this.state.budgets = this.state.budgets.filter(b => b.id !== id);
                    Toast.show('Budget deleted', 'success');
                    await DataSync.onBudgetChange();
                }
            });
            return;
        }
        if (type === 'saving') {
            ConfirmModal.show({
                title: 'Delete Goal',
                message: 'Are you sure you want to delete this goal?<br>This action cannot be undone.',
                confirmLabel: 'Delete',
                onConfirm: async () => {
                    const res = await fetch(`/api/goals/${id}`, { method: 'DELETE' });
                    if (!res.ok) { Toast.show('Failed to delete goal', 'error'); return; }
                    this.state.savings = this.state.savings.filter(s => s.id !== id);
                    Toast.show('Goal deleted', 'success');
                    await DataSync.onGoalChange();
                }
            });
            return;
        }
        if (type === 'investment') {
            ConfirmModal.show({
                title: 'Delete Investment',
                message: 'Are you sure you want to delete this investment?<br>This action cannot be undone.',
                confirmLabel: 'Delete',
                onConfirm: async () => {
                    const res = await fetch(`/api/investments/${id}`, { method: 'DELETE' });
                    if (!res.ok) { Toast.show('Failed to delete investment', 'error'); return; }
                    this.state.investments = this.state.investments.filter(i => i.id !== id);
                    Toast.show('Investment deleted', 'success');
                    await DataSync.onInvestmentChange();
                }
            });
            return;
        }
        if (type === 'roadmap') {
            await fetch(`/api/roadmap/${id}`, { method: 'DELETE' });
            this.state.roadmap = this.state.roadmap.filter(t => t.id !== id);
            this.renderModal();
            this.render();
            return;
        }
        this.render();
    },
    _descGetSuggestions(query) {
        if (!query || query.length < 2) return [];
        const q = query.toLowerCase();
        const freq = {};
        const recent = {};
        const sorted = [...this.state.transactions].sort((a, b) => b.date.localeCompare(a.date));
        sorted.forEach((tx, idx) => {
            const key = tx.description.trim();
            if (!key) return;
            freq[key] = (freq[key] || 0) + 1;
            if (!(key in recent)) recent[key] = idx; 
        });
        return Object.keys(freq)
            .filter(d => d.toLowerCase().includes(q))
            .map(d => ({ d, score: freq[d] * 2 + (1 / (recent[d] + 1)) * 10 }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 8)
            .map(x => x.d);
    },
    _descAutocomplete(e) {
        const input = e.target;
        const dropdown = document.getElementById('tx-desc-dropdown');
        if (!dropdown) return;
        const suggestions = this._descGetSuggestions(input.value);
        if (!suggestions.length) { dropdown.classList.add('hidden'); return; }
        dropdown.innerHTML = suggestions.map(s =>
            `<li class="px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 last:border-0"
                onmousedown="App._descSelect(event,'${s.replace(/'/g, "\\'")}')">${s}</li>`
        ).join('');
        dropdown.classList.remove('hidden');
    },
    _descSelect(e, value) {
        e.preventDefault();
        const input = document.getElementById('tx-desc-input');
        if (input) input.value = value;
        const dropdown = document.getElementById('tx-desc-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
    },
    _descHideDropdown() {
        setTimeout(() => {
            const dropdown = document.getElementById('tx-desc-dropdown');
            if (dropdown) dropdown.classList.add('hidden');
        }, 150);
    },
    renderModal() {
        const container = document.getElementById('modal-container');
        if (!this.state.modal.isOpen) {
            container.innerHTML = '';
            return;
        }
        const { type, entityId } = this.state.modal;
        let item = null;
        if (entityId) {
            if (type === 'transaction') item = this.state.transactions.find(t => t.id === entityId);
            if (type === 'budget') item = this.state.budgets.find(b => b.id === entityId);
            if (type === 'saving') item = this.state.savings.find(s => s.id === entityId);
            if (type === 'investment') item = this.state.investments.find(i => i.id === entityId);
        }
        const today = new Date().toISOString().split('T')[0];
        let modalTitle = entityId ? `Edit ${type.charAt(0).toUpperCase() + type.slice(1)}` : `Add ${type.charAt(0).toUpperCase() + type.slice(1)}`;
        if (type === 'roadmap') modalTitle = 'Customize Roadmap';
        let formHtml = '';
        if (type === 'transaction') {
            const txType = this.state.txFormType || (item ? item.type : 'expense');
            const sym = this.getCurrencySymbol();
            formHtml = `
                <div class="grid grid-cols-2 gap-4">
                    <button type="button" id="btn-expense" aria-pressed="${this.state.txFormType === 'expense' ? 'true' : 'false'}" role="radio" aria-label="Expense transaction type" onclick="App.setTxType('expense')" class="py-2.5 rounded-xl text-sm font-bold border-2 transition-all focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 focus:outline-none ${this.state.txFormType === 'expense' ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400' : 'border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'}">Expense</button>
                    <button type="button" id="btn-income" aria-pressed="${this.state.txFormType === 'income' ? 'true' : 'false'}" role="radio" aria-label="Income transaction type" onclick="App.setTxType('income')" class="py-2.5 rounded-xl text-sm font-bold border-2 transition-all focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 focus:outline-none ${this.state.txFormType === 'income' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'}">Income</button>
                </div>
                <div class="relative">
                    <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5" for="tx-desc-input">Description</label>
                    <input type="text" id="tx-desc-input" name="description" autocomplete="new-password" value="${item ? item.description : ''}" required placeholder="e.g. Swiggy Order" aria-invalid="false" aria-describedby="tx-desc-error" oninput="App._descAutocomplete(event)" onblur="App._descHideDropdown()" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-2 focus:outline-brand-500 focus:outline-offset-2 text-sm transition-all" />
                    <ul id="tx-desc-dropdown" class="hidden absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden text-sm"></ul>
                    <span id="tx-desc-error" class="hidden text-rose-500 text-xs mt-1 block"></span>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5" for="tx-amount">Amount</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">${sym}</span>
                            <input type="text" inputmode="decimal" id="tx-amount" name="amount" autocomplete="new-password" value="${item ? this.formatMoneyInput(item.amount) : ''}" required placeholder="0" aria-invalid="false" aria-describedby="tx-amount-error" oninput="App.handleMoneyInput(event)" class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-2 focus:outline-brand-500 focus:outline-offset-2 text-sm transition-all" />
                        </div>
                        <span id="tx-amount-error" class="hidden text-rose-500 text-xs mt-1 block"></span>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5" for="tx-date">Date</label>
                        <input type="date" id="tx-date" name="date" required value="${item ? item.date : today}" aria-invalid="false" aria-describedby="tx-date-error" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-2 focus:outline-brand-500 focus:outline-offset-2 text-sm transition-all" />
                        <span id="tx-date-error" class="hidden text-rose-500 text-xs mt-1 block"></span>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5" for="tx-category-select">Category</label>
                    <select name="category" id="tx-category-select" required aria-invalid="false" aria-describedby="tx-category-error" onchange="App.handleCategoryChange(this)" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-2 focus:outline-brand-500 focus:outline-offset-2 text-sm transition-all">
                        <option value="">Loading categories...</option>
                    </select>
                    <span id="tx-category-error" class="hidden text-rose-500 text-xs mt-1 block"></span>
                </div>
            `;
            // Populate category options after form HTML is created
            const catOptions = this.getCategoryNames(txType).map(cat => `<option value="${cat}" ${item && item.category === cat ? 'selected' : ''}>${cat}</option>`).join('');
            formHtml = formHtml.replace('<option value="">Loading categories...</option>', catOptions + '<option value="__new__">+ Add New Category</option>');
        } else if (type === 'budget') {
            const sym = this.getCurrencySymbol();
            formHtml = `
                <div>
                    <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5" for="budget-category-select">Category</label>
                    <select name="category" id="budget-category-select" onchange="App.handleCategoryChange(this)" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm transition-all">
                        <option value="">Loading categories...</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5" for="budget-limit">Monthly Limit</label>
                    <div class="relative">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">${sym}</span>
                        <input type="text" inputmode="decimal" id="budget-limit" name="limit" autocomplete="new-password" value="${item ? this.formatMoneyInput(item.limit) : ''}" oninput="App.handleMoneyInput(event)" required placeholder="0" class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm transition-all" />
                    </div>
                </div>
            `;
            // Populate category options after form HTML is created
            const catOptions = this.getCategoryNames().map(cat => `<option value="${cat}" ${item && item.category === cat ? 'selected' : ''}>${cat}</option>`).join('');
            formHtml = formHtml.replace('<option value="">Loading categories...</option>', catOptions + '<option value="__new__">+ Add New Category</option>');
        } else if (type === 'saving') {
            const sym = this.getCurrencySymbol();
            formHtml = `
                <div>
                    <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5" for="goal-name">Goal Name</label>
                    <input type="text" id="goal-name" name="name" autocomplete="new-password" value="${item ? item.name : ''}" required placeholder="e.g. New Laptop" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm transition-all" />
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5" for="goal-target">Target Amount</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">${sym}</span>
                            <input type="text" inputmode="decimal" id="goal-target" name="target" autocomplete="new-password" value="${item ? this.formatMoneyInput(item.target) : ''}" oninput="App.handleMoneyInput(event)" required placeholder="0" class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm transition-all" />
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5" for="goal-current">Currently Saved</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">${sym}</span>
                            <input type="text" inputmode="decimal" id="goal-current" name="current" autocomplete="new-password" value="${item ? this.formatMoneyInput(item.current) : '0'}" oninput="App.handleMoneyInput(event)" required placeholder="0" class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm transition-all" />
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5" for="goal-monthly">Monthly Save</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">${sym}</span>
                            <input type="text" inputmode="decimal" id="goal-monthly" name="monthlyContribution" value="${item ? this.formatMoneyInput(item.monthlyContribution || '') : ''}" oninput="App.handleMoneyInput(event)" required placeholder="0" class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm transition-all" />
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5" for="goal-date">Target Date</label>
                        <input type="date" id="goal-date" name="date" required value="${item && item.date ? item.date : today}" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm transition-all" />
                    </div>
                </div>
            `;
        } else if (type === 'investment') {
            const sym = this.getCurrencySymbol();
            const today = new Date().toISOString().split('T')[0];
            formHtml = `
                <div>
                    <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5" for="inv-symbol">Asset Name</label>
                    <input type="text" id="inv-symbol" name="symbol" autocomplete="new-password" value="${item ? item.symbol : ''}" required placeholder="e.g. NVIDIA, Gold, Bitcoin" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm transition-all" />
                </div>
                <div>
                    <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5" for="inv-shares">Quantity / Units</label>
                    <input type="number" id="inv-shares" autocomplete="new-password" name="shares" value="${item ? item.shares : ''}" required min="0" step="0.0001" placeholder="0" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm transition-all" />
                </div>
                <div>
                    <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5" for="inv-price">Purchase Price Per Unit</label>
                    <div class="relative">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">${sym}</span>
                        <input type="text" inputmode="decimal" id="inv-price" name="avgCost" value="${item ? this.formatMoneyInput(item.avgCost) : ''}" oninput="App.handleMoneyInput(event)" required placeholder="0" class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm transition-all" />
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5" for="inv-date">Purchase Date</label>
                    <input type="date" id="inv-date" name="purchaseDate" value="${item ? item.purchaseDate || today : today}" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm transition-all" />
                </div>
                <input type="hidden" name="invType" value="Asset" />
                <input type="hidden" name="currentPrice" value="${item ? this.formatMoneyInput(item.currentPrice) : ''}" />
            `;
        } else if (type === 'roadmap') {
            let stepsHtml = this.state.roadmap.map(s => `
                <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl mb-2 border border-slate-200 dark:border-slate-700">
                    <div class="flex items-center gap-3">
                        <i data-lucide="${s.icon}" class="w-4 h-4 text-slate-500"></i>
                        <span class="text-sm font-semibold">${s.title}</span>
                        <select onchange="App.updateRoadmapStatus(${s.id}, this.value)" class="text-xs bg-transparent text-slate-600 dark:text-slate-400 font-medium outline-none cursor-pointer">
                            <option value="completed" ${s.status === 'completed' ? 'selected' : ''}>Completed</option>
                            <option value="active" ${s.status === 'active' ? 'selected' : ''}>Active</option>
                            <option value="pending" ${s.status === 'pending' ? 'selected' : ''}>Pending</option>
                        </select>
                    </div>
                    <button type="button" onclick="App.deleteItem('roadmap', ${s.id})" class="text-rose-500 p-1 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            `).join('');
            if (this.state.roadmap.length === 0) {
                stepsHtml = `<p class="text-sm text-slate-500 mb-4">No milestones yet. Add one below!</p>`;
            }
            formHtml = `
                <div class="mb-6 max-h-48 overflow-y-auto pr-2">${stepsHtml}</div>
                <div class="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <h4 class="text-sm font-bold mb-3 flex items-center gap-2"><i data-lucide="plus-circle" class="w-4 h-4"></i> Add New Milestone</h4>
                    <div class="grid grid-cols-2 gap-3 mb-2">
                        <input type="text" name="title" autocomplete="new-password" placeholder="Milestone Name" required class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm"/>
                        <select name="icon" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm">
                            <option value="target">Target</option>
                            <option value="home">Home</option>
                            <option value="car">Car</option>
                            <option value="plane">Plane</option>
                            <option value="graduation-cap">Education</option>
                            <option value="briefcase">Briefcase</option>
                            <option value="heart">Health/Heart</option>
                            <option value="shield-check">Shield</option>
                            <option value="laptop">Tech</option>
                        </select>
                    </div>
                </div>
            `;
        } else if (type === 'confirm_sell') {
            const { inv, sellQuantity, sellPrice, sellDate, totalSale, totalCost, profit, profitPct } = this.state.pendingSellInvestment;
            const sym = this.getCurrencySymbol();
            container.innerHTML = `
                <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm modal-overlay">
                    <div class="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl modal-standard">
                        <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
                            <h2 class="text-xl font-bold text-slate-900 dark:text-white">Confirm Sale</h2>
                            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Sell ${sellQuantity} shares of ${inv.symbol}</p>
                        </div>
                        <div class="p-8 space-y-4">
                            <div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-3">
                                <div class="flex justify-between">
                                    <span class="text-slate-600 dark:text-slate-300">Quantity</span>
                                    <span class="font-semibold">${sellQuantity}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-slate-600 dark:text-slate-300">Price per Share</span>
                                    <span class="font-semibold">${sym}${this.formatNumber(sellPrice)}</span>
                                </div>
                                <div class="flex justify-between">
                                    <span class="text-slate-600 dark:text-slate-300">Total Cost</span>
                                    <span class="font-semibold">${sym}${this.formatNumber(totalCost)}</span>
                                </div>
                                <div class="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-3">
                                    <span class="font-semibold text-slate-900 dark:text-white">Sale Proceeds</span>
                                    <span class="font-bold text-lg">${sym}${this.formatNumber(totalSale)}</span>
                                </div>
                                <div class="flex justify-between ${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}">
                                    <span class="font-semibold">Realized Return</span>
                                    <span class="font-bold text-lg">${profit >= 0 ? '+' : ''}${sym}${this.formatNumber(Math.abs(profit))}</span>
                                </div>
                                <div class="flex justify-between text-sm text-slate-500 dark:text-slate-400">
                                    <span>Return %</span>
                                    <span class="${profit >= 0 ? 'text-emerald-600' : 'text-rose-600'} font-semibold">${profit >= 0 ? '+' : ''}${profitPct}%</span>
                                </div>
                                <div class="flex justify-between pt-2 text-xs border-t border-slate-200 dark:border-slate-700">
                                    <span class="text-slate-500 dark:text-slate-400">Sale Date</span>
                                    <span class="font-mono">${sellDate}</span>
                                </div>
                            </div>
                            <div class="p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-lg text-xs text-blue-800 dark:text-blue-300">
                                This will create an income transaction for ${sym}${this.formatNumber(totalSale)}.
                            </div>
                            <div class="flex gap-3 pt-4">
                                <button onclick="App.closeModal()" class="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-semibold text-sm transition-colors">Cancel</button>
                                <button onclick="App.confirmSellInvestment()" class="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold text-sm shadow-lg transition-colors">Confirm & Sell</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            lucide.createIcons();
            return;
        }
        container.innerHTML = `
            <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm modal-overlay" role="presentation">
                <div class="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden modal-content modal-standard" role="dialog" aria-modal="true" aria-labelledby="modal-title">
                    <div class="px-6 sm:px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                        <h2 id="modal-title" class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">${modalTitle}</h2>
                        <button type="button" aria-label="Close dialog" onclick="App.closeModal()" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors focus:outline-2 focus:outline-brand-500 focus:outline-offset-2 flex-shrink-0">
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>
                    <form onsubmit="App.handleFormSubmit(event)" class="p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[calc(100vh-280px)]">
                        ${formHtml}
                        <p id="form-error" class="text-rose-500 text-sm text-center -mb-2" role="alert" aria-live="polite"></p>
                        <div class="pt-2 flex gap-3 sm:gap-4">
                            <button type="button" onclick="App.closeModal()" class="flex-1 px-3 sm:px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-semibold text-sm transition-all min-h-[44px] focus:outline-2 focus:outline-brand-500 focus:outline-offset-2">Cancel</button>
                            <button type="submit" class="flex-1 px-3 sm:px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-blue-600/30 hover:-translate-y-0.5 transition-all min-h-[44px] focus:outline-2 focus:outline-brand-500 focus:outline-offset-2">${entityId ? 'Save' : (type === 'roadmap' ? 'Add Step' : `Add ${type.charAt(0).toUpperCase() + type.slice(1)}`)}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        lucide.createIcons();
    },
    handleCategoryChange(selectElement) {
        if (selectElement.value === '__new__') {
            this.state.pendingCategorySelect = selectElement;
            this.openCategoryModal();
        }
    },
    openCategoryModal(catId = null) {
        const cat = catId ? this.state.categories.find(c => c.id === catId) : null;
        const title = cat ? 'Edit Category' : 'New Category';
        let catContainer = document.getElementById('category-modal-container');
        if (!catContainer) {
            catContainer = document.createElement('div');
            catContainer.id = 'category-modal-container';
            document.body.appendChild(catContainer);
        }
        catContainer.innerHTML = `
            <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm modal-overlay" role="presentation">
                <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl modal-content modal-standard" role="dialog" aria-modal="true" aria-labelledby="cat-modal-title">
                    <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <h2 id="cat-modal-title" class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">${title}</h2>
                        <button type="button" aria-label="Close dialog" onclick="App.closeCategoryModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-2 focus:outline-brand-500 focus:outline-offset-2 flex-shrink-0"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>
                    <form id="cat-form" class="p-6 space-y-4" data-cat-id="${catId || ''}">
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5" for="cat-name">Category Name</label>
                            <input type="text" id="cat-name" autocomplete="new-password" value="${cat && cat.name ? cat.name : ''}" required maxlength="50" placeholder="e.g. Gym Membership" aria-invalid="false" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-2 focus:outline-brand-500 focus:outline-offset-2 text-sm min-h-[44px]" />
                        </div>
                        <p id="cat-error" class="text-rose-500 text-sm hidden" role="alert" aria-live="polite"></p>
                        <div class="flex gap-3 sm:gap-4 pt-2">
                            <button type="button" onclick="App.closeCategoryModal()" class="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-semibold text-sm min-h-[44px] focus:outline-2 focus:outline-brand-500 focus:outline-offset-2">Cancel</button>
                            <button type="submit" class="flex-1 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm shadow-lg min-h-[44px] focus:outline-2 focus:outline-brand-500 focus:outline-offset-2">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        lucide.createIcons();
        // Add form submit handler
        setTimeout(() => {
            const form = document.getElementById('cat-form');
            if (form) {
                form.onsubmit = (e) => {
                    const catId = form.dataset.catId || null;
                    this.saveCategory(e, catId === '' ? null : parseInt(catId));
                };
            }
        }, 0);
        // Add backdrop click handler for category modal
        setTimeout(() => {
            const container = document.getElementById('category-modal-container');
            if (!container) return;
            const overlay = container.querySelector('.fixed.inset-0');
            if (overlay) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) this.closeCategoryModal();
                }, { once: false });
            }
        }, 10);
    },
    closeCategoryModal() {
        const container = document.getElementById('category-modal-container');
        if (container) {
            container.innerHTML = '';
        }
        if (this.state.pendingCategorySelect && this.state.pendingCategorySelect.value === '__new__') {
            this.state.pendingCategorySelect.value = ''; // reset to default
            this.state.pendingCategorySelect = null;
        }
    },
    async saveCategory(e, catId) {
        e.preventDefault();
        const name = document.getElementById('cat-name').value.trim();
        const err = document.getElementById('cat-error');
        err.classList.add('hidden');
        
        if (catId) {
            const success = await this.categoryManager_update(catId, { name });
            if (success) {
                this.closeCategoryModal();
                Toast.show('Category updated', 'success');
            } else {
                err.textContent = 'Failed to update category';
                err.classList.remove('hidden');
            }
        } else {
            const newCat = await this.categoryManager_create(name, 'expense');
            if (newCat) {
                if (this.state.pendingCategorySelect) {
                    const select = this.state.pendingCategorySelect;
                    const newOption = document.createElement('option');
                    newOption.value = name;
                    newOption.textContent = name;
                    newOption.selected = true;
                    select.insertBefore(newOption, select.lastElementChild);
                    this.state.pendingCategorySelect = null;
                }
                this.closeCategoryModal();
                Toast.show('Category created', 'success');
            } else {
                err.textContent = 'Failed to create category';
                err.classList.remove('hidden');
            }
        }
    },
    editCategory(catId) {
        this.openCategoryModal(catId);
    },
    async deleteCategory(catId) {
        const success = await this.categoryManager_delete(catId);
        if (success) {
            Toast.show('Category deleted', 'success');
        }
    },
    async switchAccountMode(mode) {
        const res = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account_mode: mode })
        });
        if (!res.ok) {
            Toast.show('Failed to switch mode', 'error');
            return;
        }
        this.state.profile.account_mode = mode;
        Toast.show(`Switched to ${mode === 'cashflow' ? 'Cash Flow' : 'Income'} Mode`, 'success');
        this.render();
    },
    async editAvailableBalance() {
        const currentBalance = this.state.profile?.current_savings || 0;
        const sym = this.getCurrencySymbol();
        document.getElementById('modal-container').innerHTML = `
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm modal-overlay">
                <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl modal-standard">
                    <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-700">
                        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Edit Available Balance</h2>
                        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Update your current cash on hand</p>
                    </div>
                    <div class="p-6 space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Current Balance</label>
                            <div class="relative">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">${sym}</span>
                                <input type="text" id="edit-balance-input" inputmode="decimal" autocomplete="new-password" value="${this.formatNumber(currentBalance)}" oninput="App.handleMoneyInput(event)" class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm transition-all" />
                            </div>
                            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Money currently available to you</p>
                        </div>
                        <p id="edit-balance-error" class="text-rose-500 text-sm hidden"></p>
                        <div class="flex gap-3 pt-2">
                            <button onclick="App.closeModal()" class="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-semibold text-sm transition-colors">Cancel</button>
                            <button onclick="App.saveAvailableBalance()" class="flex-1 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm shadow-lg transition-colors">Save</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons();
        setTimeout(() => document.getElementById('edit-balance-input')?.focus(), 100);
    },
    async saveAvailableBalance() {
        const input = document.getElementById('edit-balance-input');
        const error = document.getElementById('edit-balance-error');
        const amount = this._parseMoney(input.value);
        if (isNaN(amount) || amount < 0) {
            error.textContent = 'Please enter a valid amount';
            error.classList.remove('hidden');
            return;
        }
        const res = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_savings: amount })
        });
        if (!res.ok) {
            error.textContent = 'Failed to update balance';
            error.classList.remove('hidden');
            return;
        }
        this.state.profile.current_savings = amount;
        this.closeModal();
        Toast.show('Available Balance updated', 'success');
        this.render();
    },
    sellInvestment(id) {
        const inv = this.state.investments.find(i => i.id === id);
        if (!inv) return;
        const today = new Date().toISOString().split('T')[0];
        const sym = this.getCurrencySymbol();
        const container = document.getElementById('modal-container');
        container.innerHTML = `
            <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <div class="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl max-w-md w-full">
                    <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800">
                        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Sell ${inv.symbol}</h2>
                        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">You own ${inv.shares} shares</p>
                    </div>
                    <form onsubmit="App.processSellInvestment(event, ${id})" class="p-8 space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Quantity to Sell</label>
                            <input type="number" name="sellQuantity" autocomplete="new-password" step="0.0001" min="0.0001" max="${inv.shares}" value="${inv.shares}" required class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" />
                            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Max: ${inv.shares}</p>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Sell Price Per Share</label>
                            <div class="relative">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">${sym}</span>
                                <input type="text" inputmode="decimal" name="sellPrice" autocomplete="new-password" oninput="App.handleMoneyInput(event)" value="${this.formatMoneyInput(inv.currentPrice)}" required placeholder="0" class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" />
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Sell Date</label>
                            <input type="date" name="sellDate" autocomplete="new-password" value="${today}" required class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" />
                        </div>
                        <div class="pt-4 space-y-2">
                            <div class="text-sm text-slate-600 dark:text-slate-300">
                                <p>Buy Price: ${sym}${this.formatNumber(inv.avgCost)} × ${inv.shares}</p>
                                <p>Avg Cost: <span class="font-semibold">${sym}${this.formatNumber(inv.shares * inv.avgCost)}</span></p>
                            </div>
                        </div>
                        <div class="flex gap-3 pt-4">
                            <button type="button" onclick="App.closeModal()" class="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-semibold text-sm transition-colors">Cancel</button>
                            <button type="submit" class="flex-1 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm shadow-lg transition-colors">Next</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    },
    processSellInvestment(e, id) {
        e.preventDefault();
        const form = e.target;
        const inv = this.state.investments.find(i => i.id === id);
        if (!inv) return;
        
        const sellQuantity = parseFloat(form.sellQuantity.value) || 0;
        const sellPrice = this._parseMoney(form.sellPrice.value) || 0;
        const sellDate = form.sellDate.value;
        
        if (sellQuantity <= 0 || sellQuantity > inv.shares) {
            Toast.show('Invalid quantity', 'error');
            return;
        }
        if (sellPrice <= 0) {
            Toast.show('Invalid sell price', 'error');
            return;
        }
        
        const totalSale = sellQuantity * sellPrice;
        const totalCost = sellQuantity * inv.avgCost;
        const profit = totalSale - totalCost;
        const profitPct = totalCost > 0 ? ((profit / totalCost) * 100).toFixed(2) : 0;
        
        this.state.pendingSellInvestment = { id, inv, sellQuantity, sellPrice, sellDate, totalSale, totalCost, profit, profitPct };
        this.renderModal('confirm_sell');
    },
    async confirmSellInvestment() {
        const { id, inv, sellQuantity, sellPrice, sellDate, totalSale, totalCost, profit, profitPct } = this.state.pendingSellInvestment;
        this.closeModal();
        
        try {
            // If selling partial quantity, update investment; otherwise delete it
            const remainingQuantity = inv.shares - sellQuantity;
            
            if (remainingQuantity > 0) {
                // Update investment with reduced quantity
                const updateRes = await fetch(`/api/investments/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ shares: remainingQuantity })
                });
                if (!updateRes.ok) throw new Error('Failed to update investment');
            } else {
                // Delete investment if all shares sold
                const deleteRes = await fetch(`/api/investments/${id}`, { method: 'DELETE' });
                if (!deleteRes.ok) throw new Error('Failed to delete investment');
            }
            
            // Create income transaction for sale proceeds
            const txIncomeRes = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: `Sold ${sellQuantity} ${inv.symbol} @ ${this.getCurrencySymbol()}${this.formatNumber(sellPrice)} - Realized ${profit >= 0 ? 'Gain' : 'Loss'}: ${this.getCurrencySymbol()}${this.formatNumber(Math.abs(profit))}`,
                    amount: totalSale,
                    category: 'Investment Returns',
                    type: 'income',
                    date: sellDate
                })
            });
            if (!txIncomeRes.ok) throw new Error('Failed to create income transaction');
            
            // Create expense transaction for original cost basis
            const txExpenseRes = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: `Original cost basis for ${sellQuantity} ${inv.symbol} @ ${this.getCurrencySymbol()}${this.formatNumber(inv.avgCost)}`,
                    amount: totalCost,
                    category: 'Investment Cost Basis',
                    type: 'expense',
                    date: sellDate
                })
            });
            if (!txExpenseRes.ok) throw new Error('Failed to create cost basis transaction');
            
            Toast.show(`Sold ${sellQuantity} ${inv.symbol} - Realized ${profit >= 0 ? 'Gain' : 'Loss'}: ${this.getCurrencySymbol()}${this.formatNumber(Math.abs(profit))} (${profitPct}%)`, 'success');
            await this.fetchInvestments();
            await this.fetchTransactions();
            await DataSync.fullSync();
        } catch (err) {
            Toast.show('Error: ' + err.message, 'error');
        }
    },
    openSellModal() {
        const activeAssets = this.state.investments.filter(inv => inv.shares > 0).sort((a, b) => b.id - a.id);
        if (activeAssets.length === 0) {
            Toast.show('No active assets to sell', 'error');
            return;
        }
        const container = document.getElementById('modal-container');
        container.innerHTML = `
            <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onclick="if(event.target===this) App.closeModal()">
                <div class="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl max-w-md w-full">
                    <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <h2 class="text-xl font-bold text-slate-900 dark:text-white">Sell Asset</h2>
                        <button type="button" onclick="App.closeModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-2xl leading-none">×</button>
                    </div>
                    <form onsubmit="App.handleSellAsset(event)" class="p-8 space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Select Asset</label>
                            <select name="sellAssetSelect" required class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm">
                                <option value="">Choose asset to sell...</option>
                                ${activeAssets.map(inv => `<option value="${inv.id}|${inv.symbol}|${inv.shares}|${inv.avgCost}">${inv.symbol} (${inv.shares} units)</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Quantity To Sell</label>
                            <input type="number" name="sellQuantity" autocomplete="new-password" step="0.0001" min="0" required class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" />
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Current Price Per Unit</label>
                            <div class="relative">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">${this.getCurrencySymbol()}</span>
                                <input type="text" inputmode="decimal" name="sellPrice" autocomplete="new-password" oninput="App.handleMoneyInput(event)" required placeholder="0" class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" />
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Sell Date</label>
                            <input type="date" name="sellDate" autocomplete="new-password" value="${new Date().toISOString().split('T')[0]}" required class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm" />
                        </div>
                        <div class="flex gap-3 pt-4">
                            <button type="button" onclick="App.closeModal()" class="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-semibold text-sm transition-colors">Cancel</button>
                            <button type="submit" class="flex-1 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm shadow-lg transition-colors">Sell Asset</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.closeModal(); });
    },
    async handleSellAsset(e) {
        e.preventDefault();
        const form = e.target;
        const [invId, symbol, maxShares, avgCost] = form.sellAssetSelect.value.split('|');
        const sellQuantity = parseFloat(form.sellQuantity.value) || 0;
        const sellPrice = this._parseMoney(form.sellPrice.value) || 0;
        const sellDate = form.sellDate.value;
        
        if (sellQuantity <= 0 || sellQuantity > parseFloat(maxShares)) {
            Toast.show('Invalid quantity', 'error');
            return;
        }
        if (sellPrice <= 0) {
            Toast.show('Invalid sell price', 'error');
            return;
        }
        
        const totalSale = sellQuantity * sellPrice;
        const totalCost = sellQuantity * parseFloat(avgCost);
        const profit = totalSale - totalCost;
        
        this.closeModal();
        
        try {
            const remainingQuantity = parseFloat(maxShares) - sellQuantity;
            if (remainingQuantity > 0) {
                const updateRes = await fetch(`/api/investments/${invId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ shares: remainingQuantity })
                });
                if (!updateRes.ok) throw new Error('Failed to update');
            } else {
                const deleteRes = await fetch(`/api/investments/${invId}`, { method: 'DELETE' });
                if (!deleteRes.ok) throw new Error('Failed to delete');
            }
            
            await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: `Sold ${sellQuantity} ${symbol} @ ${this.getCurrencySymbol()}${this.formatNumber(sellPrice)} - Profit ${profit >= 0 ? '+' : ''}${this.getCurrencySymbol()}${this.formatNumber(Math.abs(profit))}`,
                    amount: totalSale,
                    category: 'Investment Returns',
                    type: 'income',
                    date: sellDate
                })
            });
            
            Toast.show(`Sold ${sellQuantity} ${symbol} - Profit ${profit >= 0 ? '+' : ''}${this.getCurrencySymbol()}${this.formatNumber(Math.abs(profit))}`, 'success');
            await this.fetchInvestments();
            await this.fetchTransactions();
        } catch (err) {
            Toast.show('Error: ' + err.message, 'error');
        }
    },
    updateAssetBox(assetType) {
        const typeIcons = { 'Stock': '📈', 'ETF': '📊', 'Crypto': '₿', 'Mutual Fund': '💼', 'Bonds': '📝', 'Gold': '🏆', 'Silver': '⭐' };
        const displayEl = document.getElementById('asset-type-display');
        if (displayEl) {
            displayEl.textContent = assetType;
        }
        const emojiEl = document.querySelector('[data-lucide="target"]');
        if (emojiEl) {
            emojiEl.parentElement.innerHTML = `<div class="text-5xl mb-2">${typeIcons[assetType] || '📦'}</div>`;
        }
    },
    selectedItems: { tx: [], budget: [], goal: [], investment: [] },
    toggleSelectAllTx() {
        const selectAll = document.getElementById('select-all-tx');
        const checkboxes = document.querySelectorAll('.tx-checkbox');
        checkboxes.forEach(cb => cb.checked = selectAll.checked);
        this.updateTxSelection();
    },
    updateTxSelection() {
        const checkboxes = document.querySelectorAll('.tx-checkbox:checked');
        this.selectedItems.tx = Array.from(checkboxes).map(cb => parseInt(cb.value));
        this.updateBulkActionBar('tx', 'transactions');
    },
    updateBulkActionBar(type, entityName) {
        const count = this.selectedItems[type].length;
        let bar = document.getElementById(`${type}-bulk-bar`);
        if (count === 0) {
            if (bar) bar.remove();
            return;
        }
        if (!bar) {
            bar = document.createElement('div');
            bar.id = `${type}-bulk-bar`;
            bar.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900 dark:bg-slate-800 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-4 z-50';
            document.body.appendChild(bar);
        }
        bar.innerHTML = `
            <span class="font-medium">${count} ${entityName} selected</span>
            <button onclick="App.bulkDelete('${type}', '${entityName}')" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">
                Delete Selected
            </button>
            <button onclick="App.clearSelection('${type}')" class="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-sm font-medium transition-colors">
                Cancel
            </button>
        `;
    },
    async bulkDelete(type, entityName) {
        const count = this.selectedItems[type].length;
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm';
        modal.innerHTML = `
            <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                        <i data-lucide="trash-2" class="w-6 h-6 text-red-600 dark:text-red-400"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-slate-900 dark:text-white">Delete ${count} ${entityName}?</h3>
                        <p class="text-sm text-slate-500 dark:text-slate-400">This cannot be undone</p>
                    </div>
                </div>
                <div class="flex gap-3 mt-6">
                    <button id="cancel-delete" class="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
                    <button id="confirm-delete" class="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold">Delete</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        lucide.createIcons({ nodes: [modal] });
        const confirmed = await new Promise(resolve => {
            modal.querySelector('#confirm-delete').onclick = () => { modal.remove(); resolve(true); };
            modal.querySelector('#cancel-delete').onclick = () => { modal.remove(); resolve(false); };
        });
        if (!confirmed) return;
        const endpoints = {
            tx: '/api/transactions/',
            budget: '/api/budgets/',
            goal: '/api/goals/',
            investment: '/api/investments/'
        };
        try {
            for (const id of this.selectedItems[type]) {
                const res = await fetch(endpoints[type] + id, { method: 'DELETE' });
                if (!res.ok) throw new Error('Failed to delete item');
            }
            this.clearSelection(type);
            await this.fetchTransactions();
            Toast.show(`${count} ${entityName} deleted`, 'success');
            this.render();
        } catch (err) {
            Toast.show('Failed to delete items', 'error');
        }
    },
    clearSelection(type) {
        this.selectedItems[type] = [];
        const bar = document.getElementById(`${type}-bulk-bar`);
        if (bar) bar.remove();
        document.querySelectorAll(`.${type}-checkbox`).forEach(cb => cb.checked = false);
        const selectAll = document.getElementById(`select-all-${type}`);
        if (selectAll) selectAll.checked = false;
    }
};
Object.assign(App, AppDashboard);
Object.assign(App, AppViews);
Object.assign(App, AppCharts);

const tutorialSteps = [
    { title: "Dashboard", content: "View your financial overview, net worth, and goals at a glance." },
    { title: "Transactions", content: "Track all your income and expenses with categories and dates." },
    { title: "Budgets", content: "Set spending limits for different categories and monitor progress." },
    { title: "Goals", content: "Create financial goals and see forecasts for when you'll reach them." },
    { title: "Investments", content: "Track your investment portfolio and asset allocation." },
];
let tutorialStep = 0;

function showTutorialIfNeeded() {
    fetch('/api/profile').then(r => r.json()).then(profile => {
        if (profile.tutorial_completed === false) {
            document.getElementById('tutorial-modal').classList.remove('hidden');
        }
    }).catch(() => {});
}

function nextTutorial() {
    tutorialStep++;
    if (tutorialStep < tutorialSteps.length) {
        const step = tutorialSteps[tutorialStep];
        document.getElementById('tutorial-title').textContent = step.title;
        document.getElementById('tutorial-content').textContent = step.content;
        document.getElementById('tutorial-btn').textContent = tutorialStep === tutorialSteps.length - 1 ? 'Finish' : 'Next';
    } else {
        completeTutorial();
    }
}

function skipTutorial() {
    completeTutorial();
}

function completeTutorial() {
    fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tutorial_completed: true })
    }).then(() => {
        document.getElementById('tutorial-modal').classList.add('hidden');
    }).catch(() => {});
}

document.addEventListener('DOMContentLoaded', () => {
    App.init();
    setTimeout(showTutorialIfNeeded, 500);
});
