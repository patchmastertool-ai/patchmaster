import os, re
project_dir = r'c:\pat-1'
skip_dirs = {'.git', 'node_modules', 'dist', 'build', '.pkg-build', 'frontend_backup', 'test-venv', 'venv'}

seo_tags = '\n<meta name="description" content="PatchMaster Enterprise - Automated Patch Management">\n<meta property="og:title" content="PatchMaster Enterprise">\n<meta property="og:description" content="Automated Patch Management">\n<meta property="og:type" content="website">\n'

for root, dirs, files in os.walk(project_dir):
    dirs[:] = [d for d in dirs if not any(skip in d for skip in skip_dirs)]
    for f in files:
        if f.endswith('.html'):
            path = os.path.join(root, f)
            try:
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
            except: continue
            
            new_content = content
            if '<head>' in new_content.lower() or '<head ' in new_content.lower():
                if 'name="description"' not in new_content.lower():
                    new_content = re.sub(r'(<head[^>]*>)', r'\g<1>' + seo_tags, new_content, count=1, flags=re.IGNORECASE)
                if '<title>' not in new_content.lower():
                    new_content = re.sub(r'(<head[^>]*>)', r'\g<1>\n<title>PatchMaster</title>', new_content, count=1, flags=re.IGNORECASE)
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as file:
                        file.write(new_content)
