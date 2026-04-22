
import re

def find_nested_div_in_p(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple regex to find <p ...> with nested <div
    # This might miss some complex cases but should catch common ones
    matches = re.finditer(r'<p[^>]*>.*?(<div.*?>).*?</p>', content, re.DOTALL)
    
    found = False
    for match in matches:
        start_pos = match.start()
        line_num = content.count('\n', 0, start_pos) + 1
        print(f"File: {file_path}, Line: {line_num}")
        print(f"Content: {match.group(0)[:100]}...")
        found = True
    
    if not found:
        print(f"No <p> containing <div> found in {file_path}")

find_nested_div_in_p('views/SuperAdmin.tsx')
find_nested_div_in_p('App.tsx')
