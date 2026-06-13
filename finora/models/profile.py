from finora.extensions import db


class Profile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, unique=True)
    monthly_income = db.Column(db.Float, default=0)
    current_savings = db.Column(db.Float, default=0)
    current_investments = db.Column(db.Float, default=0)
    monthly_expenses = db.Column(db.Float, default=0)
    financial_goal = db.Column(db.String(200), default="")
    account_mode = db.Column(db.String(20), default="income", nullable=False)
    onboarding_completed = db.Column(db.Boolean, default=False)
    tutorial_completed = db.Column(db.Boolean, default=False)

    user = db.relationship("User", back_populates="profile")


class UserSettings(db.Model):
    __tablename__ = "user_settings"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, unique=True)
    theme = db.Column(db.String(10), default="light")
    currency = db.Column(db.String(10), default="INR")
    currency_symbol = db.Column(db.String(5), default="₹")
    currency_locale = db.Column(db.String(10), default="en-IN")
    show_greeting = db.Column(db.Boolean, default=True)
    sidebar_collapsed = db.Column(db.Boolean, default=False)
    timezone = db.Column(db.String(50), default="UTC")

    user = db.relationship("User", backref=db.backref("settings", uselist=False))
