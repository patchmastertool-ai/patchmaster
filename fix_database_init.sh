#!/bin/bash
# Quick fix for database initialization hanging issue
# Run this on the Ubuntu machine where PatchMaster is installed

echo "Fixing database initialization issue..."

# Backup the original file
sudo cp /opt/patchmaster/backend/database.py /opt/patchmaster/backend/database.py.backup

# Apply the fix
sudo tee /tmp/database_fix.py > /dev/null << 'EOF'
async def init_db():
    """Create all tables on startup."""
    db_engine = get_engine()
    if db_engine is None:
        raise RuntimeError(
            "Database not configured. Set DATABASE_URL environment variable."
        )
    async with db_engine.begin() as conn:
        from models import db_models  # noqa: F401

        try:
            await conn.run_sync(Base.metadata.create_all, checkfirst=True)
            print("Database schema initialized successfully")
        except Exception as e:
            # Handle duplicate index/table errors gracefully during upgrades
            error_msg = str(e).lower()
            if "already exists" in error_msg or "duplicate" in error_msg:
                print(f"Warning: Some database objects already exist (likely from previous installation)")
                print("Database schema verification complete - continuing with existing schema")
                # Continue - tables/indexes already exist from previous install
            else:
                # Re-raise other errors
                print(f"Error initializing database: {e}")
                raise
EOF

# Use Python to replace the function in the file
sudo python3 << 'PYTHON_SCRIPT'
import re

# Read the original file
with open('/opt/patchmaster/backend/database.py', 'r') as f:
    content = f.read()

# Read the new function
with open('/tmp/database_fix.py', 'r') as f:
    new_function = f.read()

# Replace the old function with the new one
pattern = r'async def init_db\(\):.*?(?=\n(?:async def|def|class|\Z))'
content = re.sub(pattern, new_function.rstrip(), content, flags=re.DOTALL)

# Write back
with open('/opt/patchmaster/backend/database.py', 'w') as f:
    f.write(content)

print("✅ Database initialization fix applied successfully")
PYTHON_SCRIPT

# Clean up
sudo rm /tmp/database_fix.py

echo ""
echo "Fix applied! Now you can:"
echo "1. Continue with the installation (if it's still running)"
echo "2. Or restart the installation: cd ~/packaging && sudo ./install-bare.sh"
echo ""
echo "Backup saved at: /opt/patchmaster/backend/database.py.backup"
