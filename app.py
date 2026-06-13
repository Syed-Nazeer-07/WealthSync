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

from finora.extensions import db, mail, migrate, oauth

db.init_app(app)
mail.init_app(app)
migrate.init_app(app, db)
oauth.init_app(app)

# Import models after db initialization
from finora.models import User, Profile, Transaction, Budget, Goal, Investment, RoadmapItem, UserSettings, Category

# Register blueprints
from finora.blueprints import register_blueprints
register_blueprints(app)

google = oauth.register(
    name="google",
    client_id=os.environ.get("GOOGLE_CLIENT_ID"),
    client_secret=os.environ.get("GOOGLE_CLIENT_SECRET"),
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
    token_url="https://oauth2.googleapis.com/token",
    client_kwargs={"scope": "openid email profile"},
)



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



if __name__ == '__main__':
    app.run(debug=False)
