from flask import Blueprint, jsonify, request
from finora.extensions import db
from finora.models import Budget
from finora.services.budget_service import budget_to_dict, validate_budget
from finora.utils import login_required, get_current_user_id

budgets_bp = Blueprint('budgets', __name__, url_prefix='/api/budgets')

@budgets_bp.route('/', methods=['GET'])
@login_required
def get_budgets():
    budgets = Budget.query.filter_by(user_id=get_current_user_id()).all()
    return jsonify([budget_to_dict(b) for b in budgets])

@budgets_bp.route('/', methods=['POST'])
@login_required
def create_budget():
    data = request.get_json(silent=True) or {}
    try:
        validate_budget(data)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    b = Budget(user_id=get_current_user_id(), category=str(data["category"])[:50], limit_amount=float(data["limit"]))
    db.session.add(b)
    db.session.commit()
    return jsonify(budget_to_dict(b)), 201

@budgets_bp.route('/<int:budget_id>', methods=['PUT'])
@login_required
def update_budget(budget_id):
    b = Budget.query.filter_by(id=budget_id, user_id=get_current_user_id()).first()
    if not b:
        return jsonify({"error": "Budget not found"}), 404
    data = request.get_json(silent=True) or {}
    if "category" in data:
        b.category = str(data["category"])[:50]
    if "limit" in data:
        b.limit_amount = float(data["limit"])
    db.session.commit()
    return jsonify(budget_to_dict(b))

@budgets_bp.route('/<int:budget_id>', methods=['DELETE'])
@login_required
def delete_budget(budget_id):
    b = Budget.query.filter_by(id=budget_id, user_id=get_current_user_id()).first()
    if not b:
        return jsonify({"error": "Budget not found"}), 404
    db.session.delete(b)
    db.session.commit()
    return jsonify({"success": True})
