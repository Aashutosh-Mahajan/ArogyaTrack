"""
Verify Optional Dependencies Installation
=========================================
This script verifies that django-ratelimit and reportlab are properly installed.
"""

import sys

def check_package(package_name, import_statement):
    """Check if a package can be imported."""
    try:
        exec(import_statement)
        print(f"✅ {package_name} is installed and importable")
        return True
    except ImportError as e:
        print(f"❌ {package_name} import failed: {e}")
        return False

def main():
    print("=" * 60)
    print("Checking Optional Dependencies")
    print("=" * 60)
    print()
    
    results = []
    
    # Check django-ratelimit
    print("1. Checking django-ratelimit...")
    results.append(check_package(
        "django-ratelimit",
        "from django_ratelimit.decorators import ratelimit"
    ))
    print()
    
    # Check reportlab - pagesizes
    print("2. Checking reportlab.lib.pagesizes...")
    results.append(check_package(
        "reportlab.lib.pagesizes",
        "from reportlab.lib.pagesizes import A6"
    ))
    print()
    
    # Check reportlab - units
    print("3. Checking reportlab.lib.units...")
    results.append(check_package(
        "reportlab.lib.units",
        "from reportlab.lib.units import mm"
    ))
    print()
    
    # Check reportlab - pdfgen
    print("4. Checking reportlab.pdfgen...")
    results.append(check_package(
        "reportlab.pdfgen",
        "from reportlab.pdfgen import canvas"
    ))
    print()
    
    # Check reportlab - colors
    print("5. Checking reportlab.lib.colors...")
    results.append(check_package(
        "reportlab.lib.colors",
        "from reportlab.lib.colors import HexColor"
    ))
    print()
    
    # Check reportlab - utils
    print("6. Checking reportlab.lib.utils...")
    results.append(check_package(
        "reportlab.lib.utils",
        "from reportlab.lib.utils import ImageReader"
    ))
    print()
    
    # Summary
    print("=" * 60)
    print("Summary")
    print("=" * 60)
    
    total = len(results)
    passed = sum(results)
    
    if all(results):
        print(f"✅ All {total} packages importable!")
        print()
        print("If VS Code still shows import warnings:")
        print("1. Press Ctrl+Shift+P")
        print("2. Type 'Python: Restart Language Server'")
        print("3. Or reload VS Code window (Ctrl+R)")
        return 0
    else:
        print(f"⚠️  {total - passed} of {total} checks failed")
        print()
        print("To install missing packages:")
        print("pip install django-ratelimit reportlab")
        return 1

if __name__ == "__main__":
    sys.exit(main())
