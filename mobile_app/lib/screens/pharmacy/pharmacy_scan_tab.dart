import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../../config/theme.dart';
import '../../providers/pharmacy_provider.dart';

class PharmacyScanTab extends StatefulWidget {
  const PharmacyScanTab({super.key});
  @override
  State<PharmacyScanTab> createState() => _PharmacyScanTabState();
}

class _PharmacyScanTabState extends State<PharmacyScanTab> {
  final MobileScannerController _cameraCtrl = MobileScannerController();
  bool _scanned = false;
  Map<String, dynamic>? _prescriptionData;
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

    final prov = context.read<PharmacyProvider>();
    final result = await prov.scanPrescription(code);
    if (result != null && mounted) {
      setState(() => _prescriptionData = result);
    } else if (mounted) {
      setState(() => _error = 'Invalid prescription QR. Try again.');
    }
  }

  void _resetScan() {
    setState(() {
      _scanned = false;
      _prescriptionData = null;
      _error = null;
    });
    _cameraCtrl.start();
  }

  Future<void> _dispense() async {
    if (_prescriptionData == null) return;
    final prov = context.read<PharmacyProvider>();
    final success = await prov.dispenseMedicine({
      'prescription_id': _prescriptionData!['id'],
    });
    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Medicine dispensed successfully'), backgroundColor: AppTheme.success),
      );
      _resetScan();
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to dispense'), backgroundColor: AppTheme.danger),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_prescriptionData != null) return _buildPrescriptionResult();
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
                  _error ?? 'Scan prescription QR code',
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

  Widget _buildPrescriptionResult() {
    final rx = _prescriptionData!;
    final medicines = rx['medicines'] as List? ?? rx['items'] as List? ?? [];
    final prov = context.watch<PharmacyProvider>();
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.receipt_long, color: AppTheme.primary),
                      const SizedBox(width: 8),
                      Expanded(child: Text('Prescription #${rx['id'] ?? '-'}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
                    ],
                  ),
                  const Divider(height: 24),
                  _info('Patient', rx['patient_name'] ?? rx['patient'] ?? '-'),
                  _info('Doctor', rx['doctor_name'] ?? rx['doctor'] ?? '-'),
                  _info('Date', rx['created_at'] ?? rx['date'] ?? '-'),
                  _info('Status', rx['status'] ?? 'pending'),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (medicines.isNotEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Medicines', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    ...medicines.map((m) {
                      final med = m is Map ? m : {};
                      return ListTile(
                        dense: true,
                        leading: const Icon(Icons.medication, color: AppTheme.primary, size: 20),
                        title: Text(med['name'] ?? med['medicine_name'] ?? '-'),
                        subtitle: Text('${med['dosage'] ?? ''} | ${med['frequency'] ?? ''} | ${med['duration'] ?? ''}'),
                      );
                    }),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 20),
          SizedBox(
            height: 52,
            child: ElevatedButton.icon(
              onPressed: prov.isLoading ? null : _dispense,
              icon: prov.isLoading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.check_circle),
              label: const Text('Dispense Medicine', style: TextStyle(fontSize: 16)),
            ),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _resetScan,
            icon: const Icon(Icons.qr_code_scanner),
            label: const Text('Scan Another'),
          ),
        ],
      ),
    );
  }

  Widget _info(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
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
