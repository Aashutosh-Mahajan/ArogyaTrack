import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/patient_provider.dart';
import '../../widgets/common_widgets.dart';

class PatientRecordsTab extends StatefulWidget {
  const PatientRecordsTab({super.key});
  @override
  State<PatientRecordsTab> createState() => _PatientRecordsTabState();
}

class _PatientRecordsTabState extends State<PatientRecordsTab> with SingleTickerProviderStateMixin {
  late TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PatientProvider>().loadMedicalRecords();
    });
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PatientProvider>();
    return Column(
      children: [
        TabBar(
          controller: _tabCtrl,
          labelColor: AppTheme.primary,
          unselectedLabelColor: AppTheme.textSecondary,
          indicatorColor: AppTheme.primary,
          tabs: const [
            Tab(text: 'Visits'),
            Tab(text: 'Allergies'),
            Tab(text: 'Conditions'),
          ],
        ),
        Expanded(
          child: TabBarView(
            controller: _tabCtrl,
            children: [
              // Visit Records
              p.isLoading
                  ? const LoadingWidget()
                  : p.medicalRecords.isEmpty
                      ? const EmptyStateWidget(icon: Icons.folder_open, title: 'No records yet')
                      : RefreshIndicator(
                          onRefresh: () => p.loadMedicalRecords(),
                          child: ListView.builder(
                            padding: const EdgeInsets.all(12),
                            itemCount: p.medicalRecords.length,
                            itemBuilder: (_, i) {
                              final r = p.medicalRecords[i];
                              return Card(
                                margin: const EdgeInsets.only(bottom: 8),
                                child: ExpansionTile(
                                  leading: CircleAvatar(
                                    backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                                    child: const Icon(Icons.medical_services, color: AppTheme.primary, size: 20),
                                  ),
                                  title: Text(r['doctor_name'] ?? 'Visit', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                                  subtitle: Text('${r['department'] ?? ''} • ${r['visit_date'] ?? ''}', style: const TextStyle(fontSize: 12)),
                                  children: [
                                    Padding(
                                      padding: const EdgeInsets.all(16),
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          if (r['diagnosis'] != null) _detailRow('Diagnosis', r['diagnosis']),
                                          if (r['tests_performed'] != null) _detailRow('Tests', r['tests_performed']),
                                          if (r['prescription'] != null) _detailRow('Prescription', r['prescription']),
                                          if (r['doctor_notes'] != null) _detailRow('Notes', r['doctor_notes']),
                                          if (r['report_attachments'] != null && (r['report_attachments'] as List).isNotEmpty)
                                            Padding(
                                              padding: const EdgeInsets.only(top: 8),
                                              child: Wrap(
                                                spacing: 8,
                                                children: (r['report_attachments'] as List).map((a) => Chip(
                                                  avatar: const Icon(Icons.attach_file, size: 16),
                                                  label: Text(a['file_name'] ?? 'Report', style: const TextStyle(fontSize: 12)),
                                                )).toList(),
                                              ),
                                            ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                        ),

              // Allergies
              p.allergies.isEmpty
                  ? const EmptyStateWidget(icon: Icons.warning_amber, title: 'No allergies recorded')
                  : ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: p.allergies.length,
                      itemBuilder: (_, i) {
                        final a = p.allergies[i];
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: AppTheme.warning.withValues(alpha: 0.1),
                              child: const Icon(Icons.warning_amber, color: AppTheme.warning, size: 20),
                            ),
                            title: Text(a['allergen'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text(a['reaction_type'] ?? '', style: const TextStyle(fontSize: 13)),
                            trailing: SeverityBadge(severity: _severityLabel(a['severity'])),
                          ),
                        );
                      },
                    ),

              // Chronic Conditions
              p.chronicConditions.isEmpty
                  ? const EmptyStateWidget(icon: Icons.monitor_heart, title: 'No chronic conditions')
                  : ListView.builder(
                      padding: const EdgeInsets.all(12),
                      itemCount: p.chronicConditions.length,
                      itemBuilder: (_, i) {
                        final c = p.chronicConditions[i];
                        return Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: (c['is_active'] == true ? AppTheme.danger : AppTheme.success).withValues(alpha: 0.1),
                              child: Icon(Icons.monitor_heart, color: c['is_active'] == true ? AppTheme.danger : AppTheme.success, size: 20),
                            ),
                            title: Text(c['disease_name'] ?? c['condition_name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                            subtitle: Text('ICD-10: ${c['icd_10_code'] ?? ''}', style: const TextStyle(fontSize: 13)),
                            trailing: StatusBadge(status: c['is_active'] == true ? 'Active' : 'Resolved'),
                          ),
                        );
                      },
                    ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _detailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 90, child: Text('$label:', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppTheme.textSecondary))),
          Expanded(child: Text(value, style: const TextStyle(fontSize: 13))),
        ],
      ),
    );
  }

  String _severityLabel(dynamic severity) {
    if (severity is num) {
      if (severity >= 8) return 'critical';
      if (severity >= 5) return 'high';
      if (severity >= 3) return 'medium';
      return 'low';
    }
    return severity?.toString() ?? 'low';
  }
}
