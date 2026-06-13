from flask import Blueprint, jsonify, request
from finora.extensions import db
from finora.models import Investment
from finora.services.investment_service import investment_to_dict, validate_investment
from finora.utils import login_required, get_current_user_id

investments_bp = Blueprint('investments', __name__, url_prefix='/api/investments')

@investments_bp.route('/', methods=['GET'])
@login_required
def get_investments():
    return jsonify([investment_to_dict(i) for i in Investment.query.filter_by(user_id=get_current_user_id()).all()])

@investments_bp.route('/', methods=['POST'])
@login_required
def create_investment():
    data = request.get_json(silent=True) or {}
    try:
        validate_investment(data)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    inv = Investment(user_id=get_current_user_id(), symbol=str(data["symbol"])[:100],
                     asset_type=str(data.get("type") or "Stock")[:50], quantity=float(data["shares"]),
                     average_cost=float(data.get("avgCost") or 0), current_value=float(data.get("currentPrice") or 0))
    db.session.add(inv)
    db.session.commit()
    return jsonify(investment_to_dict(inv)), 201

@investments_bp.route('/<int:inv_id>', methods=['PUT'])
@login_required
def update_investment(inv_id):
    inv = Investment.query.filter_by(id=inv_id, user_id=get_current_user_id()).first()
    if not inv:
        return jsonify({"error": "Investment not found"}), 404
    data = request.get_json(silent=True) or {}
    if "symbol" in data:
        inv.symbol = str(data["symbol"])[:100]
    if "type" in data:
        inv.asset_type = str(data["type"])[:50]
    if "shares" in data:
        inv.quantity = float(data["shares"])
    if "avgCost" in data:
        inv.average_cost = float(data["avgCost"])
    if "currentPrice" in data:
        inv.current_value = float(data["currentPrice"])
    db.session.commit()
    return jsonify(investment_to_dict(inv))

@investments_bp.route('/<int:inv_id>', methods=['DELETE'])
@login_required
def delete_investment(inv_id):
    inv = Investment.query.filter_by(id=inv_id, user_id=get_current_user_id()).first()
    if not inv:
        return jsonify({"error": "Investment not found"}), 404
    db.session.delete(inv)
    db.session.commit()
    return jsonify({"success": True})
