import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/patient_provider.dart';
import '../../widgets/common_widgets.dart';

class PatientProfileTab extends StatefulWidget {
  const PatientProfileTab({super.key});
  @override
  State<PatientProfileTab> createState() => _PatientProfileTabState();
}

class _PatientProfileTabState extends State<PatientProfileTab> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PatientProvider>().loadProfile();
    });
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PatientProvider>();
    final profile = p.profile;
    final card = p.patientCard;

    if (profile == null && p.isLoading) return const LoadingWidget();

    return RefreshIndicator(
      onRefresh: () => p.loadProfile(),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Avatar + Name
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 45,
                  backgroundColor: AppTheme.primary.withValues(alpha: 0.1),
                  child: Text(
                    (profile?['name'] ?? 'P').toString().substring(0, 1).toUpperCase(),
                    style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: AppTheme.primary),
                  ),
                ),
                const SizedBox(height: 12),
                Text(profile?['name'] ?? 'Patient', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                if (card?['unique_patient_id'] != null)
                  Text('ID: ${card!['unique_patient_id']}', style: const TextStyle(color: AppTheme.textSecondary)),
              ],
            ),
          ),
          const SizedBox(height: 24),

          _section('Personal Information', [
            _infoTile('Gender', profile?['gender'] ?? '-'),
            _infoTile('Age', '${profile?['age'] ?? profile?['calculated_age'] ?? '-'}'),
            _infoTile('Blood Group', profile?['blood_group'] ?? '-'),
            _infoTile('Date of Birth', profile?['date_of_birth'] ?? '-'),
            _infoTile('Phone', profile?['phone'] ?? '-'),
          ]),

          _section('Address', [
            _infoTile('Address', profile?['address'] ?? '-'),
            _infoTile('District', profile?['district'] ?? '-'),
            _infoTile('State', profile?['state'] ?? '-'),
            _infoTile('Pincode', profile?['pincode'] ?? '-'),
          ]),

          const SizedBox(height: 16),
          Card(
            child: Column(
              children: [
                ListTile(
                  leading: const Icon(Icons.qr_code, color: AppTheme.primary),
                  title: const Text('Health QR Card'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.pushNamed(context, '/patient/qr-card'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.science, color: AppTheme.info),
                  title: const Text('Lab Results'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.pushNamed(context, '/patient/labs'),
                ),
                const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.trending_up, color: AppTheme.success),
                  title: const Text('Health Trends'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.pushNamed(context, '/patient/health-trends'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 80),
        ],
      ),
    );
  }

  Widget _section(String title, List<Widget> children) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 8, top: 16),
          child: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        ),
        Card(child: Column(children: children)),
      ],
    );
  }

  Widget _infoTile(String label, String value) {
    return ListTile(
      dense: true,
      title: Text(label, style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
      trailing: Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
    );
  }
}
