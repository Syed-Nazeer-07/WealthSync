const App = {
    state: {
        activeTab: 'dashboard',
        isMobileMenuOpen: false,
        sidebarCollapsed: localStorage.getItem('sidebarCollapsed') === 'true',
        darkMode: localStorage.getItem('theme') === 'dark',
        modal: { isOpen: false, type: null, entityId: null },
        txFormType: 'expense',
        charts: {},
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
    },
    init() {
        if (this.state.darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        this.updateThemeIcons();
        this._applySidebarCollapsed();
        this.renderSidebarMenu();
        this.fetchCurrentUser();
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && this.state.isMobileMenuOpen) this.closeMobileSidebar();
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
        this.fetchTransactions();
        this.fetchCategories();
        this.fetchBudgets();
        this.fetchGoals();
        this.fetchGoalForecasts();
        this.fetchInvestments();
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
        const newTheme = this.state.darkMode ? 'light' : 'dark';
        this.saveSetting('theme', newTheme);
    },
    updateThemeIcons() {
        const iconStr = this.state.darkMode ? 'sun' : 'moon';
        const deskIcon = document.getElementById('theme-icon');
        const mobIcon = document.getElementById('theme-icon-mobile');
        if (deskIcon) deskIcon.setAttribute('data-lucide', iconStr);
        if (mobIcon) mobIcon.setAttribute('data-lucide', iconStr);
        lucide.createIcons();
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
        if (type) {
            return this.state.categories.filter(c => c.category_type === type).map(c => c.name);
        }
        return this.state.categories.map(c => c.name);
    },
    getCategoryEmoji(name) {
        const cat = this.state.categories.find(c => c.name === name);
        return cat ? cat.emoji : '📦';
    },
    getCategoryColor(name) {
        const cat = this.state.categories.find(c => c.name === name);
        return cat ? cat.color : '#3b82f6';
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
        const p = this.state.profile || {};
        const isCashFlow = p.account_mode === 'cashflow';
        const txIncome   = this.state.transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
        const txExpenses = this.state.transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
        const totalSavings         = p.current_savings     ?? 0;
        const profileIncome        = p.monthly_income      ?? 0;
        const profileExpenses      = p.monthly_expenses    ?? 0;
        const validInvestments = this.state.investments.filter(inv => inv.shares > 0 && inv.avgCost > 0 && inv.currentPrice > 0);
        const totalInvestmentValue = validInvestments.length
            ? validInvestments.reduce((acc, inv) => acc + (inv.shares * inv.currentPrice), 0)
            : (p.current_investments ?? 0);
        const totalIncome   = txIncome   || profileIncome;
        const totalExpenses = txExpenses || profileExpenses;
        const currentCash   = txIncome - txExpenses;  
        const availableBalance = currentCash;
        const netWorth = currentCash + totalSavings + totalInvestmentValue;
        const now = new Date();
        const thisYM  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        const lastDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
        const lastYM  = `${lastDate.getFullYear()}-${String(lastDate.getMonth()+1).padStart(2,'0')}`;
        const txThisMonth = this.state.transactions.filter(t => t.date.startsWith(thisYM));
        const txLastMonth = this.state.transactions.filter(t => t.date.startsWith(lastYM));
        const netThisMonth = txThisMonth.reduce((s,t) => s + (t.type==='income' ? t.amount : -t.amount), 0);
        const netLastMonth = txLastMonth.reduce((s,t) => s + (t.type==='income' ? t.amount : -t.amount), 0);
        let netWorthGrowth = 0;
        if (netLastMonth !== 0) {
            netWorthGrowth = ((netThisMonth - netLastMonth) / Math.abs(netLastMonth)) * 100;
        } else if (netThisMonth > 0) {
            netWorthGrowth = 100;
        }
        const totalInvestmentCost = validInvestments.length
            ? validInvestments.reduce((acc, curr) => acc + (curr.shares * curr.avgCost), 0)
            : totalInvestmentValue * 0.85;
        const investmentProfit = totalInvestmentValue - totalInvestmentCost;
        const budgetProgress = this.state.budgets.map(budget => {
            const spent = this.state.transactions
                .filter(t => t.type === 'expense' && t.category === budget.category)
                .reduce((acc, curr) => acc + curr.amount, 0);
            return { ...budget, spent };
        });
        let healthScore, breakdown;
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
            if (this.state.savings.length > 0) {
                const avgProgress = this.state.savings.reduce((sum, g) => 
                    sum + Math.min(100, g.target > 0 ? (g.current / g.target) * 100 : 0), 0) / this.state.savings.length;
                goalScore = (avgProgress / 100) * 25;
            }
            const trendScore = currentCash > 0 ? 15 : currentCash > -1000 ? 8 : 3;
            const txCount = this.state.transactions.length;
            const consistencyScore = Math.min(10, txCount / 5);
            healthScore = Math.round(spendingScore + budgetScore + goalScore + trendScore + consistencyScore);
            breakdown = {
                spendingScore: Math.round(spendingScore),
                budgetScore: Math.round(budgetScore),
                goalScore: Math.round(goalScore),
                trendScore: Math.round(trendScore),
                consistencyScore: Math.round(consistencyScore)
            };
        } else {
            const monthlyIncome = profileIncome || (txIncome / Math.max(1, this.state.transactions.length));
            const savingsRate = totalSavings / (monthlyIncome * 12 || 1);
            const savingsRateScore = Math.min(20, savingsRate * 100);
            const emergencyMonths = totalSavings / (profileExpenses || totalExpenses || 1);
            const emergencyFundScore = Math.min(20, (emergencyMonths / 6) * 20);
            let budgetScore = budgetProgress.length > 0
                ? (budgetProgress.filter(b => b.spent <= b.limit).length / budgetProgress.length) * 15
                : 10;
            let goalScore = 5;
            if (this.state.savings.length > 0) {
                const avgProgress = this.state.savings.reduce((sum, g) => 
                    sum + Math.min(100, g.target > 0 ? (g.current / g.target) * 100 : 0), 0) / this.state.savings.length;
                goalScore = (avgProgress / 100) * 15;
            }
            const invRatio = totalSavings > 0 ? (totalInvestmentValue / totalSavings) : (totalInvestmentValue > 0 ? 1 : 0);
            const investmentScore = Math.min(15, invRatio * 15);
            const monthlyExp = {};
            this.state.transactions.filter(t => t.type === 'expense').forEach(t => {
                const ym = t.date.substring(0, 7);
                monthlyExp[ym] = (monthlyExp[ym] || 0) + t.amount;
            });
            let stabilityScore = 5;
            if (Object.keys(monthlyExp).length >= 2) {
                const expValues = Object.values(monthlyExp);
                const avgExp = expValues.reduce((a, b) => a + b, 0) / expValues.length;
                const variance = expValues.reduce((sum, val) => sum + Math.pow(val - avgExp, 2), 0) / expValues.length;
                const stdDev = Math.sqrt(variance);
                const cv = avgExp > 0 ? stdDev / avgExp : 1;
                stabilityScore = Math.max(0, 10 * (1 - Math.min(1, cv)));
            }
            const growthScore = netWorth > 0 ? 5 : 2;
            healthScore = Math.round(savingsRateScore + emergencyFundScore + budgetScore + goalScore + investmentScore + stabilityScore + growthScore);
            breakdown = {
                savingsRateScore: Math.round(savingsRateScore),
                emergencyFundScore: Math.round(emergencyFundScore),
                budgetScore: Math.round(budgetScore),
                goalScore: Math.round(goalScore),
                investmentScore: Math.round(investmentScore),
                stabilityScore: Math.round(stabilityScore),
                growthScore: Math.round(growthScore)
            };
        }
        return {
            totalIncome, totalExpenses, currentCash, totalSavings,
            totalInvestmentValue, totalInvestmentCost, investmentProfit,
            netWorth, availableBalance, netWorthGrowth, budgetProgress, healthScore,
            breakdown, isCashFlow
        };
    },
    getBadges() {
        const calc = this.getCalculations();
        const p = this.state.profile || {};
        return [
            {
                id: 1, icon: 'shield-check', title: 'Emergency Funded',
                earned: calc.totalSavings >= ((p.monthly_expenses || 0) * 6)
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
        if (calc.totalSavings > 0 && calc.totalInvestmentValue === 0) {
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
    async saveFinancialProfile() {
        const isCashFlow = this.state.profile?.account_mode === 'cashflow';
        const parseNum = (val) => parseFloat((val || '').replace(/,/g, '')) || 0;
        const payload = {
            current_savings: parseNum(document.getElementById('profile-savings')?.value),
            current_investments: parseNum(document.getElementById('profile-investments')?.value),
            monthly_expenses: parseNum(document.getElementById('profile-expenses')?.value)
        };
        if (!isCashFlow) {
            payload.monthly_income = parseNum(document.getElementById('profile-monthly-income')?.value);
        }
        const res = await fetch('/api/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const err = document.getElementById('profile-save-err');
        if (!res.ok) {
            const data = await res.json();
            if (err) {
                err.textContent = data.error || 'Failed to save';
                err.classList.remove('hidden');
            }
            return;
        }
        if (err) err.classList.add('hidden');
        Object.assign(this.state.profile, payload);
        Toast.show('Financial profile updated', 'success');
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
            overlay.className = 'fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm fade-in';
            overlay.innerHTML = `
                <div class="bg-white dark:bg-dark-card rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-sm slide-up p-8">
                    <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">${cfg.title}</h3>
                    <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">${cfg.msg}</p>
                    <input id="danger-pw" type="password" placeholder="Enter your password to confirm" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 mb-4">
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
            if (!item) return `<div class="sidebar-section-divider mx-3 my-2 border-t border-slate-100 dark:border-dark-border"></div>`;
            const isActive = this.state.activeTab === item.id;
            const activeClasses = isActive
                ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 font-semibold'
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
    render() {
        // Debounce render to prevent double initialization
        clearTimeout(this.state.renderTimer);
        this.state.renderTimer = setTimeout(() => this._doRender(), 10);
    },
    _doRender() {
        if (this.state.activeTab === 'transactions' && !this.state.txLoading && !this.state.txError) {
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
            case 'dashboard':    html = this.getDashboardHTML(); break;
            case 'transactions': html = this.getTransactionsHTML(); break;
            case 'budgets':      html = this.getBudgetsHTML(); break;
            case 'savings':      html = this.getSavingsHTML(); break;
            case 'investments':  html = this.getInvestmentsHTML(); break;
            case 'settings':     html = this.getSettingsHTML(); break;
        }
        content.innerHTML = html;
        lucide.createIcons();
        setTimeout(async () => {
            if (this.state.activeTab === 'dashboard') await this.initDashboardCharts();
            if (this.state.activeTab === 'investments') this.initInvestmentCharts();
        }, 50);
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
            await this.fetchTransactions();
            return;
        } else if (type === 'budget') {
            const payload = { category: fd.get('category'), limit: this._parseMoney(fd.get('limit') || '0') };
            const url = entityId ? `/api/budgets/${entityId}` : '/api/budgets';
            const method = entityId ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) { Toast.show('Failed to save budget', 'error'); return; }
            this.closeModal();
            Toast.show(entityId ? 'Budget updated' : 'Budget created', 'success');
            await this.fetchBudgets();
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
            this.closeModal();
            Toast.show(entityId ? 'Goal updated' : 'Goal created', 'success');
            await this.fetchGoals();
            return;
        } else if (type === 'investment') {
            const payload = { symbol: fd.get('symbol'), type: fd.get('invType'),
                shares: parseFloat(fd.get('shares')), avgCost: this._parseMoney(fd.get('avgCost') || '0'),
                currentPrice: this._parseMoney(fd.get('currentPrice') || '0') };
            const url = entityId ? `/api/investments/${entityId}` : '/api/investments';
            const method = entityId ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) { Toast.show('Failed to save investment', 'error'); return; }
            this.closeModal();
            Toast.show(entityId ? 'Investment updated' : 'Investment added', 'success');
            await this.fetchInvestments();
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
                        Toast.show('Transaction deleted successfully', 'success');
                        await this.fetchTransactions();
                    } catch (err) {
                        Toast.show(`Failed to delete transaction: ${err.message}`, 'error');
                    }
                }
            });
            return;
        }
        if (type === 'budget') {
            const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
            if (!res.ok) { Toast.show('Failed to delete budget', 'error'); return; }
            await this.fetchBudgets();
            return;
        }
        if (type === 'saving') {
            const res = await fetch(`/api/goals/${id}`, { method: 'DELETE' });
            if (!res.ok) { Toast.show('Failed to delete goal', 'error'); return; }
            await this.fetchGoals();
            return;
        }
        if (type === 'investment') {
            const res = await fetch(`/api/investments/${id}`, { method: 'DELETE' });
            if (!res.ok) { Toast.show('Failed to delete investment', 'error'); return; }
            await this.fetchInvestments();
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
            const catOptions = this.getCategoryNames(txType).map(cat => `<option value="${cat}" ${item && item.category === cat ? 'selected' : ''}>${cat}</option>`).join('');
            const sym = this.getCurrencySymbol();
            formHtml = `
                <div class="grid grid-cols-2 gap-4">
                    <button type="button" id="btn-expense" onclick="App.setTxType('expense')" class="py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${this.state.txFormType === 'expense' ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400' : 'border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'}">Expense</button>
                    <button type="button" id="btn-income" onclick="App.setTxType('income')" class="py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${this.state.txFormType === 'income' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'}">Income</button>
                </div>
                <div class="relative">
                    <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Description</label>
                    <input type="text" name="description" id="tx-desc-input" autocomplete="off" value="${item ? item.description : ''}" required placeholder="e.g. Swiggy Order" oninput="App._descAutocomplete(event)" onblur="App._descHideDropdown()" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white transition-all" />
                    <ul id="tx-desc-dropdown" class="hidden absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden text-sm"></ul>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Amount</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">${sym}</span>
                            <input type="text" inputmode="numeric" name="amount" autocomplete="off" value="${item ? this.formatMoneyInput(item.amount) : ''}" oninput="App.handleMoneyInput(event)" required placeholder="0" class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white transition-all" />
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Date</label>
                        <input type="date" name="date" required value="${item ? item.date : today}" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white transition-all" />
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
                    <select name="category" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white transition-all">
                        ${catOptions}
                    </select>
                </div>
            `;
        } else if (type === 'budget') {
            const catOptions = this.getCategoryNames().map(cat => `<option value="${cat}" ${item && item.category === cat ? 'selected' : ''}>${cat}</option>`).join('');
            const sym = this.getCurrencySymbol();
            formHtml = `
                <div>
                    <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
                    <select name="category" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white transition-all">
                        ${catOptions}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Monthly Limit</label>
                    <div class="relative">
                        <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">${sym}</span>
                        <input type="text" inputmode="numeric" name="limit" autocomplete="off" value="${item ? this.formatMoneyInput(item.limit) : ''}" oninput="App.handleMoneyInput(event)" required placeholder="0" class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white transition-all" />
                    </div>
                </div>
            `;
        } else if (type === 'saving') {
            const sym = this.getCurrencySymbol();
            formHtml = `
                <div>
                    <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Goal Name</label>
                    <input type="text" name="name" autocomplete="off" value="${item ? item.name : ''}" required placeholder="e.g. New Laptop" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white transition-all" />
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Target Amount</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">${sym}</span>
                            <input type="text" inputmode="numeric" name="target" autocomplete="off" value="${item ? this.formatMoneyInput(item.target) : ''}" oninput="App.handleMoneyInput(event)" required placeholder="0" class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white transition-all" />
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Currently Saved</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">${sym}</span>
                            <input type="text" inputmode="numeric" name="current" autocomplete="off" value="${item ? this.formatMoneyInput(item.current) : '0'}" oninput="App.handleMoneyInput(event)" required placeholder="0" class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white transition-all" />
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Monthly Save</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">${sym}</span>
                            <input type="text" inputmode="numeric" name="monthlyContribution" value="${item ? this.formatMoneyInput(item.monthlyContribution || '') : ''}" oninput="App.handleMoneyInput(event)" required placeholder="0" class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white transition-all" />
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Target Date</label>
                        <input type="date" name="date" required value="${item && item.date ? item.date : today}" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white transition-all" />
                    </div>
                </div>
            `;
        } else if (type === 'investment') {
            const invTypes = ['Stock', 'ETF', 'Crypto', 'Mutual Fund', 'Bonds'];
            const typeOptions = invTypes.map(t => `<option value="${t}" ${item && item.type === t ? 'selected' : ''}>${t}</option>`).join('');
            const sym = this.getCurrencySymbol();
            formHtml = `
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Symbol/Name</label>
                        <input type="text" name="symbol" autocomplete="off" value="${item ? item.symbol : ''}" required placeholder="e.g. AAPL" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white transition-all" />
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Asset Type</label>
                        <select name="invType" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white transition-all">
                            ${typeOptions}
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Shares Owned</label>
                    <input type="number" name="shares" value="${item ? item.shares : ''}" required min="0" step="0.0001" placeholder="0" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white transition-all" />
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Average Cost</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">${sym}</span>
                            <input type="text" inputmode="numeric" name="avgCost" value="${item ? this.formatMoneyInput(item.avgCost) : ''}" oninput="App.handleMoneyInput(event)" required placeholder="0" class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white transition-all" />
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Current Price</label>
                        <div class="relative">
                            <span class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">${sym}</span>
                            <input type="text" inputmode="numeric" name="currentPrice" value="${item ? this.formatMoneyInput(item.currentPrice) : ''}" oninput="App.handleMoneyInput(event)" required placeholder="0" class="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white transition-all" />
                        </div>
                    </div>
                </div>
            `;
        } else if (type === 'roadmap') {
            let stepsHtml = this.state.roadmap.map(s => `
                <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl mb-2 border border-slate-200 dark:border-slate-700">
                    <div class="flex items-center gap-3">
                        <i data-lucide="${s.icon}" class="w-4 h-4 text-slate-500"></i>
                        <span class="text-sm font-semibold dark:text-white">${s.title}</span>
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
                    <h4 class="text-sm font-bold dark:text-white mb-3 flex items-center gap-2"><i data-lucide="plus-circle" class="w-4 h-4"></i> Add New Milestone</h4>
                    <div class="grid grid-cols-2 gap-3 mb-2">
                        <input type="text" name="title" autocomplete="off" placeholder="Milestone Name" required class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white"/>
                        <select name="icon" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white">
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
        }
        container.innerHTML = `
            <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity fade-in">
                <div class="bg-white dark:bg-dark-card rounded-[2rem] shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-md slide-up overflow-hidden">
                    <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                        <h2 class="text-xl font-bold text-slate-900 dark:text-white">${modalTitle}</h2>
                        <button type="button" onclick="App.closeModal()" class="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                            <i data-lucide="x" class="w-5 h-5"></i>
                        </button>
                    </div>
                    <form onsubmit="App.handleFormSubmit(event)" class="p-8 space-y-6">
                        ${formHtml}
                        <p id="form-error" class="text-rose-500 text-sm text-center -mb-2"></p>
                        <div class="pt-2 flex gap-4">
                            <button type="button" onclick="App.closeModal()" class="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-semibold text-sm transition-all">${type === 'roadmap' ? 'Done' : 'Cancel'}</button>
                            <button type="submit" class="flex-1 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm shadow-lg shadow-brand-500/30 hover:-translate-y-0.5 transition-all">${type === 'roadmap' ? 'Add Step' : 'Save Record'}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        lucide.createIcons();
    },
    openCategoryModal(catId = null) {
        const cat = catId ? this.state.categories.find(c => c.id === catId) : null;
        const title = cat ? 'Edit Category' : 'New Category';
        document.getElementById('modal-container').innerHTML = `
            <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                <div class="bg-white dark:bg-dark-card rounded-2xl shadow-2xl max-w-md w-full animate-scale-in">
                    <div class="px-6 py-5 border-b border-slate-100 dark:border-dark-border flex items-center justify-between">
                        <h2 class="text-xl font-bold text-slate-900 dark:text-white">${title}</h2>
                        <button onclick="App.closeModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"><i data-lucide="x" class="w-5 h-5"></i></button>
                    </div>
                    <form onsubmit="App.saveCategory(event, ${catId})" class="p-6 space-y-4">
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category Name</label>
                            <input type="text" id="cat-name" autocomplete="off" value="${cat ? cat.name : ''}" required maxlength="50" placeholder="e.g. Gym Membership" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white" />
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Emoji</label>
                            <input type="text" id="cat-emoji" autocomplete="off" value="${cat ? cat.emoji : '📦'}" required maxlength="10" placeholder="📦" class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white" />
                        </div>
                        <div>
                            <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Color</label>
                            <div class="grid grid-cols-8 gap-2 mb-3">
                                ${['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b', '#000000'].map(color => `
                                    <button type="button" onclick="App.selectCategoryColor('${color}')" class="w-full aspect-square rounded-lg hover:scale-110 transition-transform border-2 ${(cat?.color || '#3b82f6') === color ? 'border-slate-900 dark:border-white' : 'border-transparent'}" style="background-color: ${color}" data-color="${color}"></button>
                                `).join('')}
                            </div>
                            <div class="flex items-center gap-2">
                                <input type="color" id="cat-color-picker" value="${cat ? cat.color : '#3b82f6'}" onchange="App.selectCategoryColor(this.value)" class="w-12 h-12 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer" />
                                <input type="text" id="cat-color" value="${cat ? cat.color : '#3b82f6'}" pattern="^#[0-9A-Fa-f]{6}$" maxlength="7" placeholder="#3b82f6" oninput="App.updateColorPreview(this.value)" class="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-sm dark:text-white font-mono" />
                                <div id="cat-color-preview" class="w-12 h-12 rounded-lg border-2 border-slate-200 dark:border-slate-700 shrink-0" style="background-color: ${cat ? cat.color : '#3b82f6'}"></div>
                            </div>
                        </div>
                        <p id="cat-error" class="text-rose-500 text-sm hidden"></p>
                        <div class="flex gap-4 pt-2">
                            <button type="button" onclick="App.closeModal()" class="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl font-semibold text-sm">Cancel</button>
                            <button type="submit" class="flex-1 px-4 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm shadow-lg">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        lucide.createIcons();
    },
    selectCategoryColor(color) {
        document.getElementById('cat-color').value = color;
        document.getElementById('cat-color-picker').value = color;
        document.getElementById('cat-color-preview').style.backgroundColor = color;
        // Update border on preset buttons
        document.querySelectorAll('[data-color]').forEach(btn => {
            btn.classList.toggle('border-slate-900', btn.dataset.color === color);
            btn.classList.toggle('dark:border-white', btn.dataset.color === color);
            btn.classList.toggle('border-transparent', btn.dataset.color !== color);
        });
    },
    updateColorPreview(value) {
        if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
            document.getElementById('cat-color-preview').style.backgroundColor = value;
            document.getElementById('cat-color-picker').value = value;
        }
    },
    async saveCategory(e, catId) {
        e.preventDefault();
        const name = document.getElementById('cat-name').value.trim();
        const emoji = document.getElementById('cat-emoji').value.trim();
        const color = document.getElementById('cat-color').value.trim();
        const err = document.getElementById('cat-error');
        const method = catId ? 'PUT' : 'POST';
        const url = catId ? `/api/categories/${catId}` : '/api/categories';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, emoji, color })
        });
        const data = await res.json();
        if (!res.ok) {
            err.textContent = data.error;
            err.classList.remove('hidden');
            return;
        }
        await this.fetchCategories();
        this.closeModal();
        Toast.show(catId ? 'Category updated' : 'Category created', 'success');
        this.render();
    },
    editCategory(catId) {
        this.openCategoryModal(catId);
    },
    async deleteCategory(catId) {
        if (!confirm('Delete this category? Make sure no transactions use it.')) return;
        const res = await fetch(`/api/categories/${catId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) {
            Toast.show(data.error || 'Failed to delete', 'error');
            return;
        }
        await this.fetchCategories();
        Toast.show('Category deleted', 'success');
        this.render();
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
            <div class="bg-white dark:bg-dark-card rounded-2xl shadow-2xl max-w-md w-full p-6">
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
