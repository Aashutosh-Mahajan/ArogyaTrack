import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/doctor_provider.dart';
import 'doctor_home_tab.dart';
import 'doctor_patients_tab.dart';
import 'doctor_add_record_tab.dart';
import 'doctor_scan_tab.dart';

class DoctorDashboard extends StatefulWidget {
  const DoctorDashboard({super.key});
  @override
  State<DoctorDashboard> createState() => _DoctorDashboardState();
}

class _DoctorDashboardState extends State<DoctorDashboard> {
  int _currentIndex = 0;

  final _tabs = const [
    DoctorHomeTab(),
    DoctorPatientsTab(),
    DoctorAddRecordTab(),
    DoctorScanTab(),
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DoctorProvider>().loadDashboard();
    });
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(
        title: Text(_getTitle()),
        actions: [
          PopupMenuButton(
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'high-risk', child: ListTile(leading: Icon(Icons.warning), title: Text('High Risk'))),
              const PopupMenuItem(value: 'logout', child: ListTile(leading: Icon(Icons.logout, color: AppTheme.danger), title: Text('Logout'))),
            ],
            onSelected: (v) {
              if (v == 'logout') {
                auth.logout();
                Navigator.pushReplacementNamed(context, '/login');
              } else if (v == 'high-risk') {
                Navigator.pushNamed(context, '/doctor/high-risk');
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
          BottomNavigationBarItem(icon: Icon(Icons.people), label: 'Patients'),
          BottomNavigationBarItem(icon: Icon(Icons.add_circle), label: 'Add Record'),
          BottomNavigationBarItem(icon: Icon(Icons.qr_code_scanner), label: 'Scan QR'),
        ],
      ),
    );
  }

  String _getTitle() {
    switch (_currentIndex) {
      case 0: return 'Doctor Dashboard';
      case 1: return 'My Patients';
      case 2: return 'Add Medical Record';
      case 3: return 'Scan Patient QR';
      default: return 'Dashboard';
    }
  }
}
