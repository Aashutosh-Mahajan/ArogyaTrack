import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/doctor_provider.dart';
import '../../widgets/common_widgets.dart';

class DoctorHomeTab extends StatelessWidget {
  const DoctorHomeTab({super.key});

  @override
  Widget build(BuildContext context) {
    final d = context.watch<DoctorProvider>();
    if (d.isLoading && d.dashboardSummary == null) return const LoadingWidget(message: 'Loading dashboard...');

    final summary = d.dashboardSummary;

    return RefreshIndicator(
      onRefresh: () => d.loadDashboard(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Welcome
          Card(
            color: AppTheme.secondary,
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.medical_services, color: Colors.white, size: 28),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Dr. ${summary?['doctor_name'] ?? 'Doctor'}',
                          style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  if (summary?['specialization'] != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4),
                      child: Text(summary!['specialization'], style: const TextStyle(color: Colors.white70)),
                    ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 16),

          // Stats
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 8,
            mainAxisSpacing: 8,
            childAspectRatio: 1.5,
            children: [
              StatCard(title: 'Total Patients', value: '${summary?['total_patients'] ?? 0}', icon: Icons.people, color: AppTheme.primary),
              StatCard(title: 'Active Rx', value: '${summary?['active_prescriptions'] ?? 0}', icon: Icons.medication, color: AppTheme.secondary),
              StatCard(title: 'Visits Today', value: '${summary?['visits_today'] ?? 0}', icon: Icons.calendar_today, color: AppTheme.info),
              StatCard(title: 'High Risk', value: '${summary?['high_risk_patients'] ?? 0}', icon: Icons.warning, color: AppTheme.danger),
            ],
          ),

          // Recent Activity
          if (d.recentActivity.isNotEmpty) ...[
            const SizedBox(height: 16),
            const SectionHeader(title: 'Recent Activity'),
            ...d.recentActivity.take(5).map((a) => Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                      child: const Icon(Icons.history, color: AppTheme.primary, size: 20),
                    ),
                    title: Text(a['description'] ?? a['action'] ?? '', style: const TextStyle(fontSize: 14)),
                    subtitle: Text(a['created_at']?.toString().substring(0, 16) ?? '', style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                  ),
                )),
          ],
          const SizedBox(height: 80),
        ],
      ),
    );
  }
}
