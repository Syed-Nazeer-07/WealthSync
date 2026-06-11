
const AppCharts = {
    async initDashboardCharts() {
        const isDark = this.state.darkMode;
        const textColor = isDark ? '#94a3b8' : '#64748b';
        const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        const nwCtx = document.getElementById('netWorthChart');
        if (nwCtx) {
            let nwLabels = ['Jan','Feb','Mar','Apr','May','Jun'];
            let nwData   = [0,0,0,0,0,0];
            try {
                const res = await fetch('/api/net-worth-history');
                if (res.ok) { const d = await res.json(); nwLabels = d.labels; nwData = d.data; }
            } catch(e) {}
            this.state.charts.nw = new Chart(nwCtx, {
                type: 'line',
                data: {
                    labels: nwLabels,
                    datasets: [{
                        label: 'Net Worth',
                        data: nwData,
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderWidth: 3,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#8b5cf6',
                        pointBorderColor: isDark ? '#0f172a' : '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                    scales: {
                        y: { border: {display: false}, grid: { color: gridColor }, ticks: { color: textColor, callback: (val) => {
                            const sym = App.getCurrencySymbol();
                            const abs = Math.abs(val);
                            if (abs >= 1e7) return (val/1e7).toFixed(1).replace(/\.0$/,'') + ' Cr';
                            if (abs >= 1e5) return (val/1e5).toFixed(1).replace(/\.0$/,'') + ' L';
                            if (abs >= 1e3) return (val/1e3).toFixed(0) + 'k';
                            return sym + val;
                        }}},
                        x: { border: {display: false}, grid: { display: false }, ticks: { color: textColor } }
                    },
                    interaction: { mode: 'nearest', axis: 'x', intersect: false }
                }
            });
        }
        const expCtx = document.getElementById('expenseChart');
        if (expCtx) {
            const expenses = this.state.transactions.filter(t => t.type === 'expense');
            const categoryTotals = {};
            expenses.forEach(e => { categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount; });
            this.state.charts.exp = new Chart(expCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(categoryTotals),
                    datasets: [{
                        data: Object.values(categoryTotals),
                        backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#64748b', '#ef4444', '#14b8a6', '#84cc16'],
                        borderWidth: 2,
                        borderColor: isDark ? '#111827' : '#ffffff',
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: {
                        legend: { position: 'right', labels: { color: textColor, usePointStyle: true, padding: 15 } }
                    }
                }
            });
        }
    },
    initInvestmentCharts() {
        const ctx = document.getElementById('allocationChart');
        if (!ctx) return;
        const allocTotals = {};
        this.state.investments.forEach(inv => {
            const value = inv.shares * inv.currentPrice;
            allocTotals[inv.type] = (allocTotals[inv.type] || 0) + value;
        });
        const isDark = this.state.darkMode;
        this.state.charts.invAlloc = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(allocTotals),
                datasets: [{
                    data: Object.values(allocTotals),
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
                    borderWidth: 2,
                    borderColor: isDark ? '#111827' : '#ffffff',
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { display: false } }
            }
        });
    }
};
