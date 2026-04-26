import os, glob

src = r'c:\Users\test\Desktop\pat-1\frontend\src'
jsx_files = glob.glob(os.path.join(src, '*.jsx'))

for path in jsx_files:
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()

    # Fix literal escaped backticks which break JSX template strings
    if r'\`' in text:
        text = text.replace(r'\`', '`')
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f'Fixed escaped backticks in {os.path.basename(path)}')

print('Global syntax check complete.')
