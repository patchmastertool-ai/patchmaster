import os, re

files = [
    'CICDOpsPage.jsx', 'SoftwarePage.jsx', 'MirrorRepoOpsPage.jsx',
    'BackupManagerPage.jsx', 'NetworkBootPage.jsx', 'LiveCommandPage.jsx',
    'AgentUpdatePage.jsx', 'PluginIntegrationsPage.jsx', 'RestoreDrillPage.jsx'
]
src = r'c:\Users\test\Desktop\pat-1\frontend\src'

for f in files:
    path = os.path.join(src, f)
    with open(path, 'r', encoding='utf-8') as file:
        content = file.read()
    
    # Replace "card" with "ops-panel"
    content = re.sub(r'className="card"', r'className="ops-panel"', content)
    
    # Replace log viewer legacy inline style with ops-console
    console_pattern = r'<div style=\{\{background:\s*\'#1e1e1e\'[^\}]+\}\}>'
    content = re.sub(console_pattern, r'<div className="ops-console">', content)

    # Strip inline solid borders (1px) inline per the "Zero Border Directive"
    content = re.sub(r',\s*border:\s*\'1px solid [^\']+\'', '', content)
    content = re.sub(r'border:\s*\'1px solid [^\']+\'\s*,?', '', content)
    
    with open(path, 'w', encoding='utf-8') as file:
        file.write(content)
    print(f'Updated {f}')
