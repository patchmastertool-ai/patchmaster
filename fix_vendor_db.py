import os

file_path = "vendor/app.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix imports
content = content.replace("import psycopg2\nimport psycopg2.extras\n", "import sqlite3\n")

# Fix SERIAL PRIMARY KEY
content = content.replace("SERIAL PRIMARY KEY", "INTEGER PRIMARY KEY AUTOINCREMENT")

# Fix DatabaseWrapper
content = content.replace(
"""class DatabaseWrapper:
    def __init__(self, conn):
        self.conn = conn
    def execute(self, query, params=()):
        query = query.replace("?", "%s")
        cur = self.conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        cur.execute(query, params)
        return cur
    def executescript(self, script):
        cur = self.conn.cursor()
        cur.execute(script)""",
"""class DatabaseWrapper:
    def __init__(self, conn):
        self.conn = conn
        self.conn.row_factory = sqlite3.Row
    def execute(self, query, params=()):
        cur = self.conn.cursor()
        cur.execute(query, params)
        return cur
    def executescript(self, script):
        cur = self.conn.cursor()
        cur.executescript(script)"""
)

# get_db fix
content = content.replace(
"""def get_db():
    if "db" not in g:
        conn = psycopg2.connect(DATABASE_URL)
        g.db = DatabaseWrapper(conn)""",
"""def get_db():
    if "db" not in g:
        conn = sqlite3.connect(DATABASE_URL)
        g.db = DatabaseWrapper(conn)"""
)

# init_db fix
content = content.replace(
"""def init_db():
    \"\"\"Create tables if they don't exist.\"\"\"
    conn = psycopg2.connect(DATABASE_URL)
    db = DatabaseWrapper(conn)""",
"""def init_db():
    \"\"\"Create tables if they don't exist.\"\"\"
    conn = sqlite3.connect(DATABASE_URL)
    db = DatabaseWrapper(conn)"""
)

# ensure_table_columns fix
content = content.replace(
"""def ensure_table_columns(db, table_name, columns):
    existing = {row["column_name"] for row in db.execute(f"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='{table_name}'").fetchall()}""",
"""def ensure_table_columns(db, table_name, columns):
    existing = {row["name"] for row in db.execute(f"PRAGMA table_info({table_name})").fetchall()}"""
)

# ensure_schema fix
content = content.replace(
"""existing_tables = {
        row[0]
        for row in db.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public'").fetchall()
    }""",
"""existing_tables = {
        row[0]
        for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    }"""
)

# Fix exception usage
content = content.replace("psycopg2.IntegrityError", "sqlite3.IntegrityError")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Finished patching vendor/app.py")
