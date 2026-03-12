import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/patient_provider.dart';
import '../../widgets/common_widgets.dart';

class PatientAlertsScreen extends StatefulWidget {
  const PatientAlertsScreen({super.key});
  @override
  State<PatientAlertsScreen> createState() => _PatientAlertsScreenState();
}

class _PatientAlertsScreenState extends State<PatientAlertsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<PatientProvider>().loadAlerts());
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PatientProvider>();
    final activeAlerts = p.alerts.where((a) => a['is_dismissed'] != true).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Alerts')),
      body: activeAlerts.isEmpty
          ? const EmptyStateWidget(icon: Icons.notifications_off, title: 'No alerts', subtitle: 'All clear!')
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: activeAlerts.length,
              itemBuilder: (_, i) {
                final a = activeAlerts[i];
                return Dismissible(
                  key: Key(a['id'].toString()),
                  direction: DismissDirection.endToStart,
                  onDismissed: (_) => p.dismissAlert(a['id'].toString()),
                  background: Container(
                    color: AppTheme.danger,
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.only(right: 20),
                    child: const Icon(Icons.delete, color: Colors.white),
                  ),
                  child: Card(
                    margin: const EdgeInsets.only(bottom: 8),
                    color: a['is_read'] != true ? AppTheme.primary.withValues(alpha: 0.05) : null,
                    child: ListTile(
                      onTap: () => p.markAlertRead(a['id'].toString()),
                      leading: Icon(
                        _alertIcon(a['alert_type']),
                        color: _severityColor(a['severity']),
                      ),
                      title: Text(a['title'] ?? '', style: TextStyle(fontWeight: a['is_read'] != true ? FontWeight.bold : FontWeight.normal, fontSize: 14)),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(a['message'] ?? '', maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13)),
                          const SizedBox(height: 4),
                          Text(a['created_at']?.toString().substring(0, 10) ?? '', style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                        ],
                      ),
                      trailing: SeverityBadge(severity: a['severity'] ?? 'low'),
                      isThreeLine: true,
                    ),
                  ),
                );
              },
            ),
    );
  }

  IconData _alertIcon(String? type) {
    switch (type) {
      case 'abnormal_labs': return Icons.science;
      case 'low_adherence': return Icons.medication;
      case 'high_risk': return Icons.warning;
      default: return Icons.info;
    }
  }

  Color _severityColor(String? severity) {
    switch (severity) {
      case 'critical': return AppTheme.danger;
      case 'high': return Colors.orange;
      case 'medium': return AppTheme.warning;
      default: return AppTheme.info;
    }
  }
}
