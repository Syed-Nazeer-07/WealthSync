# Critical UI/UX Fixes for WealthSync

## Files to Modify

### 1. `/static/js/app.js` - Modal Keyboard Handling & Accessibility

**Changes:**
- Add ESC key handler to modal (currently only in sidebar)
- Add backdrop click handler to modal
- Add `aria-pressed` to toggle buttons (Expense/Income)
- Add `aria-label` to modal close button
- Add disabled state styling to buttons
- Fix dark mode contrast for form labels
- Add `aria-label` attributes to icon buttons

### 2. `/templates/login.html` - Form Labels & Accessibility

**Changes:**
- Associate labels with inputs using `for` attribute
- Add `aria-label` to inputs without labels
- Improve password strength meter
- Fix dark mode contrast for labels

### 3. `/static/css/style.css` - Disabled Button States & Styling

**Changes:**
- Add disabled button styling with opacity and cursor
- Standardize button hover states
- Fix dark mode text contrast for form labels

### 4. `/templates/index.html` - Accessibility & Semantic HTML

**Changes:**
- Add `aria-label` to theme toggle button
- Add `aria-label` to logout button
- Improve sidebar menu semantic HTML
- Add focus visible states to buttons

### 5. `/static/js/dashboard.js` - Empty States & Accessibility

**Changes:**
- Add `aria-label` to SVG health score
- Improve empty state messaging consistency
- Add proper focus styles

## Implementation Order

1. Modal keyboard handling (ESC key)
2. Modal backdrop click handling
3. Toggle button accessibility (aria-pressed)
4. Form label associations
5. Dark mode contrast fixes
6. Disabled button states
7. Icon button aria-labels
8. Empty state improvements
