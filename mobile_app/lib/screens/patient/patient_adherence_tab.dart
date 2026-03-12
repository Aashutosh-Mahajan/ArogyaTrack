import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/patient_provider.dart';
import '../../widgets/common_widgets.dart';

class PatientAdherenceTab extends StatefulWidget {
  const PatientAdherenceTab({super.key});
  @override
  State<PatientAdherenceTab> createState() => _PatientAdherenceTabState();
}

class _PatientAdherenceTabState extends State<PatientAdherenceTab> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PatientProvider>().loadAdherence();
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PatientProvider>();
    if (p.isLoading && p.adherenceTrackers.isEmpty) return const LoadingWidget();

    return RefreshIndicator(
      onRefresh: () => p.loadAdherence(),
      child: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          // Upcoming Doses
          if (p.upcomingDoses.isNotEmpty) ...[
            const SectionHeader(title: 'Upcoming Doses'),
            ...p.upcomingDoses.map((d) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: AppTheme.warning.withValues(alpha: 0.1),
                      child: const Icon(Icons.alarm, color: AppTheme.warning, size: 20),
                    ),
                    title: Text(_getMedicineName(d), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    subtitle: Text(d['scheduled_time'] ?? '', style: const TextStyle(fontSize: 13)),
                    trailing: ElevatedButton(
                      onPressed: d['is_taken'] == true
                          ? null
                          : () => p.markDoseTaken({'dose_schedule_id': d['id']}),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: d['is_taken'] == true ? AppTheme.success : AppTheme.primary,
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      ),
                      child: Text(d['is_taken'] == true ? 'Taken ✓' : 'Take', style: const TextStyle(fontSize: 12)),
                    ),
                  ),
                )),
          ],

          // Missed Doses
          if (p.missedDoses.isNotEmpty) ...[
            const SizedBox(height: 16),
            const SectionHeader(title: 'Missed Doses'),
            ...p.missedDoses.map((d) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  color: AppTheme.danger.withValues(alpha: 0.05),
                  child: ListTile(
                    leading: const CircleAvatar(
                      backgroundColor: Color(0x1AEF4444),
                      child: Icon(Icons.cancel, color: AppTheme.danger, size: 20),
                    ),
                    title: Text(_getMedicineName(d), style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    subtitle: Text('Scheduled: ${d['scheduled_time'] ?? ''}', style: const TextStyle(fontSize: 13)),
                    trailing: OutlinedButton(
                      onPressed: () => p.markDoseTaken({'dose_schedule_id': d['id']}),
                      child: const Text('Take Now', style: TextStyle(fontSize: 12)),
                    ),
                  ),
                )),
          ],

          // Trackers
          if (p.adherenceTrackers.isNotEmpty) ...[
            const SizedBox(height: 16),
            const SectionHeader(title: 'Adherence Trackers'),
            ...p.adherenceTrackers.map((t) {
              final pct = (t['adherence_percentage'] ?? 0).toDouble();
              return Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(child: Text('Tracker ${t['id']?.toString().substring(0, 8) ?? ''}', style: const TextStyle(fontWeight: FontWeight.w600))),
                          StatusBadge(status: t['is_active'] == true ? 'Active' : 'Completed'),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(6),
                              child: LinearProgressIndicator(
                                value: pct / 100,
                                minHeight: 10,
                                backgroundColor: AppTheme.border,
                                valueColor: AlwaysStoppedAnimation(_adherenceColor(pct)),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Text('${pct.toStringAsFixed(0)}%', style: TextStyle(fontWeight: FontWeight.bold, color: _adherenceColor(pct))),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Doses: ${t['actual_doses'] ?? 0}/${t['expected_doses'] ?? 0} • ${t['start_date'] ?? ''} to ${t['end_date'] ?? ''}',
                        style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ],

          if (p.upcomingDoses.isEmpty && p.missedDoses.isEmpty && p.adherenceTrackers.isEmpty)
            const EmptyStateWidget(icon: Icons.check_circle_outline, title: 'No adherence data', subtitle: 'Adherence tracking starts when you have active prescriptions'),

          const SizedBox(height: 80),
        ],
      ),
    );
  }

  String _getMedicineName(dynamic dose) {
    if (dose['medicine_name'] != null) return dose['medicine_name'];
    if (dose['medicine'] is Map) return dose['medicine']['name'] ?? '';
    return 'Medicine';
  }

  Color _adherenceColor(double pct) {
    if (pct >= 80) return AppTheme.success;
    if (pct >= 50) return AppTheme.warning;
    return AppTheme.danger;
  }
}
