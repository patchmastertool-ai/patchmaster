import codecs
import re

with codecs.open('vendor/app.py', 'r', 'utf-8') as f:
    code = f.read()

# 1. Imports
code = code.replace("import sqlite3", "import urllib.parse\nimport psycopg2\nimport psycopg2.extras")
code = code.replace("from functools import wraps", "from functools import wraps\nfrom argon2 import PasswordHasher, exceptions")

# 2. DATABASE_URL (replace exact block)
code = re.sub(
    r'DB_PATH = os\.environ\.get\([^)]+?\)\n',
    'DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/patchmaster")\n',
    code, count=1
)

# Any trailing DB_PATHs
code = code.replace("DB_PATH,", "DATABASE_URL,")
code = code.replace("DB_PATH)", "DATABASE_URL)")
code = code.replace("DB_PATH", "DATABASE_URL")

# 3. get_db Wrapper
old_get_db = """def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DATABASE_URL)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA journal_mode=WAL")
        g.db.execute("PRAGMA foreign_keys=ON")
    return g.db"""

new_get_db = """class DatabaseWrapper:
    def __init__(self, conn):
        self.conn = conn
    def execute(self, query, params=()):
        query = query.replace("?", "%s")
        cur = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute(query, params)
        return cur
    def executescript(self, script):
        cur = self.conn.cursor()
        cur.execute(script)
    def commit(self):
        self.conn.commit()
    def close(self):
        self.conn.close()

def get_db():
    if "db" not in g:
        conn = psycopg2.connect(DATABASE_URL)
        g.db = DatabaseWrapper(conn)
    return g.db"""
code = code.replace(old_get_db, new_get_db)

# 4. PRAGMA and Schema
code = code.replace(
    'existing = {row[1] for row in db.execute(f"PRAGMA table_info({table_name})").fetchall()}',
    'existing = {row["column_name"] for row in db.execute(f"SELECT column_name FROM information_schema.columns WHERE table_schema=\'public\' AND table_name=\'{table_name}\'").fetchall()}'
)

code = code.replace(
    'row[0]\n            for row in db.execute("SELECT name FROM sqlite_master WHERE type=\'table\'").fetchall()',
    'row["table_name"]\n            for row in db.execute("SELECT table_name FROM information_schema.tables WHERE table_schema=\'public\'").fetchall()'
)

code = code.replace(
    'db.execute("SELECT name FROM sqlite_master WHERE type=\'table\'").fetchall()',
    'db.execute("SELECT table_name FROM information_schema.tables WHERE table_schema=\'public\'").fetchall()'
)

code = code.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')
code = code.replace("datetime('now')", "CURRENT_TIMESTAMP")

# 5. init_db()
old_init_db = """def init_db():
    \"\"\"Create tables if they don't exist.\"\"\"
    os.makedirs(os.path.dirname(DATABASE_URL), exist_ok=True)
    db = sqlite3.connect(DATABASE_URL)
    ensure_schema(db)
    db.close()
    logger.info("Database initialized at %s", DATABASE_URL)"""

new_init_db = """def init_db():
    \"\"\"Create tables if they don't exist.\"\"\"
    conn = psycopg2.connect(DATABASE_URL)
    db = DatabaseWrapper(conn)
    ensure_schema(db)
    db.close()
    logger.info("Database initialized at %s", DATABASE_URL)"""
code = code.replace(old_init_db, new_init_db)

# Also fix the init_db CLI command
old_cli_init = """    with app.app_context():
        db = sqlite3.connect(DATABASE_URL)
        ensure_schema(db)
        db.close()"""
new_cli_init = """    with app.app_context():
        conn = psycopg2.connect(DATABASE_URL)
        db = DatabaseWrapper(conn)
        ensure_schema(db)
        db.close()"""
code = code.replace(old_cli_init, new_cli_init)

# 6. Cryptography Methods
old_hash = """def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()"""

new_hash = """pwd_context = PasswordHasher()
def hash_password(password):
    return pwd_context.hash(password)"""
code = code.replace(old_hash, new_hash)

old_verify = """def verify_password(plain, hashed):
    return hash_password(plain) == hashed"""

new_verify = """def verify_password(plain, hashed):
    try:
        # Fallback for legacy sha256
        if len(hashed) == 64 and "$" not in hashed:
            import hashlib
            return hashlib.sha256(plain.encode()).hexdigest() == hashed
        return pwd_context.verify(hashed, plain)
    except exceptions.VerifyMismatchError:
        return False"""
code = code.replace(old_verify, new_verify)

# 7. last_insert_rowid fixes 
# We just forcefully find the INSERT lines preceding the last_insert_rowid and append RETURNING id
code = re.sub(
    r'db\.execute\(\s*("""[\s\S]*?)",\s*\((.*?)\),\s*\)\s*cust_id = db\.execute\("SELECT last_insert_rowid\(\)"\)\.fetchone\(\)\[0\]',
    r'cust_id = db.execute(\1 RETURNING id", (\2)).fetchone()["id"]',
    code
)

code = re.sub(
    r'db\.execute\(\s*("""[\s\S]*?)",\s*params,\s*\)\s*purchase_id = db\.execute\("SELECT last_insert_rowid\(\)"\)\.fetchone\(\)\[0\]',
    r'purchase_id = db.execute(\1 RETURNING id", params).fetchone()["id"]',
    code
)

code = re.sub(
    r'db\.execute\(\s*("""[\s\S]*?)""",\s*params,\s*\)\s*new_id = db\.execute\("SELECT last_insert_rowid\(\)"\)\.fetchone\(\)\[0\]',
    r'new_id = db.execute(\1 RETURNING id""", params).fetchone()["id"]',
    code
)

# 8. Activity log uses ? for sqlite3. DatabaseWrapper replaces ? with %s. 
with codecs.open('vendor/app.py', 'w', 'utf-8') as f:
    f.write(code)

print("Refactor applied.")
