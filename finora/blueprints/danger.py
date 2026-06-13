from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash

from finora.extensions import db
from finora.models import Transaction, Budget, Goal, Investment, RoadmapItem, Profile, User
from finora.utils import login_required, get_current_user_id, get_current_user

danger_bp = Blueprint('danger', __name__, url_prefix='/api/danger')


@danger_bp.route('/clear-transactions', methods=['DELETE'])
@login_required
def clear_transactions():
    Transaction.query.filter_by(user_id=get_current_user_id()).delete()
    db.session.commit()
    return jsonify({"success": True})


@danger_bp.route('/clear-financial-data', methods=['DELETE'])
@login_required
def clear_financial_data():
    uid = get_current_user_id()
    Transaction.query.filter_by(user_id=uid).delete()
    Budget.query.filter_by(user_id=uid).delete()
    Goal.query.filter_by(user_id=uid).delete()
    Investment.query.filter_by(user_id=uid).delete()
    RoadmapItem.query.filter_by(user_id=uid).delete()
    p = Profile.query.filter_by(user_id=uid).first()
    if p:
        p.monthly_income = 0
        p.current_savings = 0
        p.current_investments = 0
        p.monthly_expenses = 0
        p.financial_goal = ""
    db.session.commit()
    return jsonify({"success": True})


@danger_bp.route('/delete-account', methods=['DELETE'])
@login_required
def delete_account():
    data = request.get_json(silent=True) or {}
    user = get_current_user()
    if user.password_hash:
        if not check_password_hash(user.password_hash, data.get("password", "")):
            return jsonify({"error": "Incorrect password"}), 401
    db.session.delete(user)
    db.session.commit()
    session.clear()
    return jsonify({"success": True})
