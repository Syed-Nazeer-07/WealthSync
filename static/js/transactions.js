
const AppViews = {
    getTransactionsHTML() {
        return `
            <div class="space-y-6 slide-up pb-10">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Transaction Ledger</h2>
                        <p class="text-slate-500 dark:text-slate-400 text-sm">Advanced search and filtering.</p>
                    </div>
                    <button onclick="App.openModal('transaction')" class="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex justify-center items-center gap-2 transition-colors shadow-lg focus:ring-2 focus:ring-brand-500 focus:outline-none">
                        <i data-lucide="plus" class="w-4 h-4"></i> Add Record
                    </button>
                </div>
                <div class="flex flex-col sm:flex-row gap-4 bg-white dark:bg-dark-card p-4 rounded-2xl border border-slate-200 dark:border-dark-border shadow-sm">
                    <div class="relative flex-1">
                        <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"></i>
                        <input id="tx-search-input" type="text" placeholder="Search by description, category, or type…" oninput="App.handleTxSearch(event)" value="${this.state.txSearchQuery}" autocomplete="off" class="w-full pl-10 pr-8 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm dark:text-white transition-all">
                        <button id="tx-search-clear" onclick="App.clearTxSearch()" class="${this.state.txSearchQuery ? '' : 'hidden'} absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" title="Clear search">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <select id="tx-filter-select" onchange="App.handleTxFilter(event)" class="px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm dark:text-white transition-all">
                        <option value="All">All Categories</option>
                        ${this.getCategoryNames().map(c => `<option value="${c}" ${this.state.txFilterCategory === c ? 'selected' : ''}>${this.getCategoryEmoji(c)} ${c}</option>`).join('')}
                    </select>
                </div>
                <div class="bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-2xl shadow-sm overflow-hidden w-full">
                    <div class="overflow-x-auto w-full">
                        <table class="w-full text-left border-collapse min-w-full">
                            <thead>
                                <tr class="bg-slate-50/50 dark:bg-slate-800/50 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-dark-border">
                                    <th class="px-6 py-4 font-semibold">
                                        <input type="checkbox" id="select-all-tx" onchange="App.toggleSelectAllTx()" class="w-4 h-4 text-brand-600 border-slate-300 rounded">
                                    </th>
                                    <th class="px-6 py-4 font-semibold">Date</th>
                                    <th class="px-6 py-4 font-semibold">Description</th>
                                    <th class="px-6 py-4 font-semibold">Category</th>
                                    <th class="px-6 py-4 font-semibold text-right">Amount</th>
                                    <th class="px-6 py-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="tx-table-body">${this._getTxRows()}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },
    _getTxRows() {
        let filtered = this.state.transactions;
        if (this.state.txSearchQuery) {
            const q = this.state.txSearchQuery.toLowerCase();
            filtered = filtered.filter(tx =>
                tx.description.toLowerCase().includes(q) ||
                tx.category.toLowerCase().includes(q) ||
                tx.type.toLowerCase().includes(q)
            );
        }
        if (this.state.txFilterCategory && this.state.txFilterCategory !== 'All') {
            filtered = filtered.filter(tx => tx.category === this.state.txFilterCategory);
        }
        if (filtered.length === 0) {
            return `<tr><td colspan="6" class="py-16 text-center">
                <div class="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
                    <i data-lucide="receipt" class="w-10 h-10 opacity-40"></i>
                    <div>
                        <p class="font-semibold text-base text-slate-700 dark:text-slate-300 mb-1">No Transactions Yet</p>
                        <p class="text-sm mb-3">${this.state.txSearchQuery ? 'No results match your search' : 'Start tracking your finances'}</p>
                        ${this.state.txSearchQuery ? `<button onclick="App.clearTxSearch()" class="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded font-medium transition-colors">Clear Search</button>` : `<button onclick="App.openModal('transaction')" class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors">Add Transaction</button>`}
                    </div>
                </div>
            </td></tr>`;
        }
        return filtered.map(tx => {
            const catEmoji = this.getCategoryEmoji(tx.category);
            const catColor = this.getCategoryColor(tx.category);
            return `
            <tr class="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-dark-border last:border-0">
                <td class="px-6 py-4">
                    <input type="checkbox" class="tx-checkbox w-4 h-4 text-brand-600 border-slate-300 rounded" value="${tx.id}" onchange="App.updateTxSelection()">
                </td>
                <td class="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">${this.formatDate(tx.date)}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-4">
                        <div class="p-2 rounded-xl border-2 shadow-sm text-lg flex items-center justify-center w-10 h-10 shrink-0" style="border-color: ${catColor}; background-color: ${catColor}15">${catEmoji}</div>
                        <span class="font-semibold text-slate-900 dark:text-white">${tx.description}</span>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap" style="background-color: ${catColor}20; color: ${catColor}">${tx.category}</span>
                </td>
                <td class="px-6 py-4 font-bold text-right whitespace-nowrap ${tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}">
                    ${tx.type === 'income' ? '+' : '-'}${this.formatCurrency(tx.amount)}
                </td>
                <td class="px-6 py-4 text-right whitespace-nowrap">
                    <div class="flex items-center justify-end gap-1">
                        <button aria-label="Edit transaction" onclick="App.openModal('transaction', ${tx.id})" class="text-slate-400 hover:text-brand-500 transition-colors p-2 rounded focus:ring-2 focus:ring-brand-500 focus:outline-none" title="Edit"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                        <button aria-label="Delete transaction" onclick="App.deleteItem('transaction', ${tx.id})" class="text-slate-400 hover:text-rose-500 transition-colors p-2 rounded focus:ring-2 focus:ring-rose-500 focus:outline-none" title="Delete"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    },
    getBudgetsHTML() {
        const calc = this.getCalculations();
        const cardsHtml = calc.budgetProgress.map(b => {
            const percent = Math.min((b.spent / b.limit) * 100, 100);
            const isOver = b.spent > b.limit;
            const remaining = b.limit - b.spent;
            const runRate = b.spent * 2;
            const forecastClass = runRate > b.limit ? 'text-rose-500' : 'text-emerald-500';
            const catColor = this.getCategoryColor(b.category);
            return `
                <div class="bg-white dark:bg-dark-card p-6 rounded-3xl border-2 shadow-sm relative group hover-card flex flex-col" style="border-color: ${catColor}40">
                    <div class="absolute top-4 right-4 flex gap-1">
                        <button aria-label="Edit budget" onclick="App.openModal('budget', ${b.id})" class="p-2 text-slate-400 hover:text-brand-500 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/10 focus:ring-2 focus:ring-brand-500 focus:outline-none transition-colors" title="Edit"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                        <button aria-label="Delete budget" onclick="App.deleteItem('budget', ${b.id})" class="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 focus:ring-2 focus:ring-rose-500 focus:outline-none transition-colors" title="Delete"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                    <div class="flex items-center gap-4 mb-6">
                        <div class="p-3 rounded-2xl" style="background-color: ${catColor}20">
                            <span class="text-2xl">${this.getCategoryEmoji(b.category)}</span>
                        </div>
                        <div>
                            <h3 class="font-bold text-lg text-slate-900 dark:text-white leading-tight">${b.category}</h3>
                            <span class="text-xs font-bold uppercase tracking-wider ${isOver ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}">
                                ${isOver ? 'Over Budget' : 'On Track'}
                            </span>
                        </div>
                    </div>
                    <div class="mb-2 flex justify-between text-sm mt-auto">
                        <span class="text-slate-500 dark:text-slate-400">Spent: <strong class="text-slate-900 dark:text-white">${this.formatCurrency(b.spent)}</strong></span>
                        <span class="text-slate-500 dark:text-slate-400">Limit: <strong class="text-slate-900 dark:text-white">${this.formatCurrency(b.limit)}</strong></span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 mb-4 overflow-hidden">
                        <div class="h-3 rounded-full transition-all duration-1000 ${isOver ? 'bg-gradient-to-r from-rose-500 to-red-600' : 'bg-gradient-to-r from-brand-400 to-indigo-600'}" style="width: ${percent}%"></div>
                    </div>
                    <div class="flex justify-between items-center text-sm">
                        <div class="text-xs font-medium text-slate-500">
                            EOM Forecast: <span class="${forecastClass}">${this.formatCurrency(runRate)}</span>
                        </div>
                        <div class="font-medium text-right">
                            ${isOver ?
                                `<span class="text-rose-500">Over by ${this.formatCurrency(Math.abs(remaining))}</span>` :
                                `<span class="text-emerald-600 dark:text-emerald-400">${this.formatCurrency(remaining)} left</span>`
                            }
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        return `
            <div class="space-y-6 slide-up pb-10">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Budgets & Predictors</h2>
                        <p class="text-slate-500 dark:text-slate-400 text-sm">Control spending with end-of-month (EOM) forecasts.</p>
                    </div>
                    <button onclick="App.openModal('budget')" class="w-full sm:w-auto bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-xl text-sm font-semibold flex justify-center items-center gap-2 hover:scale-105 transition-all shadow-lg">
                        <i data-lucide="plus" class="w-4 h-4"></i> Create Budget
                    </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${cardsHtml}
                    ${calc.budgetProgress.length === 0 ? `<div class="col-span-full p-12 text-center flex flex-col items-center gap-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl"><i data-lucide="pie-chart" class="w-10 h-10 text-slate-400 dark:text-slate-600"></i><div><p class="font-semibold text-slate-700 dark:text-slate-300 mb-1">No Budgets Yet</p><p class="text-sm text-slate-500 dark:text-slate-400 mb-3">Create budgets to track spending</p><button onclick="App.openModal('budget')" class="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors focus:ring-2 focus:ring-brand-500 focus:outline-none">Create Budget</button></div></div>` : ''}
                </div>
            </div>
        `;
    },
    getSavingsHTML() {
        const cardsHtml = this.state.savings.map(goal => {
            const percent = Math.min(((goal.current / goal.target) * 100), 100).toFixed(0);
            const isComplete = goal.current >= goal.target;
            const forecast = this.getGoalForecast(goal.id);
            const healthColors = {
                on_track: 'text-emerald-500 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20',
                behind: 'text-amber-500 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20',
                at_risk: 'text-rose-500 bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20',
                complete: 'text-emerald-500 bg-emerald-50 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20'
            };
            const healthLabels = { on_track: 'On Track', behind: 'Behind', at_risk: 'At Risk', complete: 'Complete' };
            let estimatedDateStr = 'Calculating...';
            let healthClass = healthColors.on_track;
            let healthLabel = 'Unknown';
            let scenariosHtml = '';
            let insightsHtml = '';
            if (forecast) {
                healthClass = healthColors[forecast.health] || healthColors.on_track;
                healthLabel = healthLabels[forecast.health] || 'Unknown';
                if (forecast.currentPace?.date) {
                    const date = new Date(forecast.currentPace.date);
                    estimatedDateStr = date.toLocaleDateString(this.getCurrencyLocale(), { month: 'short', year: 'numeric', timeZone: this.state.settings?.timezone || 'UTC' });
                } else if (forecast.health === 'complete') {
                    estimatedDateStr = 'Achieved!';
                } else {
                    estimatedDateStr = 'No savings';
                }
                scenariosHtml = `
                    <div class="grid grid-cols-3 gap-2 text-xs">
                        <div class="text-center p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <p class="text-slate-400 font-semibold mb-1">Current</p>
                            <p class="font-bold text-slate-900 dark:text-white">${forecast.currentPace?.months ? forecast.currentPace.months + ' mo' : 'N/A'}</p>
                        </div>
                        <div class="text-center p-2 bg-brand-50 dark:bg-brand-500/10 rounded-lg border border-brand-200 dark:border-brand-500/20">
                            <p class="text-brand-600 dark:text-brand-400 font-semibold mb-1">+10%</p>
                            <p class="font-bold text-brand-700 dark:text-brand-300">${forecast.accelerated?.months ? forecast.accelerated.months + ' mo' : 'N/A'}</p>
                        </div>
                        <div class="text-center p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
                            <p class="text-emerald-600 dark:text-emerald-400 font-semibold mb-1">+25%</p>
                            <p class="font-bold text-emerald-700 dark:text-emerald-300">${forecast.aggressive?.months ? forecast.aggressive.months + ' mo' : 'N/A'}</p>
                        </div>
                    </div>
                `;
                if (forecast.insights && forecast.insights.length > 0) {
                    insightsHtml = forecast.insights.map(insight => `
                        <div class="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                            <i data-lucide="lightbulb" class="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5"></i>
                            <span>${insight}</span>
                        </div>
                    `).join('');
                }
            }
            return `
                <div class="bg-white dark:bg-dark-card p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-dark-border shadow-sm flex flex-col relative group hover-card">
                    ${isComplete ? '<div class="absolute top-0 left-0 w-full h-1.5 bg-emerald-500"></div>' : ''}
                    <div class="absolute top-4 right-4 flex gap-1 z-10">
                        <button aria-label="Edit goal" onclick="App.openModal('saving', ${goal.id})" class="p-2 text-slate-400 hover:text-brand-500 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-500/10 focus:ring-2 focus:ring-brand-500 focus:outline-none transition-colors" title="Edit"><i data-lucide="edit-2" class="w-4 h-4"></i></button>
                        <button aria-label="Delete goal" onclick="App.deleteItem('saving', ${goal.id})" class="p-2 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 focus:ring-2 focus:ring-rose-500 focus:outline-none transition-colors" title="Delete"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                    </div>
                    <div class="flex justify-between items-start w-full mb-6">
                        <div>
                            <h3 class="font-bold text-xl text-slate-900 dark:text-white mb-1">${goal.name}</h3>
                            <p class="text-sm text-slate-500 dark:text-slate-400">Target: <span class="font-semibold text-slate-800 dark:text-slate-200">${this.formatCurrency(goal.target)}</span></p>
                        </div>
                        <div class="px-2.5 py-1 text-[10px] font-bold uppercase rounded border ${healthClass}">${healthLabel}</div>
                    </div>
                    <div class="flex flex-col md:flex-row items-center gap-8 mb-6">
                        <div class="relative w-32 h-32 shrink-0 rounded-full flex items-center justify-center shadow-inner"
                             style="background: conic-gradient(${isComplete ? '#10b981' : '#4f46e5'} ${percent}%, ${this.state.darkMode ? '#1e293b' : '#f1f5f9'} 0)">
                            <div class="absolute w-[112px] h-[112px] bg-white dark:bg-dark-card rounded-full flex flex-col items-center justify-center shadow-md border border-slate-100 dark:border-slate-800">
                                <span class="text-2xl font-extrabold ${isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}">${percent}%</span>
                            </div>
                        </div>
                        <div class="w-full space-y-4">
                            <div>
                                <p class="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Current Saved</p>
                                <p class="text-xl font-bold text-slate-900 dark:text-white">${this.formatCurrency(goal.current)}</p>
                            </div>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <p class="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Monthly In</p>
                                    <p class="text-sm font-semibold text-brand-600 dark:text-brand-400">${this.formatCurrency(goal.monthlyContribution || 0)}</p>
                                </div>
                                <div>
                                    <p class="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-0.5">Est. Completion</p>
                                    <p class="text-sm font-semibold text-slate-700 dark:text-slate-300">${estimatedDateStr}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    ${scenariosHtml ? `<div class="mb-4">${scenariosHtml}</div>` : ''}
                    ${insightsHtml ? `<div class="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-700">${insightsHtml}</div>` : ''}
                    ${goal.date ? `<div class="w-full mt-4 bg-slate-50 dark:bg-slate-800/30 p-3 rounded-xl border border-slate-100 dark:border-slate-700 text-xs text-center text-slate-500">
                        Desired Date: <strong>${new Date(goal.date).toLocaleDateString(this.getCurrencyLocale(), {month: 'long', year: 'numeric', timeZone: this.state.settings?.timezone || 'UTC'})}</strong>
                    </div>` : ''}
                </div>
            `;
        }).join('');
        return `
            <div class="space-y-6 slide-up pb-10">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Goal Forecasting</h2>
                        <p class="text-slate-500 dark:text-slate-400 text-sm">Track progress with enhanced forecasts, scenarios, and insights.</p>
                    </div>
                    <button onclick="App.openModal('saving')" class="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex justify-center items-center gap-2 transition-colors shadow-lg">
                        <i data-lucide="plus" class="w-4 h-4"></i> Add Goal
                    </button>
                </div>
                ${this.state.savings.length === 0 ? `
                <div class="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 gap-4">
                    <i data-lucide="target" class="w-16 h-16 opacity-40"></i>
                    <p class="text-lg">No goals yet. Create your first goal to get started!</p>
                    <button onclick="App.openModal('saving')" class="text-brand-500 hover:underline font-semibold">+ Add Goal</button>
                </div>
                ` : `<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">${cardsHtml}</div>`}
            </div>
        `;
    },
    getInvestmentsHTML() {
        const activeAssets = this.state.investments.filter(inv => inv.shares > 0).sort((a, b) => b.id - a.id);
        const totalInvested = this.state.investments.reduce((sum, inv) => sum + (inv.shares * inv.avgCost), 0);
        const totalReturned = this.state.investments.filter(inv => inv.shares === 0).reduce((sum, inv) => sum + (inv.quantity * inv.currentPrice - inv.quantity * inv.avgCost), 0);
        const sortedTransactions = [...this.state.transactions].filter(t => t.category === 'Investment Returns').sort((a, b) => new Date(b.date) - new Date(a.date));
        
        return `
            <div class="space-y-6 slide-up pb-10">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
                    <div>
                        <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Investment Portfolio</h2>
                        <p class="text-slate-500 dark:text-slate-400 text-sm">Simple personal finance tracking.</p>
                    </div>
                    <div class="flex gap-2 w-full sm:w-auto">
                        <button onclick="App.openModal('investment')" class="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex justify-center items-center gap-2 transition-colors shadow-lg">
                            <i data-lucide="plus" class="w-4 h-4"></i> Add Asset
                        </button>
                        ${activeAssets.length > 0 ? `<button onclick="App.openSellModal()" class="flex-1 sm:flex-none bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold flex justify-center items-center gap-2 transition-colors shadow-lg">
                            <i data-lucide="trending-down" class="w-4 h-4"></i> Sell Asset
                        </button>` : ''}
                    </div>
                </div>
                
                <!-- Summary Cards -->
                <div class="grid grid-cols-3 gap-4">
                    <div class="bg-white dark:bg-dark-card rounded-2xl p-4 border border-slate-200 dark:border-dark-border">
                        <p class="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">Total Invested</p>
                        <h3 class="text-2xl font-bold text-slate-900 dark:text-white">${this.formatCurrency(totalInvested)}</h3>
                    </div>
                    <div class="bg-white dark:bg-dark-card rounded-2xl p-4 border border-slate-200 dark:border-dark-border">
                        <p class="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">Total Returned</p>
                        <h3 class="text-2xl font-bold text-slate-900 dark:text-white">${this.formatCurrency(totalReturned)}</h3>
                    </div>
                    <div class="bg-white dark:bg-dark-card rounded-2xl p-4 border border-slate-200 dark:border-dark-border">
                        <p class="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold mb-1">Net Profit/Loss</p>
                        <h3 class="text-2xl font-bold ${(totalReturned - totalInvested) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${(totalReturned - totalInvested) >= 0 ? '+' : ''}${this.formatCurrency(totalReturned - totalInvested)}</h3>
                    </div>
                </div>
                
                <!-- Active Assets -->
                ${activeAssets.length > 0 ? `
                <div class="bg-white dark:bg-dark-card rounded-2xl p-6 border border-slate-200 dark:border-dark-border">
                    <h3 class="font-bold text-slate-900 dark:text-white mb-4">Current Active Assets</h3>
                    <div class="space-y-3">
                        ${activeAssets.map(inv => `
                            <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div>
                                    <p class="font-semibold text-slate-900 dark:text-white">${inv.symbol}</p>
                                    <p class="text-sm text-slate-600 dark:text-slate-400">${inv.shares} Units</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-sm text-slate-600 dark:text-slate-400">Invested</p>
                                    <p class="font-semibold text-slate-900 dark:text-white">${this.formatCurrency(inv.shares * inv.avgCost)}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                <!-- Investment History -->
                <div class="bg-white dark:bg-dark-card rounded-2xl p-6 border border-slate-200 dark:border-dark-border">
                    <h3 class="font-bold text-slate-900 dark:text-white mb-4">Investment Activity</h3>
                    ${sortedTransactions.length > 0 ? `
                    <div class="space-y-3">
                        ${sortedTransactions.slice(0, 10).map(t => `
                            <div class="flex justify-between items-start py-2 px-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div class="flex-1">
                                    <p class="font-semibold text-slate-900 dark:text-white text-sm">${t.description}</p>
                                    <p class="text-xs text-slate-500 dark:text-slate-400">${this.formatDate(t.date)}</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-sm font-semibold ${t.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}">${t.type === 'income' ? '+' : '-'}${this.formatCurrency(t.amount)}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    ` : '<div class="flex flex-col items-center gap-3 py-8"><i data-lucide="trending-up" class="w-10 h-10 text-slate-300 dark:text-slate-600"></i><p class="text-slate-700 dark:text-slate-300 font-semibold">No Activity Yet</p><p class="text-sm text-slate-500">Your investment history will appear here</p></div>'}
                </div>
            </div>
        `;
    },
    getSettingsHTML() {
        const u = this.state.currentUser || {};
        const s = this.state.settings || {};
        const isGoogle = !!u.google_id;
        const verified = u.email_verified;
        const initials = (u.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        const section = (title, icon, content) => `
            <div class="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border shadow-sm overflow-hidden">
                <div class="px-6 py-4 border-b border-slate-100 dark:border-dark-border flex items-center gap-2">
                    <i data-lucide="${icon}" class="w-4 h-4 text-brand-500"></i>
                    <h3 class="font-semibold text-sm text-slate-900 dark:text-white">${title}</h3>
                </div>
                <div class="px-6 py-5 space-y-4">${content}</div>
            </div>`;
        const row = (label, value) => `
            <div class="flex items-center justify-between py-1">
                <span class="text-sm text-slate-500 dark:text-slate-400">${label}</span>
                <span class="text-sm font-medium text-slate-900 dark:text-white">${value}</span>
            </div>`;
        const currencies = [
            { code: 'INR', label: '₹ Indian Rupee' },
            { code: 'USD', label: '$ US Dollar' },
            { code: 'EUR', label: '€ Euro' },
            { code: 'GBP', label: '£ British Pound' },
            { code: 'AED', label: 'د.إ UAE Dirham' },
            { code: 'SGD', label: 'S$ Singapore Dollar' },
        ];
        return `
        <div class="space-y-6 slide-up pb-10 max-w-2xl mx-auto">
            <div>
                <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Settings</h2>
                <p class="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage your account, preferences and data.</p>
            </div>
            <!-- Profile -->
            ${section('Profile', 'user', `
                <div class="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-dark-border">
                    <div class="w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shrink-0" style="color: white; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);">${initials}</div>
                    <div class="flex-1">
                        <p class="font-bold text-slate-900 dark:text-white text-xl">${u.name || 'User'}</p>
                        <p class="text-sm text-slate-500 dark:text-slate-400 truncate">${u.email || ''}</p>
                        <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">${verified ? '✓ Verified' : '⚠ Unverified'}</p>
                    </div>
                </div>
                ${row('Account Status', verified
                    ? '<span class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Verified</span>'
                    : '<span class="flex items-center gap-1 text-amber-600 dark:text-amber-400"><i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> Unverified</span>')}
                ${row('Login Method', isGoogle
                    ? '<span class="flex items-center gap-1"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Google</span>'
                    : '<span class="flex items-center gap-1"><i data-lucide="mail" class="w-3.5 h-3.5"></i> Email</span>')}
                <!-- Edit name -->
                <div class="pt-2">
                    <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Display Name</label>
                    <div class="flex gap-2">
                        <input id="settings-name" type="text" autocomplete="off" value="${u.name || ''}" class="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                        <button onclick="App.saveSettingName()" class="px-4 py-2 !bg-blue-600 hover:!bg-blue-700 !text-white rounded-xl text-sm font-medium transition-colors">Save</button>
                    </div>
                </div>
                <!-- Resend verification -->
                ${!verified ? `<button onclick="App.resendVerification()" class="text-sm text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"><i data-lucide="send" class="w-3.5 h-3.5"></i> Resend verification email</button>` : ''}
            `)}
            <!-- Change Password -->
            ${!isGoogle ? section('Security', 'lock', `
                <div class="space-y-3">
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Current Password</label>
                        <input id="settings-pw-current" type="password" autocomplete="current-password" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">New Password</label>
                        <input id="settings-pw-new" type="password" autocomplete="new-password" class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                    </div>
                    <p id="settings-pw-err" class="text-rose-500 text-xs hidden"></p>
                    <button onclick="App.saveSettingPassword()" class="px-4 py-2 !bg-blue-600 hover:!bg-blue-700 !text-white rounded-xl text-sm font-medium transition-colors">Change Password</button>
                </div>
            `) : section('Security', 'lock', `
                <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <i data-lucide="shield-check" class="w-5 h-5 text-brand-500 shrink-0"></i>
                    <p class="text-sm text-slate-600 dark:text-slate-400">Password is managed by Google. Sign in with Google to change it.</p>
                </div>
            `)}
            <!-- Appearance -->
            ${section('Appearance', 'palette', `
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-slate-900 dark:text-white">Theme</p>
                        <p class="text-xs text-slate-500 dark:text-slate-400">Choose your preferred colour scheme</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="App.saveSetting('theme','light')" class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${(s.theme||'dark')==='light' ? '!bg-blue-600 !text-white border-blue-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}">Light</button>
                        <button onclick="App.saveSetting('theme','dark')" class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${(s.theme||'dark')==='dark' ? '!bg-blue-600 !text-white border-blue-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}">Dark</button>
                    </div>
                </div>
                <div class="flex items-center justify-between pt-1">
                    <div>
                        <p class="text-sm font-medium text-slate-900 dark:text-white">Dashboard Greeting</p>
                        <p class="text-xs text-slate-500 dark:text-slate-400">Show "Good morning/afternoon" banner</p>
                    </div>
                    <button onclick="App.saveSetting('show_greeting', ${s.show_greeting === false})" class="w-11 h-6 rounded-full transition-colors relative ${s.show_greeting !== false ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-600'}">
                        <span class="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${s.show_greeting !== false ? 'left-5' : 'left-0.5'}"></span>
                    </button>
                </div>
                <div class="flex items-center justify-between pt-1">
                    <div>
                        <p class="text-sm font-medium text-slate-900 dark:text-white">Sidebar Default</p>
                        <p class="text-xs text-slate-500 dark:text-slate-400">Start with sidebar expanded or collapsed</p>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="App.saveSetting('sidebar_collapsed',false)" class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${!s.sidebar_collapsed ? '!bg-blue-600 !text-white border-blue-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}">Expanded</button>
                        <button onclick="App.saveSetting('sidebar_collapsed',true)" class="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${s.sidebar_collapsed ? '!bg-blue-600 !text-white border-blue-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}">Collapsed</button>
                    </div>
                </div>
            `)}
            <!-- Account Mode -->
            ${section('Account Mode', 'user-circle', `
                <div class="space-y-4">
                    <div>
                        <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Switch between modes to adapt WealthSync for your financial lifestyle.</p>
                        <div class="space-y-3">
                            <button onclick="App.switchAccountMode('income')" class="w-full p-4 rounded-xl border-2 text-left transition-all ${(this.state.profile?.account_mode || 'income') === 'income' ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 shadow-md ring-1 ring-brand-400' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}" id="mode-income-btn">
                                <div class="flex items-start gap-3">
                                    <div class="text-xl">💼</div>
                                    <div>
                                        <h4 class="font-semibold text-slate-900 dark:text-white">Income Mode</h4>
                                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Best for salary earners and structured financial planning</p>
                                    </div>
                                </div>
                            </button>
                            <button onclick="App.switchAccountMode('cashflow')" class="w-full p-4 rounded-xl border-2 text-left transition-all ${(this.state.profile?.account_mode || 'income') === 'cashflow' ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10 shadow-md ring-1 ring-brand-400' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}" id="mode-cashflow-btn">
                                <div class="flex items-start gap-3">
                                    <div class="text-xl">💰</div>
                                    <div>
                                        <h4 class="font-semibold text-slate-900 dark:text-white">Cash Flow Mode</h4>
                                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Best for students, allowance users, and irregular income</p>
                                    </div>
                                </div>
                            </button>
                        </div>
                        <p class="text-xs text-slate-400 dark:text-slate-500 mt-3">Switching modes never deletes your data, only changes calculations and labels.</p>
                    </div>
                </div>
            `)}
            <!-- Financial Profile -->
            ${section('Financial Profile', 'wallet', `
                <div class="space-y-4">
                    <p class="text-xs text-slate-500 dark:text-slate-400">Update your financial information used for calculations and insights.</p>
                    ${(this.state.profile?.account_mode || 'income') === 'income' ? `
                        <div>
                            <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Monthly Income</label>
                            <div class="relative">
                                <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${this.getCurrencySymbol()}</span>
                                <input id="profile-monthly-income" type="text" inputmode="numeric" oninput="App.handleMoneyInput(event)" value="${this.formatNumber(this.state.profile?.monthly_income || 0)}" class="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                            </div>
                            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Your regular monthly income (salary, freelance, etc.)</p>
                        </div>
                    ` : ''}
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Current Savings</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${this.getCurrencySymbol()}</span>
                            <input id="profile-savings" type="text" inputmode="numeric" oninput="App.handleMoneyInput(event)" value="${this.formatNumber(this.state.profile?.current_savings || 0)}" class="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Balance in savings accounts, FDs, liquid funds</p>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Current Investments</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${this.getCurrencySymbol()}</span>
                            <input id="profile-investments" type="text" inputmode="numeric" oninput="App.handleMoneyInput(event)" value="${this.formatNumber(this.state.profile?.current_investments || 0)}" class="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Total value of stocks, mutual funds, ETFs, crypto, etc.</p>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Monthly Expenses</label>
                        <div class="relative">
                            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">${this.getCurrencySymbol()}</span>
                            <input id="profile-expenses" type="text" inputmode="numeric" oninput="App.handleMoneyInput(event)" value="${this.formatNumber(this.state.profile?.monthly_expenses || 0)}" class="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                        </div>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Typical monthly spending (rent, food, bills, etc.)</p>
                    </div>
                    <p id="profile-save-err" class="text-rose-500 text-xs hidden"></p>
                    <button onclick="App.saveFinancialProfile()" class="px-4 py-2 !bg-blue-600 hover:!bg-blue-700 !text-white rounded-xl text-sm font-medium transition-colors">Save Changes</button>
                </div>
            `)}
            <!-- Timezone -->
            ${section('Timezone', 'clock', `
                <div>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">Used for date grouping in transactions and reports.</p>
                    <select onchange="App.saveSetting('timezone', this.value)" class="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                        ${[
                            ['UTC',                  'UTC (Coordinated Universal Time)'],
                            ['Asia/Kolkata',          'Asia/Kolkata (IST +5:30)'],
                            ['Asia/Dubai',            'Asia/Dubai (GST +4:00)'],
                            ['Asia/Singapore',        'Asia/Singapore (SGT +8:00)'],
                            ['Asia/Tokyo',            'Asia/Tokyo (JST +9:00)'],
                            ['Asia/Shanghai',         'Asia/Shanghai (CST +8:00)'],
                            ['Europe/London',         'Europe/London (GMT/BST)'],
                            ['Europe/Paris',          'Europe/Paris (CET/CEST)'],
                            ['Europe/Berlin',         'Europe/Berlin (CET/CEST)'],
                            ['America/New_York',      'America/New_York (ET)'],
                            ['America/Chicago',       'America/Chicago (CT)'],
                            ['America/Los_Angeles',   'America/Los_Angeles (PT)'],
                            ['America/Toronto',       'America/Toronto (ET)'],
                            ['Australia/Sydney',      'Australia/Sydney (AEST)'],
                            ['Pacific/Auckland',      'Pacific/Auckland (NZST)'],
                        ].map(([val, label]) => `<option value="${val}" ${(s.timezone||'UTC')===val ? 'selected' : ''}>${label}</option>`).join('')}
                    </select>
                </div>
            `)}
            <!-- Category Management -->
            ${section('Categories', 'tag', `
                <div class="space-y-3">
                    <div class="flex items-center justify-between mb-3">
                        <p class="text-xs text-slate-500 dark:text-slate-400">Manage transaction categories. Custom categories can be edited or deleted.</p>
                        <button onclick="App.openCategoryModal()" class="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1">
                            <i data-lucide="plus" class="w-3 h-3"></i> New Category
                        </button>
                    </div>
                    <div id="categories-list" class="space-y-2 max-h-64 overflow-y-auto">
                        ${this.state.categories.map(cat => `
                            <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2" style="border-color: ${cat.color}40">
                                <div class="flex items-center gap-3 min-w-0">
                                    <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background-color: ${cat.color}20; border: 2px solid ${cat.color}">
                                        <span class="text-base">${cat.emoji}</span>
                                    </div>
                                    <span class="text-sm font-medium text-slate-900 dark:text-white truncate">${cat.name}</span>
                                    ${cat.is_default ? '<span class="text-[10px] px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full font-semibold">Default</span>' : ''}
                                </div>
                                ${!cat.is_default ? `
                                    <div class="flex items-center gap-1 shrink-0">
                                        <button onclick="App.editCategory(${cat.id})" class="p-1.5 text-slate-400 hover:text-brand-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title="Edit">
                                            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                                        </button>
                                        <button onclick="App.deleteCategory(${cat.id})" class="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title="Delete">
                                            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                        </button>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `)}
            <!-- Data Export -->
            ${section('Data Export', 'download', `
                <div class="flex flex-col sm:flex-row gap-3">
                    <a href="/api/export/transactions" class="flex items-center gap-2 px-4 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
                        <i data-lucide="file-text" class="w-4 h-4"></i> Export Transactions (CSV)
                    </a>
                    <a href="/api/export/data" class="flex items-center gap-2 px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <i data-lucide="package" class="w-4 h-4"></i> Export All Data (JSON)
                    </a>
                </div>
            `)}
            <!-- Danger Zone -->
            <div class="bg-white dark:bg-dark-card rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-sm overflow-hidden">
                <div class="px-6 py-4 border-b border-rose-100 dark:border-rose-900/30 flex items-center gap-2">
                    <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-500"></i>
                    <h3 class="font-semibold text-sm text-rose-700 dark:text-rose-400">Danger Zone</h3>
                </div>
                <div class="px-6 py-5 space-y-3">
                    <div class="flex items-center justify-between py-2">
                        <div>
                            <p class="text-sm font-medium text-slate-900 dark:text-white">Delete All Transactions</p>
                            <p class="text-xs text-slate-500 dark:text-slate-400">Permanently removes all transaction records</p>
                        </div>
                        <button onclick="App.dangerAction('clear-transactions')" class="px-3 py-1.5 border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">Delete</button>
                    </div>
                    <div class="flex items-center justify-between py-2 border-t border-slate-100 dark:border-dark-border">
                        <div>
                            <p class="text-sm font-medium text-slate-900 dark:text-white">Delete All Financial Data</p>
                            <p class="text-xs text-slate-500 dark:text-slate-400">Removes transactions, budgets, goals, investments and roadmap</p>
                        </div>
                        <button onclick="App.dangerAction('clear-financial-data')" class="px-3 py-1.5 border border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors">Delete</button>
                    </div>
                    <div class="flex items-center justify-between py-2 border-t border-slate-100 dark:border-dark-border">
                        <div>
                            <p class="text-sm font-medium text-slate-900 dark:text-white">Delete Account</p>
                            <p class="text-xs text-slate-500 dark:text-slate-400">Permanently deletes your account and all data</p>
                        </div>
                        <button onclick="App.dangerAction('delete-account')" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors">Delete Account</button>
                    </div>
                </div>
            </div>
            <!-- Logout -->
            <button onclick="App.logout()" class="w-full flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-sm font-semibold transition-colors">
                <i data-lucide="log-out" class="w-4 h-4"></i> Sign Out
            </button>
        </div>`;
    }
};
