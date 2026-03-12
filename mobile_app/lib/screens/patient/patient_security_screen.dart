import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/patient_provider.dart';
import '../../widgets/common_widgets.dart';

class PatientSecurityScreen extends StatefulWidget {
  const PatientSecurityScreen({super.key});
  @override
  State<PatientSecurityScreen> createState() => _PatientSecurityScreenState();
}

class _PatientSecurityScreenState extends State<PatientSecurityScreen> {
  final _oldPwCtrl = TextEditingController();
  final _newPwCtrl = TextEditingController();
  final _confirmPwCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<PatientProvider>().loadSecurity());
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PatientProvider>();
    final info = p.securityInfo;

    return Scaffold(
      appBar: AppBar(title: const Text('Security')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          if (info != null) ...[
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.login, color: AppTheme.primary),
                    title: const Text('Last Login'),
                    subtitle: Text(info['last_login'] ?? 'N/A'),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: const Icon(Icons.password, color: AppTheme.warning),
                    title: const Text('Password Last Changed'),
                    subtitle: Text(info['password_last_changed'] ?? 'N/A'),
                  ),
                  const Divider(height: 1),
                  ListTile(
                    leading: Icon(Icons.security, color: info['is_2fa_enabled'] == true ? AppTheme.success : AppTheme.textSecondary),
                    title: const Text('Two-Factor Authentication'),
                    subtitle: Text(info['is_2fa_enabled'] == true ? 'Enabled' : 'Disabled'),
                  ),
                ],
              ),
            ),

            if (info['active_sessions'] is List && (info['active_sessions'] as List).isNotEmpty) ...[
              const SizedBox(height: 16),
              const SectionHeader(title: 'Active Sessions'),
              ...(info['active_sessions'] as List).map((s) => Card(
                    child: ListTile(
                      leading: const Icon(Icons.devices, color: AppTheme.info),
                      title: Text(s['device'] ?? 'Unknown'),
                      subtitle: Text('IP: ${s['ip_address'] ?? ''}\nLast active: ${s['last_active'] ?? ''}'),
                      isThreeLine: true,
                    ),
                  )),
            ],
          ],

          const SizedBox(height: 24),
          const Text('Change Password', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          TextField(controller: _oldPwCtrl, decoration: const InputDecoration(labelText: 'Current Password'), obscureText: true),
          const SizedBox(height: 12),
          TextField(controller: _newPwCtrl, decoration: const InputDecoration(labelText: 'New Password'), obscureText: true),
          const SizedBox(height: 12),
          TextField(controller: _confirmPwCtrl, decoration: const InputDecoration(labelText: 'Confirm Password'), obscureText: true),
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: () async {
              if (_newPwCtrl.text != _confirmPwCtrl.text) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Passwords do not match'), backgroundColor: AppTheme.danger));
                return;
              }
              final ok = await p.changePassword(_oldPwCtrl.text, _newPwCtrl.text, _confirmPwCtrl.text);
              if (ok && context.mounted) {
                _oldPwCtrl.clear();
                _newPwCtrl.clear();
                _confirmPwCtrl.clear();
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password changed!'), backgroundColor: AppTheme.success));
              }
            },
            child: const Text('Change Password'),
          ),
        ],
      ),
    );
  }
}
