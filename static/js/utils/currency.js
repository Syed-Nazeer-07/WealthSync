export function formatCurrency(amount, symbol = '₹', locale = 'en-IN') {
    if (typeof amount !== 'number' || isNaN(amount)) return symbol + '0';
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: locale === 'en-IN' ? 'INR' : 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount).replace(/^(\D+)/, symbol);
}

export function getCurrencySymbol(currency = 'INR') {
    const symbols = {
        'INR': '₹',
        'USD': '$',
        'EUR': '€',
        'GBP': '£',
        'AED': 'د.إ',
        'SGD': 'S$'
    };
    return symbols[currency] || '$';
}
