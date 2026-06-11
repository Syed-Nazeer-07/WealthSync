"""Add account_mode column to existing profiles"""

import sqlite3

try:
    conn = sqlite3.connect('instance/wealthsync.db')
    cursor = conn.cursor()
    
    cursor.execute("PRAGMA table_info(profile)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'account_mode' not in columns:
        print("Adding account_mode column...")
        cursor.execute("ALTER TABLE profile ADD COLUMN account_mode TEXT DEFAULT 'income'")
        cursor.execute("UPDATE profile SET account_mode = 'income' WHERE account_mode IS NULL")
        conn.commit()
        print("✓ account_mode column added successfully")
    else:
        print("✓ account_mode column already exists")
    
    conn.close()
    print("Migration complete!")

except Exception as e:
    print(f"Error: {e}")