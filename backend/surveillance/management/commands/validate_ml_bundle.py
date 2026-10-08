"""Load, verify hashes/versions/schema, and smoke-predict the active model bundle."""
import json
from django.core.management.base import BaseCommand,CommandError
from surveillance.services import _bundle,MLModelInfoService


class Command(BaseCommand):
    help='Verify the active immutable ML bundle without touching surveillance records'

    def handle(self,*args,**options):
        try:
            _,manifest=_bundle()
        except Exception as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(json.dumps({'version':manifest['version'],'schema':manifest['schema_version'],
            'data_kind':manifest['data_kind'],'real_world_validated':manifest['real_world_validated'],
            'models':MLModelInfoService.get_all_models_info()},indent=2))
