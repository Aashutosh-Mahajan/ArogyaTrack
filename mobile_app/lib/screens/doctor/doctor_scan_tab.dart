import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../config/theme.dart';
import '../../providers/doctor_provider.dart';

class DoctorScanTab extends StatefulWidget {
  const DoctorScanTab({super.key});
  @override
  State<DoctorScanTab> createState() => _DoctorScanTabState();
}

class _DoctorScanTabState extends State<DoctorScanTab> {
  final MobileScannerController _cameraCtrl = MobileScannerController();
  bool _scanned = false;
  Map<String, dynamic>? _patientData;
  String? _error;

  @override
  void dispose() {
    _cameraCtrl.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) async {
    if (_scanned) return;
    final code = capture.barcodes.firstOrNull?.rawValue;
    if (code == null) return;
    setState(() {
      _scanned = true;
      _error = null;
    });
    await _cameraCtrl.stop();

    final doctor = context.read<DoctorProvider>();
    final result = await doctor.scanQR(code);
    if (result != null && mounted) {
      setState(() => _patientData = result);
    } else if (mounted) {
      setState(() => _error = 'Could not find patient. Try again.');
    }
  }

  void _resetScan() {
    setState(() {
      _scanned = false;
      _patientData = null;
      _error = null;
    });
    _cameraCtrl.start();
  }

  @override
  Widget build(BuildContext context) {
    if (_patientData != null) return _buildPatientResult();
    return Column(
      children: [
        Expanded(
          flex: 3,
          child: Stack(
            children: [
              MobileScanner(controller: _cameraCtrl, onDetect: _onDetect),
              Center(
                child: Container(
                  width: 250,
                  height: 250,
                  decoration: BoxDecoration(
                    border: Border.all(color: AppTheme.primary, width: 3),
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
              ),
              if (_scanned && _error == null)
                const Center(child: CircularProgressIndicator()),
            ],
          ),
        ),
        Expanded(
          flex: 1,
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                Icon(Icons.qr_code_scanner, size: 48, color: Colors.grey.shade400),
                const SizedBox(height: 8),
                Text(
                  _error ?? 'Scan patient health card QR code',
                  style: TextStyle(fontSize: 16, color: _error != null ? AppTheme.danger : Colors.grey.shade600),
                  textAlign: TextAlign.center,
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  OutlinedButton(onPressed: _resetScan, child: const Text('Scan Again')),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPatientResult() {
    final p = _patientData!;
    final doctor = context.read<DoctorProvider>();
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  const CircleAvatar(radius: 36, backgroundColor: AppTheme.primary, child: Icon(Icons.person, size: 36, color: Colors.white)),
                  const SizedBox(height: 12),
                  Text(p['name'] ?? p['full_name'] ?? 'Unknown', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  Text('ID: ${p['unique_patient_id'] ?? p['patient_id'] ?? p['id'] ?? '-'}', style: TextStyle(color: Colors.grey.shade600)),
                  const SizedBox(height: 16),
                  _infoRow('Blood Group', p['blood_group'] ?? '-'),
                  _infoRow('Gender', p['gender'] ?? '-'),
                  _infoRow('Age', p['age']?.toString() ?? '-'),
                  _infoRow('Phone', p['phone'] ?? '-'),
                  _infoRow('District', p['district'] ?? '-'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              onPressed: () async {
                final id = p['id']?.toString() ?? p['unique_patient_id']?.toString() ?? p['patient_id']?.toString();
                if (id != null) {
                  await doctor.addPatientToMyList(id);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Patient added to your list'), backgroundColor: AppTheme.success),
                    );
                  }
                }
              },
              icon: const Icon(Icons.person_add),
              label: const Text('Add to My Patients'),
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(onPressed: _resetScan, icon: const Icon(Icons.qr_code_scanner), label: const Text('Scan Another')),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: Colors.grey.shade600)),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
