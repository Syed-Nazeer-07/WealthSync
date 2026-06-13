export const API = {
    auth: {
        async me() {
            const res = await fetch('/api/auth/me');
            if (!res.ok) throw new Error('Not authenticated');
            return res.json();
        },
        
        async logout() {
            await fetch('/api/auth/logout', { method: 'POST' });
            window.location.href = '/login';
        }
    },
    
    profile: {
        async get() {
            const res = await fetch('/api/profile');
            return res.json();
        },
        
        async update(data) {
            const res = await fetch('/api/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.json();
        }
    },
    
    settings: {
        async get() {
            const res = await fetch('/api/settings');
            return res.json();
        },
        
        async update(data) {
            const res = await fetch('/api/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        
        async updateName(name) {
            const res = await fetch('/api/settings/update-name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            return res.json();
        },
        
        async changePassword(currentPassword, newPassword) {
            const res = await fetch('/api/settings/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
            });
            return res.json();
        }
    },
    
    transactions: {
        async list() {
            const res = await fetch('/api/transactions');
            return res.json();
        },
        
        async create(data) {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        
        async update(id, data) {
            const res = await fetch(`/api/transactions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        
        async delete(id) {
            const res = await fetch(`/api/transactions/${id}`, {
                method: 'DELETE'
            });
            return res.json();
        }
    },
    
    budgets: {
        async list() {
            const res = await fetch('/api/budgets');
            return res.json();
        },
        
        async create(data) {
            const res = await fetch('/api/budgets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        
        async update(id, data) {
            const res = await fetch(`/api/budgets/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        
        async delete(id) {
            const res = await fetch(`/api/budgets/${id}`, {
                method: 'DELETE'
            });
            return res.json();
        }
    },
    
    goals: {
        async list() {
            const res = await fetch('/api/goals');
            return res.json();
        },
        
        async create(data) {
            const res = await fetch('/api/goals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        
        async update(id, data) {
            const res = await fetch(`/api/goals/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        
        async delete(id) {
            const res = await fetch(`/api/goals/${id}`, {
                method: 'DELETE'
            });
            return res.json();
        },
        
        async forecast() {
            const res = await fetch('/api/goals/forecast');
            return res.json();
        }
    },
    
    investments: {
        async list() {
            const res = await fetch('/api/investments');
            return res.json();
        },
        
        async create(data) {
            const res = await fetch('/api/investments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        
        async update(id, data) {
            const res = await fetch(`/api/investments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        
        async delete(id) {
            const res = await fetch(`/api/investments/${id}`, {
                method: 'DELETE'
            });
            return res.json();
        }
    },
    
    categories: {
        async list() {
            const res = await fetch('/api/categories');
            return res.json();
        },
        
        async create(data) {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        
        async update(id, data) {
            const res = await fetch(`/api/categories/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return res.json();
        },
        
        async delete(id) {
            const res = await fetch(`/api/categories/${id}`, {
                method: 'DELETE'
            });
            return res.json();
        }
    },
    
    analytics: {
        async getFinancialHealth() {
            const res = await fetch('/api/financial-health');
            return res.json();
        },
        
        async getNetWorthHistory() {
            const res = await fetch('/api/net-worth-history');
            return res.json();
        }
    },
    
    danger: {
        async clearTransactions(password) {
            const res = await fetch('/api/danger/clear-transactions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            return res.json();
        },
        
        async clearFinancialData(password) {
            const res = await fetch('/api/danger/clear-financial-data', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            return res.json();
        },
        
        async deleteAccount(password) {
            const res = await fetch('/api/danger/delete-account', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            return res.json();
        }
    }
};
