from flask import Blueprint, jsonify, Response
from datetime import datetime
import csv
import io
import json as _json

from finora.extensions import db
from finora.models import User, Profile, Transaction, Budget, Goal, Investment
from finora.utils import login_required, get_current_user_id, get_current_user

export_bp = Blueprint('export', __name__, url_prefix='/api/export')


@export_bp.route('/transactions')
@login_required
def export_transactions():
    txs = Transaction.query.filter_by(user_id=get_current_user_id()).order_by(Transaction.date.desc()).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Date", "Description", "Category", "Type", "Amount"])
    for t in txs:
        w.writerow([t.date, t.description, t.category, t.type, t.amount])
    buf.seek(0)
    return Response(buf.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=transactions.csv"})


@export_bp.route('/data')
@login_required
def export_data():
    uid = get_current_user_id()
    user = get_current_user()
    p = Profile.query.filter_by(user_id=uid).first()
    data = {
        "exported_at": datetime.utcnow().isoformat(),
        "user": {"name": user.name, "email": user.email, "created_at": user.created_at.isoformat()},
        "profile": {"monthly_income": p.monthly_income, "current_savings": p.current_savings,
                    "current_investments": p.current_investments, "monthly_expenses": p.monthly_expenses,
                    "financial_goal": p.financial_goal} if p else {},
        "transactions": [{"date": t.date, "description": t.description, "category": t.category,
                          "type": t.type, "amount": t.amount}
                         for t in Transaction.query.filter_by(user_id=uid).all()],
        "budgets": [{"category": b.category, "limit": b.limit_amount}
                    for b in Budget.query.filter_by(user_id=uid).all()],
        "goals": [{"title": g.title, "target": g.target_amount, "current": g.current_amount,
                   "monthly_contribution": g.monthly_contribution, "target_date": g.target_date}
                  for g in Goal.query.filter_by(user_id=uid).all()],
        "investments": [{"symbol": i.symbol, "type": i.asset_type, "quantity": i.quantity,
                         "average_cost": i.average_cost, "current_value": i.current_value}
                        for i in Investment.query.filter_by(user_id=uid).all()],
    }
    return Response(_json.dumps(data, indent=2), mimetype="application/json",
                    headers={"Content-Disposition": "attachment; filename=finora_data.json"})
