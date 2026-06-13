from finora.extensions import db


class RoadmapItem(db.Model):
    __tablename__ = "roadmap_item"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    icon = db.Column(db.String(50), nullable=False, default="target")
    status = db.Column(db.String(20), nullable=False, default="pending")
    position = db.Column(db.Integer, nullable=False, default=0)
