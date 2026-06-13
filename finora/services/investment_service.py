def investment_to_dict(i):
    """Convert Investment model to dictionary"""
    return {"id": i.id, "symbol": i.symbol, "type": i.asset_type,
            "shares": i.quantity, "avgCost": i.average_cost, "currentPrice": i.current_value}


def validate_investment(data):
    """
    Validate investment data.
    Returns True if valid, raises ValueError if invalid.
    """
    if not data.get("symbol") or not data.get("shares"):
        raise ValueError("symbol and shares are required")
    return True
