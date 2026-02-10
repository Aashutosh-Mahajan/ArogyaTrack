"""Management command to seed initial regions data"""
from django.core.management.base import BaseCommand
from surveillance.models import Region


class Command(BaseCommand):
    help = 'Seed initial regions data for surveillance'

    def handle(self, *args, **options):
        self.stdout.write('Seeding regions data...')
        
        regions_data = [
            # Maharashtra
            {
                'name': 'Andheri West',
                'district': 'Mumbai Suburban',
                'state': 'Maharashtra',
                'latitude': 19.1357,
                'longitude': 72.8262,
                'population': 650000
            },
            {
                'name': 'Borivali',
                'district': 'Mumbai Suburban',
                'state': 'Maharashtra',
                'latitude': 19.2304,
                'longitude': 72.8569,
                'population': 800000
            },
            {
                'name': 'Thane',
                'district': 'Thane',
                'state': 'Maharashtra',
                'latitude': 19.2183,
                'longitude': 72.9781,
                'population': 1841488
            },
            {
                'name': 'Pune City',
                'district': 'Pune',
                'state': 'Maharashtra',
                'latitude': 18.5204,
                'longitude': 73.8567,
                'population': 3124458
            },
            {
                'name': 'Nagpur',
                'district': 'Nagpur',
                'state': 'Maharashtra',
                'latitude': 21.1458,
                'longitude': 79.0882,
                'population': 2405421
            },
            
            # Karnataka
            {
                'name': 'Koramangala',
                'district': 'Bangalore Urban',
                'state': 'Karnataka',
                'latitude': 12.9352,
                'longitude': 77.6245,
                'population': 180000
            },
            {
                'name': 'Whitefield',
                'district': 'Bangalore Urban',
                'state': 'Karnataka',
                'latitude': 12.9698,
                'longitude': 77.7500,
                'population': 250000
            },
            {
                'name': 'Mysore',
                'district': 'Mysore',
                'state': 'Karnataka',
                'latitude': 12.2958,
                'longitude': 76.6394,
                'population': 920550
            },
            
            # Delhi
            {
                'name': 'Dwarka',
                'district': 'South West Delhi',
                'state': 'Delhi',
                'latitude': 28.5921,
                'longitude': 77.0460,
                'population': 700000
            },
            {
                'name': 'Rohini',
                'district': 'North West Delhi',
                'state': 'Delhi',
                'latitude': 28.7495,
                'longitude': 77.0736,
                'population': 1500000
            },
            {
                'name': 'Saket',
                'district': 'South Delhi',
                'state': 'Delhi',
                'latitude': 28.5244,
                'longitude': 77.2066,
                'population': 300000
            },
            
            # Tamil Nadu
            {
                'name': 'T Nagar',
                'district': 'Chennai',
                'state': 'Tamil Nadu',
                'latitude': 13.0418,
                'longitude': 80.2341,
                'population': 400000
            },
            {
                'name': 'Velachery',
                'district': 'Chennai',
                'state': 'Tamil Nadu',
                'latitude': 12.9759,
                'longitude': 80.2209,
                'population': 350000
            },
            {
                'name': 'Coimbatore',
                'district': 'Coimbatore',
                'state': 'Tamil Nadu',
                'latitude': 11.0168,
                'longitude': 76.9558,
                'population': 1061447
            },
            
            # West Bengal
            {
                'name': 'Salt Lake City',
                'district': 'North 24 Parganas',
                'state': 'West Bengal',
                'latitude': 22.5843,
                'longitude': 88.4175,
                'population': 280000
            },
            {
                'name': 'Howrah',
                'district': 'Howrah',
                'state': 'West Bengal',
                'latitude': 22.5958,
                'longitude': 88.2636,
                'population': 1077075
            },
            
            # Gujarat
            {
                'name': 'Ahmedabad',
                'district': 'Ahmedabad',
                'state': 'Gujarat',
                'latitude': 23.0225,
                'longitude': 72.5714,
                'population': 5577940
            },
            {
                'name': 'Surat',
                'district': 'Surat',
                'state': 'Gujarat',
                'latitude': 21.1702,
                'longitude': 72.8311,
                'population': 4467797
            },
            
            # Rajasthan
            {
                'name': 'Jaipur',
                'district': 'Jaipur',
                'state': 'Rajasthan',
                'latitude': 26.9124,
                'longitude': 75.7873,
                'population': 3046163
            },
            
            # Uttar Pradesh
            {
                'name': 'Lucknow',
                'district': 'Lucknow',
                'state': 'Uttar Pradesh',
                'latitude': 26.8467,
                'longitude': 80.9462,
                'population': 2817105
            },
            {
                'name': 'Noida',
                'district': 'Gautam Buddha Nagar',
                'state': 'Uttar Pradesh',
                'latitude': 28.5355,
                'longitude': 77.3910,
                'population': 637272
            },
        ]
        
        created_count = 0
        updated_count = 0
        
        for region_data in regions_data:
            region, created = Region.objects.update_or_create(
                name=region_data['name'],
                district=region_data['district'],
                state=region_data['state'],
                defaults={
                    'latitude': region_data['latitude'],
                    'longitude': region_data['longitude'],
                    'population': region_data['population'],
                    'country': 'India'
                }
            )
            
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created: {region.name}, {region.state}'))
            else:
                updated_count += 1
                self.stdout.write(f'Updated: {region.name}, {region.state}')
        
        self.stdout.write(self.style.SUCCESS(f'\nCompleted! Created: {created_count}, Updated: {updated_count}'))
