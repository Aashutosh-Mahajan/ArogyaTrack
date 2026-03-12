import os
import re

TARGET_DIRS = ['app', 'components']
BASE_DIR = r'd:\Projects\loop\algosmiths\frontend'

REPLACEMENTS = {
    '#0A3D2E': '#030712',
    '#071F18': '#0B0F19',
    '#0D4A38': '#111827',
    '#00E676': '#10B981',
    '#22C55E': '#34D399',
    '#B2D8CC': '#D1D5DB',
    '#7FB3A0': '#9CA3AF',
    'rgba(0, 230, 118': 'rgba(16, 185, 129',
    'rgba(0,230,118': 'rgba(16,185,129'
}

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    for old_color, new_color in REPLACEMENTS.items():
        # Case insensitive replacement for hex codes
        if old_color.startswith('#'):
            content = re.sub(old_color, new_color, content, flags=re.IGNORECASE)
        else:
            content = content.replace(old_color, new_color)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {os.path.relpath(filepath, BASE_DIR)}")

def main():
    for d in TARGET_DIRS:
        dir_path = os.path.join(BASE_DIR, d)
        for root, _, files in os.walk(dir_path):
            for file in files:
                if file.endswith(('.tsx', '.ts', '.css')):
                    process_file(os.path.join(root, file))

if __name__ == "__main__":
    main()
