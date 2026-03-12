import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/patient_provider.dart';
import '../../widgets/common_widgets.dart';

class PatientLabsScreen extends StatefulWidget {
  const PatientLabsScreen({super.key});
  @override
  State<PatientLabsScreen> createState() => _PatientLabsScreenState();
}

class _PatientLabsScreenState extends State<PatientLabsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<PatientProvider>().loadLabTests());
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PatientProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Lab Results')),
      body: p.isLoading && p.labTests.isEmpty
          ? const LoadingWidget()
          : p.labTests.isEmpty
              ? const EmptyStateWidget(icon: Icons.science, title: 'No lab results')
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: p.labTests.length,
                  itemBuilder: (_, i) {
                    final t = p.labTests[i];
                    final status = t['status'] ?? 'normal';
                    final value = (t['value'] ?? 0).toDouble();
                    final min = (t['normal_min'] ?? 0).toDouble();
                    final max = (t['normal_max'] ?? 100).toDouble();

                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(t['test_name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                                ),
                                StatusBadge(status: status),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Text(
                                  '${value.toStringAsFixed(1)} ${t['unit'] ?? ''}',
                                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: _statusColor(status)),
                                ),
                                const SizedBox(width: 8),
                                if (t['trend'] != null)
                                  Icon(
                                    t['trend'] == 'up' ? Icons.trending_up : Icons.trending_down,
                                    color: t['trend'] == 'up'
                                        ? (status == 'high' ? AppTheme.danger : AppTheme.success)
                                        : (status == 'low' ? AppTheme.danger : AppTheme.success),
                                    size: 20,
                                  ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text('Normal Range: ${min.toStringAsFixed(1)} - ${max.toStringAsFixed(1)} ${t['unit'] ?? ''}',
                                style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                            const SizedBox(height: 4),
                            Text('Tested: ${t['tested_at']?.toString().substring(0, 10) ?? ''}',
                                style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                          ],
                        ),
                      ),
                    );
                  },
                ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'high': return AppTheme.danger;
      case 'low': return AppTheme.warning;
      default: return AppTheme.success;
    }
  }
}
