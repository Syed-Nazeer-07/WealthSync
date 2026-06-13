from datetime import date, datetime
from finora.extensions import db


class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    description = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    type = db.Column(db.String(10), nullable=False, default="expense")
    date = db.Column(db.String(10), nullable=False, default=str(date.today()))

    user = db.relationship("User", back_populates="transactions")


class Category(db.Model):
    __tablename__ = "category"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    emoji = db.Column(db.String(10), nullable=False, default="📦")
    color = db.Column(db.String(7), nullable=False, default="#3b82f6")
    category_type = db.Column(db.String(10), nullable=False, default="expense")
    is_default = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('user_id', 'name', 'category_type', name='_user_category_uc'),)
