import django, os
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
django.setup()

from surveillance.models import Alert
from django.db.models import Count

print(f"Total alerts: {Alert.objects.count()}")
print()

print("By severity:")
for sv in Alert.objects.values('severity').annotate(c=Count('id')).order_by('-c'):
    print(f"  {sv['severity']}: {sv['c']}")

print()
print("By status:")
for st in Alert.objects.values('status').annotate(c=Count('id')).order_by('-c'):
    print(f"  {st['status']}: {st['c']}")

print()
print("By disease:")
for d in Alert.objects.values('disease_code', 'disease_name').annotate(c=Count('id')).order_by('-c'):
    print(f"  {d['disease_code']} ({d['disease_name']}): {d['c']}")

print()
print("Sample alerts:")
for a in Alert.objects.all()[:5]:
    print(f"  [{a.severity}] {a.title} (regions: {a.affected_regions.count()})")
    print(f"    Factors: {a.contributing_factors}")
