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

