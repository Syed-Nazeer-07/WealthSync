from flask import Blueprint, jsonify, request
from finora.extensions import db
from finora.models import Category, Transaction
from finora.services.category_service import category_to_dict
from finora.utils import login_required, get_current_user_id

categories_bp = Blueprint('categories', __name__, url_prefix='/api/categories')


@categories_bp.route('/', methods=['GET'])
@login_required
def get_categories():
    cats = Category.query.filter_by(user_id=get_current_user_id()).order_by(Category.is_default.desc(), Category.name).all()
    return jsonify([category_to_dict(c) for c in cats])


@categories_bp.route('/', methods=['POST'])
@login_required
def create_category():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name or len(name) > 50:
        return jsonify({"error": "Category name must be 1-50 characters"}), 400
    
    category_type = (data.get("category_type") or "expense").strip()
    if category_type not in ("income", "expense"):
        return jsonify({"error": "category_type must be 'income' or 'expense'"}), 400
    
    existing = Category.query.filter_by(user_id=get_current_user_id(), name=name, category_type=category_type).first()
    if existing:
        return jsonify({"error": "Category already exists"}), 400
    
    emoji = (data.get("emoji") or "📦").strip()[:10]
    color = (data.get("color") or "#3b82f6").strip()[:7]
    cat = Category(user_id=get_current_user_id(), name=name, emoji=emoji, color=color, category_type=category_type, is_default=False)
    db.session.add(cat)
    db.session.commit()
    return jsonify(category_to_dict(cat)), 201


@categories_bp.route('/<int:cat_id>', methods=['PUT'])
@login_required
def update_category(cat_id):
    cat = Category.query.filter_by(id=cat_id, user_id=get_current_user_id()).first()
    if not cat:
        return jsonify({"error": "Not found"}), 404
    if cat.is_default:
        return jsonify({"error": "Cannot edit default categories"}), 400
    
    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = (data["name"] or "").strip()
        if not name or len(name) > 50:
            return jsonify({"error": "Name must be 1-50 characters"}), 400
        dup = Category.query.filter_by(user_id=get_current_user_id(), name=name, category_type=cat.category_type).filter(Category.id != cat_id).first()
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
    return jsonify(category_to_dict(cat))


@categories_bp.route('/<int:cat_id>', methods=['DELETE'])
@login_required
def delete_category(cat_id):
    cat = Category.query.filter_by(id=cat_id, user_id=get_current_user_id()).first()
    if not cat:
        return jsonify({"error": "Not found"}), 404
    if cat.is_default:
        return jsonify({"error": "Cannot delete default categories"}), 400
    
    in_use = Transaction.query.filter_by(user_id=get_current_user_id(), category=cat.name).first()
    if in_use:
        return jsonify({"error": "Category is in use by transactions. Reassign them first."}), 400
    
    db.session.delete(cat)
    db.session.commit()
    return jsonify({"success": True})
