from flask import Blueprint, jsonify, request
from finora.extensions import db
from finora.models import Transaction
from finora.services.transaction_service import transaction_to_dict, validate_transaction
from finora.utils import login_required, get_current_user_id

transactions_bp = Blueprint('transactions', __name__, url_prefix='/api/transactions')

@transactions_bp.route('/', methods=['GET'])
@login_required
def get_transactions():
    txs = Transaction.query.filter_by(user_id=get_current_user_id()).order_by(Transaction.date.desc()).all()
    return jsonify([transaction_to_dict(t) for t in txs])

@transactions_bp.route('/', methods=['POST'])
@login_required
def create_transaction():
    data = request.get_json(silent=True) or {}
    amount, err = validate_transaction(data)
    if err:
        error_dict, status_code = err
        return jsonify(error_dict), status_code
    t = Transaction(user_id=get_current_user_id(), description=str(data["description"])[:100],
                    amount=amount, category=str(data["category"])[:50], type=data["type"], date=str(data["date"]))
    db.session.add(t)
    db.session.commit()
    return jsonify(transaction_to_dict(t)), 201

@transactions_bp.route('/<int:tx_id>', methods=['PUT'])
@login_required
def update_transaction(tx_id):
    t = Transaction.query.filter_by(id=tx_id, user_id=get_current_user_id()).first()
    if not t:
        return jsonify({"error": "Transaction not found"}), 404
    data = request.get_json(silent=True) or {}
    amount, err = validate_transaction(data)
    if err:
        error_dict, status_code = err
        return jsonify(error_dict), status_code
    t.description = str(data["description"])[:100]
    t.amount = amount
    t.category = str(data["category"])[:50]
    t.type = data["type"]
    t.date = str(data["date"])
    db.session.commit()
    return jsonify(transaction_to_dict(t))

@transactions_bp.route('/<int:tx_id>', methods=['DELETE'])
@login_required
def delete_transaction(tx_id):
    t = Transaction.query.filter_by(id=tx_id, user_id=get_current_user_id()).first()
    if not t:
        return jsonify({"error": "Transaction not found"}), 404
    db.session.delete(t)
    db.session.commit()
    return jsonify({"success": True})
