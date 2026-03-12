import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/patient_provider.dart';
import '../../widgets/common_widgets.dart';

class PatientHomeTab extends StatelessWidget {
  const PatientHomeTab({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PatientProvider>();
    if (p.isLoading && p.dashboardSummary == null) return const LoadingWidget(message: 'Loading dashboard...');

    final summary = p.dashboardSummary;
    final kpis = p.kpis;
    final card = p.patientCard;

    return RefreshIndicator(
      onRefresh: () => p.loadDashboard(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Welcome card
          if (summary != null)
            Card(
              color: AppTheme.primary,
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Welcome, ${summary['patient_name'] ?? 'Patient'}',
                      style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    if (summary['health_id'] != null)
                      Text('Health ID: ${summary['health_id']}', style: TextStyle(color: Colors.white.withValues(alpha: 0.9))),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        _SummaryChip(label: 'Risk', value: summary['calculated_risk_level'] ?? 'Low', color: _riskColor(summary['calculated_risk_level'])),
                        const SizedBox(width: 8),
                        _SummaryChip(label: 'Adherence', value: '${(summary['adherence_percentage'] ?? 0).toStringAsFixed(0)}%', color: Colors.white),
                        const SizedBox(width: 8),
                        _SummaryChip(label: 'Alerts', value: '${summary['total_alerts'] ?? 0}', color: Colors.white),
                      ],
                    ),
                  ],
                ),
              ),
            ),

          const SizedBox(height: 16),

          // KPI Cards
          if (kpis != null)
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
              childAspectRatio: 1.5,
              children: [
                StatCard(title: 'Medical Records', value: '${kpis['total_medical_records'] ?? 0}', icon: Icons.folder_shared, color: AppTheme.primary),
                StatCard(title: 'Active Rx', value: '${kpis['active_prescriptions'] ?? 0}', icon: Icons.medication, color: AppTheme.secondary),
                StatCard(title: 'Downloads', value: '${kpis['total_downloads'] ?? 0}', icon: Icons.download, color: AppTheme.info),
                StatCard(title: 'Blood Group', value: summary?['blood_group'] ?? '-', icon: Icons.bloodtype, color: AppTheme.danger),
              ],
            ),

          const SizedBox(height: 16),

          // Patient Card
          if (card != null) ...[
            const SectionHeader(title: 'Health Card'),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 30,
                          backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                          child: const Icon(Icons.person, size: 30, color: AppTheme.primary),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(card['name'] ?? '', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                              Text('ID: ${card['unique_patient_id'] ?? ''}', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                              Text('${card['blood_group'] ?? ''} • ${card['gender'] ?? ''} • Age ${card['age'] ?? ''}',
                                  style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: () => Navigator.pushNamed(context, '/patient/qr-card'),
                        icon: const Icon(Icons.qr_code),
                        label: const Text('View QR Health Card'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],

          // Recent Records
          if (p.recentRecords.isNotEmpty) ...[
            const SizedBox(height: 16),
            const SectionHeader(title: 'Recent Visits'),
            ...p.recentRecords.take(3).map((r) => Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: _statusColor(r['status'] ?? '').withValues(alpha: 0.1),
                      child: Icon(Icons.medical_services, color: _statusColor(r['status'] ?? ''), size: 20),
                    ),
                    title: Text(r['doctor_name'] ?? 'Visit', style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: Text('${r['department'] ?? ''} • ${r['visit_date'] ?? ''}', style: const TextStyle(fontSize: 13)),
                    trailing: StatusBadge(status: r['status'] ?? 'completed'),
                  ),
                )),
          ],

          // Active Alerts
          if (p.alerts.where((a) => a['is_dismissed'] != true).isNotEmpty) ...[
            const SizedBox(height: 16),
            const SectionHeader(title: 'Active Alerts'),
            ...p.alerts.where((a) => a['is_dismissed'] != true).take(3).map((a) => Card(
                  child: ListTile(
                    leading: Icon(
                      a['severity'] == 'critical' ? Icons.warning : Icons.info,
                      color: a['severity'] == 'critical' ? AppTheme.danger : AppTheme.warning,
                    ),
                    title: Text(a['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    subtitle: Text(a['message'] ?? '', maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                    trailing: SeverityBadge(severity: a['severity'] ?? 'low'),
                  ),
                )),
          ],

          const SizedBox(height: 80),
        ],
      ),
    );
  }

  Color _riskColor(String? level) {
    switch (level?.toLowerCase()) {
      case 'high': return Colors.redAccent;
      case 'medium': return Colors.orangeAccent;
      default: return Colors.greenAccent;
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'critical': return AppTheme.danger;
      case 'follow_up': return AppTheme.warning;
      default: return AppTheme.success;
    }
  }
}

class _SummaryChip extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  const _SummaryChip({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.2),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text('$label: $value', style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }
}
