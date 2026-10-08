"""Preserve every historical output. New inference identities enforce idempotency.

Nullable unique keys allow existing duplicate rows to remain untouched. There are
no data mutations, deletions, or bulk changes to legacy probabilities/confidences.
"""
from django.db import migrations,models


class Migration(migrations.Migration):
    dependencies=[('surveillance','0004_anomaly_data_cutoff_anomaly_model_version_and_more')]
    operations=[
        migrations.AddField(model_name='forecast',name='inference_key',
            field=models.CharField(max_length=64,unique=True,null=True,blank=True)),
        migrations.AddField(model_name='anomaly',name='inference_key',
            field=models.CharField(max_length=64,unique=True,null=True,blank=True)),
    ]
