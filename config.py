import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))


class Config:
    """Base configuration"""
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
    
    # Database
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 3600,
        "echo": False
    }
    
    # Session
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = os.environ.get("PREFERRED_URL_SCHEME", "http") == "https"
    
    # Security
    PROPAGATE_EXCEPTIONS = True
    
    # Mail
    MAIL_SERVER = os.environ.get("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.environ.get("MAIL_PORT", 587))
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME")
    MAIL_PASSWORD = os.environ.get("MAIL_PASSWORD")
    MAIL_DEFAULT_SENDER = os.environ.get("MAIL_DEFAULT_SENDER", os.environ.get("MAIL_USERNAME"))
    
    # OAuth
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
    
    @staticmethod
    def init_app(app):
        """Initialize app-specific configuration"""
        pass


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL") or "sqlite:///wealthsync.db"


class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    
    def __init__(self):
        super().__init__()
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            raise RuntimeError("DATABASE_URL environment variable is required in production")
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        self.SQLALCHEMY_DATABASE_URI = database_url
    
    @staticmethod
    def init_app(app):
        """Initialize production-specific configuration"""
        Config.init_app(app)
        
        # Log database configuration
        db_uri = app.config.get("SQLALCHEMY_DATABASE_URI", "")
        if db_uri.startswith("postgresql://"):
            parts = db_uri.split('@')
            if len(parts) == 2:
                host_db = parts[1].split('/')[0]
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


config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig if os.environ.get("FLASK_ENV") != "production" else ProductionConfig
}
