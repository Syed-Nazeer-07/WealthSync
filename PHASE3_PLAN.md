# Phase 3 Plan: Utilities & Decorators

## Analysis: Duplicated Code Patterns

### 1. AUTHENTICATION CHECKS (39 occurrences)
**Current Pattern:**
```python
@app.route("/api/something", methods=["GET"])
def some_route():
    err = login_required_json()
    if err: return err
    # ... rest of route
```

**Found in 39 routes:**
- All `/api/profile` routes
- All `/api/transactions` routes
- All `/api/budgets` routes
- All `/api/goals` routes
- All `/api/investments` routes
- All `/api/roadmap` routes
- All `/api/categories` routes
- All `/api/settings` routes
- `/api/financial-health`
- `/api/net-worth-history`
- `/api/export/*` routes
- `/api/danger/*` routes

### 2. USER SESSION ACCESS (6 occurrences)
**Current Pattern:**
```python
user = current_user()
```

**Found in:**
- `/api/auth/me`
- `/api/settings/update-name`
- `/api/settings/change-password`
- `/api/settings/resend-verification`
- `/api/danger/delete-account`
- Multiple other locations

### 3. SESSION USER_ID ACCESS (80+ occurrences)
**Current Pattern:**
```python
session["user_id"]
```

**Used in almost every authenticated route for:**
- Database queries: `Transaction.query.filter_by(user_id=session["user_id"])`
- Object creation: `Transaction(user_id=session["user_id"], ...)`
- Settings lookup: `get_or_create_settings(session["user_id"], ...)`

### 4. ERROR RESPONSES (45+ occurrences)
**Current Patterns:**
```python
return jsonify({"error": "Some message"}), 400
return jsonify({"error": "Not found"}), 404
return jsonify({"error": "Unauthorized"}), 401
```

### 5. SUCCESS RESPONSES (14 occurrences)
**Current Pattern:**
```python
return jsonify({"success": True})
```

### 6. STRING TRUNCATION (16+ occurrences)
**Current Patterns:**
```python
str(data["description"])[:100]
str(data["category"])[:50]
str(data["name"])[:200]
str(data["title"])[:100]
str(data["icon"])[:50]
```

### 7. DATA EXTRACTION (100+ occurrences)
**Current Patterns:**
```python
data = request.get_json(silent=True) or {}
(data.get("name") or "").strip()
(data.get("email") or "").strip().lower()
```

### 8. MAGIC STRINGS
**Transaction types:**
- `"income"` (15+ occurrences)
- `"expense"` (20+ occurrences)

**Category types:**
- `"income"` / `"expense"` validation

**Session keys:**
- `"user_id"` (80+ occurrences)

**Response keys:**
- `"error"`, `"success"`, `"message"`

**Account modes:**
- `"income"`, `"cashflow"`

### 9. COMMON VALIDATIONS
**Found in multiple routes:**
```python
if not data.get("name") or not data.get("target"):
    return jsonify({"error": "name and target are required"}), 400

if not name or len(name) > 50:
    return jsonify({"error": "Name must be 1-50 characters"}), 400
```

---

## Proposed Structure

```
finora/utils/
├── __init__.py
├── decorators.py      # Authentication decorators
├── helpers.py         # Generic helper functions
├── validators.py      # Request validation utilities
└── constants.py       # Magic strings and enums
```

---

## 1. decorators.py

### Functions to Create:

#### `@login_required`
**Purpose:** Replace the `err = login_required_json(); if err: return err` pattern

**Current code (39 times):**
```python
@app.route("/api/something", methods=["GET"])
def some_route():
    err = login_required_json()
    if err: return err
    # route logic
```

**New code:**
```python
@app.route("/api/something", methods=["GET"])
@login_required
def some_route():
    # route logic
```

**Implementation:**
```python
from functools import wraps
from flask import session, jsonify

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function
```

**Why it's safe:**
- Exact same logic, just moved into a decorator
- No changes to authentication behavior
- No changes to response format
- Decorator runs before the route function

---

## 2. helpers.py

### Functions to Create:

#### `get_current_user_id() -> int`
**Purpose:** Replace `session["user_id"]` access

**Current code (80+ times):**
```python
uid = session["user_id"]
Transaction.query.filter_by(user_id=session["user_id"])
```

**New code:**
```python
uid = get_current_user_id()
Transaction.query.filter_by(user_id=get_current_user_id())
```

**Implementation:**
```python
from flask import session

def get_current_user_id():
    """Get current user ID from session. Assumes user is authenticated."""
    return session["user_id"]
```

**Why it's safe:**
- Direct wrapper around `session["user_id"]`
- Used only in authenticated routes (after `@login_required`)
- No logic changes

#### `get_current_user() -> User`
**Purpose:** Centralize user lookup logic

**Current code:**
```python
def current_user():
    uid = session.get("user_id")
    return User.query.get(uid) if uid else None
```

**New location:** Move to `helpers.py`, keep exact same logic

**Why it's safe:**
- Same function, just moved location
- No logic changes

#### `truncate_string(s: str, max_length: int) -> str`
**Purpose:** Replace repeated string truncation

**Current code (16+ times):**
```python
str(data["description"])[:100]
str(data["category"])[:50]
```

**New code:**
```python
truncate_string(data["description"], 100)
truncate_string(data["category"], 50)
```

**Implementation:**
```python
def truncate_string(s, max_length):
    """Truncate string to max_length characters."""
    return str(s)[:max_length] if s else ""
```

**Why it's safe:**
- Exact same behavior: `str(x)[:n]`
- No logic changes

#### `success_response(data=None)`
**Purpose:** Standardize success responses

**Current code (14 times):**
```python
return jsonify({"success": True})
return jsonify({"success": True, "name": user.name})
```

**New code:**
```python
return success_response()
return success_response({"name": user.name})
```

**Implementation:**
```python
from flask import jsonify

def success_response(data=None):
    """Return standardized success response."""
    response = {"success": True}
    if data:
        response.update(data)
    return jsonify(response)
```

**Why it's safe:**
- Produces identical JSON output
- Optional data parameter preserves all current behaviors

#### `error_response(message: str, status_code: int = 400)`
**Purpose:** Standardize error responses

**Current code (45+ times):**
```python
return jsonify({"error": "Some message"}), 400
return jsonify({"error": "Not found"}), 404
```

**New code:**
```python
return error_response("Some message", 400)
return error_response("Not found", 404)
```

**Implementation:**
```python
from flask import jsonify

def error_response(message, status_code=400):
    """Return standardized error response."""
    return jsonify({"error": message}), status_code
```

**Why it's safe:**
- Produces identical JSON output
- Same status codes

---

## 3. validators.py

### Functions to Create:

#### `get_json_data()`
**Purpose:** Replace `request.get_json(silent=True) or {}`

**Current code (60+ times):**
```python
data = request.get_json(silent=True) or {}
```

**New code:**
```python
data = get_json_data()
```

**Implementation:**
```python
from flask import request

def get_json_data():
    """Get JSON data from request, returning empty dict if none."""
    return request.get_json(silent=True) or {}
```

**Why it's safe:**
- Exact same logic
- No behavior changes

#### `strip_and_lower(value: str) -> str`
**Purpose:** Common email/string processing

**Current code:**
```python
(data.get("email") or "").strip().lower()
```

**New code:**
```python
strip_and_lower(data.get("email"))
```

**Implementation:**
```python
def strip_and_lower(value):
    """Strip whitespace and convert to lowercase."""
    return (value or "").strip().lower()
```

**Why it's safe:**
- Exact same operations
- Handles None/empty strings same way

#### `validate_required_fields(data: dict, fields: list) -> tuple`
**Purpose:** Standardize required field validation

**Current code:**
```python
if not data.get("name") or not data.get("target"):
    return jsonify({"error": "name and target are required"}), 400
```

**New code:**
```python
error = validate_required_fields(data, ["name", "target"])
if error:
    return error
```

**Implementation:**
```python
def validate_required_fields(data, fields):
    """Validate required fields are present. Returns error response or None."""
    missing = [f for f in fields if not data.get(f)]
    if missing:
        return error_response(f"Required fields: {', '.join(missing)}", 400)
    return None
```

**Why it's safe:**
- Same validation logic
- Returns same error format
- Only used where field validation already exists

---

## 4. constants.py

### Constants to Extract:

```python
# Transaction types
TRANSACTION_TYPE_INCOME = "income"
TRANSACTION_TYPE_EXPENSE = "expense"
TRANSACTION_TYPES = (TRANSACTION_TYPE_INCOME, TRANSACTION_TYPE_EXPENSE)

# Category types
CATEGORY_TYPE_INCOME = "income"
CATEGORY_TYPE_EXPENSE = "expense"
CATEGORY_TYPES = (CATEGORY_TYPE_INCOME, CATEGORY_TYPE_EXPENSE)

# Account modes
ACCOUNT_MODE_INCOME = "income"
ACCOUNT_MODE_CASHFLOW = "cashflow"
ACCOUNT_MODES = (ACCOUNT_MODE_INCOME, ACCOUNT_MODE_CASHFLOW)

# Session keys
SESSION_KEY_USER_ID = "user_id"

# Default values
DEFAULT_EMOJI = "📦"
DEFAULT_COLOR = "#3b82f6"

# String length limits
MAX_LENGTH_DESCRIPTION = 100
MAX_LENGTH_TITLE = 100
MAX_LENGTH_NAME = 100
MAX_LENGTH_CATEGORY = 50
MAX_LENGTH_ICON = 50
MAX_LENGTH_EMOJI = 10
MAX_LENGTH_COLOR = 7
MAX_LENGTH_GOAL = 200

# HTTP Status codes (for reference)
HTTP_OK = 200
HTTP_CREATED = 201
HTTP_BAD_REQUEST = 400
HTTP_UNAUTHORIZED = 401
HTTP_FORBIDDEN = 403
HTTP_NOT_FOUND = 404
HTTP_CONFLICT = 409
HTTP_SERVER_ERROR = 500
```

**Why it's safe:**
- String constants are exact replacements
- No logic changes
- Easier to maintain and update
- Type-safe with editor support

---

## Migration Strategy

### Step 1: Create utility files
1. Create `finora/utils/` directory
2. Create all 4 files with implementations
3. Verify imports work

### Step 2: Update app.py imports
1. Import decorators, helpers, validators, constants
2. Keep all existing route functions unchanged initially

### Step 3: Apply decorator pattern (39 routes)
1. Replace `err = login_required_json(); if err: return err` with `@login_required`
2. Remove the `login_required_json()` function from app.py
3. Test authentication still works

### Step 4: Replace helper functions (incremental)
1. Replace `session["user_id"]` → `get_current_user_id()` where safe
2. Replace string truncation patterns
3. Replace response helpers
4. Move `current_user()` to helpers

### Step 5: Replace validators
1. Replace `request.get_json(silent=True) or {}` patterns
2. Replace field validation patterns where appropriate

### Step 6: Replace constants
1. Replace hardcoded strings with constants
2. Focus on `"income"`, `"expense"`, `"user_id"`

### Step 7: Verify
1. Run syntax check
2. Start application
3. Test key endpoints

---

## Changes NOT Included

**Will NOT be changed:**
- Route definitions or URLs
- API response structures (beyond using helpers)
- Authentication logic (only packaging)
- Database queries or models
- Service layer functions
- Frontend code
- Configuration

---

## Risk Assessment

### LOW RISK (Safe to proceed):
- `@login_required` decorator - exact same logic
- `get_current_user_id()` - direct wrapper
- `truncate_string()` - exact same behavior
- Response helpers - produce identical JSON
- Constants - string replacements

### MEDIUM RISK (Requires testing):
- `get_json_data()` - used 60+ times, needs verification
- Field validators - ensure error messages match

### HIGH RISK (Not doing in Phase 3):
- Changing authentication mechanisms
- Modifying database queries
- Altering API contracts

---

## Expected Outcome

**Code reduction:**
- ~100 lines removed from app.py
- ~39 authentication check removals
- ~60 duplicate data extraction calls simplified
- ~45 error responses standardized
- ~80 session access calls centralized

**Improved maintainability:**
- Single source of truth for magic strings
- Easier to modify authentication logic
- Consistent error responses
- DRY principle applied

**No functional changes:**
- All routes behave identically
- All API responses unchanged
- All authentication preserved
- All validation preserved
