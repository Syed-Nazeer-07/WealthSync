from flask import Blueprint, jsonify, request
from finora.extensions import db
from finora.models import Goal, Transaction
from finora.services.goal_service import goal_to_dict, calculate_goal_forecasts
from finora.utils import login_required, get_current_user_id

goals_bp = Blueprint('goals', __name__, url_prefix='/api/goals')

@goals_bp.route('/', methods=['GET'])
@login_required
def get_goals():
    goals = Goal.query.filter_by(user_id=get_current_user_id()).all()
    return jsonify([goal_to_dict(g) for g in goals])

@goals_bp.route('/', methods=['POST'])
@login_required
def create_goal():
    data = request.get_json(silent=True) or {}
    if not data.get("name") or not data.get("target"):
        return jsonify({"error": "name and target are required"}), 400
    g = Goal(user_id=get_current_user_id(), title=str(data["name"])[:100], target_amount=float(data["target"]),
             current_amount=float(data.get("current") or 0), monthly_contribution=float(data.get("monthlyContribution") or 0),
             target_date=str(data["date"]) if data.get("date") else None)
    db.session.add(g)
    db.session.commit()
    return jsonify(goal_to_dict(g)), 201

@goals_bp.route('/<int:goal_id>', methods=['PUT'])
@login_required
def update_goal(goal_id):
    g = Goal.query.filter_by(id=goal_id, user_id=get_current_user_id()).first()
    if not g:
        return jsonify({"error": "Goal not found"}), 404
    data = request.get_json(silent=True) or {}
    if "name" in data:
        g.title = str(data["name"])[:100]
    if "target" in data:
        g.target_amount = float(data["target"])
    if "current" in data:
        g.current_amount = float(data["current"])
    if "monthlyContribution" in data:
        g.monthly_contribution = float(data["monthlyContribution"])
    if "date" in data:
        g.target_date = str(data["date"]) if data["date"] else None
    db.session.commit()
    return jsonify(goal_to_dict(g))

@goals_bp.route('/<int:goal_id>', methods=['DELETE'])
@login_required
def delete_goal(goal_id):
    g = Goal.query.filter_by(id=goal_id, user_id=get_current_user_id()).first()
    if not g:
        return jsonify({"error": "Goal not found"}), 404
    db.session.delete(g)
    db.session.commit()
    return jsonify({"success": True})

@goals_bp.route('/forecast', methods=['GET'])
@login_required
def forecast_goals():
    uid = get_current_user_id()
    goals = Goal.query.filter_by(user_id=uid).all()
    txs = Transaction.query.filter_by(user_id=uid).all()
    return jsonify(calculate_goal_forecasts(goals, txs))
