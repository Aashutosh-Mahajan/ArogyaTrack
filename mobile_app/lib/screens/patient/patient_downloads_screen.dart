import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/patient_provider.dart';
import '../../widgets/common_widgets.dart';

class PatientDownloadsScreen extends StatefulWidget {
  const PatientDownloadsScreen({super.key});
  @override
  State<PatientDownloadsScreen> createState() => _PatientDownloadsScreenState();
}

class _PatientDownloadsScreenState extends State<PatientDownloadsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<PatientProvider>().loadDownloads());
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PatientProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Downloads')),
      body: p.downloads.isEmpty
          ? const EmptyStateWidget(icon: Icons.download, title: 'No downloads available')
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: p.downloads.length,
              itemBuilder: (_, i) {
                final d = p.downloads[i];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    leading: Icon(_typeIcon(d['type']), color: AppTheme.primary),
                    title: Text(d['title'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                    subtitle: Text('${d['type_label'] ?? d['type']} • ${d['created_at']?.toString().substring(0, 10) ?? ''}',
                        style: const TextStyle(fontSize: 12)),
                    trailing: const Icon(Icons.download, color: AppTheme.primary),
                    onTap: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Download started...')),
                      );
                    },
                  ),
                );
              },
            ),
    );
  }

  IconData _typeIcon(String? type) {
    switch (type) {
      case 'visit_attachment': return Icons.attach_file;
      case 'lab_report': return Icons.science;
      case 'medical_record': return Icons.folder_shared;
      default: return Icons.insert_drive_file;
    }
  }
}
