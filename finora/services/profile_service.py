def profile_to_dict(p):
    """Convert Profile model to dictionary"""
    return {
        "monthly_income":      p.monthly_income,
        "current_savings":     p.current_savings,
        "current_investments": p.current_investments,
        "monthly_expenses":    p.monthly_expenses,
        "financial_goal":      p.financial_goal,
        "account_mode":        p.account_mode,
        "onboarding_completed": p.onboarding_completed,
        "tutorial_completed":  p.tutorial_completed,
    }


def validate_profile_field(field_name, value):
    """
    Validate a profile numeric field.
    Returns (validated_value, None) if valid, (None, error_message) if invalid.
    """
    try:
        val = float(value or 0)
        if val < 0:
            return None, f"{field_name} cannot be negative"
        if val > 1e10:
            return None, f"{field_name} exceeds reasonable limit"
        return val, None
    except (ValueError, TypeError):
        return None, "Invalid numeric values provided"


def update_profile_from_data(profile, data):
    """Update profile model from request data"""
    numeric_fields = ["monthly_income", "current_savings", "current_investments", "monthly_expenses"]
    
    for field in numeric_fields:
        if field in data:
            val, err = validate_profile_field(field, data[field])
            if err:
                return False, err
            setattr(profile, field, val)
    
    if "financial_goal" in data:
        profile.financial_goal = str(data["financial_goal"])[:200]
    if "account_mode" in data:
        mode = str(data["account_mode"])
        if mode in ("income", "cashflow"):
            profile.account_mode = mode
    if "onboarding_completed" in data:
        profile.onboarding_completed = bool(data["onboarding_completed"])
    if "tutorial_completed" in data:
        profile.tutorial_completed = bool(data["tutorial_completed"])
    
    return True, None
