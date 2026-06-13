from flask import Blueprint, jsonify, request
from finora.extensions import db
from finora.models import RoadmapItem
from finora.services.roadmap_service import roadmap_to_dict, validate_roadmap_item
from finora.utils import login_required, get_current_user_id

roadmap_bp = Blueprint('roadmap', __name__, url_prefix='/api/roadmap')


@roadmap_bp.route('/', methods=['GET'])
@login_required
def get_roadmap():
    items = RoadmapItem.query.filter_by(user_id=get_current_user_id()).order_by(RoadmapItem.position).all()
    return jsonify([roadmap_to_dict(r) for r in items])


@roadmap_bp.route('/', methods=['POST'])
@login_required
def create_roadmap_item():
    data = request.get_json(silent=True) or {}
    try:
        validate_roadmap_item(data)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    count = RoadmapItem.query.filter_by(user_id=get_current_user_id()).count()
    item = RoadmapItem(user_id=get_current_user_id(), title=str(data["title"])[:100],
                       icon=str(data.get("icon") or "target")[:50],
                       status=str(data.get("status") or "pending"),
                       position=count)
    db.session.add(item)
    db.session.commit()
    return jsonify(roadmap_to_dict(item)), 201


@roadmap_bp.route('/<int:item_id>', methods=['PUT'])
@login_required
def update_roadmap_item(item_id):
    item = RoadmapItem.query.filter_by(id=item_id, user_id=get_current_user_id()).first()
    if not item:
        return jsonify({"error": "Not found"}), 404
    data = request.get_json(silent=True) or {}
    if "title" in data:
        item.title = str(data["title"])[:100]
    if "icon" in data:
        item.icon = str(data["icon"])[:50]
    if "status" in data:
        item.status = str(data["status"])
    db.session.commit()
    return jsonify(roadmap_to_dict(item))


@roadmap_bp.route('/<int:item_id>', methods=['DELETE'])
@login_required
def delete_roadmap_item(item_id):
    item = RoadmapItem.query.filter_by(id=item_id, user_id=get_current_user_id()).first()
    if not item:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(item)
    db.session.commit()
    return jsonify({"success": True})
