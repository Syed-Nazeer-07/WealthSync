from flask import Flask, render_template, jsonify, request, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
from authlib.integrations.flask_client import OAuth
from datetime import date, datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.middleware.proxy_fix import ProxyFix
from dotenv import load_dotenv
import os, secrets

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

app = Flask(__name__)
app.wsgi_app = ProxyFix(
    app.wsgi_app,
    x_for=1,
    x_proto=1,
    x_host=1,
    x_port=1
)

database_url = os.environ.get("DATABASE_URL")
if not database_url:
    if os.environ.get("FLASK_ENV") == "production":
        raise RuntimeError("DATABASE_URL environment variable is required in production")
    database_url = "sqlite:///wealthsync.db"
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_pre_ping": True,
    "pool_recycle": 3600,
    "echo": False
}
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"]   = os.environ.get("PREFERRED_URL_SCHEME", "http") == "https"
app.config["PREFERRED_URL_SCHEME"]    = os.environ.get("PREFERRED_URL_SCHEME", "http")
app.config["PROPAGATE_EXCEPTIONS"] = True

import logging
from logging.handlers import RotatingFileHandler
if not app.debug:
    if not os.path.exists("logs"):
        os.mkdir("logs")
    file_handler = RotatingFileHandler("logs/finora.log", maxBytes=10240000, backupCount=10)
    file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s: %(message)s"))
    file_handler.setLevel(logging.INFO)
    app.logger.addHandler(file_handler)
    app.logger.setLevel(logging.INFO)
    
    # Log database configuration on startup
    db_uri = app.config["SQLALCHEMY_DATABASE_URI"]
    if db_uri.startswith("postgresql://"):
        # Extract and mask host
        parts = db_uri.split('@')
        if len(parts) == 2:
            host_db = parts[1].split('/')[0]  # host:port
            host = host_db.split(':')[0]
            masked_host = f"{host[:20]}..." if len(host) > 20 else host
            app.logger.info(f"✓ Using PostgreSQL: {masked_host}")
        else:
            app.logger.info("✓ Using PostgreSQL: (configured)")
    elif db_uri.startswith("sqlite:///"):
        app.logger.error(f"⚠ CRITICAL: Using SQLite: {db_uri} - DATA WILL BE LOST ON DEPLOYMENT!")
        if os.environ.get("FLASK_ENV") == "production":
            raise RuntimeError("SQLite is not allowed in production. Configure DATABASE_URL.")
    else:
        app.logger.info(f"Using database: {db_uri.split(':')[0]}")
    app.logger.info("Finora startup")

app.config["MAIL_SERVER"]   = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
app.config["MAIL_PORT"]     = int(os.environ.get("MAIL_PORT", 587))
app.config["MAIL_USE_TLS"]  = True
app.config["MAIL_USERNAME"] = os.environ.get("MAIL_USERNAME")
app.config["MAIL_PASSWORD"] = os.environ.get("MAIL_PASSWORD")
app.config["MAIL_DEFAULT_SENDER"] = os.environ.get("MAIL_DEFAULT_SENDER", os.environ.get("MAIL_USERNAME"))

db = SQLAlchemy(app)
mail = Mail(app)

from flask_migrate import Migrate
migrate = Migrate(app, db)

oauth = OAuth(app)
google = oauth.register(
    name="google",
    client_id=os.environ.get("GOOGLE_CLIENT_ID"),
    client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
    token_url="https://oauth2.googleapis.com/token",
    client_kwargs={"scope": "openid email profile"},
)



class User(db.Model):
    id            = db.Column(db.Integer, primary_key=True)
    name          = db.Column(db.String(100), nullable=False)
    email         = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=True)
    google_id     = db.Column(db.String(128), nullable=True, index=True)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)
    email_verified            = db.Column(db.Boolean, default=False, nullable=False)
    email_verification_token  = db.Column(db.String(100), nullable=True)
    email_verification_expires = db.Column(db.DateTime, nullable=True)
    password_reset_token      = db.Column(db.String(100), nullable=True)
    password_reset_expires    = db.Column(db.DateTime, nullable=True)

    profile      = db.relationship("Profile",     back_populates="user", uselist=False, cascade="all, delete-orphan")
    transactions = db.relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    budgets       = db.relationship("Budget",       back_populates="user", cascade="all, delete-orphan")
    goals         = db.relationship("Goal",         back_populates="user", cascade="all, delete-orphan")
    investments   = db.relationship("Investment",   back_populates="user", cascade="all, delete-orphan")
    roadmap_items = db.relationship("RoadmapItem",  back_populates="user", cascade="all, delete-orphan")
    settings      = db.relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    categories    = db.relationship("Category",     back_populates="user", cascade="all, delete-orphan")


class Profile(db.Model):
    id                   = db.Column(db.Integer, primary_key=True)
    user_id              = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, unique=True)
    monthly_income       = db.Column(db.Float, default=0)
    current_savings      = db.Column(db.Float, default=0)
    current_investments  = db.Column(db.Float, default=0)
    monthly_expenses     = db.Column(db.Float, default=0)
    financial_goal       = db.Column(db.String(200), default="")
    account_mode         = db.Column(db.String(20), default="income", nullable=False)
    onboarding_completed = db.Column(db.Boolean, default=False)
    tutorial_completed   = db.Column(db.Boolean, default=False)

    user = db.relationship("User", back_populates="profile")


class Transaction(db.Model):
    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    description = db.Column(db.String(100), nullable=False)
    amount      = db.Column(db.Float, nullable=False)
    category    = db.Column(db.String(50), nullable=False)
    type        = db.Column(db.String(10), nullable=False, default="expense")
    date        = db.Column(db.String(10), nullable=False, default=str(date.today()))

    user = db.relationship("User", back_populates="transactions")


class Budget(db.Model):
    id           = db.Column(db.Integer, primary_key=True)
    user_id      = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    category     = db.Column(db.String(50), nullable=False)
    limit_amount = db.Column(db.Float, nullable=False)
    created_at   = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", back_populates="budgets")


class Goal(db.Model):
    id             = db.Column(db.Integer, primary_key=True)
    user_id        = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    title          = db.Column(db.String(100), nullable=False)
    target_amount  = db.Column(db.Float, nullable=False)
    current_amount = db.Column(db.Float, default=0)
    monthly_contribution = db.Column(db.Float, default=0)
    target_date    = db.Column(db.String(10), nullable=True)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", back_populates="goals")


class Investment(db.Model):
    id            = db.Column(db.Integer, primary_key=True)
    user_id       = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    symbol        = db.Column(db.String(100), nullable=False)
    asset_type    = db.Column(db.String(50), nullable=False)
    quantity      = db.Column(db.Float, nullable=False)
    average_cost  = db.Column(db.Float, nullable=False)
    current_value = db.Column(db.Float, nullable=False)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", back_populates="investments")


class RoadmapItem(db.Model):
    __tablename__ = "roadmap_item"
    id       = db.Column(db.Integer, primary_key=True)
    user_id  = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    title    = db.Column(db.String(100), nullable=False)
    icon     = db.Column(db.String(50), nullable=False, default="target")
    status   = db.Column(db.String(20), nullable=False, default="pending")
    position = db.Column(db.Integer, nullable=False, default=0)

    user = db.relationship("User", back_populates="roadmap_items")


class UserSettings(db.Model):
    __tablename__ = "user_settings"
    id                    = db.Column(db.Integer, primary_key=True)
    user_id               = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, unique=True)
    theme                 = db.Column(db.String(10),  default="light")
    currency              = db.Column(db.String(10),  default="INR")
    currency_symbol       = db.Column(db.String(5),   default="₹")
    currency_locale       = db.Column(db.String(10),  default="en-IN")
    show_greeting         = db.Column(db.Boolean,     default=True)
    sidebar_collapsed     = db.Column(db.Boolean,     default=False)
    timezone              = db.Column(db.String(50),  default="UTC")

    user = db.relationship("User", back_populates="settings")


class Category(db.Model):
    __tablename__ = "category"
    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    name        = db.Column(db.String(50), nullable=False)
    emoji       = db.Column(db.String(10), nullable=False, default="📦")
    color       = db.Column(db.String(7), nullable=False, default="#3b82f6")
    category_type = db.Column(db.String(10), nullable=False, default="expense")
    is_default  = db.Column(db.Boolean, default=False, nullable=False)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('user_id', 'name', 'category_type', name='_user_category_uc'),)

    user = db.relationship("User", back_populates="categories")



with app.app_context():
    db.create_all()

    if User.query.count() == 0:
        demo = User(
            name="Nazeer",
            email="nazeer@wealthsync.app",
            password_hash=generate_password_hash("changeme"),
        )
        db.session.add(demo)
        db.session.flush()

        db.session.add(Profile(user_id=demo.id))

        # Expense categories
        expense_cats = [
            ("Food & Dining", "🍔"), ("Groceries", "🛒"), ("Transportation", "🚗"),
            ("Fuel", "⛽"), ("Housing", "🏠"), ("Rent", "🏘️"), ("Utilities", "💡"),
            ("Internet & Mobile", "📱"), ("Shopping", "🛍️"), ("Entertainment", "🍿"),
            ("Healthcare", "🏥"), ("Education", "📚"), ("Insurance", "🛡️"),
            ("Debt Payments", "💳"), ("Subscriptions", "📺"), ("Gifts & Donations", "🎁"),
            ("Travel", "✈️"), ("Other Expense", "📦")
        ]
        for name, emoji in expense_cats:
            db.session.add(Category(user_id=demo.id, name=name, emoji=emoji, category_type="expense", is_default=True))
        
        # Income categories
        income_cats = [
            ("Salary", "💵"), ("Pocket Money", "💸"), ("Freelance", "🚀"),
            ("Business Income", "💼"), ("Scholarship", "🎓"), ("Allowance", "👛"),
            ("Internship", "🧑‍💼"), ("Gift Received", "🎁"), ("Interest Income", "🏦"),
            ("Investment Returns", "📊"), ("Refund", "↩️"), ("Bonus", "🎉"),
            ("Side Hustle", "⚡"), ("Other Income", "📦")
        ]
        for name, emoji in income_cats:
            db.session.add(Category(user_id=demo.id, name=name, emoji=emoji, category_type="income", is_default=True))

        if Transaction.query.count() == 0:
            db.session.add_all([
                Transaction(user_id=demo.id, description="TechCorp Salary",     amount=150000, category="Salary",       type="income",  date="2026-06-05"),
                Transaction(user_id=demo.id, description="Amazon Purchase",      amount=12000,  category="Shopping",      type="expense", date="2026-06-08"),
                Transaction(user_id=demo.id, description="Zomato Delivery",      amount=850,    category="Food & Dining", type="expense", date="2026-06-03"),
                Transaction(user_id=demo.id, description="Apartment Rent",       amount=25000,  category="Housing",       type="expense", date="2026-06-01"),
                Transaction(user_id=demo.id, description="Netflix Subscription", amount=649,    category="Entertainment", type="expense", date="2026-05-28"),
                Transaction(user_id=demo.id, description="Uber Rides",           amount=1240,   category="Transportation",type="expense", date="2026-05-25"),
            ])
        else:
            Transaction.query.filter_by(user_id=None).update({"user_id": demo.id})

        db.session.commit()



def current_user():
    uid = session.get("user_id")
    return User.query.get(uid) if uid else None

def login_required_json():
    """Returns a 401 JSON response if not logged in, else None."""
    if not session.get("user_id"):
        return jsonify({"error": "Unauthorized"}), 401
    return None

def _tx_dict(t):
    return {"id": t.id, "description": t.description, "amount": t.amount,
            "category": t.category, "type": t.type, "date": t.date}

def _validate_tx(data):
    required = ["description", "amount", "category", "type", "date"]
    missing = [f for f in required if not data.get(f) and data.get(f) != 0]
    if missing:
        return None, (jsonify({"error": f"Missing fields: {', '.join(missing)}"}), 400)
    if data["type"] not in ("income", "expense"):
        return None, (jsonify({"error": "type must be 'income' or 'expense'"}), 400)
    try:
        return float(data["amount"]), None
    except (ValueError, TypeError):
        return None, (jsonify({"error": "amount must be a number"}), 400)



@app.route("/login")
def login_page():
    if session.get("user_id"):
        return redirect(url_for("index"))
    return render_template("login.html")


@app.route("/api/auth/signup", methods=["POST"])
def signup():
    try:
        data = request.get_json(silent=True) or {}
        name     = (data.get("name") or "").strip()
        email    = (data.get("email") or "").strip().lower()
        password = data.get("password") or ""

        if not name or not email or not password:
            return jsonify({"error": "Name, email and password are required"}), 400
        if len(password) < 8:
            return jsonify({"error": "Password must be at least 8 characters"}), 400
        if not any(c.isupper() for c in password):
            return jsonify({"error": "Password must contain at least one uppercase letter"}), 400
        if not any(c.isdigit() for c in password):
            return jsonify({"error": "Password must contain at least one number"}), 400
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "An account with that email already exists"}), 409

        token   = secrets.token_urlsafe(32)
        expires = datetime.utcnow() + timedelta(hours=24)

        user = User(
            name=name, email=email,
            password_hash=generate_password_hash(password),
            email_verified=False,
            email_verification_token=token,
            email_verification_expires=expires,
        )
        db.session.add(user)
        db.session.flush()
        db.session.add(Profile(user_id=user.id))
        
        # Expense categories
        expense_cats = [
            ("Food & Dining", "🍔"), ("Groceries", "🛒"), ("Transportation", "🚗"),
            ("Fuel", "⛽"), ("Housing", "🏠"), ("Rent", "🏘️"), ("Utilities", "💡"),
            ("Internet & Mobile", "📱"), ("Shopping", "🛍️"), ("Entertainment", "🍿"),
            ("Healthcare", "🏥"), ("Education", "📚"), ("Insurance", "🛡️"),
            ("Debt Payments", "💳"), ("Subscriptions", "📺"), ("Gifts & Donations", "🎁"),
            ("Travel", "✈️"), ("Other", "📦")
        ]
        for cat_name, cat_emoji in expense_cats:
            db.session.add(Category(user_id=user.id, name=cat_name, emoji=cat_emoji, category_type="expense", is_default=True))
        
        # Income categories
        income_cats = [
            ("Salary", "💵"), ("Pocket Money", "💸"), ("Freelance", "🚀"),
            ("Business Income", "💼"), ("Scholarship", "🎓"), ("Allowance", "👛"),
            ("Internship", "🧑‍💼"), ("Gift Received", "🎁"), ("Interest Income", "🏦"),
            ("Investment Returns", "📊"), ("Refund", "↩️"), ("Bonus", "🎉"),
            ("Side Hustle", "⚡"), ("Other", "📦")
        ]
        for cat_name, cat_emoji in income_cats:
            db.session.add(Category(user_id=user.id, name=cat_name, emoji=cat_emoji, category_type="income", is_default=True))
        
        db.session.commit()

        # Send verification email (non-blocking, account creation succeeds even if email fails)
        email_sent = _send_verification_email(user, token)
        if not email_sent:
            app.logger.warning(f"Account created for {email} but verification email failed to send")
            return jsonify({
                "success": True,
                "pending": True,
                "email": email,
                "verification_email_sent": False,
                "message": "Account created. Verification email could not be sent."
            }), 201

        return jsonify({
            "success": True,
            "pending": True,
            "email": email,
            "verification_email_sent": True
        }), 201
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Signup error: {e}")
        return jsonify({"error": "An error occurred during signup. Please try again."}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    try:
        user = User.query.filter_by(email=email).first()
        if not user or not user.password_hash or not check_password_hash(user.password_hash, password):
            return jsonify({"error": "Invalid email or password"}), 401
    except Exception as e:
        app.logger.error(f"Login error for {email}: {e}")
        return jsonify({"error": "Invalid email or password"}), 401
    
    if not user.email_verified:
        return jsonify({"error": "Please verify your email before continuing.", "unverified": True, "email": email}), 403

    session["user_id"] = user.id
    return jsonify({"id": user.id, "name": user.name, "email": user.email})


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True})


@app.route("/api/auth/me")
def me():
    user = current_user()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "email_verified": user.email_verified,
        "google_id": user.google_id,
        "has_password": bool(user.password_hash),
    })



@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint for Render monitoring"""
    try:
        from sqlalchemy import text
        db.session.execute(text("SELECT 1"))
        return jsonify({"status": "healthy", "database": "connected"}), 200
    except Exception as e:
        app.logger.error(f"Health check failed: {e}")
        return jsonify({"status": "unhealthy", "database": "disconnected", "error": str(e)}), 503

@app.route("/favicon.ico")
def favicon():
    """Serve favicon from static folder"""
    from flask import send_from_directory
    return send_from_directory('static', 'favicon.ico', mimetype='image/x-icon')

@app.before_request
def log_request():
    """Log incoming requests in production"""
    if not app.debug and app.logger.level <= logging.INFO:
        app.logger.info(f"{request.method} {request.path}")


@app.route("/debug/oauth", methods=["GET"])
def debug_oauth():
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        return jsonify({"error": "OAuth credentials missing"}), 400
    return jsonify({
        "client_id_loaded": bool(client_id),
        "client_id_length": len(client_id) if client_id else 0,
        "client_secret_loaded": bool(client_secret),
        "client_secret_length": len(client_secret) if client_secret else 0,
        "redirect_uri_template": url_for("google_callback", _external=True),
        "app_url_scheme": os.environ.get("PREFERRED_URL_SCHEME", "http"),
        "google_client_config": {
            "client_id_starts_with": client_id[:20] if client_id else None,
            "client_secret_starts_with": client_secret[:10] if client_secret else None
        }
    })

@app.route("/")
def index():
    if not session.get("user_id"):
        return redirect(url_for("login_page"))
    return render_template("index.html")


@app.route("/onboarding")
def onboarding_page():
    if not session.get("user_id"):
        return redirect(url_for("login_page"))
    return render_template("onboarding.html")



@app.route("/api/profile", methods=["GET"])
def get_profile():
    err = login_required_json()
    if err: return err
    p = Profile.query.filter_by(user_id=session["user_id"]).first()
    if not p:
        return jsonify({"error": "Profile not found"}), 404
    return jsonify({
        "monthly_income":      p.monthly_income,
        "current_savings":     p.current_savings,
        "current_investments": p.current_investments,
        "monthly_expenses":    p.monthly_expenses,
        "financial_goal":      p.financial_goal,
        "account_mode":        p.account_mode,
        "onboarding_completed": p.onboarding_completed,
        "tutorial_completed":  p.tutorial_completed,
    })


@app.route("/api/profile", methods=["PUT"])
def update_profile():
    err = login_required_json()
    if err: return err
    p = Profile.query.filter_by(user_id=session["user_id"]).first()
    if not p:
        return jsonify({"error": "Profile not found"}), 404
    data = request.get_json(silent=True) or {}
    
    try:
        if "monthly_income" in data:
            val = float(data["monthly_income"] or 0)
            if val < 0:
                return jsonify({"error": "monthly_income cannot be negative"}), 400
            if val > 1e10:
                return jsonify({"error": "monthly_income exceeds reasonable limit"}), 400
            p.monthly_income = val
        
        if "current_savings" in data:
            val = float(data["current_savings"] or 0)
            if val < 0:
                return jsonify({"error": "current_savings cannot be negative"}), 400
            if val > 1e10:
                return jsonify({"error": "current_savings exceeds reasonable limit"}), 400
            p.current_savings = val
        
        if "current_investments" in data:
            val = float(data["current_investments"] or 0)
            if val < 0:
                return jsonify({"error": "current_investments cannot be negative"}), 400
            if val > 1e10:
                return jsonify({"error": "current_investments exceeds reasonable limit"}), 400
            p.current_investments = val
        
        if "monthly_expenses" in data:
            val = float(data["monthly_expenses"] or 0)
            if val < 0:
                return jsonify({"error": "monthly_expenses cannot be negative"}), 400
            if val > 1e10:
                return jsonify({"error": "monthly_expenses exceeds reasonable limit"}), 400
            p.monthly_expenses = val
    except (ValueError, TypeError):
        return jsonify({"error": "Invalid numeric values provided"}), 400
    
    if "financial_goal" in data: p.financial_goal = str(data["financial_goal"])[:200]
    if "account_mode" in data:
        mode = str(data["account_mode"])
        if mode in ("income", "cashflow"):
            p.account_mode = mode
    if "onboarding_completed" in data: p.onboarding_completed = bool(data["onboarding_completed"])
    if "tutorial_completed" in data: p.tutorial_completed = bool(data["tutorial_completed"])
    db.session.commit()
    return jsonify({"success": True})




@app.route("/api/transactions", methods=["GET"])
def get_transactions():
    err = login_required_json()
    if err: return err
    txs = Transaction.query.filter_by(user_id=session["user_id"]).order_by(Transaction.date.desc()).all()
    return jsonify([_tx_dict(t) for t in txs])


@app.route("/api/transactions", methods=["POST"])
def create_transaction():
    err = login_required_json()
    if err: return err
    data = request.get_json(silent=True) or {}
    amount, err = _validate_tx(data)
    if err: return err
    t = Transaction(
        user_id=session["user_id"],
        description=str(data["description"])[:100],
        amount=amount,
        category=str(data["category"])[:50],
        type=data["type"],
        date=str(data["date"]),
    )
    db.session.add(t)
    db.session.commit()
    return jsonify(_tx_dict(t)), 201


@app.route("/api/transactions/<int:tx_id>", methods=["PUT"])
def update_transaction(tx_id):
    err = login_required_json()
    if err: return err
    t = Transaction.query.filter_by(id=tx_id, user_id=session["user_id"]).first()
    if not t:
        return jsonify({"error": "Transaction not found"}), 404
    data = request.get_json(silent=True) or {}
    amount, err = _validate_tx(data)
    if err: return err
    t.description = str(data["description"])[:100]
    t.amount      = amount
    t.category    = str(data["category"])[:50]
    t.type        = data["type"]
    t.date        = str(data["date"])
    db.session.commit()
    return jsonify(_tx_dict(t))


@app.route("/api/transactions/<int:tx_id>", methods=["DELETE"])
def delete_transaction(tx_id):
    err = login_required_json()
    if err: return err
    t = Transaction.query.filter_by(id=tx_id, user_id=session["user_id"]).first()
    if not t:
        return jsonify({"error": "Transaction not found"}), 404
    db.session.delete(t)
    db.session.commit()
    return jsonify({"success": True})


@app.route("/api/budgets", methods=["GET"])
def get_budgets():
    err = login_required_json()
    if err: return err
    budgets = Budget.query.filter_by(user_id=session["user_id"]).all()
    return jsonify([{"id": b.id, "category": b.category, "limit": b.limit_amount} for b in budgets])


@app.route("/api/budgets", methods=["POST"])
def create_budget():
    err = login_required_json()
    if err: return err
    data = request.get_json(silent=True) or {}
    if not data.get("category") or not data.get("limit"):
        return jsonify({"error": "category and limit are required"}), 400
    b = Budget(user_id=session["user_id"], category=str(data["category"])[:50],
               limit_amount=float(data["limit"]))
    db.session.add(b)
    db.session.commit()
    return jsonify({"id": b.id, "category": b.category, "limit": b.limit_amount}), 201


@app.route("/api/budgets/<int:budget_id>", methods=["PUT"])
def update_budget(budget_id):
    err = login_required_json()
    if err: return err
    b = Budget.query.filter_by(id=budget_id, user_id=session["user_id"]).first()
    if not b: return jsonify({"error": "Budget not found"}), 404
    data = request.get_json(silent=True) or {}
    if "category" in data: b.category = str(data["category"])[:50]
    if "limit" in data: b.limit_amount = float(data["limit"])
    db.session.commit()
    return jsonify({"id": b.id, "category": b.category, "limit": b.limit_amount})


@app.route("/api/budgets/<int:budget_id>", methods=["DELETE"])
def delete_budget(budget_id):
    err = login_required_json()
    if err: return err
    b = Budget.query.filter_by(id=budget_id, user_id=session["user_id"]).first()
    if not b: return jsonify({"error": "Budget not found"}), 404
    db.session.delete(b)
    db.session.commit()
    return jsonify({"success": True})


def _goal_dict(g):
    return {"id": g.id, "name": g.title, "target": g.target_amount,
            "current": g.current_amount, "monthlyContribution": g.monthly_contribution,
            "date": g.target_date or ""}


@app.route("/api/goals", methods=["GET"])
def get_goals():
    err = login_required_json()
    if err: return err
    goals = Goal.query.filter_by(user_id=session["user_id"]).all()
    return jsonify([_goal_dict(g) for g in goals])


@app.route("/api/goals", methods=["POST"])
def create_goal():
    err = login_required_json()
    if err: return err
    data = request.get_json(silent=True) or {}
    if not data.get("name") or not data.get("target"):
        return jsonify({"error": "name and target are required"}), 400
    g = Goal(user_id=session["user_id"], title=str(data["name"])[:100],
             target_amount=float(data["target"]),
             current_amount=float(data.get("current") or 0),
             monthly_contribution=float(data.get("monthlyContribution") or 0),
             target_date=str(data["date"]) if data.get("date") else None)
    db.session.add(g)
    db.session.commit()
    return jsonify(_goal_dict(g)), 201


@app.route("/api/goals/<int:goal_id>", methods=["PUT"])
def update_goal(goal_id):
    err = login_required_json()
    if err: return err
    g = Goal.query.filter_by(id=goal_id, user_id=session["user_id"]).first()
    if not g: return jsonify({"error": "Goal not found"}), 404
    data = request.get_json(silent=True) or {}
    if "name" in data: g.title = str(data["name"])[:100]
    if "target" in data: g.target_amount = float(data["target"])
    if "current" in data: g.current_amount = float(data["current"])
    if "monthlyContribution" in data: g.monthly_contribution = float(data["monthlyContribution"])
    if "date" in data: g.target_date = str(data["date"]) if data["date"] else None
    db.session.commit()
    return jsonify(_goal_dict(g))


@app.route("/api/goals/<int:goal_id>", methods=["DELETE"])
def delete_goal(goal_id):
    err = login_required_json()
    if err: return err
    g = Goal.query.filter_by(id=goal_id, user_id=session["user_id"]).first()
    if not g: return jsonify({"error": "Goal not found"}), 404
    db.session.delete(g)
    db.session.commit()
    return jsonify({"success": True})


@app.route("/api/goals/forecast", methods=["GET"])
def forecast_goals():
    err = login_required_json()
    if err: return err
    uid = session["user_id"]
    goals = Goal.query.filter_by(user_id=uid).all()
    txs = Transaction.query.filter_by(user_id=uid).all()
    
    now = datetime.utcnow()
    three_months_ago = datetime(now.year, now.month - 2 if now.month > 2 else now.month + 10, 1)
    recent_txs = [t for t in txs if datetime.strptime(t.date, "%Y-%m-%d") >= three_months_ago]
    income = sum(t.amount for t in recent_txs if t.type == 'income')
    expenses = sum(t.amount for t in recent_txs if t.type == 'expense')
    avg_monthly_savings = (income - expenses) / 3 if len(recent_txs) > 0 else 0
    
    forecasts = []
    for g in goals:
        remaining = g.target_amount - g.current_amount
        contribution = g.monthly_contribution if g.monthly_contribution > 0 else max(0, avg_monthly_savings * 0.3)
        
        if remaining <= 0:
            forecasts.append({
                "goalId": g.id,
                "health": "complete",
                "currentPace": {"months": 0, "date": None},
                "accelerated": {"months": 0, "date": None},
                "aggressive": {"months": 0, "date": None},
                "insights": ["Goal already achieved! 🎉"]
            })
            continue
        
        if contribution <= 0:
            forecasts.append({
                "goalId": g.id,
                "health": "at_risk",
                "currentPace": {"months": None, "date": None},
                "accelerated": {"months": None, "date": None},
                "aggressive": {"months": None, "date": None},
                "insights": ["No savings detected. Start saving to reach this goal."]
            })
            continue
        
        months_current = remaining / contribution
        months_accel = remaining / (contribution * 1.1)
        months_aggr = remaining / (contribution * 1.25)
        
        current_date = (now + timedelta(days=months_current * 30)).strftime("%Y-%m-%d")
        accel_date = (now + timedelta(days=months_accel * 30)).strftime("%Y-%m-%d")
        aggr_date = (now + timedelta(days=months_aggr * 30)).strftime("%Y-%m-%d")
        
        health = "on_track"
        if g.target_date:
            target_dt = datetime.strptime(g.target_date, "%Y-%m-%d")
            forecast_dt = datetime.strptime(current_date, "%Y-%m-%d")
            days_diff = (forecast_dt - target_dt).days
            if days_diff > 60:
                health = "at_risk"
            elif days_diff > 30:
                health = "behind"
        
        insights = []
        if health == "on_track":
            insights.append(f"You're on track to reach this goal by {current_date}.")
        elif health == "behind":
            days_behind = (datetime.strptime(current_date, "%Y-%m-%d") - datetime.strptime(g.target_date, "%Y-%m-%d")).days
            insights.append(f"You may miss your target by {days_behind // 30} month(s).")
        elif health == "at_risk":
            insights.append("Significantly behind schedule. Consider increasing contributions.")
        
        saved_days = (months_current - months_accel) * 30
        if saved_days >= 7:
            insights.append(f"Increasing savings by 10% would shorten completion by {int(saved_days)} days.")
        
        aggr_saved = (months_current - months_aggr) * 30
        if aggr_saved >= 30:
            insights.append(f"An aggressive 25% increase would save {int(aggr_saved // 30)} month(s).")
        
        forecasts.append({
            "goalId": g.id,
            "health": health,
            "currentPace": {"months": round(months_current, 1), "date": current_date},
            "accelerated": {"months": round(months_accel, 1), "date": accel_date},
            "aggressive": {"months": round(months_aggr, 1), "date": aggr_date},
            "insights": insights
        })
    
    return jsonify(forecasts)


def _inv_dict(i):
    return {"id": i.id, "symbol": i.symbol, "type": i.asset_type,
            "shares": i.quantity, "avgCost": i.average_cost, "currentPrice": i.current_value}


@app.route("/api/investments", methods=["GET"])
def get_investments():
    err = login_required_json()
    if err: return err
    return jsonify([_inv_dict(i) for i in Investment.query.filter_by(user_id=session["user_id"]).all()])


@app.route("/api/investments", methods=["POST"])
def create_investment():
    err = login_required_json()
    if err: return err
    data = request.get_json(silent=True) or {}
    if not data.get("symbol") or not data.get("shares"):
        return jsonify({"error": "symbol and shares are required"}), 400
    inv = Investment(user_id=session["user_id"], symbol=str(data["symbol"])[:100],
                     asset_type=str(data.get("type") or "Stock")[:50],
                     quantity=float(data["shares"]), average_cost=float(data.get("avgCost") or 0),
                     current_value=float(data.get("currentPrice") or 0))
    db.session.add(inv)
    db.session.commit()
    return jsonify(_inv_dict(inv)), 201


@app.route("/api/investments/<int:inv_id>", methods=["PUT"])
def update_investment(inv_id):
    err = login_required_json()
    if err: return err
    inv = Investment.query.filter_by(id=inv_id, user_id=session["user_id"]).first()
    if not inv: return jsonify({"error": "Investment not found"}), 404
    data = request.get_json(silent=True) or {}
    if "symbol" in data: inv.symbol = str(data["symbol"])[:100]
    if "type" in data: inv.asset_type = str(data["type"])[:50]
    if "shares" in data: inv.quantity = float(data["shares"])
    if "avgCost" in data: inv.average_cost = float(data["avgCost"])
    if "currentPrice" in data: inv.current_value = float(data["currentPrice"])
    db.session.commit()
    return jsonify(_inv_dict(inv))


@app.route("/api/investments/<int:inv_id>", methods=["DELETE"])
def delete_investment(inv_id):
    err = login_required_json()
    if err: return err
    inv = Investment.query.filter_by(id=inv_id, user_id=session["user_id"]).first()
    if not inv: return jsonify({"error": "Investment not found"}), 404
    db.session.delete(inv)
    db.session.commit()
    return jsonify({"success": True})



_EMAIL_HEADER = """
<div style="font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;max-width:580px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
  <div style="background:linear-gradient(135deg,#2563eb 0%,#4f46e5 100%);padding:32px 40px">
    <a href="{base_url}" style="text-decoration:none;display:inline-flex;align-items:center;gap:10px">
      <span style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.3px">Finora</span>
    </a>
    <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px">Personal Finance OS</p>
  </div>
  <div style="padding:40px 40px 32px;color:#0f172a">
"""

_EMAIL_FOOTER = """
  </div>
  <div style="padding:20px 40px 28px;border-top:1px solid #e2e8f0;background:#f8fafc">
    <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6">
      This email was sent to you because an action was performed on your Finora account.<br>
      If you didn't request this, you can safely ignore this email — your account remains secure.<br><br>
      &copy; 2026 Finora &nbsp;·&nbsp; <a href="{base_url}" style="color:#2563eb;text-decoration:none">Visit Finora</a>
    </p>
  </div>
</div>
"""


def _base_url():
    try:
        return url_for("index", _external=True).rstrip("/")
    except Exception:
        return "http://127.0.0.1:5000"


def _send_email(to, subject, body_html):
    """Send email with timeout handling. Returns True on success, False on failure."""
    html = _EMAIL_HEADER.format(base_url=_base_url()) + body_html + _EMAIL_FOOTER.format(base_url=_base_url())
    try:
        app.logger.info(f"Attempting to send email to {to} via SMTP {app.config.get('MAIL_SERVER')}:{app.config.get('MAIL_PORT')}")
        msg = Message(subject=subject, recipients=[to], html=html)
        
        # Set timeout for SMTP operations to prevent worker death
        import socket
        old_timeout = socket.getdefaulttimeout()
        socket.setdefaulttimeout(10)  # 10 second timeout
        
        try:
            mail.send(msg)
            app.logger.info(f"Email sent successfully to {to}")
            return True
        finally:
            socket.setdefaulttimeout(old_timeout)
            
    except socket.timeout:
        app.logger.error(f"SMTP timeout sending to {to} - connection timed out after 10s")
        return False
    except Exception as e:
        app.logger.error(f"Mail send failed to {to}: {type(e).__name__}: {e}")
        app.logger.error(f"SMTP Config - Server: {app.config.get('MAIL_SERVER')}, Port: {app.config.get('MAIL_PORT')}, TLS: {app.config.get('MAIL_USE_TLS')}")
        return False


def _send_verification_email(user, token):
    verify_url = url_for("verify_email", token=token, _external=True)
    body = f"""
    <h2 style="margin:0 0 6px;color:#0f172a;font-size:22px;font-weight:700">Hi {user.name},</h2>
    <p style="color:#64748b;margin:0 0 28px;line-height:1.7;font-size:15px">
      Thanks for signing up. Click the button below to verify your email address and activate your Finora account.
    </p>
    <a href="{verify_url}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;margin-bottom:32px">
      Verify Email Address
    </a>
    <div style="background:#f1f5f9;border-radius:10px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Or paste this link in your browser</p>
      <p style="margin:0;word-break:break-all;color:#2563eb;font-size:12px">{verify_url}</p>
    </div>
    <div style="background:#dbeafe;border:1px solid #93c5fd;border-radius:10px;padding:14px 18px;margin-bottom:24px">
      <p style="margin:0;color:#1e3a8a;font-size:13px">🔒 <strong>Account security:</strong> This link expires in <strong>24 hours</strong> and can only be used once.</p>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0">If you didn't create a Finora account, you can safely ignore this email. No account will be activated without verification.</p>
    """
    return _send_email(user.email, "Verify your Finora account", body)


def _send_password_reset_email(user, token):
    reset_url = url_for("reset_password_page", token=token, _external=True)
    body = f"""
    <h2 style="margin:0 0 6px;color:#0f172a;font-size:22px;font-weight:700">Hi {user.name},</h2>
    <p style="color:#64748b;margin:0 0 28px;line-height:1.7;font-size:15px">
      We received a request to reset the password for your Finora account. Click the button below to choose a new password.
    </p>
    <a href="{reset_url}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px;margin-bottom:32px">
      Reset Password
    </a>
    <div style="background:#f1f5f9;border-radius:10px;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Or paste this link in your browser</p>
      <p style="margin:0;word-break:break-all;color:#2563eb;font-size:12px">{reset_url}</p>
    </div>
    <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:14px 18px;margin-bottom:24px">
      <p style="margin:0;color:#7f1d1d;font-size:13px">⏰ <strong>This link expires in 1 hour</strong> and can only be used once. After that you'll need to request a new one.</p>
    </div>
    <p style="color:#64748b;font-size:13px;margin:0">If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
    """
    return _send_email(user.email, "Reset your Finora password", body)



@app.route("/verify-email/<token>")
def verify_email(token):
    user = User.query.filter_by(email_verification_token=token).first()
    if not user or not user.email_verification_expires or \
       datetime.utcnow() > user.email_verification_expires:
        return render_template("verify_failed.html")

    user.email_verified = True
    user.email_verification_token = None
    user.email_verification_expires = None
    db.session.commit()
    return render_template("verify_success.html", name=user.name)


@app.route("/verify-pending")
def verify_pending():
    email = request.args.get("email", "")
    return render_template("verify_pending.html", email=email)



@app.route("/forgot-password")
def forgot_password_page():
    return render_template("forgot_password.html")


@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    try:
        data  = request.get_json(silent=True) or {}
        email = (data.get("email") or "").strip().lower()

        user = User.query.filter_by(email=email).first()
        if user and user.password_hash and user.email_verified:
            user.password_reset_token   = secrets.token_urlsafe(32)
            user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
            db.session.commit()
            
            # Send reset email (non-blocking)
            email_sent = _send_password_reset_email(user, user.password_reset_token)
            if not email_sent:
                app.logger.warning(f"Password reset requested for {email} but email failed to send")

        return jsonify({"message": "If an account exists, a password reset email has been sent."})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Forgot password error: {e}")
        return jsonify({"error": "An error occurred. Please try again."}), 500


@app.route("/reset-password/<token>")
def reset_password_page(token):
    user = User.query.filter_by(password_reset_token=token).first()
    if not user or not user.password_reset_expires or \
       datetime.utcnow() > user.password_reset_expires:
        return render_template("verify_failed.html", mode="reset")
    return render_template("reset_password.html", token=token)


@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    data     = request.get_json(silent=True) or {}
    token    = data.get("token", "")
    password = data.get("password", "")

    if len(password) < 8 or not any(c.isupper() for c in password) or not any(c.isdigit() for c in password):
        return jsonify({"error": "Password must be at least 8 characters with one uppercase letter and one number"}), 400

    user = User.query.filter_by(password_reset_token=token).first()
    if not user or not user.password_reset_expires or \
       datetime.utcnow() > user.password_reset_expires:
        return jsonify({"error": "Reset link is invalid or has expired"}), 400

    user.password_hash          = generate_password_hash(password)
    user.password_reset_token   = None
    user.password_reset_expires = None
    db.session.commit()
    return jsonify({"success": True})


@app.route("/api/auth/resend-verification", methods=["POST"])
def resend_verification():
    data  = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    user = User.query.filter_by(email=email).first()
    if user and not user.email_verified and user.password_hash:
        can_resend = (
            not user.email_verification_expires or
            datetime.utcnow() > user.email_verification_expires - timedelta(hours=23, minutes=59)
        )
        if can_resend:
            user.email_verification_token   = secrets.token_urlsafe(32)
            user.email_verification_expires = datetime.utcnow() + timedelta(hours=24)
            db.session.commit()
            _send_verification_email(user, user.email_verification_token)

    return jsonify({"message": "If that email is registered and unverified, a new link has been sent."})


def _roadmap_dict(r):
    return {"id": r.id, "title": r.title, "icon": r.icon, "status": r.status, "position": r.position}

@app.route("/api/roadmap", methods=["GET"])
def get_roadmap():
    err = login_required_json()
    if err: return err
    items = RoadmapItem.query.filter_by(user_id=session["user_id"]).order_by(RoadmapItem.position).all()
    return jsonify([_roadmap_dict(r) for r in items])

@app.route("/api/roadmap", methods=["POST"])
def create_roadmap_item():
    err = login_required_json()
    if err: return err
    data = request.get_json(silent=True) or {}
    if not data.get("title"):
        return jsonify({"error": "title required"}), 400
    count = RoadmapItem.query.filter_by(user_id=session["user_id"]).count()
    item = RoadmapItem(user_id=session["user_id"], title=str(data["title"])[:100],
                       icon=str(data.get("icon") or "target")[:50],
                       status=str(data.get("status") or "pending"),
                       position=count)
    db.session.add(item)
    db.session.commit()
    return jsonify(_roadmap_dict(item)), 201

@app.route("/api/roadmap/<int:item_id>", methods=["PUT"])
def update_roadmap_item(item_id):
    err = login_required_json()
    if err: return err
    item = RoadmapItem.query.filter_by(id=item_id, user_id=session["user_id"]).first()
    if not item: return jsonify({"error": "Not found"}), 404
    data = request.get_json(silent=True) or {}
    if "title"  in data: item.title  = str(data["title"])[:100]
    if "icon"   in data: item.icon   = str(data["icon"])[:50]
    if "status" in data: item.status = str(data["status"])
    db.session.commit()
    return jsonify(_roadmap_dict(item))

@app.route("/api/roadmap/<int:item_id>", methods=["DELETE"])
def delete_roadmap_item(item_id):
    err = login_required_json()
    if err: return err
    item = RoadmapItem.query.filter_by(id=item_id, user_id=session["user_id"]).first()
    if not item: return jsonify({"error": "Not found"}), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify({"success": True})



def _category_dict(c):
    return {"id": c.id, "name": c.name, "emoji": c.emoji, "color": c.color, "category_type": c.category_type, "is_default": c.is_default}

@app.route("/api/categories", methods=["GET"])
def get_categories():
    err = login_required_json()
    if err: return err
    cats = Category.query.filter_by(user_id=session["user_id"]).order_by(Category.is_default.desc(), Category.name).all()
    return jsonify([_category_dict(c) for c in cats])

@app.route("/api/categories", methods=["POST"])
def create_category():
    err = login_required_json()
    if err: return err
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name or len(name) > 50:
        return jsonify({"error": "Category name must be 1-50 characters"}), 400
    
    category_type = (data.get("category_type") or "expense").strip()
    if category_type not in ("income", "expense"):
        return jsonify({"error": "category_type must be 'income' or 'expense'"}), 400
    
    existing = Category.query.filter_by(user_id=session["user_id"], name=name, category_type=category_type).first()
    if existing:
        return jsonify({"error": "Category already exists"}), 400
    
    emoji = (data.get("emoji") or "📦").strip()[:10]
    color = (data.get("color") or "#3b82f6").strip()[:7]
    cat = Category(user_id=session["user_id"], name=name, emoji=emoji, color=color, category_type=category_type, is_default=False)
    db.session.add(cat)
    db.session.commit()
    return jsonify(_category_dict(cat)), 201

@app.route("/api/categories/<int:cat_id>", methods=["PUT"])
def update_category(cat_id):
    err = login_required_json()
    if err: return err
    cat = Category.query.filter_by(id=cat_id, user_id=session["user_id"]).first()
    if not cat: return jsonify({"error": "Not found"}), 404
    if cat.is_default:
        return jsonify({"error": "Cannot edit default categories"}), 400
    
    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = (data["name"] or "").strip()
        if not name or len(name) > 50:
            return jsonify({"error": "Name must be 1-50 characters"}), 400
        dup = Category.query.filter_by(user_id=session["user_id"], name=name, category_type=cat.category_type).filter(Category.id != cat_id).first()
        if dup:
            return jsonify({"error": "Category name already exists"}), 400
        cat.name = name
    if "emoji" in data:
        cat.emoji = (data["emoji"] or "📦").strip()[:10]
    if "color" in data:
        cat.color = (data["color"] or "#3b82f6").strip()[:7]
    if "category_type" in data:
        category_type = (data["category_type"] or "expense").strip()
        if category_type in ("income", "expense"):
            cat.category_type = category_type
    db.session.commit()
    return jsonify(_category_dict(cat))

@app.route("/api/categories/<int:cat_id>", methods=["DELETE"])
def delete_category(cat_id):
    err = login_required_json()
    if err: return err
    cat = Category.query.filter_by(id=cat_id, user_id=session["user_id"]).first()
    if not cat: return jsonify({"error": "Not found"}), 404
    if cat.is_default:
        return jsonify({"error": "Cannot delete default categories"}), 400
    
    in_use = Transaction.query.filter_by(user_id=session["user_id"], category=cat.name).first()
    if in_use:
        return jsonify({"error": "Category is in use by transactions. Reassign them first."}), 400
    
    db.session.delete(cat)
    db.session.commit()
    return jsonify({"success": True})



def _get_or_create_settings(uid):
    s = UserSettings.query.filter_by(user_id=uid).first()
    if not s:
        s = UserSettings(user_id=uid)
        db.session.add(s)
        db.session.commit()
    return s

def _settings_dict(s):
    return {
        "theme":              s.theme,
        "currency":           s.currency,
        "currency_symbol":    s.currency_symbol,
        "currency_locale":    s.currency_locale,
        "show_greeting":      s.show_greeting,
        "sidebar_collapsed":  s.sidebar_collapsed,
        "timezone":           s.timezone or "UTC",
    }

@app.route("/api/settings", methods=["GET"])
def get_settings():
    err = login_required_json()
    if err: return err
    s = _get_or_create_settings(session["user_id"])
    return jsonify(_settings_dict(s))

@app.route("/api/settings", methods=["PUT"])
def update_settings():
    err = login_required_json()
    if err: return err
    s = _get_or_create_settings(session["user_id"])
    data = request.get_json(silent=True) or {}
    if "theme"             in data: s.theme             = str(data["theme"])[:10]
    if "show_greeting"     in data: s.show_greeting     = bool(data["show_greeting"])
    if "sidebar_collapsed" in data: s.sidebar_collapsed = bool(data["sidebar_collapsed"])
    if "timezone"          in data:
        tz = str(data["timezone"])[:50]
        VALID_ZONES = {
            "UTC","Asia/Kolkata","America/New_York","America/Chicago","America/Los_Angeles",
            "America/Toronto","Europe/London","Europe/Paris","Europe/Berlin","Asia/Dubai",
            "Asia/Singapore","Asia/Tokyo","Asia/Shanghai","Australia/Sydney","Pacific/Auckland"
        }
        if tz in VALID_ZONES:
            s.timezone = tz
    if "currency"          in data:
        cur = str(data["currency"])[:10]
        CURRENCIES = {
            "INR": {"symbol": "₹",  "locale": "en-IN"},
            "USD": {"symbol": "$",  "locale": "en-US"},
            "EUR": {"symbol": "€",  "locale": "de-DE"},
            "GBP": {"symbol": "£",  "locale": "en-GB"},
            "AED": {"symbol": "د.إ","locale": "ar-AE"},
            "SGD": {"symbol": "S$", "locale": "en-SG"},
        }
        if cur in CURRENCIES:
            s.currency        = cur
            s.currency_symbol = CURRENCIES[cur]["symbol"]
            s.currency_locale = CURRENCIES[cur]["locale"]
    db.session.commit()
    return jsonify(_settings_dict(s))

@app.route("/api/settings/update-name", methods=["POST"])
def update_name():
    err = login_required_json()
    if err: return err
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name or len(name) > 100:
        return jsonify({"error": "Name must be 1–100 characters"}), 400
    user = current_user()
    user.name = name
    db.session.commit()
    return jsonify({"success": True, "name": user.name})

@app.route("/api/settings/change-password", methods=["POST"])
def change_password():
    err = login_required_json()
    if err: return err
    data = request.get_json(silent=True) or {}
    user = current_user()
    if not user.password_hash:
        return jsonify({"error": "Password managed by Google"}), 400
    if not check_password_hash(user.password_hash, data.get("current_password", "")):
        return jsonify({"error": "Current password is incorrect"}), 401
    new_pw = data.get("new_password", "")
    if len(new_pw) < 8 or not any(c.isupper() for c in new_pw) or not any(c.isdigit() for c in new_pw):
        return jsonify({"error": "Password must be 8+ chars with one uppercase and one number"}), 400
    user.password_hash = generate_password_hash(new_pw)
    db.session.commit()
    return jsonify({"success": True})

@app.route("/api/settings/resend-verification", methods=["POST"])
def resend_verification_settings():
    err = login_required_json()
    if err: return err
    user = current_user()
    if user.email_verified:
        return jsonify({"error": "Email already verified"}), 400
    user.email_verification_token   = secrets.token_urlsafe(32)
    user.email_verification_expires = datetime.utcnow() + timedelta(hours=24)
    db.session.commit()
    _send_verification_email(user, user.email_verification_token)
    return jsonify({"success": True})


import csv, io, json as _json

@app.route("/api/export/transactions")
def export_transactions():
    err = login_required_json()
    if err: return err
    txs = Transaction.query.filter_by(user_id=session["user_id"]).order_by(Transaction.date.desc()).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Date", "Description", "Category", "Type", "Amount"])
    for t in txs:
        w.writerow([t.date, t.description, t.category, t.type, t.amount])
    buf.seek(0)
    from flask import Response
    return Response(buf.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=transactions.csv"})

@app.route("/api/export/data")
def export_data():
    err = login_required_json()
    if err: return err
    uid  = session["user_id"]
    user = current_user()
    p    = Profile.query.filter_by(user_id=uid).first()
    data = {
        "exported_at": datetime.utcnow().isoformat(),
        "user": {"name": user.name, "email": user.email, "created_at": user.created_at.isoformat()},
        "profile": {"monthly_income": p.monthly_income, "current_savings": p.current_savings,
                    "current_investments": p.current_investments, "monthly_expenses": p.monthly_expenses,
                    "financial_goal": p.financial_goal} if p else {},
        "transactions": [{"date": t.date, "description": t.description, "category": t.category,
                          "type": t.type, "amount": t.amount}
                         for t in Transaction.query.filter_by(user_id=uid).all()],
        "budgets": [{"category": b.category, "limit": b.limit_amount}
                    for b in Budget.query.filter_by(user_id=uid).all()],
        "goals": [{"title": g.title, "target": g.target_amount, "current": g.current_amount,
                   "monthly_contribution": g.monthly_contribution, "target_date": g.target_date}
                  for g in Goal.query.filter_by(user_id=uid).all()],
        "investments": [{"symbol": i.symbol, "type": i.asset_type, "quantity": i.quantity,
                         "average_cost": i.average_cost, "current_value": i.current_value}
                        for i in Investment.query.filter_by(user_id=uid).all()],
    }
    from flask import Response
    return Response(_json.dumps(data, indent=2), mimetype="application/json",
                    headers={"Content-Disposition": "attachment; filename=finora_data.json"})

@app.route("/api/financial-health", methods=["GET"])
def get_financial_health():
    err = login_required_json()
    if err: return err
    uid = session["user_id"]
    
    def calc_health(txs, profile, budgets, goals, investments):
        income = sum(t.amount for t in txs if t.type == 'income')
        expenses = sum(t.amount for t in txs if t.type == 'expense')
        
        savings = profile.current_savings if profile else 0
        inv_value = profile.current_investments if profile else 0
        monthly_exp = profile.monthly_expenses if profile else (expenses / max(1, len({t.date[:7] for t in txs})))
        monthly_inc = profile.monthly_income if profile else (income / max(1, len({t.date[:7] for t in txs})))
        
        savings_rate = (savings / (monthly_inc * 12)) if monthly_inc > 0 else 0
        savings_rate_score = min(20, savings_rate * 100)
        
        emergency_months = (savings / monthly_exp) if monthly_exp > 0 else 0
        emergency_fund_score = min(20, (emergency_months / 6) * 20)
        
        budget_score = 0
        if budgets:
            met = sum(1 for b in budgets if sum(t.amount for t in txs if t.type=='expense' and t.category==b.category) <= b.limit_amount)
            budget_score = (met / len(budgets)) * 15
        else:
            budget_score = 10
        
        goal_score = 0
        if goals:
            avg_progress = sum(min(100, (g.current_amount / g.target_amount) * 100 if g.target_amount > 0 else 0) for g in goals) / len(goals)
            goal_score = (avg_progress / 100) * 15
        else:
            goal_score = 5
        
        inv_ratio = (inv_value / savings) if savings > 0 else (1 if inv_value > 0 else 0)
        investment_score = min(15, inv_ratio * 15)
        
        if len(txs) >= 2:
            monthly_expenses = {}
            for t in txs:
                if t.type == 'expense':
                    ym = t.date[:7]
                    monthly_expenses[ym] = monthly_expenses.get(ym, 0) + t.amount
            if len(monthly_expenses) >= 2:
                exp_values = list(monthly_expenses.values())
                avg_exp = sum(exp_values) / len(exp_values)
                variance = sum((x - avg_exp) ** 2 for x in exp_values) / len(exp_values)
                std_dev = variance ** 0.5
                coefficient_of_variation = (std_dev / avg_exp) if avg_exp > 0 else 1
                stability_score = max(0, 10 * (1 - min(1, coefficient_of_variation)))
            else:
                stability_score = 5
        else:
            stability_score = 5
        
        net_worth = income - expenses + savings + inv_value
        growth_score = 5 if net_worth > 0 else 2
        
        total = savings_rate_score + emergency_fund_score + budget_score + goal_score + investment_score + stability_score + growth_score
        
        return {
            "total": round(total, 1),
            "components": {
                "savingsRate": round(savings_rate_score, 1),
                "emergencyFund": round(emergency_fund_score, 1),
                "budgetDiscipline": round(budget_score, 1),
                "goalProgress": round(goal_score, 1),
                "investmentActivity": round(investment_score, 1),
                "spendingStability": round(stability_score, 1),
                "netWorthGrowth": round(growth_score, 1)
            },
            "details": {
                "savingsRate": round(savings_rate * 100, 1),
                "emergencyMonths": round(emergency_months, 1),
                "budgetsMet": f"{int(sum(1 for b in budgets if sum(t.amount for t in txs if t.type=='expense' and t.category==b.category) <= b.limit_amount))}/{len(budgets)}" if budgets else "No budgets",
                "avgGoalProgress": round((sum(min(100, (g.current_amount / g.target_amount) * 100 if g.target_amount > 0 else 0) for g in goals) / len(goals)) if goals else 0, 1),
                "investmentRatio": round(inv_ratio * 100, 1),
                "spendingVariation": round(coefficient_of_variation * 100, 1) if 'coefficient_of_variation' in locals() else 0
            }
        }
    
    now = datetime.utcnow()
    this_ym = f"{now.year}-{now.month:02d}"
    txs_this = Transaction.query.filter_by(user_id=uid).filter(Transaction.date.startswith(this_ym)).all()
    if not txs_this:
        txs_this = Transaction.query.filter_by(user_id=uid).all()
    
    profile = Profile.query.filter_by(user_id=uid).first()
    budgets = Budget.query.filter_by(user_id=uid).all()
    goals = Goal.query.filter_by(user_id=uid).all()
    investments = Investment.query.filter_by(user_id=uid).all()
    
    current_health = calc_health(txs_this, profile, budgets, goals, investments)
    
    last_month = now.month - 1 if now.month > 1 else 12
    last_year = now.year if now.month > 1 else now.year - 1
    last_ym = f"{last_year}-{last_month:02d}"
    txs_last = Transaction.query.filter_by(user_id=uid).filter(Transaction.date.startswith(last_ym)).all()
    
    if txs_last:
        last_health = calc_health(txs_last, profile, budgets, goals, investments)
    else:
        last_health = current_health
    
    recommendations = []
    details = current_health["details"]
    comps = current_health["components"]
    
    if comps["savingsRate"] < 15:
        needed = max(0, (0.2 * (profile.monthly_income if profile else 50000) * 12) - (profile.current_savings if profile else 0))
        if needed > 0:
            recommendations.append(f"Increase savings by ₹{int(needed / 12)}/month to improve savings rate score.")
    
    if comps["emergencyFund"] < 15:
        target_months = 6
        current_months = details["emergencyMonths"]
        gap = target_months - current_months
        if gap > 0 and profile:
            recommendations.append(f"Build emergency fund to {target_months} months (₹{int(profile.monthly_expenses * gap)} more) for +{int((gap / 6) * 20)} pts.")
    
    if comps["budgetDiscipline"] < 12 and budgets:
        exceeded = [b for b in budgets if sum(t.amount for t in txs_this if t.type=='expense' and t.category==b.category) > b.limit_amount]
        if exceeded:
            recommendations.append(f"Reduce spending in {exceeded[0].category} to stay within budget (+{int(15 - comps['budgetDiscipline'])} pts).")
    
    if comps["goalProgress"] < 10 and goals:
        recommendations.append("Increase goal contributions to improve progress score.")
    
    if comps["investmentActivity"] < 10:
        recommendations.append("Consider investing surplus savings to improve investment score.")
    
    if not recommendations:
        recommendations.append("Excellent! Maintain your current financial habits.")
    
    changes = []
    for key in current_health["components"]:
        curr = current_health["components"][key]
        prev = last_health["components"][key]
        diff = curr - prev
        if abs(diff) >= 1:
            label = key.replace("Rate", " Rate").replace("Fund", " Fund").replace("Discipline", " Discipline").replace("Progress", " Progress").replace("Activity", " Activity").replace("Stability", " Stability").replace("Growth", " Growth")
            label = ''.join([' ' + c if c.isupper() else c for c in label]).strip()
            if diff > 0:
                changes.append(f"{label} improved this month (+{round(diff, 1)} pts)")
            else:
                changes.append(f"{label} decreased this month ({round(diff, 1)} pts)")
    
    return jsonify({
        "current": current_health,
        "previous": last_health,
        "recommendations": recommendations[:5],
        "changes": changes[:5]
    })



@app.route("/api/danger/clear-transactions", methods=["DELETE"])
def clear_transactions():
    err = login_required_json()
    if err: return err
    Transaction.query.filter_by(user_id=session["user_id"]).delete()
    db.session.commit()
    return jsonify({"success": True})

@app.route("/api/danger/clear-financial-data", methods=["DELETE"])
def clear_financial_data():
    err = login_required_json()
    if err: return err
    uid = session["user_id"]
    Transaction.query.filter_by(user_id=uid).delete()
    Budget.query.filter_by(user_id=uid).delete()
    Goal.query.filter_by(user_id=uid).delete()
    Investment.query.filter_by(user_id=uid).delete()
    RoadmapItem.query.filter_by(user_id=uid).delete()
    p = Profile.query.filter_by(user_id=uid).first()
    if p:
        p.monthly_income = 0; p.current_savings = 0
        p.current_investments = 0; p.monthly_expenses = 0
        p.financial_goal = ""
    db.session.commit()
    return jsonify({"success": True})

@app.route("/api/danger/delete-account", methods=["DELETE"])
def delete_account():
    err = login_required_json()
    if err: return err
    data = request.get_json(silent=True) or {}
    user = current_user()
    if user.password_hash:
        if not check_password_hash(user.password_hash, data.get("password", "")):
            return jsonify({"error": "Incorrect password"}), 401
    db.session.delete(user)
    db.session.commit()
    session.clear()
    return jsonify({"success": True})


@app.route("/api/net-worth-history")
def net_worth_history():
    """Return last 6 months of net-worth snapshots computed from transactions."""
    err = login_required_json()
    if err: return err
    uid = session["user_id"]
    p   = Profile.query.filter_by(user_id=uid).first()
    txs = Transaction.query.filter_by(user_id=uid).all()

    from collections import defaultdict
    base_savings     = p.current_savings     if p else 0
    base_investments = p.current_investments if p else 0

    monthly = defaultdict(lambda: {"income": 0, "expense": 0})
    for t in txs:
        try:
            ym = t.date[:7]
            monthly[ym][t.type] += t.amount
        except Exception:
            pass

    today = datetime.utcnow()
    months = []
    for i in range(5, -1, -1):
        m = today.month - i
        y = today.year
        while m <= 0: m += 12; y -= 1
        months.append((y, m))

    labels, data = [], []
    cumulative_cash = 0
    for y, m in months:
        ym  = f"{y}-{m:02d}"
        inc = monthly[ym]["income"]
        exp = monthly[ym]["expense"]
        cumulative_cash += (inc - exp)
        nw = cumulative_cash + base_savings + base_investments
        labels.append(datetime(y, m, 1).strftime("%b"))
        data.append(round(nw, 2))

    return jsonify({"labels": labels, "data": data})


@app.route("/auth/google")
def google_login():
    redirect_uri = url_for("google_callback", _external=True)
    return google.authorize_redirect(redirect_uri)


@app.route("/auth/google/callback")
def google_callback():
    if request.args.get("error"):
        error_reason = request.args.get("error", "unknown")
        app.logger.warning(f"Google OAuth error: {error_reason}")
        return redirect(url_for("login_page"))
    
    try:
        token = google.authorize_access_token()
    except Exception as e:
        app.logger.error(f"Google token error: {e}")
        return redirect(url_for("login_page"))
    
    info = token.get("userinfo")
    if not info:
        app.logger.warning("Google OAuth: No userinfo returned")
        return redirect(url_for("login_page"))

    google_id = info["sub"]
    email = info["email"]
    name = info.get("name") or email.split("@")[0]

    is_new = False
    user = User.query.filter_by(google_id=google_id).first()
    if not user:
        user = User.query.filter_by(email=email).first()
        if user:
            user.google_id = google_id
            user.email_verified = True
            is_new = False  # Existing user, not new
        else:
            user = User(name=name, email=email, google_id=google_id, email_verified=True)
            db.session.add(user)
            db.session.flush()
            db.session.add(Profile(user_id=user.id))
            
            # Expense categories
            expense_cats = [
                ("Food & Dining", "🍔"), ("Groceries", "🛒"), ("Transportation", "🚗"),
                ("Fuel", "⛽"), ("Housing", "🏠"), ("Rent", "🏘️"), ("Utilities", "💡"),
                ("Internet & Mobile", "📱"), ("Shopping", "🛍️"), ("Entertainment", "🍿"),
                ("Healthcare", "🏥"), ("Education", "📚"), ("Insurance", "🛡️"),
                ("Debt Payments", "💳"), ("Subscriptions", "📺"), ("Gifts & Donations", "🎁"),
                ("Travel", "✈️"), ("Other", "📦")
            ]
            for cat_name, cat_emoji in expense_cats:
                db.session.add(Category(user_id=user.id, name=cat_name, emoji=cat_emoji, category_type="expense", is_default=True))
            
            # Income categories
            income_cats = [
                ("Salary", "💵"), ("Pocket Money", "💸"), ("Freelance", "🚀"),
                ("Business Income", "💼"), ("Scholarship", "🎓"), ("Allowance", "👛"),
                ("Internship", "🧑‍💼"), ("Gift Received", "🎁"), ("Interest Income", "🏦"),
                ("Investment Returns", "📊"), ("Refund", "↩️"), ("Bonus", "🎉"),
                ("Side Hustle", "⚡"), ("Other", "📦")
            ]
            for cat_name, cat_emoji in income_cats:
                db.session.add(Category(user_id=user.id, name=cat_name, emoji=cat_emoji, category_type="income", is_default=True))
            
            is_new = True
        db.session.commit()

    session["user_id"] = user.id

    if is_new:
        return redirect(url_for("onboarding_page"))

    profile = Profile.query.filter_by(user_id=user.id).first()
    if not profile or not profile.onboarding_completed:
        return redirect(url_for("onboarding_page"))

    return redirect(url_for("index"))


if __name__ == "__main__":
    app.run(debug=False)
