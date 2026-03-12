import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from accounts.models import User
from pharmacy.models import Pharmacy

# Find pharmacist users
pharmacists = User.objects.filter(role='pharmacist')
print(f"Pharmacist users: {pharmacists.count()}")
for u in pharmacists:
    name = f"{u.get_first_name()} {u.get_last_name()}".strip() if hasattr(u, 'get_first_name') else u.email
    pharmacies = Pharmacy.objects.filter(owner=u)
    print(f"  id={u.id} email={u.email} name={name}")
    if pharmacies.exists():
        for p in pharmacies:
            print(f"    -> Pharmacy: {p.name} (id={p.id}, active={p.is_active})")
    else:
        print(f"    -> NO PHARMACY LINKED")

# Show all pharmacies
print(f"\nAll pharmacies: {Pharmacy.objects.count()}")
for p in Pharmacy.objects.all()[:10]:
    print(f"  {p.name} (owner_id={p.owner_id}, active={p.is_active})")
