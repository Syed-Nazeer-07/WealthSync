// ES6 Module Entry Point for Finora
import { initTheme } from './components/theme.js';
import { showToast } from './components/toast.js';
import { LazyLoader } from './components/loader.js';
import { API } from './core/api.js';
import { formatCurrency } from './utils/currency.js';
import { formatDate } from './utils/date.js';

// Initialize theme on load
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
});

// Export to window for backward compatibility with existing app.js
window.showToast = showToast;
window.LazyLoader = LazyLoader;
window.API = API;
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;

console.log('✓ Finora modules loaded');
