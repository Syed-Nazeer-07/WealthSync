"""Migration script to add default categories to existing users"""

from app import app, db, User, Category

DEFAULT_CATEGORIES = [
    ("Food & Dining", "🍔"), ("Groceries", "🛒"), ("Transportation", "🚗"),
    ("Fuel", "⛽"), ("Housing", "🏠"), ("Utilities", "💡"),
    ("Internet & Mobile", "📱"), ("Shopping", "🛍️"), ("Entertainment", "🍿"),
    ("Subscriptions", "📺"), ("Education", "📚"), ("Healthcare", "🏥"),
    ("Insurance", "🛡️"), ("Travel", "✈️"), ("Gifts & Donations", "🎁"),
    ("Investments", "📈"), ("Savings", "💰"), ("Debt Payments", "💳"),
    ("Salary", "💵"), ("Freelance Income", "🚀"), ("Pocket Money", "💸"),
    ("Other", "📦")
]

with app.app_context():
    users = User.query.all()
    for user in users:
        existing = Category.query.filter_by(user_id=user.id).count()
        if existing == 0:
            print(f"Adding categories for user {user.email}...")
            for name, emoji in DEFAULT_CATEGORIES:
                db.session.add(Category(user_id=user.id, name=name, emoji=emoji, is_default=True))
            db.session.commit()
            print(f"  ✓ Added {len(DEFAULT_CATEGORIES)} categories")
        else:
            print(f"Skipping user {user.email} (already has {existing} categories)")
    
    print("\nMigration complete!")
