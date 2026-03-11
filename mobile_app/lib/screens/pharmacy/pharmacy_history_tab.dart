import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/pharmacy_provider.dart';
import '../../widgets/common_widgets.dart';

class PharmacyHistoryTab extends StatefulWidget {
  const PharmacyHistoryTab({super.key});
  @override
  State<PharmacyHistoryTab> createState() => _PharmacyHistoryTabState();
}

class _PharmacyHistoryTabState extends State<PharmacyHistoryTab> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PharmacyProvider>().loadDispensingHistory();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<PharmacyProvider>(
      builder: (context, prov, _) {
        if (prov.isLoading && prov.dispensingHistory.isEmpty) return const LoadingWidget();
        if (prov.error != null && prov.dispensingHistory.isEmpty) {
          return ErrorRetryWidget(message: prov.error!, onRetry: prov.loadDispensingHistory);
        }
        if (prov.dispensingHistory.isEmpty) {
          return const EmptyStateWidget(icon: Icons.history, title: 'No dispensing history');
        }
        return RefreshIndicator(
          onRefresh: () => prov.loadDispensingHistory(),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: prov.dispensingHistory.length,
            itemBuilder: (context, i) {
              final h = prov.dispensingHistory[i];
              return Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ExpansionTile(
                  leading: const CircleAvatar(
                    backgroundColor: Color(0xFFE0F2F1),
                    child: Icon(Icons.local_pharmacy, color: AppTheme.primary),
                  ),
                  title: Text(h['patient_name'] ?? h['patient'] ?? 'Patient', style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(h['dispensed_at'] ?? h['date'] ?? '-', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                  trailing: StatusBadge(status: h['status'] ?? 'dispensed'),
                  children: [
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _row('Prescription', '#${h['prescription_id'] ?? h['prescription'] ?? '-'}'),
                          _row('Doctor', h['doctor_name'] ?? h['doctor'] ?? '-'),
                          _row('Medicine', h['medicine_name'] ?? h['medicine'] ?? '-'),
                          _row('Quantity', '${h['quantity'] ?? '-'}'),
                          _row('Dispensed By', h['dispensed_by'] ?? '-'),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
