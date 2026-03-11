import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/patient_provider.dart';
import 'patient_home_tab.dart';
import 'patient_records_tab.dart';
import 'patient_prescriptions_tab.dart';
import 'patient_adherence_tab.dart';
import 'patient_profile_tab.dart';

class PatientDashboard extends StatefulWidget {
  const PatientDashboard({super.key});
  @override
  State<PatientDashboard> createState() => _PatientDashboardState();
}

class _PatientDashboardState extends State<PatientDashboard> {
  int _currentIndex = 0;

  final _tabs = const [
    PatientHomeTab(),
    PatientRecordsTab(),
    PatientPrescriptionsTab(),
    PatientAdherenceTab(),
    PatientProfileTab(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PatientProvider>().loadDashboard();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final patient = context.watch<PatientProvider>();
    return Scaffold(
      appBar: AppBar(
        title: Text(_getTitle()),
        actions: [
          if (patient.unreadAlerts > 0)
            Badge(
              label: Text('${patient.unreadAlerts}'),
              child: IconButton(
                icon: const Icon(Icons.notifications),
                onPressed: () => Navigator.pushNamed(context, '/patient/alerts'),
              ),
            )
          else
            IconButton(
              icon: const Icon(Icons.notifications_outlined),
              onPressed: () => Navigator.pushNamed(context, '/patient/alerts'),
            ),
          PopupMenuButton(
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'security', child: ListTile(leading: Icon(Icons.security), title: Text('Security'))),
              const PopupMenuItem(value: 'downloads', child: ListTile(leading: Icon(Icons.download), title: Text('Downloads'))),
              const PopupMenuItem(value: 'logout', child: ListTile(leading: Icon(Icons.logout, color: AppTheme.danger), title: Text('Logout'))),
            ],
            onSelected: (v) {
              if (v == 'logout') {
                auth.logout();
                Navigator.pushReplacementNamed(context, '/login');
              } else if (v == 'security') {
                Navigator.pushNamed(context, '/patient/security');
              } else if (v == 'downloads') {
                Navigator.pushNamed(context, '/patient/downloads');
              }
            },
          ),
        ],
      ),
      body: _tabs[_currentIndex],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.folder_shared), label: 'Records'),
          BottomNavigationBarItem(icon: Icon(Icons.medication), label: 'Rx'),
          BottomNavigationBarItem(icon: Icon(Icons.check_circle_outline), label: 'Adherence'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }

  String _getTitle() {
    switch (_currentIndex) {
      case 0: return 'Dashboard';
      case 1: return 'Medical Records';
      case 2: return 'Prescriptions';
      case 3: return 'Adherence';
      case 4: return 'Profile';
      default: return 'Dashboard';
    }
  }
}
