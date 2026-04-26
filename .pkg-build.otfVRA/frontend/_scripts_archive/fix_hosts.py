import os

path = r'c:\Users\test\Desktop\pat-1\frontend\src\HostsOpsPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix literal escaped backticks which break JSX template strings
text = text.replace(r'\`', '`')

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Fixed escaped backticks in HostsOpsPage.jsx')
