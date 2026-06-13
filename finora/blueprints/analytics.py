from flask import Blueprint, jsonify
from datetime import datetime

from finora.extensions import db
from finora.models import Transaction, Profile, Budget, Goal, Investment
from finora.services.analytics_service import (calculate_financial_health, generate_recommendations,
                                                 calculate_health_changes, calculate_net_worth_history)
from finora.utils import login_required, get_current_user_id

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api')


@analytics_bp.route('/financial-health', methods=['GET'])
@login_required
def get_financial_health():
    uid = get_current_user_id()
    
    now = datetime.utcnow()
    this_ym = f"{now.year}-{now.month:02d}"
    txs_this = Transaction.query.filter_by(user_id=uid).filter(Transaction.date.startswith(this_ym)).all()
    if not txs_this:
        txs_this = Transaction.query.filter_by(user_id=uid).all()
    
    profile = Profile.query.filter_by(user_id=uid).first()
    budgets = Budget.query.filter_by(user_id=uid).all()
    goals = Goal.query.filter_by(user_id=uid).all()
    investments = Investment.query.filter_by(user_id=uid).all()
    
    current_health = calculate_financial_health(txs_this, profile, budgets, goals, investments)
    
    last_month = now.month - 1 if now.month > 1 else 12
    last_year = now.year if now.month > 1 else now.year - 1
    last_ym = f"{last_year}-{last_month:02d}"
    txs_last = Transaction.query.filter_by(user_id=uid).filter(Transaction.date.startswith(last_ym)).all()
    
    if txs_last:
        last_health = calculate_financial_health(txs_last, profile, budgets, goals, investments)
    else:
        last_health = current_health
    
    recommendations = generate_recommendations(current_health, profile, budgets, txs_this)
    changes = calculate_health_changes(current_health, last_health)
    
    return jsonify({
        "current": current_health,
        "previous": last_health,
        "recommendations": recommendations,
        "changes": changes
    })


@analytics_bp.route('/net-worth-history')
@login_required
def net_worth_history():
    uid = get_current_user_id()
    p = Profile.query.filter_by(user_id=uid).first()
    txs = Transaction.query.filter_by(user_id=uid).all()

    return jsonify(calculate_net_worth_history(txs, p))
