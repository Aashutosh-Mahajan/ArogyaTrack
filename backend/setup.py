#!/usr/bin/env python
"""
Setup script for Health Surveillance System
Run this after installing dependencies
"""
import os
import sys
import subprocess
from pathlib import Path


def run_command(command, description):
    """Run a command and print status"""
    print(f"\n{'='*60}")
    print(f"🔧 {description}")
    print(f"{'='*60}")
    try:
        result = subprocess.run(command, shell=True, check=True, text=True)
        print(f"✅ {description} - SUCCESS")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} - FAILED")
        print(f"Error: {e}")
        return False


def main():
    print("""
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║      HEALTH SURVEILLANCE SYSTEM - SETUP SCRIPT           ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    """)
    
    # Check if we're in the backend directory
    if not Path('manage.py').exists():
        print("❌ Error: manage.py not found. Please run this script from the backend directory.")
        sys.exit(1)
    
    # Check if .env exists
    if not Path('.env').exists():
        print("\n⚠️  .env file not found. Creating from .env.example...")
        if Path('.env.example').exists():
            import shutil
            shutil.copy('.env.example', '.env')
            print("✅ Created .env file. Please edit it with your database credentials.")
            print("   Then run this script again.")
            sys.exit(0)
        else:
            print("❌ .env.example not found. Please create .env manually.")
            sys.exit(1)
    
    print("\n🚀 Starting setup process...")
    
    # Step 1: Create migrations
    if not run_command(
        "python manage.py makemigrations",
        "Creating database migrations"
    ):
        print("\n⚠️  Migration creation failed. This might be normal if migrations already exist.")
    
    # Step 2: Apply migrations
    if not run_command(
        "python manage.py migrate",
        "Applying database migrations"
    ):
        print("\n❌ Migration failed. Please check your database configuration in .env")
        sys.exit(1)
    
    # Step 3: Seed regions
    if not run_command(
        "python manage.py seed_regions",
        "Seeding regions data"
    ):
        print("\n⚠️  Region seeding failed. You can try manually later.")
    
    # Step 4: Seed medicines
    if not run_command(
        "python manage.py seed_medicines",
        "Seeding medicines database"
    ):
        print("\n⚠️  Medicine seeding failed. You can try manually later.")
    
    # Step 5: Check for superuser
    print(f"\n{'='*60}")
    print("👤 Creating superuser (Admin account)")
    print(f"{'='*60}")
    print("\nPlease create an admin account:")
    if not run_command(
        "python manage.py createsuperuser",
        "Creating superuser"
    ):
        print("\n⚠️  Superuser creation skipped or failed.")
    
    # Success message
    print(f"""
    
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║                    ✅ SETUP COMPLETE!                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

📋 NEXT STEPS:

1️⃣  Start Redis (in separate terminal):
   redis-server

2️⃣  Start Django server (in separate terminal):
   python manage.py runserver

3️⃣  Start Celery worker (in separate terminal):
   celery -A config worker -l info

4️⃣  Start Celery beat - OPTIONAL (for scheduled tasks):
   celery -A config beat -l info

5️⃣  Access the application:
   🌐 API: http://localhost:8000/api/
   🔐 Admin: http://localhost:8000/admin/

📚 DOCUMENTATION:
   - QUICK_START.md - Quick setup guide
   - IMPLEMENTATION_COMPLETE.md - Full documentation
   - IMPLEMENTATION_COMPARISON.md - Feature comparison

🎉 Happy coding!
    """)


if __name__ == "__main__":
    main()
