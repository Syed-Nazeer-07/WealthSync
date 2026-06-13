def transaction_to_dict(t):
    """Convert Transaction model to dictionary"""
    return {"id": t.id, "description": t.description, "amount": t.amount,
            "category": t.category, "type": t.type, "date": t.date}


def validate_transaction(data):
    """
    Validate transaction data.
    Returns (amount, None) if valid, (None, error_response) if invalid.
    """
    required = ["description", "amount", "category", "type", "date"]
    missing = [f for f in required if not data.get(f) and data.get(f) != 0]
    if missing:
        return None, {"error": f"Missing fields: {', '.join(missing)}"}, 400
    if data["type"] not in ("income", "expense"):
        return None, {"error": "type must be 'income' or 'expense'"}, 400
    try:
        return float(data["amount"]), None
    except (ValueError, TypeError):
        return None, {"error": "amount must be a number"}, 400
