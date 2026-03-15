import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/patient_provider.dart';
import '../../widgets/common_widgets.dart';

class PatientPrescriptionsTab extends StatefulWidget {
  const PatientPrescriptionsTab({super.key});
  @override
  State<PatientPrescriptionsTab> createState() => _PatientPrescriptionsTabState();
}

class _PatientPrescriptionsTabState extends State<PatientPrescriptionsTab> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PatientProvider>().loadPrescriptions();
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PatientProvider>();
    if (p.isLoading && p.prescriptions.isEmpty) return const LoadingWidget();
    if (p.prescriptions.isEmpty) return const EmptyStateWidget(icon: Icons.medication, title: 'No prescriptions');

    return RefreshIndicator(
      onRefresh: () => p.loadPrescriptions(),
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: p.prescriptions.length,
        itemBuilder: (_, i) {
          final rx = p.prescriptions[i];
          final medicines = rx['medicines'] as List? ?? [];
          return Card(
            margin: const EdgeInsets.only(bottom: 12),
            child: ExpansionTile(
              leading: CircleAvatar(
                backgroundColor: _statusColor(rx['status'] ?? '').withValues(alpha: 0.1),
                child: Icon(Icons.receipt_long, color: _statusColor(rx['status'] ?? ''), size: 20),
              ),
              title: Text('Rx #${rx['prescription_number'] ?? rx['id']?.toString().substring(0, 8) ?? ''}',
                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              subtitle: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Dr. ${rx['doctor_name'] ?? 'Unknown'}', style: const TextStyle(fontSize: 13)),
                  Text(rx['created_at']?.toString().substring(0, 10) ?? '', style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                ],
              ),
              trailing: StatusBadge(status: rx['status'] ?? 'pending'),
              children: [
                if (medicines.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      children: medicines.map<Widget>((m) {
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppTheme.background,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(
                                      m['medicine_name'] ?? (m['medicine'] is Map ? m['medicine']['name'] : ''),
                                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                                    ),
                                  ),
                                  StatusBadge(status: m['dispense_status'] ?? 'pending'),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${m['dosage'] ?? ''} • ${m['frequency'] ?? ''} • ${m['duration_days'] ?? 0} days',
                                style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                              ),
                              if (m['special_instructions'] != null && m['special_instructions'].toString().isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Text('Note: ${m['special_instructions']}',
                                      style: const TextStyle(fontSize: 12, color: AppTheme.primary, fontStyle: FontStyle.italic)),
                                ),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'fully_dispensed': return AppTheme.success;
      case 'partially_dispensed': return AppTheme.info;
      default: return AppTheme.warning;
    }
  }
}
