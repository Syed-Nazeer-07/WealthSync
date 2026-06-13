let toastTimeout;

export function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info';
    const bgColor = type === 'success' ? 'bg-emerald-500' : type === 'error' ? 'bg-rose-500' : 'bg-blue-500';
    
    toast.innerHTML = `
        <div class="${bgColor} text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3">
            <i data-lucide="${icon}" class="w-5 h-5"></i>
            <span class="font-medium">${message}</span>
        </div>
    `;
    
    toast.classList.remove('hidden');
    toast.classList.add('show');
    
    if (window.lucide) lucide.createIcons();
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => hideToast(), 3000);
}

export function hideToast() {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
}
