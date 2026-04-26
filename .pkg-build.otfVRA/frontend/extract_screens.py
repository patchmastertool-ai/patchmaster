import json
with open(r'C:\Users\test\.gemini\antigravity\brain\e8d26dc8-71a8-4b25-bd06-919d4ff0b1a3\.system_generated\steps\797\output.txt', 'r', encoding='utf-8') as f:
    data = json.load(f)

for screen in data.get('screens', []):
    print(f"Title: {screen['title']}")
    for asset in screen.get('assets', []):
        print(f"  Asset Type: {asset.get('type', 'UNKNOWN')}, URL: {asset.get('downloadUrl', 'N/A')}")
