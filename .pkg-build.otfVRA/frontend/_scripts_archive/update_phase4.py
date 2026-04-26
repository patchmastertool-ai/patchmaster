import os, glob, re

src = r'c:\Users\test\Desktop\pat-1\frontend\src'
jsx_files = glob.glob(os.path.join(src, '*Page.jsx'))

for path in jsx_files:
    fname = os.path.basename(path)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    orig = content
    # 1. card -> ops-panel
    content = re.sub(r'className="card"', r'className="ops-panel"', content)
    
    # 2. Empty states with textAlign center
    content = re.sub(r'className="ops-panel"\s+style=\{\{(?:[^}]*)textAlign:\s*\'center\'(?:[^}]*)\}\}', r'className="ops-empty"', content)
    
    # 3. Strip basic basic inline border lines
    content = re.sub(r',\s*border:\s*\'1px solid [^\']+\'', '', content)
    content = re.sub(r'border:\s*\'1px solid [^\']+\'\s*,?', '', content)

    # 4. Aggressive inline border strip
    content = re.sub(r'border:\s*[^,}]+[,}]', lambda m: '}' if m.group(0).endswith('}') else '', content)
    content = re.sub(r',\s*\}', r'}', content)

    # 5. Legacy log viewer console backgrounds
    console_pattern = r'<div style=\{\{background:\s*\'#1e1e1e\'[^\}]+\}\}>'
    content = re.sub(console_pattern, r'<div className="ops-console">', content)

    if orig != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Standardized {fname}')

print('Global Phase 4 design compliance enforced.')
