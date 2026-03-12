import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/doctor_provider.dart';
import '../../widgets/common_widgets.dart';

class DoctorPatientsTab extends StatefulWidget {
  const DoctorPatientsTab({super.key});
  @override
  State<DoctorPatientsTab> createState() => _DoctorPatientsTabState();
}

class _DoctorPatientsTabState extends State<DoctorPatientsTab> {
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<DoctorProvider>().loadMyPatients());
  }

  @override
  Widget build(BuildContext context) {
    final d = context.watch<DoctorProvider>();
    if (d.isLoading && d.myPatients.isEmpty) return const LoadingWidget();

    final patients = d.myPatients.where((p) {
      if (_searchCtrl.text.isEmpty) return true;
      final q = _searchCtrl.text.toLowerCase();
      return (p['name']?.toString().toLowerCase().contains(q) ?? false) ||
          (p['unique_patient_id']?.toString().toLowerCase().contains(q) ?? false);
    }).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              hintText: 'Search patients...',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _searchCtrl.text.isNotEmpty
                  ? IconButton(icon: const Icon(Icons.clear), onPressed: () { _searchCtrl.clear(); setState(() {}); })
                  : null,
            ),
            onChanged: (_) => setState(() {}),
          ),
        ),
        Expanded(
          child: patients.isEmpty
              ? const EmptyStateWidget(icon: Icons.people, title: 'No patients', subtitle: 'Scan a patient QR to add them')
              : RefreshIndicator(
                  onRefresh: () => d.loadMyPatients(),
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: patients.length,
                    itemBuilder: (_, i) {
                      final p = patients[i];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                            child: Text(
                              (p['name'] ?? 'P')[0].toUpperCase(),
                              style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold),
                            ),
                          ),
                          title: Text(p['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600)),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('ID: ${p['unique_patient_id'] ?? p['patient_id'] ?? ''}', style: const TextStyle(fontSize: 12)),
                              Text(
                                '${p['gender'] ?? ''} • ${p['age'] ?? ''} yrs • ${p['blood_group'] ?? ''}',
                                style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                              ),
                            ],
                          ),
                          trailing: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.end,
                            children: [
                              Text('${p['visit_count'] ?? 0} visits', style: const TextStyle(fontSize: 12, color: AppTheme.primary)),
                              if (p['last_visit_date'] != null)
                                Text(p['last_visit_date'].toString().substring(0, 10), style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                            ],
                          ),
                          isThreeLine: true,
                          onTap: () => _showPatientDetails(context, p),
                        ),
                      );
                    },
                  ),
                ),
        ),
      ],
    );
  }

  void _showPatientDetails(BuildContext context, dynamic patient) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (_, ctrl) => ListView(
          controller: ctrl,
          padding: const EdgeInsets.all(20),
          children: [
            Center(child: Container(width: 40, height: 4, decoration: BoxDecoration(color: AppTheme.border, borderRadius: BorderRadius.circular(2)))),
            const SizedBox(height: 16),
            Text(patient['name'] ?? '', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            Text('ID: ${patient['unique_patient_id'] ?? ''}', style: const TextStyle(color: AppTheme.textSecondary)),
            const SizedBox(height: 16),
            _infoRow('Gender', patient['gender'] ?? '-'),
            _infoRow('Age', '${patient['age'] ?? '-'}'),
            _infoRow('Blood Group', patient['blood_group'] ?? '-'),
            _infoRow('District', patient['district'] ?? '-'),
            _infoRow('Visits', '${patient['visit_count'] ?? 0}'),
            _infoRow('Access Method', patient['access_method'] ?? '-'),
            _infoRow('Access Expires', patient['access_expires_at']?.toString().substring(0, 10) ?? '-'),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(context);
                // Navigate to add record for this patient
              },
              icon: const Icon(Icons.add),
              label: const Text('Add Visit Record'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(width: 120, child: Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14))),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 14))),
        ],
      ),
    );
  }
}
