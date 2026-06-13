def category_to_dict(c):
    """Convert Category model to dictionary"""
    return {"id": c.id, "name": c.name, "emoji": c.emoji, "color": c.color, 
            "category_type": c.category_type, "is_default": c.is_default}


def get_default_expense_categories():
    """Get list of default expense categories with emojis"""
    return [
        ("Food & Dining", "🍔"), ("Groceries", "🛒"), ("Transportation", "🚗"),
        ("Fuel", "⛽"), ("Housing", "🏠"), ("Rent", "🏘️"), ("Utilities", "💡"),
        ("Internet & Mobile", "📱"), ("Shopping", "🛍️"), ("Entertainment", "🍿"),
        ("Healthcare", "🏥"), ("Education", "📚"), ("Insurance", "🛡️"),
        ("Debt Payments", "💳"), ("Subscriptions", "📺"), ("Gifts & Donations", "🎁"),
        ("Travel", "✈️"), ("Other", "📦")
    ]


def get_default_income_categories():
    """Get list of default income categories with emojis"""
    return [
        ("Salary", "💵"), ("Pocket Money", "💸"), ("Freelance", "🚀"),
        ("Business Income", "💼"), ("Scholarship", "🎓"), ("Allowance", "👛"),
        ("Internship", "🧑‍💼"), ("Gift Received", "🎁"), ("Interest Income", "🏦"),
        ("Investment Returns", "📊"), ("Refund", "↩️"), ("Bonus", "🎉"),
        ("Side Hustle", "⚡"), ("Other", "📦")
    ]


def create_default_categories_for_user(user_id, db, Category):
    """Create default expense and income categories for a new user"""
    for name, emoji in get_default_expense_categories():
        db.session.add(Category(user_id=user_id, name=name, emoji=emoji, category_type="expense", is_default=True))
    
    for name, emoji in get_default_income_categories():
        db.session.add(Category(user_id=user_id, name=name, emoji=emoji, category_type="income", is_default=True))
