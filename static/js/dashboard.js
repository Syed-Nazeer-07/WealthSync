
const AppDashboard = {
    getDashboardHTML() {
        const calc = this.getCalculations();
        const report = this.getMonthlyReport();
        const activity = this.getRecentActivity();
        const insights = this.getSmartInsights('month');
        const streak = this.getStreak();
        const isCashFlow = this.state.profile?.account_mode === 'cashflow';
        const financialInsights = [];
        const now = new Date();
        const thisYM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const lastYM = `${lastYear}-${String(lastMonth+1).padStart(2,'0')}`;
        const txThis = this.state.transactions.filter(t => t.date.startsWith(thisYM));
        const txLast = this.state.transactions.filter(t => t.date.startsWith(lastYM));
        const catThis = {}, catLast = {};
        txThis.filter(t => t.type === 'expense').forEach(t => catThis[t.category] = (catThis[t.category]||0) + t.amount);
        txLast.filter(t => t.type === 'expense').forEach(t => catLast[t.category] = (catLast[t.category]||0) + t.amount);
        Object.keys({...catThis, ...catLast}).forEach(cat => {
            const curr = catThis[cat] || 0;
            const prev = catLast[cat] || 0;
            const diff = curr - prev;
            const pct = prev > 0 ? Math.round((diff / prev) * 100) : null;
            if (Math.abs(diff) > 500) { 
                if (pct !== null && Math.abs(pct) >= 10) { 
                    if (diff > 0) {
                        financialInsights.push({
                            icon: 'trending-up',
                            color: 'text-rose-600 dark:text-rose-400',
                            text: `${cat} spending increased ${pct}% this month (${this.formatCurrency(diff)} more).`
                        });
                    } else {
                        financialInsights.push({
                            icon: 'trending-down',
                            color: 'text-emerald-600 dark:text-emerald-400',
                            text: `${cat} spending decreased ${Math.abs(pct)}% (saved ${this.formatCurrency(Math.abs(diff))}).`
                        });
                    }
                } else if (prev === 0 && curr > 1000) {
                    financialInsights.push({
                        icon: 'alert-circle',
                        color: 'text-amber-600 dark:text-amber-400',
                        text: `New spending in ${cat}: ${this.formatCurrency(curr)} this month.`
                    });
                }
            }
        });
        const incThis = txThis.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
        const expThis = txThis.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
        const incLast = txLast.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
        const expLast = txLast.filter(t => t.type === 'expense').reduce((s,t) => s + t.amount, 0);
        const srThis = incThis > 0 ? ((incThis - expThis) / incThis * 100) : 0;
        const srLast = incLast > 0 ? ((incLast - expLast) / incLast * 100) : 0;
        if (Math.abs(srThis - srLast) >= 5 && incThis > 0) {
            financialInsights.push({
                icon: srThis > srLast ? 'arrow-up-circle' : 'arrow-down-circle',
                color: srThis > srLast ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
                text: `Savings rate ${srThis > srLast ? 'improved' : 'decreased'} from ${srLast.toFixed(0)}% to ${srThis.toFixed(0)}%.`
            });
        }
        if (incThis > 0 && expThis > 0) {
            const monthlySavings = incThis - expThis;
            if (monthlySavings > 0) {
                const annualProjection = monthlySavings * 12;
                financialInsights.push({
                    icon: 'calendar',
                    color: 'text-brand-600 dark:text-brand-400',
                    text: `On track to save ${this.formatCurrency(annualProjection)} this year.`
                });
            }
        }
        if (this.state.savings.length > 0) {
            const goalsThisMonth = this.state.savings.filter(g => {
                const lastUpdate = new Date(g.target_date || Date.now());
                return lastUpdate.getMonth() === now.getMonth();
            });
            const avgProgress = this.state.savings.reduce((sum, g) => 
                sum + Math.min(100, (g.current / g.target) * 100), 0) / this.state.savings.length;
            if (avgProgress >= 75) {
                financialInsights.push({
                    icon: 'target',
                    color: 'text-emerald-600 dark:text-emerald-400',
                    text: `Goals are ${avgProgress.toFixed(0)}% complete on average. Great progress!`
                });
            } else if (avgProgress < 30 && this.state.savings.length > 0) {
                financialInsights.push({
                    icon: 'alert-triangle',
                    color: 'text-amber-600 dark:text-amber-400',
                    text: `Goal progress at ${avgProgress.toFixed(0)}%. Consider increasing contributions.`
                });
            }
        }
        const topInsights = financialInsights.slice(0, 5);
        const timeOfDay = new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening';
        const showGreeting = this.state.settings?.show_greeting !== false;
        const sym = this.getCurrencySymbol();
        const gradeDesc = { A: 'Excellent', B: 'Good', C: 'Fair', D: 'Needs Work', F: 'At Risk' };
        const reportMetrics = [
            { label: isCashFlow ? 'Money Received' : 'Income',    value: this.formatCurrency(report.income),    color: 'text-emerald-600 dark:text-emerald-400' },
            { label: isCashFlow ? 'Money Spent' : 'Expenses',  value: this.formatCurrency(report.expenses),  color: 'text-rose-600 dark:text-rose-400' },
            { label: isCashFlow ? 'Remaining Balance' : 'Saved',     value: this.formatCurrency(report.savings),   color: report.savings >= 0 ? 'text-brand-600 dark:text-brand-400' : 'text-rose-600 dark:text-rose-400' },
            { label: 'Net ∆',     value: (report.netChange >= 0 ? '+' : '') + this.formatCurrency(report.netChange), color: report.netChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' },
        ];
        const goalsHtml = this.state.savings.length === 0
            ? `<div class="flex flex-col items-center justify-center py-12 text-center">
                <i data-lucide="target" class="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4"></i>
                <p class="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No Goals Yet</p>
                <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Start saving for your dreams today</p>
                <button onclick="App.openModal('saving')" class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors focus:ring-2 focus:ring-brand-500 focus:outline-none">Create Your First Goal</button>
               </div>`
            : this.state.savings.map(goal => {
                const pct = Math.min(100, goal.target > 0 ? (goal.current / goal.target) * 100 : 0);
                const isComplete = pct >= 100;
                const forecast = this.getGoalForecast(goal.id);
                let etaStr = 'Calculating...';
                let healthBadge = '';
                if (forecast) {
                    if (forecast.health === 'complete') {
                        etaStr = '✅ Complete';
                    } else if (forecast.currentPace?.date) {
                        const date = new Date(forecast.currentPace.date);
                        etaStr = date.toLocaleDateString(this.getCurrencyLocale(), { month: 'short', year: 'numeric', timeZone: this.state.settings?.timezone || 'UTC' });
                    } else {
                        etaStr = 'No savings detected';
                    }
                    const healthColors = {
                        on_track: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                        behind: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                        at_risk: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
                        complete: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                    };
                    const healthLabels = {
                        on_track: 'On Track',
                        behind: 'Behind',
                        at_risk: 'At Risk',
                        complete: 'Complete'
                    };
                    healthBadge = `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${healthColors[forecast.health] || healthColors.on_track}">${healthLabels[forecast.health] || 'Unknown'}</span>`;
                }
                return `
                <div class="py-3 border-b border-slate-100 dark:border-dark-border last:border-0">
                    <div class="flex justify-between items-start mb-1.5">
                        <span class="text-sm font-semibold text-slate-900 dark:text-white truncate mr-2">${goal.name}</span>
                        <div class="flex items-center gap-2 shrink-0">
                            ${healthBadge}
                            <span class="text-xs font-bold ${isComplete ? 'text-emerald-500' : 'text-slate-500 dark:text-slate-400'}">${pct.toFixed(0)}%</span>
                        </div>
                    </div>
                    <div class="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mb-1.5">
                        <div class="h-1.5 rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-brand-500'} transition-all" style="width:${pct}%"></div>
                    </div>
                    <div class="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>${this.formatCurrency(goal.current)} <span class="text-slate-400">of ${this.formatCurrency(goal.target)}</span></span>
                        <span class="text-right">${etaStr}</span>
                    </div>
                </div>`;
            }).join('');
        const txGroup = (label, txList) => {
            if (!txList.length) return '';
            return `<div class="mb-3">
                <p class="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">${label}</p>
                ${txList.map(tx => {
                    const catColor = this.getCategoryColor(tx.category);
                    return `
                <div class="flex items-center gap-3 py-2 border-b border-slate-50 dark:border-dark-border/50 last:border-0">
                    <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style="background-color: ${catColor}20; border: 2px solid ${catColor}">
                        <span class="text-base">${this.getCategoryEmoji(tx.category)}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-slate-900 dark:text-white truncate">${tx.description}</p>
                        <p class="text-xs font-medium" style="color: ${catColor}">${tx.category}</p>
                    </div>
                    <span class="text-sm font-bold shrink-0 ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}">
                        ${tx.type === 'income' ? '+' : '-'}${this.formatCurrency(tx.amount)}
                    </span>
                </div>`;
                }).join('')}
            </div>`;
        };
        const hasActivity = activity.today.length + activity.yesterday.length + activity.earlier.length > 0;
        const activityHtml = hasActivity
            ? txGroup('Today', activity.today) + txGroup('Yesterday', activity.yesterday) + txGroup('Earlier', activity.earlier)
            : `<div class="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500 text-sm gap-2">
                <i data-lucide="receipt" class="w-8 h-8 opacity-40"></i>
                <p>No recent transactions</p>
               </div>`;
        const insightColors = {
            warning: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300',
            success: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300',
            danger:  'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-300',
            info:    'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
        };
        const insightsHtml = insights.map(ins => `
            <div class="flex items-start gap-2.5 p-3 rounded-xl border text-xs font-medium mb-2 last:mb-0 ${insightColors[ins.type] || insightColors.info}">
                <i data-lucide="${ins.icon}" class="w-4 h-4 shrink-0 mt-0.5"></i>
                <span>${ins.text}</span>
            </div>`).join('');
        return `
        <div class="space-y-6 sm:space-y-8 pb-10">
            <!-- Header -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 slide-up">
                ${showGreeting
                    ? `<div>
                        <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-1">Good ${timeOfDay}, ${this.state.currentUser?.name ?? ''} 👋</h1>
                        <p class="text-slate-500 dark:text-slate-400 text-sm">Here's your financial snapshot.</p>
                       </div>`
                    : `<div>
                        <h1 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-1">Dashboard</h1>
                        <p class="text-slate-500 dark:text-slate-400 text-sm">Your Personal Financial OS.</p>
                       </div>`}
                <button onclick="App.openModal('transaction')" class="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-semibold text-sm shadow-lg flex items-center gap-2 transition-colors focus:ring-2 focus:ring-brand-500 focus:outline-none">
                    <i data-lucide="plus" class="w-4 h-4"></i> Add Transaction
                </button>
            </div>
            <!-- Row 1: Net Worth Hero + Financial Health -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 slide-up delay-100">
                <div class="lg:col-span-2 relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-slate-900 dark:bg-dark-card border border-slate-800 dark:border-dark-border text-white shadow-2xl hover-card">
                    <div class="absolute top-0 right-0 w-96 h-96 bg-brand-500/30 rounded-full blur-3xl -mr-20 -mt-40 pointer-events-none animate-pulse-slow"></div>
                    <div class="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none"></div>
                    <div class="relative z-10 flex flex-col h-full justify-between">
                        <div class="flex justify-between items-start mb-8">
                            <div class="flex-1">
                                <div class="flex items-center gap-2 mb-1">
                                    <p class="text-slate-400 font-medium text-sm uppercase tracking-wider">${isCashFlow ? 'Available Balance' : 'Total Net Worth'}</p>
                                    ${isCashFlow ? `<button onclick="App.editAvailableBalance()" class="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors" title="Edit Available Balance"><i data-lucide="edit-2" class="w-4 h-4"></i></button>` : ''}
                                </div>
                                <h2 class="text-4xl sm:text-5xl font-extrabold tracking-tight">${this.formatCurrency(isCashFlow ? calc.availableBalance : calc.netWorth)}</h2>
                            </div>
                            <div class="px-3 py-1.5 rounded-full ${calc.netWorthGrowth >= 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'} flex items-center gap-1 text-sm font-bold backdrop-blur-md shrink-0" title="${isCashFlow ? 'Balance change this month' : 'Net worth growth this month'}">
                                <i data-lucide="${calc.netWorthGrowth >= 0 ? 'trending-up' : 'trending-down'}" class="w-4 h-4"></i>
                                ${calc.netWorthGrowth >= 0 ? '+' : ''}${calc.netWorthGrowth.toFixed(1)}%
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
                            <div><p class="text-slate-400 text-xs mb-1">${isCashFlow ? 'Current Cash' : 'Liquid Cash'}</p><p class="font-semibold text-lg">${this.formatCurrency(calc.currentCash)}</p></div>
                            <div><p class="text-slate-400 text-xs mb-1">Savings</p><p class="font-semibold text-lg">${this.formatCurrency(calc.totalSavings)}</p></div>
                            <div><p class="text-slate-400 text-xs mb-1">${isCashFlow ? 'Goals' : 'Investments'}</p><p class="font-semibold text-lg">${this.formatCurrency(isCashFlow ? this.state.savings.reduce((sum, g) => sum + g.current, 0) : calc.totalInvestmentValue)}</p></div>
                        </div>
                    </div>
                </div>
                <!-- Financial Health -->
                <div id="financial-health-card" class="bg-white dark:bg-dark-card rounded-3xl p-6 border border-slate-200 dark:border-dark-border shadow-sm hover-card flex flex-col">
                    <div class="flex justify-between items-start mb-4">
                        <h3 class="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Financial Health</h3>
                        <button onclick="App._toggleHealthBreakdown()" class="text-brand-500 hover:text-brand-600 text-xs font-semibold flex items-center gap-1">
                            <span id="health-toggle-text">View Breakdown</span>
                            <i data-lucide="chevron-down" id="health-toggle-icon" class="w-3.5 h-3.5 transition-transform"></i>
                        </button>
                    </div>
                    <div class="flex flex-col items-center text-center mb-4">
                        <div class="relative w-32 h-32 flex items-center justify-center">
                            <svg class="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <path class="text-slate-100 dark:text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="100, 100"/>
                                <path class="${calc.healthScore >= 75 ? 'text-emerald-500' : calc.healthScore >= 55 ? 'text-amber-500' : 'text-rose-500'}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="${calc.healthScore}, 100"/>
                            </svg>
                            <div class="absolute inset-0 flex flex-col items-center justify-center">
                                <span class="text-3xl font-extrabold text-slate-900 dark:text-white">${calc.healthScore}</span>
                                <span class="text-[10px] text-slate-400">/ 100</span>
                            </div>
                        </div>
                        <p class="mt-3 text-sm font-semibold ${calc.healthScore >= 75 ? 'text-emerald-600 dark:text-emerald-400' : calc.healthScore >= 55 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}">
                            ${calc.healthScore >= 75 ? 'Optimized 🚀' : calc.healthScore >= 55 ? 'Needs Attention' : 'At Risk ⚠️'}
                        </p>
                    </div>
                    <div id="health-breakdown" class="hidden space-y-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                        ${this.getHealthExplanation(calc)}
                    </div>
                </div>
            </div>
            <!-- Row 2: Monthly Summary + Budget Snapshot -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 slide-up delay-150">
                <!-- Monthly Summary -->
                <div class="bg-white dark:bg-dark-card rounded-3xl p-6 border border-slate-200 dark:border-dark-border shadow-sm hover-card">
                    <div class="flex items-center justify-between mb-5">
                        <h3 class="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                            <i data-lucide="calendar" class="w-5 h-5 text-brand-500"></i> This Month
                        </h3>
                        ${streak > 0 ? `<div class="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30 rounded-lg"><span class="text-orange-500">🔥</span><span class="text-sm font-bold text-orange-600 dark:text-orange-400">${streak}d</span></div>` : ''}
                    </div>
                    <div class="space-y-3">
                        <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                            <span class="text-sm font-medium text-slate-600 dark:text-slate-400">${isCashFlow ? 'Money Received' : 'Income'}</span>
                            <span class="font-bold text-emerald-600 dark:text-emerald-400">${this.formatCurrency(report.income)}</span>
                        </div>
                        <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                            <span class="text-sm font-medium text-slate-600 dark:text-slate-400">${isCashFlow ? 'Money Spent' : 'Expenses'}</span>
                            <span class="font-bold text-rose-600 dark:text-rose-400">${this.formatCurrency(report.expenses)}</span>
                        </div>
                        <div class="flex items-center justify-between p-3 bg-brand-50 dark:bg-brand-900/10 rounded-xl border border-brand-200 dark:border-brand-900/30">
                            <span class="text-sm font-semibold text-slate-700 dark:text-slate-300">${isCashFlow ? 'Remaining' : 'Saved'}</span>
                            <span class="font-extrabold text-lg text-brand-600 dark:text-brand-400">${this.formatCurrency(report.savings)}</span>
                        </div>
                    </div>
                </div>
                <!-- Budget Snapshot -->
                <div class="bg-white dark:bg-dark-card rounded-3xl p-6 border border-slate-200 dark:border-dark-border shadow-sm hover-card">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                            <i data-lucide="pie-chart" class="w-5 h-5 text-brand-500"></i> Budgets
                        </h3>
                        <button onclick="App.setActiveTab('budgets')" class="text-xs text-brand-500 hover:text-brand-600 font-semibold">View All →</button>
                    </div>
                    ${calc.budgetProgress.length > 0 ? calc.budgetProgress.slice(0, 4).map(b => {
                        const pct = b.limit > 0 ? (b.spent / b.limit) * 100 : 0;
                        const catColor = this.getCategoryColor(b.category);
                        const textColor = pct >= 90 ? 'text-red-600 dark:text-red-400' : pct >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400';
                        return `
                        <div class="mb-4 last:mb-0">
                            <div class="flex items-center justify-between mb-1.5">
                                <div class="flex items-center gap-2">
                                    <div class="w-6 h-6 rounded-md flex items-center justify-center text-xs" style="background-color: ${catColor}30; border: 1.5px solid ${catColor}">
                                        ${this.getCategoryEmoji(b.category)}
                                    </div>
                                    <span class="text-sm font-medium text-slate-700 dark:text-slate-300">${b.category}</span>
                                </div>
                                <span class="text-xs font-bold ${textColor}">${Math.round(pct)}%</span>
                            </div>
                            <div class="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div class="h-full rounded-full transition-all" style="width: ${Math.min(100, pct)}%; background-color: ${catColor}"></div>
                            </div>
                            <div class="flex justify-between mt-1">
                                <span class="text-xs text-slate-500">${this.formatCurrency(b.spent)}</span>
                                <span class="text-xs text-slate-500">of ${this.formatCurrency(b.limit)}</span>
                            </div>
                        </div>`;
                    }).join('') : '<div class="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-slate-500"><i data-lucide="pie-chart" class="w-8 h-8 mb-2 opacity-40"></i><p class="text-sm">No budgets set</p><button onclick="App.openModal(\'budget\')" class="text-xs text-brand-500 hover:underline mt-1">Create Budget</button></div>'}
                </div>
            </div>
            <!-- Row 3: Recent Activity + Goals + Insights -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 slide-up delay-200">
                <!-- Recent Activity -->
                <div class="bg-white dark:bg-dark-card rounded-3xl p-6 border border-slate-200 dark:border-dark-border shadow-sm hover-card">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                            <i data-lucide="clock" class="w-4 h-4 text-purple-500"></i> Recent Activity
                        </h3>
                        <button onclick="App.setActiveTab('transactions')" class="text-xs text-brand-500 hover:text-brand-600 font-semibold">View All →</button>
                    </div>
                    <div class="space-y-3 max-h-64 overflow-y-auto">
                        ${activity.today.concat(activity.yesterday, activity.earlier).slice(0, 7).map(tx => {
                            const catColor = this.getCategoryColor(tx.category);
                            return `
                        <div class="flex items-center gap-3 py-2 border-b border-slate-50 dark:border-dark-border/50 last:border-0">
                            <div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style="background-color: ${catColor}20; border: 2px solid ${catColor}">
                                <span class="text-base">${this.getCategoryEmoji(tx.category)}</span>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-sm font-medium text-slate-900 dark:text-white truncate">${tx.description}</p>
                                <p class="text-xs font-medium" style="color: ${catColor}">${tx.category}</p>
                            </div>
                            <span class="text-sm font-bold shrink-0 ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}">
                                ${tx.type === 'income' ? '+' : '-'}${this.formatCurrency(tx.amount)}
                            </span>
                        </div>`;
                        }).join('') || '<div class="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500"><i data-lucide="receipt" class="w-8 h-8 mb-2 opacity-40"></i><p class="text-sm">No recent transactions</p></div>'}
                    </div>
                </div>
                <!-- Goal Progress -->
                <div class="bg-white dark:bg-dark-card rounded-3xl p-6 border border-slate-200 dark:border-dark-border shadow-sm hover-card">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                            <i data-lucide="target" class="w-4 h-4 text-brand-500"></i> Active Goals
                        </h3>
                        <button onclick="App.setActiveTab('savings')" class="text-xs text-brand-500 hover:text-brand-600 font-semibold">View All →</button>
                    </div>
                    ${goalsHtml}
                </div>
                <!-- Smart Insights -->
                <div class="bg-white dark:bg-dark-card rounded-3xl p-6 border border-slate-200 dark:border-dark-border shadow-sm hover-card">
                    <h3 class="font-bold text-sm text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <i data-lucide="lightbulb" class="w-4 h-4 text-amber-500"></i> Smart Insights
                    </h3>
                    <div class="space-y-2 max-h-64 overflow-y-auto">${insightsHtml || '<p class="text-xs text-slate-400">No insights available</p>'}</div>
                </div>
            </div>
            <!-- Row 3: Charts -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 slide-up delay-300">
                <div class="bg-white dark:bg-dark-card p-6 rounded-3xl border border-slate-200 dark:border-dark-border shadow-sm hover-card">
                    <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-6">Net Worth Trend</h3>
                    <div class="h-56 relative w-full"><canvas id="netWorthChart"></canvas></div>
                </div>
                <div class="bg-white dark:bg-dark-card p-6 rounded-3xl border border-slate-200 dark:border-dark-border shadow-sm hover-card">
                    <h3 class="font-bold text-lg text-slate-900 dark:text-white mb-6">Expense Breakdown</h3>
                    <div class="h-56 relative w-full flex justify-center"><canvas id="expenseChart"></canvas></div>
                </div>
            </div>
        </div>`;
    },
    _dashInsightPeriod(period) {
        const content = document.getElementById('insights-content');
        if (!content) return;
        ['week','month','year'].forEach(p => {
            const btn = document.getElementById(`insight-tab-${p}`);
            if (!btn) return;
            btn.className = `px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${p === period
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`;
        });
        const insightColors = {
            warning: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300',
            success: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-800 dark:text-emerald-300',
            danger:  'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-800 dark:text-rose-300',
            info:    'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300',
        };
        const insights = this.getSmartInsights(period);
        content.innerHTML = insights.map(ins => `
            <div class="flex items-start gap-2.5 p-3 rounded-xl border text-xs font-medium mb-2 last:mb-0 ${insightColors[ins.type] || insightColors.info}">
                <i data-lucide="${ins.icon}" class="w-4 h-4 shrink-0 mt-0.5"></i>
                <span>${ins.text}</span>
            </div>`).join('');
        lucide.createIcons({ nodes: [content] });
    },
    _toggleHealthBreakdown() {
        const breakdown = document.getElementById('health-breakdown');
        const icon = document.getElementById('health-toggle-icon');
        const text = document.getElementById('health-toggle-text');
        if (breakdown && icon && text) {
            breakdown.classList.toggle('hidden');
            icon.classList.toggle('rotate-180');
            text.textContent = breakdown.classList.contains('hidden') ? 'View Breakdown' : 'Hide Breakdown';
        }
    },
    getHealthExplanation(calc) {
        const components = [
            { 
                label: 'Savings Rate', 
                score: calc.breakdown.savingsRateScore, 
                max: 20,
                explain: calc.breakdown.savingsRateScore >= 15 
                    ? '✓ Strong savings rate' 
                    : calc.breakdown.savingsRateScore >= 10
                    ? '⚠ Moderate savings. Try to save 15-20% of income'
                    : '⚠ Low savings rate. Aim to save at least 15% monthly'
            },
            { 
                label: 'Emergency Fund', 
                score: calc.breakdown.emergencyFundScore, 
                max: 20,
                explain: calc.breakdown.emergencyFundScore >= 15 
                    ? '✓ Good emergency fund coverage' 
                    : calc.breakdown.emergencyFundScore >= 10
                    ? '⚠ Build emergency fund to 6 months expenses'
                    : '⚠ Emergency fund too low. Target 6 months expenses'
            },
            { 
                label: 'Budget Discipline', 
                score: calc.breakdown.budgetScore, 
                max: 15,
                explain: calc.breakdown.budgetScore >= 12 
                    ? '✓ Staying within budgets' 
                    : calc.breakdown.budgetScore >= 10
                    ? '⚠ Some budget categories exceeded'
                    : this.state.budgets.length === 0
                    ? 'ℹ No budgets set. Create budgets to track better'
                    : '⚠ Multiple budgets exceeded. Review spending'
            },
            { 
                label: 'Goal Progress', 
                score: calc.breakdown.goalScore, 
                max: 15,
                explain: calc.breakdown.goalScore >= 10 
                    ? '✓ Goals are on track' 
                    : calc.breakdown.goalScore >= 5
                    ? '⚠ Goal progress is slow. Increase contributions'
                    : this.state.savings.length === 0
                    ? 'ℹ No goals set. Create savings goals'
                    : '⚠ Goals behind schedule. Review targets'
            },
            { 
                label: 'Investment Activity', 
                score: calc.breakdown.investmentScore, 
                max: 15,
                explain: calc.breakdown.investmentScore >= 10 
                    ? '✓ Active investment portfolio' 
                    : calc.breakdown.investmentScore >= 5
                    ? '⚠ Low investment ratio. Consider investing surplus'
                    : '⚠ No investments. Start with systematic investing'
            },
            { 
                label: 'Spending Stability', 
                score: calc.breakdown.stabilityScore, 
                max: 10,
                explain: calc.breakdown.stabilityScore >= 7 
                    ? '✓ Consistent spending patterns' 
                    : calc.breakdown.stabilityScore >= 5
                    ? '⚠ Some spending volatility'
                    : '⚠ High spending variation. Track expenses closely'
            },
            { 
                label: 'Net Worth Growth', 
                score: calc.breakdown.growthScore, 
                max: 5,
                explain: calc.breakdown.growthScore >= 4 
                    ? '✓ Positive net worth growth' 
                    : '⚠ Net worth not growing. Focus on saving'
            }
        ];
        return components.map(item => {
            const pct = (item.score / item.max) * 100;
            const color = pct >= 75 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
            const barColor = pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
            return `
            <div class="space-y-1">
                <div class="flex items-center justify-between text-xs">
                    <span class="font-medium text-slate-700 dark:text-slate-300">${item.label}</span>
                    <span class="font-bold ${color}">${item.score}/${item.max}</span>
                </div>
                <div class="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div class="h-full ${barColor} rounded-full transition-all" style="width:${pct}%"></div>
                </div>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">${item.explain}</p>
            </div>`;
        }).join('');
    }
};
