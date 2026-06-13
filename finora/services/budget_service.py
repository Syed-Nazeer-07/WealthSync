def budget_to_dict(b):
    """Convert Budget model to dictionary"""
    return {"id": b.id, "category": b.category, "limit": b.limit_amount}


def validate_budget(data):
    """
    Validate budget data.
    Returns True if valid, raises ValueError if invalid.
    """
    if not data.get("category") or not data.get("limit"):
        raise ValueError("category and limit are required")
    return True
