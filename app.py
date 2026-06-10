from flask import Flask, render_template, jsonify, request, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from flask_mail import Mail, Message
from authlib.integrations.flask_client import OAuth
from datetime import date, datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv
import os, secrets

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

app = Flask(__name__)

app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///wealthsync.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")

app.config["MAIL_SERVER"]   = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
app.config["MAIL_PORT"]     = int(os.environ.get("MAIL_PORT", 587))
app.config["MAIL_USE_TLS"]  = True
app.config["MAIL_USERNAME"] = os.environ.get("MAIL_USERNAME")
app.config["MAIL_PASSWORD"] = os.environ.get("MAIL_PASSWORD")
app.config["MAIL_DEFAULT_SENDER"] = os.environ.get("MAIL_DEFAULT_SENDER", os.environ.get("MAIL_USERNAME"))

db = SQLAlchemy(app)
mail = Mail(app)

oauth = OAuth(app)
google = oauth.register(
    name="google",
    client_id=os.environ.get("GOOGLE_CLIENT_ID"),
    client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)


# ─── Models ───────────────────────────────────────────────────────────────────

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

    profile      = db.relationship("Profile",     back_populates="user", uselist=False, cascade="all, delete-orphan")
    transactions = db.relationship("Transaction", back_populates="user", cascade="all, delete-orphan")


class Profile(db.Model):
    id                   = db.Column(db.Integer, primary_key=True)
    user_id              = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, unique=True)
    monthly_income       = db.Column(db.Float, default=0)
    current_savings      = db.Column(db.Float, default=0)
    current_investments  = db.Column(db.Float, default=0)
    monthly_expenses     = db.Column(db.Float, default=0)
    financial_goal       = db.Column(db.String(200), default="")
    onboarding_completed = db.Column(db.Boolean, default=False)

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


class Goal(db.Model):
    id             = db.Column(db.Integer, primary_key=True)
    user_id        = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    title          = db.Column(db.String(100), nullable=False)
    target_amount  = db.Column(db.Float, nullable=False)
    current_amount = db.Column(db.Float, default=0)
    monthly_contribution = db.Column(db.Float, default=0)
    target_date    = db.Column(db.String(10), nullable=True)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)


class Investment(db.Model):
    id            = db.Column(db.Integer, primary_key=True)
    user_id       = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    symbol        = db.Column(db.String(100), nullable=False)
    asset_type    = db.Column(db.String(50), nullable=False)
    quantity      = db.Column(db.Float, nullable=False)
    average_cost  = db.Column(db.Float, nullable=False)
    current_value = db.Column(db.Float, nullable=False)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)


# ─── Seed ─────────────────────────────────────────────────────────────────────

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

        if Transaction.query.count() == 0:
            db.session.add_all([
                Transaction(user_id=demo.id, description="TechCorp Salary",     amount=150000, category="Salary",       type="income",  date="2026-06-05"),
                Transaction(user_id=demo.id, description="Amazon Purchase",      amount=12000,  category="Shopping",      type="expense", date="2026-06-08"),
                Transaction(user_id=demo.id, description="Zomato Delivery",      amount=850,    category="Food & Dining", type="expense", date="2026-06-03"),
                Transaction(user_id=demo.id, description="Apartment Rent",       amount=25000,  category="Housing",       type="expense", date="2026-06-01"),
                Transaction(user_id=demo.id, description="Netflix Subscription", amount=649,    category="Entertainment", type="expense", date="2026-05-28"),
                Transaction(user_id=demo.id, description="Uber Rides",           amount=1240,   category="Transport",     type="expense", date="2026-05-25"),
            ])
        else:
            Transaction.query.filter_by(user_id=None).update({"user_id": demo.id})

        db.session.commit()


# ─── Helpers ──────────────────────────────────────────────────────────────────

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


# ─── Auth routes ──────────────────────────────────────────────────────────────

@app.route("/login")
def login_page():
    if session.get("user_id"):
        return redirect(url_for("index"))
    return render_template("login.html")


@app.route("/api/auth/signup", methods=["POST"])
def signup():
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
    db.session.commit()

    _send_verification_email(user, token)

    return jsonify({"pending": True, "email": email}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email    = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.password_hash or not check_password_hash(user.password_hash, password):
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
    return jsonify({"id": user.id, "name": user.name, "email": user.email})


# ─── App routes ───────────────────────────────────────────────────────────────

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


# ─── Profile API ─────────────────────────────────────────────────────────────

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
        "onboarding_completed": p.onboarding_completed,
    })


@app.route("/api/profile", methods=["PUT"])
def update_profile():
    err = login_required_json()
    if err: return err
    p = Profile.query.filter_by(user_id=session["user_id"]).first()
    if not p:
        return jsonify({"error": "Profile not found"}), 404
    data = request.get_json(silent=True) or {}
    if "monthly_income"      in data: p.monthly_income      = float(data["monthly_income"] or 0)
    if "current_savings"     in data: p.current_savings     = float(data["current_savings"] or 0)
    if "current_investments" in data: p.current_investments = float(data["current_investments"] or 0)
    if "monthly_expenses"    in data: p.monthly_expenses    = float(data["monthly_expenses"] or 0)
    if "financial_goal"      in data: p.financial_goal      = str(data["financial_goal"])[:200]
    if "onboarding_completed" in data: p.onboarding_completed = bool(data["onboarding_completed"])
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


# ─── Email helper ─────────────────────────────────────────────────────────────

def _send_verification_email(user, token):
    verify_url = url_for("verify_email", token=token, _external=True)
    html = f"""
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#0B0F19;color:#e2e8f0;border-radius:16px;overflow:hidden">
      <div style="background:linear-gradient(135deg,#2563eb,#4f46e5);padding:32px 40px">
        <h1 style="margin:0;font-size:24px;color:#fff">WealthSync</h1>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.7);font-size:14px">Personal Financial OS</p>
      </div>
      <div style="padding:40px">
        <h2 style="margin:0 0 8px;color:#f1f5f9;font-size:20px">Hi {user.name},</h2>
        <p style="color:#94a3b8;margin:0 0 32px;line-height:1.6">Verify your email address to activate your WealthSync account and start tracking your finances.</p>
        <a href="{verify_url}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#4f46e5);color:#fff;text-decoration:none;padding:14px 32px;border-radius:12px;font-weight:600;font-size:15px">Verify Email Address</a>
        <p style="margin:32px 0 8px;color:#64748b;font-size:13px">Or copy this link:</p>
        <p style="word-break:break-all;color:#60a5fa;font-size:12px;background:#1e293b;padding:12px;border-radius:8px">{verify_url}</p>
        <p style="margin:24px 0 0;color:#475569;font-size:12px">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
      </div>
    </div>
    """
    try:
        msg = Message(subject="Verify your WealthSync account", recipients=[user.email], html=html)
        mail.send(msg)
    except Exception:
        pass  # Don't crash signup if mail fails; token is in DB for resend


# ─── Verification routes ───────────────────────────────────────────────────────

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


@app.route("/api/auth/resend-verification", methods=["POST"])
def resend_verification():
    data  = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    # Always return success — no user enumeration
    user = User.query.filter_by(email=email).first()
    if user and not user.email_verified and user.password_hash:
        # Rate limit: only resend if last token is >60s old
        if not user.email_verification_expires or \
           datetime.utcnow() > user.email_verification_expires - timedelta(hours=23, minutes=59):
            user.email_verification_token   = secrets.token_urlsafe(32)
            user.email_verification_expires = datetime.utcnow() + timedelta(hours=24)
            db.session.commit()
            _send_verification_email(user, user.email_verification_token)

    return jsonify({"message": "If that email is registered and unverified, a new link has been sent."})


@app.route("/auth/google")
def google_login():
    redirect_uri = url_for("google_callback", _external=True)
    return google.authorize_redirect(redirect_uri)


@app.route("/auth/google/callback")
def google_callback():
    if request.args.get("error"):
        return redirect(url_for("login_page"))
    token = google.authorize_access_token()
    info = token.get("userinfo")
    if not info:
        return redirect(url_for("login_page"))

    google_id = info["sub"]
    email = info["email"]
    name = info.get("name") or email.split("@")[0]

    is_new = False
    user = User.query.filter_by(google_id=google_id).first()
    if not user:
        user = User.query.filter_by(email=email).first()
        if user:
            user.google_id = google_id  # link existing account
            user.email_verified = True
        else:
            user = User(name=name, email=email, google_id=google_id, email_verified=True)
            db.session.add(user)
            db.session.flush()
            db.session.add(Profile(user_id=user.id))
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
    app.run(debug=True)
