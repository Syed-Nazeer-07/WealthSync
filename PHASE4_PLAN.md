# Phase 4 Plan: Flask Blueprints

## Current State Analysis

**Total Routes:** 58 routes in monolithic `app.py`

**Route Categories Identified:**
- Authentication & OAuth: 10 routes
- Main pages: 2 routes
- Profile: 2 routes
- Transactions: 4 routes
- Budgets: 4 routes
- Goals: 5 routes (including forecast)
- Investments: 4 routes
- Categories: 4 routes
- Roadmap: 4 routes
- Settings: 5 routes
- Analytics: 2 routes
- Export: 2 routes
- Danger Zone: 3 routes
- Utilities: 3 routes (health, favicon, debug)

---

## Proposed Blueprint Structure

```
finora/blueprints/
├── __init__.py          # Blueprint registration helper
├── main.py              # Main pages + utilities
├── auth.py              # Authentication & OAuth
├── profile.py           # User profile
├── transactions.py      # Transaction CRUD
├── budgets.py           # Budget CRUD
├── goals.py             # Goals CRUD + forecasting
├── investments.py       # Investment CRUD
├── categories.py        # Category management
├── roadmap.py           # Roadmap items
├── settings.py          # User settings
├── analytics.py         # Financial health & analytics
├── export.py            # Data export
└── danger.py            # Dangerous operations
```

---

## Blueprint Route Mapping

### 1. **main.py** (Main Blueprint)
**URL Prefix:** None (root level)

| Route | Method | Function | Notes |
|-------|--------|----------|-------|
| `/` | GET | `index()` | Dashboard page |
| `/onboarding` | GET | `onboarding_page()` | Onboarding flow |
| `/health` | GET | `health_check()` | Health check endpoint |
| `/favicon.ico` | GET | `favicon()` | Favicon serving |
| `/debug/oauth` | GET | `debug_oauth()` | OAuth debugging (dev only) |

**Dependencies:**
- No auth required for health/favicon
- Session check for index/onboarding

---

### 2. **auth.py** (Auth Blueprint)
**URL Prefix:** None (mixed `/login`, `/api/auth/*`, `/auth/*`)

| Route | Method | Function | Notes |
|-------|--------|----------|-------|
| `/login` | GET | `login_page()` | Login page |
| `/api/auth/signup` | POST | `signup()` | User registration |
| `/api/auth/login` | POST | `login()` | User login |
| `/api/auth/logout` | POST | `logout()` | User logout |
| `/api/auth/me` | GET | `me()` | Current user info |
| `/api/auth/forgot-password` | POST | `forgot_password()` | Request password reset |
| `/api/auth/reset-password` | POST | `reset_password()` | Reset password |
| `/api/auth/resend-verification` | POST | `resend_verification()` | Resend verification email |
| `/verify-email/<token>` | GET | `verify_email(token)` | Email verification |
| `/verify-pending` | GET | `verify_pending()` | Verification pending page |
| `/forgot-password` | GET | `forgot_password_page()` | Forgot password page |
| `/reset-password/<token>` | GET | `reset_password_page(token)` | Reset password page |
| `/auth/google` | GET | `google_login()` | Google OAuth initiation |
| `/auth/google/callback` | GET | `google_callback()` | Google OAuth callback |

**Dependencies:**
- `werkzeug.security` for password hashing
- `secrets` for token generation
- `datetime`, `timedelta` for expiry
- Services: `auth_service`, `email_service`, `category_service`
- Models: `User`, `Profile`, `Category`
- Extensions: `db`, `oauth`
- Global: `google` OAuth provider

---

### 3. **profile.py** (Profile Blueprint)
**URL Prefix:** `/api/profile`

| Route | Method | Function | Notes |
|-------|--------|----------|-------|
| `/` | GET | `get_profile()` | Get user profile |
| `/` | PUT | `update_profile()` | Update user profile |

**Dependencies:**
- Services: `profile_service`
- Models: `Profile`
- Auth: Login required

---

### 4. **transactions.py** (Transactions Blueprint)
**URL Prefix:** `/api/transactions`

| Route | Method | Function | Notes |
|-------|--------|----------|-------|
| `/` | GET | `get_transactions()` | List all transactions |
| `/` | POST | `create_transaction()` | Create transaction |
| `/<int:tx_id>` | PUT | `update_transaction(tx_id)` | Update transaction |
| `/<int:tx_id>` | DELETE | `delete_transaction(tx_id)` | Delete transaction |

**Dependencies:**
- Services: `transaction_service`
- Models: `Transaction`
- Auth: Login required

---

### 5. **budgets.py** (Budgets Blueprint)
**URL Prefix:** `/api/budgets`

| Route | Method | Function | Notes |
|-------|--------|----------|-------|
| `/` | GET | `get_budgets()` | List all budgets |
| `/` | POST | `create_budget()` | Create budget |
| `/<int:budget_id>` | PUT | `update_budget(budget_id)` | Update budget |
| `/<int:budget_id>` | DELETE | `delete_budget(budget_id)` | Delete budget |

**Dependencies:**
- Services: `budget_service`
- Models: `Budget`
- Auth: Login required

---

### 6. **goals.py** (Goals Blueprint)
**URL Prefix:** `/api/goals`

| Route | Method | Function | Notes |
|-------|--------|----------|-------|
| `/` | GET | `get_goals()` | List all goals |
| `/` | POST | `create_goal()` | Create goal |
| `/<int:goal_id>` | PUT | `update_goal(goal_id)` | Update goal |
| `/<int:goal_id>` | DELETE | `delete_goal(goal_id)` | Delete goal |
| `/forecast` | GET | `forecast_goals()` | Get goal forecasts |

**Dependencies:**
- Services: `goal_service`
- Models: `Goal`, `Transaction`
- Auth: Login required

---

### 7. **investments.py** (Investments Blueprint)
**URL Prefix:** `/api/investments`

| Route | Method | Function | Notes |
|-------|--------|----------|-------|
| `/` | GET | `get_investments()` | List all investments |
| `/` | POST | `create_investment()` | Create investment |
| `/<int:inv_id>` | PUT | `update_investment(inv_id)` | Update investment |
| `/<int:inv_id>` | DELETE | `delete_investment(inv_id)` | Delete investment |

**Dependencies:**
- Services: `investment_service`
- Models: `Investment`
- Auth: Login required

---

### 8. **categories.py** (Categories Blueprint)
**URL Prefix:** `/api/categories`

| Route | Method | Function | Notes |
|-------|--------|----------|-------|
| `/` | GET | `get_categories()` | List all categories |
| `/` | POST | `create_category()` | Create category |
| `/<int:cat_id>` | PUT | `update_category(cat_id)` | Update category |
| `/<int:cat_id>` | DELETE | `delete_category(cat_id)` | Delete category |

**Dependencies:**
- Services: `category_service`
- Models: `Category`, `Transaction`
- Auth: Login required

---

### 9. **roadmap.py** (Roadmap Blueprint)
**URL Prefix:** `/api/roadmap`

| Route | Method | Function | Notes |
|-------|--------|----------|-------|
| `/` | GET | `get_roadmap()` | List roadmap items |
| `/` | POST | `create_roadmap_item()` | Create roadmap item |
| `/<int:item_id>` | PUT | `update_roadmap_item(item_id)` | Update roadmap item |
| `/<int:item_id>` | DELETE | `delete_roadmap_item(item_id)` | Delete roadmap item |

**Dependencies:**
- Services: `roadmap_service`
- Models: `RoadmapItem`
- Auth: Login required

---

### 10. **settings.py** (Settings Blueprint)
**URL Prefix:** `/api/settings`

| Route | Method | Function | Notes |
|-------|--------|----------|-------|
| `/` | GET | `get_settings()` | Get user settings |
| `/` | PUT | `update_settings()` | Update user settings |
| `/update-name` | POST | `update_name()` | Update user name |
| `/change-password` | POST | `change_password()` | Change password |
| `/resend-verification` | POST | `resend_verification_settings()` | Resend verification |

**Dependencies:**
- Services: `settings_service`, `auth_service`, `email_service`
- Models: `UserSettings`, `User`
- Auth: Login required

---

### 11. **analytics.py** (Analytics Blueprint)
**URL Prefix:** `/api`

| Route | Method | Function | Notes |
|-------|--------|----------|-------|
| `/financial-health` | GET | `get_financial_health()` | Financial health score |
| `/net-worth-history` | GET | `net_worth_history()` | Net worth over time |

**Dependencies:**
- Services: `analytics_service`
- Models: `Transaction`, `Profile`, `Budget`, `Goal`, `Investment`
- Auth: Login required

---

### 12. **export.py** (Export Blueprint)
**URL Prefix:** `/api/export`

| Route | Method | Function | Notes |
|-------|--------|----------|-------|
| `/transactions` | GET | `export_transactions()` | Export transactions CSV |
| `/data` | GET | `export_data()` | Export all data JSON |

**Dependencies:**
- Models: All (User, Profile, Transaction, Budget, Goal, Investment)
- Libraries: `csv`, `io`, `json`
- Auth: Login required

---

### 13. **danger.py** (Danger Zone Blueprint)
**URL Prefix:** `/api/danger`

| Route | Method | Function | Notes |
|-------|--------|----------|-------|
| `/clear-transactions` | DELETE | `clear_transactions()` | Delete all transactions |
| `/clear-financial-data` | DELETE | `clear_financial_data()` | Delete all financial data |
| `/delete-account` | DELETE | `delete_account()` | Delete user account |

**Dependencies:**
- Models: All (Transaction, Budget, Goal, Investment, RoadmapItem, Profile, User)
- `werkzeug.security` for password verification
- Auth: Login required + password verification

---

## Blueprint Registration Strategy

### In `app.py`:

```python
from finora.blueprints import register_blueprints

app = Flask(__name__)
# ... configuration ...

# Register all blueprints
register_blueprints(app)

# ... rest of initialization ...
```

### In `finora/blueprints/__init__.py`:

```python
def register_blueprints(app):
    """Register all blueprints with the Flask application."""
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
    
    app.register_blueprint(main_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(transactions_bp)
    app.register_blueprint(budgets_bp)
    app.register_blueprint(goals_bp)
    app.register_blueprint(investments_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(roadmap_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(export_bp)
    app.register_blueprint(danger_bp)
```

---

## Blueprint Template Structure

Each blueprint follows this pattern:

```python
from flask import Blueprint, jsonify, request, session
from finora.extensions import db
from finora.models import SomeModel
from finora.services.some_service import some_function

# Create blueprint
blueprint_name_bp = Blueprint('blueprint_name', __name__)

@blueprint_name_bp.route('/path', methods=['GET'])
def route_function():
    # Route logic
    pass
```

---

## Shared Dependencies Across Blueprints

All blueprints will need access to:

**Core Flask:**
- `Blueprint` class
- `jsonify`, `request`, `session`, `redirect`, `url_for`, `render_template`

**Extensions:**
- `db` (database)
- `mail` (some blueprints)
- `oauth` (auth blueprint only)

**Models:**
- Imported as needed per blueprint

**Services:**
- Imported as needed per blueprint

**Utils (if Phase 3 completed):**
- Decorators: `@login_required`
- Helpers: `get_current_user_id()`, `error_response()`, `success_response()`
- Validators: `get_json_data()`, etc.

---

## Migration Steps

### Step 1: Create Blueprint Files
1. Create empty blueprint files with basic structure
2. Import necessary dependencies for each
3. Create Blueprint instances

### Step 2: Move Routes (One Blueprint at a Time)
1. Copy route functions from `app.py` to blueprint
2. Change `@app.route` to `@blueprint_bp.route`
3. Update imports in blueprint file
4. Keep original routes in `app.py` temporarily

### Step 3: Register Blueprints
1. Create `register_blueprints()` function
2. Call it in `app.py` after app creation
3. Test that both old and new routes work

### Step 4: Remove Original Routes
1. Once blueprint routes verified, remove from `app.py`
2. Clean up unused imports in `app.py`

### Step 5: Test Everything
1. Verify all 58 routes still work
2. Test authentication flows
3. Test OAuth
4. Test exports
5. Test danger operations

---

## URL Preservation Guarantee

**All URLs remain exactly the same:**

- `/login` → stays `/login`
- `/api/auth/signup` → stays `/api/auth/signup`
- `/api/transactions` → stays `/api/transactions`
- `/api/goals/forecast` → stays `/api/goals/forecast`
- etc.

**How:** Blueprint `url_prefix` matches the existing URL structure.

---

## Risk Assessment

### LOW RISK:
✅ **Blueprint registration** - Standard Flask pattern  
✅ **URL preservation** - Using correct `url_prefix`  
✅ **Route logic** - Exact copy, no changes  
✅ **Import statements** - All dependencies available  

### MEDIUM RISK:
⚠️ **OAuth configuration** - `google` provider needs to be accessible  
⚠️ **Session access** - Ensure `session` works in blueprints (it does by default)  
⚠️ **Template rendering** - `render_template()` works from blueprints  

### MITIGATION:
- OAuth provider will be passed or imported properly
- Test each blueprint individually
- Keep `app.py` routes until verified

### HIGH RISK:
❌ None - This is a standard Flask refactoring pattern

---

## Special Considerations

### 1. OAuth Provider (`google`)
Currently defined in `app.py`:
```python
google = oauth.register(...)
```

**Solution:** 
- Keep OAuth registration in `app.py` 
- Import `oauth` and register in auth blueprint if needed
- OR pass `oauth` instance to blueprint

### 2. Database Initialization
Currently in `app.py`:
```python
with app.app_context():
    db.create_all()
    # Demo data creation
```

**Solution:**
- Keep this in `app.py`
- Blueprints don't need this

### 3. Logging Setup
Currently in `app.py` initialization

**Solution:**
- Keep in `app.py`
- Blueprints use `current_app.logger`

### 4. Helper Functions
Currently in `app.py`:
```python
def current_user():
    ...

def login_required_json():
    ...
```

**Solution:**
- If Phase 3 completed: Already in `utils/helpers.py` and `utils/decorators.py`
- If not: Move to `utils/` or keep in `app.py` and import

---

## What Stays in `app.py`

After migration, `app.py` will contain:

1. **Imports**
2. **Flask app creation**
3. **Configuration loading**
4. **Extension initialization** (db, mail, migrate, oauth)
5. **OAuth provider registration**
6. **Logging setup**
7. **Blueprint registration** (one function call)
8. **Database initialization** (with app context)
9. **Main execution** (`if __name__ == "__main__"`)

**Estimated size:** ~100-150 lines (down from ~1000+)

---

## Testing Checklist

After migration, verify:

- [ ] All 58 routes respond
- [ ] Authentication works
- [ ] Signup flow works
- [ ] Login flow works
- [ ] Logout works
- [ ] Email verification works
- [ ] Password reset works
- [ ] Google OAuth works
- [ ] Profile CRUD works
- [ ] Transaction CRUD works
- [ ] Budget CRUD works
- [ ] Goal CRUD works
- [ ] Investment CRUD works
- [ ] Category CRUD works
- [ ] Settings work
- [ ] Analytics endpoints work
- [ ] Export works
- [ ] Danger zone works (in test environment!)
- [ ] Health check works
- [ ] Static files (favicon) work

---

## Expected Outcome

**Before:**
- 1 monolithic file: `app.py` (~1000+ lines)
- 58 routes mixed together
- Hard to navigate and maintain

**After:**
- 1 initialization file: `app.py` (~150 lines)
- 13 focused blueprint files (~50-200 lines each)
- Clear organization by feature
- Easy to find and modify routes
- Better separation of concerns

**Functionality:**
- ✅ Zero changes to routes
- ✅ Zero changes to URLs
- ✅ Zero changes to authentication
- ✅ Zero changes to API responses
- ✅ Zero changes to database
- ✅ Zero changes to frontend
- ✅ Exact same behavior

---

## Summary

This plan organizes 58 routes into 13 logical blueprints without changing any functionality. Each blueprint is self-contained with its dependencies, and all URLs are preserved exactly. The migration can be done incrementally, testing each blueprint before removing the original routes from `app.py`.

**Ready for approval to proceed with implementation.**
