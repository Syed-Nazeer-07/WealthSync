VALID_TIMEZONES = {
    "UTC", "Asia/Kolkata", "America/New_York", "America/Chicago", "America/Los_Angeles",
    "America/Toronto", "Europe/London", "Europe/Paris", "Europe/Berlin", "Asia/Dubai",
    "Asia/Singapore", "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney", "Pacific/Auckland"
}

CURRENCIES = {
    "INR": {"symbol": "₹", "locale": "en-IN"},
    "USD": {"symbol": "$", "locale": "en-US"},
    "EUR": {"symbol": "€", "locale": "de-DE"},
    "GBP": {"symbol": "£", "locale": "en-GB"},
    "AED": {"symbol": "د.إ", "locale": "ar-AE"},
    "SGD": {"symbol": "S$", "locale": "en-SG"},
}


def get_or_create_settings(user_id, db, UserSettings):
    """Get or create user settings"""
    s = UserSettings.query.filter_by(user_id=user_id).first()
    if not s:
        s = UserSettings(user_id=user_id)
        db.session.add(s)
        db.session.commit()
    return s


def settings_to_dict(s):
    """Convert UserSettings model to dictionary"""
    return {
        "theme": s.theme,
        "currency": s.currency,
        "currency_symbol": s.currency_symbol,
        "currency_locale": s.currency_locale,
        "show_greeting": s.show_greeting,
        "sidebar_collapsed": s.sidebar_collapsed,
        "timezone": s.timezone or "UTC",
    }


def update_settings_from_data(settings, data):
    """Update settings model from request data"""
    if "theme" in data:
        settings.theme = str(data["theme"])[:10]
    if "show_greeting" in data:
        settings.show_greeting = bool(data["show_greeting"])
    if "sidebar_collapsed" in data:
        settings.sidebar_collapsed = bool(data["sidebar_collapsed"])
    if "timezone" in data:
        tz = str(data["timezone"])[:50]
        if tz in VALID_TIMEZONES:
            settings.timezone = tz
    if "currency" in data:
        cur = str(data["currency"])[:10]
        if cur in CURRENCIES:
            settings.currency = cur
            settings.currency_symbol = CURRENCIES[cur]["symbol"]
            settings.currency_locale = CURRENCIES[cur]["locale"]
