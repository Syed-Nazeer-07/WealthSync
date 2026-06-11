"""
Migration: Fix Category UNIQUE constraint to include category_type

This fixes the production bug where signup fails with:
  UNIQUE constraint failed: category.user_id, category.name

ROOT CAUSE: Both income and expense categories have 'Other', but the
constraint is only (user_id, name), not (user_id, name, category_type).

This migration drops the old constraint and creates the correct one.
"""

from app import app, db
from sqlalchemy import text

def migrate():
    with app.app_context():
        # Detect database type
        engine_name = db.engine.name
        
        if engine_name == 'sqlite':
            print("SQLite detected - recreating table with new constraint")
            
            # SQLite doesn't support dropping constraints, so we need to recreate the table
            db.session.execute(text("""
                CREATE TABLE category_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    name VARCHAR(50) NOT NULL,
                    emoji VARCHAR(10) NOT NULL DEFAULT '📦',
                    color VARCHAR(7) NOT NULL DEFAULT '#3b82f6',
                    category_type VARCHAR(10) NOT NULL DEFAULT 'expense',
                    is_default BOOLEAN NOT NULL DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES user(id),
                    UNIQUE(user_id, name, category_type)
                )
            """))
            
            # Copy data
            db.session.execute(text("""
                INSERT INTO category_new (id, user_id, name, emoji, color, category_type, is_default, created_at)
                SELECT id, user_id, name, emoji, color, category_type, is_default, created_at
                FROM category
            """))
            
            # Drop old table and rename
            db.session.execute(text("DROP TABLE category"))
            db.session.execute(text("ALTER TABLE category_new RENAME TO category"))
            
        elif engine_name == 'postgresql':
            print("PostgreSQL detected - updating constraint")
            
            # Drop old constraint
            db.session.execute(text("""
                ALTER TABLE category 
                DROP CONSTRAINT IF EXISTS _user_category_uc
            """))
            
            # Add new constraint
            db.session.execute(text("""
                ALTER TABLE category 
                ADD CONSTRAINT _user_category_uc 
                UNIQUE (user_id, name, category_type)
            """))
        
        db.session.commit()
        print("✓ Migration complete - UNIQUE constraint now includes category_type")

if __name__ == "__main__":
    migrate()
