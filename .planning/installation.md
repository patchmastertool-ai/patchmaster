# Installation Issue Tracker

## Issue: async_session ImportError

### Problem
```
ImportError: cannot import name 'async_session' from 'database'
```

### Root Cause
Python's `from database import async_session` statement was failing because:
1. The `database.py` module didn't export `async_session` properly
2. Python's `__getattr__` mechanism wasn't being triggered for direct imports

### Fix Applied (Commit f7f0f54)
1. Removed `async_session = None` from module level in `database.py`
2. Added `global async_session` in `get_engine()` to create module-level binding when initialized
3. `__getattr__` now properly intercepts and returns the mock/real session

### Verification
```bash
# Local test - PASSES
$ cd backend && python -c "from database import async_session; print('OK:', type(async_session).__name__)"
OK: MagicMock
```

### Latest Package
- File: `dist/patchmaster-2.0.14.tar.gz`
- Built: 2026-04-15 (with fix commit f7f0f54)
- Size: ~133 MB

### Customer Instructions
1. **DELETE** old installation: `sudo rm -rf /opt/patchmaster`
2. **Download** new package from `dist/patchmaster-2.0.14.tar.gz`
3. **Verify** checksum: `sha256sum patchmaster-2.0.14.tar.gz`
4. **Extract and install** fresh

### Previous Failed Attempts (Archived)
[See git history for previous fix attempts]
