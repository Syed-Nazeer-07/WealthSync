def validate_password(password):
    """
    Validate password meets security requirements.
    Returns (True, None) if valid, (False, error_message) if invalid.
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one number"
    return True, None


def validate_signup_data(name, email, password):
    """
    Validate signup form data.
    Returns (True, None) if valid, (False, error_message) if invalid.
    """
    if not name or not email or not password:
        return False, "Name, email and password are required"
    
    is_valid, error = validate_password(password)
    if not is_valid:
        return False, error
    
    return True, None
