import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/pharmacy_provider.dart';
import '../../widgets/common_widgets.dart';

class PharmacyHomeTab extends StatelessWidget {
  const PharmacyHomeTab({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<PharmacyProvider>(
      builder: (context, prov, _) {
        if (prov.isLoading && prov.dashboardStats == null) return const LoadingWidget();
        if (prov.error != null && prov.dashboardStats == null) {
          return ErrorRetryWidget(message: prov.error!, onRetry: prov.loadDashboard);
        }
        final stats = prov.dashboardStats ?? {};
        return RefreshIndicator(
          onRefresh: () => prov.loadDashboard(),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Welcome card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [AppTheme.primary, Color(0xFF0D9488)]),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Pharmacy Dashboard', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Text('Manage prescriptions & inventory', style: TextStyle(color: Colors.white.withValues(alpha: 0.9))),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              // Stats grid
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.5,
                children: [
                  StatCard(
                    title: 'Today Dispensed',
                    value: '${stats['today_dispensed'] ?? stats['dispensed_today'] ?? 0}',
                    icon: Icons.local_pharmacy,
                    color: AppTheme.primary,
                  ),
                  StatCard(
                    title: 'Pending',
                    value: '${stats['pending_prescriptions'] ?? stats['pending'] ?? 0}',
                    icon: Icons.pending_actions,
                    color: AppTheme.warning,
                  ),
                  StatCard(
                    title: 'Low Stock',
                    value: '${stats['low_stock_count'] ?? stats['low_stock'] ?? 0}',
                    icon: Icons.warning_amber,
                    color: AppTheme.danger,
                  ),
                  StatCard(
                    title: 'Total Items',
                    value: '${stats['total_inventory'] ?? stats['total_items'] ?? 0}',
                    icon: Icons.inventory,
                    color: Colors.blue,
                  ),
                ],
              ),
              const SizedBox(height: 20),
              // Quick actions
              const SectionHeader(title: 'Quick Actions'),
              const SizedBox(height: 8),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  _actionChip(context, Icons.qr_code_scanner, 'Scan Prescription', () {
                    // Switch to scan tab - the parent manages tab index
                  }),
                  _actionChip(context, Icons.inventory_2, 'Check Inventory', () {}),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _actionChip(BuildContext context, IconData icon, String label, VoidCallback onTap) {
    return ActionChip(
      avatar: Icon(icon, size: 18, color: AppTheme.primary),
      label: Text(label),
      onPressed: onTap,
    );
  }
}
