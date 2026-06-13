# Phase 4: Blueprint Organization - Quick Reference

## Current State
**58 routes** in one monolithic `app.py` file (~1000+ lines)

---

## Proposed Organization

```
finora/blueprints/
├── main.py          →  5 routes  (index, onboarding, health, favicon, debug)
├── auth.py          → 14 routes  (login, signup, OAuth, verification, password reset)
├── profile.py       →  2 routes  (get, update profile)
├── transactions.py  →  4 routes  (CRUD)
├── budgets.py       →  4 routes  (CRUD)
├── goals.py         →  5 routes  (CRUD + forecast)
├── investments.py   →  4 routes  (CRUD)
├── categories.py    →  4 routes  (CRUD)
├── roadmap.py       →  4 routes  (CRUD)
├── settings.py      →  5 routes  (get, update, name, password, verification)
├── analytics.py     →  2 routes  (financial-health, net-worth-history)
├── export.py        →  2 routes  (transactions CSV, data JSON)
└── danger.py        →  3 routes  (clear transactions, clear data, delete account)
```

**Total: 58 routes organized into 13 blueprints**

---

## Blueprint Details

### 1. Main Blueprint (`main.py`)
**No URL prefix** - Root level routes
```
GET  /                    → Dashboard
GET  /onboarding          → Onboarding page
GET  /health              → Health check
GET  /favicon.ico         → Favicon
GET  /debug/oauth         → OAuth debug info
```

### 2. Auth Blueprint (`auth.py`)
**No URL prefix** - Mixed paths
```
# Pages
GET  /login                              → Login page
GET  /forgot-password                    → Forgot password page
GET  /reset-password/<token>             → Reset password page
GET  /verify-pending                     → Verification pending page
GET  /verify-email/<token>               → Email verification

# API Endpoints
POST /api/auth/signup                    → Register
POST /api/auth/login                     → Login
POST /api/auth/logout                    → Logout
GET  /api/auth/me                        → Current user
POST /api/auth/forgot-password           → Request reset
POST /api/auth/reset-password            → Reset password
POST /api/auth/resend-verification       → Resend email

# OAuth
GET  /auth/google                        → Google OAuth start
GET  /auth/google/callback               → Google OAuth callback
```

### 3. Profile Blueprint (`profile.py`)
**URL prefix:** `/api/profile`
```
GET  /                    → Get profile
PUT  /                    → Update profile
```

### 4. Transactions Blueprint (`transactions.py`)
**URL prefix:** `/api/transactions`
```
GET    /                  → List transactions
POST   /                  → Create transaction
PUT    /<int:tx_id>       → Update transaction
DELETE /<int:tx_id>       → Delete transaction
```

### 5. Budgets Blueprint (`budgets.py`)
**URL prefix:** `/api/budgets`
```
GET    /                      → List budgets
POST   /                      → Create budget
PUT    /<int:budget_id>       → Update budget
DELETE /<int:budget_id>       → Delete budget
```

### 6. Goals Blueprint (`goals.py`)
**URL prefix:** `/api/goals`
```
GET    /                  → List goals
POST   /                  → Create goal
PUT    /<int:goal_id>     → Update goal
DELETE /<int:goal_id>     → Delete goal
GET    /forecast          → Goal forecasts
```

### 7. Investments Blueprint (`investments.py`)
**URL prefix:** `/api/investments`
```
GET    /                  → List investments
POST   /                  → Create investment
PUT    /<int:inv_id>      → Update investment
DELETE /<int:inv_id>      → Delete investment
```

### 8. Categories Blueprint (`categories.py`)
**URL prefix:** `/api/categories`
```
GET    /                  → List categories
POST   /                  → Create category
PUT    /<int:cat_id>      → Update category
DELETE /<int:cat_id>      → Delete category
```

### 9. Roadmap Blueprint (`roadmap.py`)
**URL prefix:** `/api/roadmap`
```
GET    /                  → List roadmap items
POST   /                  → Create item
PUT    /<int:item_id>     → Update item
DELETE /<int:item_id>     → Delete item
```

### 10. Settings Blueprint (`settings.py`)
**URL prefix:** `/api/settings`
```
GET  /                    → Get settings
PUT  /                    → Update settings
POST /update-name         → Update name
POST /change-password     → Change password
POST /resend-verification → Resend verification
```

### 11. Analytics Blueprint (`analytics.py`)
**URL prefix:** `/api`
```
GET  /financial-health    → Financial health score
GET  /net-worth-history   → Net worth over time
```

### 12. Export Blueprint (`export.py`)
**URL prefix:** `/api/export`
```
GET  /transactions        → Export transactions (CSV)
GET  /data                → Export all data (JSON)
```

### 13. Danger Zone Blueprint (`danger.py`)
**URL prefix:** `/api/danger`
```
DELETE /clear-transactions       → Delete all transactions
DELETE /clear-financial-data     → Delete all financial data
DELETE /delete-account           → Delete user account
```

---

## Registration Order

All blueprints registered in `finora/blueprints/__init__.py`:

```python
def register_blueprints(app):
    from .main import main_bp
    from .auth import auth_bp
    from .profile import profile_bp
    from .transactions import transactions_bp
    from .budgets import budgets_bp
    from .goals import goals_bp
    from .investments import investments_bp
    from .categories import categories_bp
    from .roadmap import roadmap_bp
    from .settings import settings_bp
    from .analytics import analytics_bp
    from .export import export_bp
    from .danger import danger_bp
    
    # Register all blueprints
    for bp in [main_bp, auth_bp, profile_bp, transactions_bp, budgets_bp,
               goals_bp, investments_bp, categories_bp, roadmap_bp,
               settings_bp, analytics_bp, export_bp, danger_bp]:
        app.register_blueprint(bp)
```

---

## URL Preservation Examples

| Old Route | Blueprint | New Route | URL |
|-----------|-----------|-----------|-----|
| `@app.route('/login')` | auth.py | `@auth_bp.route('/login')` | `/login` ✓ |
| `@app.route('/api/transactions')` | transactions.py | `@transactions_bp.route('/')` | `/api/transactions` ✓ |
| `@app.route('/api/goals/forecast')` | goals.py | `@goals_bp.route('/forecast')` | `/api/goals/forecast` ✓ |
| `@app.route('/api/export/data')` | export.py | `@export_bp.route('/data')` | `/api/export/data` ✓ |

**All URLs remain exactly the same!**

---

## Dependencies by Blueprint

### Common Dependencies (All Blueprints)
```python
from flask import Blueprint, jsonify, request, session
from finora.extensions import db
```

### Specific Dependencies

**auth.py:**
- `werkzeug.security`, `secrets`, `datetime`
- Extensions: `oauth`
- Services: `auth_service`, `email_service`, `category_service`
- Models: `User`, `Profile`, `Category`

**transactions.py, budgets.py, goals.py, investments.py, categories.py, roadmap.py:**
- Services: Respective service modules
- Models: Respective model classes

**settings.py:**
- `werkzeug.security` (password check)
- Services: `settings_service`, `auth_service`, `email_service`
- Models: `UserSettings`, `User`

**analytics.py:**
- Services: `analytics_service`
- Models: `Transaction`, `Profile`, `Budget`, `Goal`, `Investment`

**export.py:**
- Libraries: `csv`, `io`, `json`
- Models: All models

**danger.py:**
- `werkzeug.security` (password verification)
- Models: All models

---

## What Stays in `app.py`

After migration (~150 lines total):

1. Flask app creation
2. Configuration loading
3. Extension initialization (db, mail, migrate, oauth)
4. OAuth provider registration
5. Logging setup
6. **Blueprint registration** ← NEW
7. Database initialization
8. Demo data seeding
9. Main execution block

---

## Migration Safety

✅ **All URLs preserved** - Correct `url_prefix` usage  
✅ **All routes copied** - Exact same function logic  
✅ **All auth preserved** - Same decorators/checks  
✅ **All responses preserved** - Same JSON/HTML output  
✅ **All imports available** - Dependencies accessible  
✅ **Incremental migration** - Test each blueprint  
✅ **Rollback possible** - Keep old routes until verified  

---

## Testing Strategy

1. Create blueprint files
2. Register blueprints
3. Test each blueprint routes work
4. Verify authentication
5. Test OAuth flow
6. Remove old routes from `app.py`
7. Final verification

---

## Result

**Before:** 1000+ line monolithic `app.py`  
**After:** 150-line `app.py` + 13 organized blueprint files

**Zero functional changes. Zero URL changes. Zero API changes.**

Ready for implementation approval.
