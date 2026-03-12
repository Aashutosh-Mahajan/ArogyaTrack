import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../../config/theme.dart';
import '../../providers/patient_provider.dart';
import '../../widgets/common_widgets.dart';

class PatientQRCardScreen extends StatelessWidget {
  const PatientQRCardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PatientProvider>();
    final card = p.patientCard;

    return Scaffold(
      appBar: AppBar(title: const Text('Health Card')),
      body: card == null
          ? Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const EmptyStateWidget(icon: Icons.credit_card, title: 'No health card', subtitle: 'Generate your health card to get started'),
                  ElevatedButton(
                    onPressed: () async {
                      await p.generateHealthCard();
                      await p.loadDashboard();
                    },
                    child: const Text('Generate Health Card'),
                  ),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Card(
                    elevation: 4,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        gradient: const LinearGradient(
                          colors: [AppTheme.primary, AppTheme.primaryDark],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: Column(
                        children: [
                          const Icon(Icons.local_hospital, color: Colors.white, size: 32),
                          const SizedBox(height: 8),
                          const Text('HEALTH SURVEILLANCE', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14, letterSpacing: 2)),
                          const Text('Digital Health Card', style: TextStyle(color: Colors.white70, fontSize: 12)),
                          const SizedBox(height: 20),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: QrImageView(
                              data: card['token'] ?? card['unique_patient_id'] ?? '',
                              version: QrVersions.auto,
                              size: 200,
                            ),
                          ),
                          const SizedBox(height: 20),
                          Text(
                            card['name'] ?? '',
                            style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'ID: ${card['unique_patient_id'] ?? ''}',
                            style: const TextStyle(color: Colors.white70, fontSize: 14),
                          ),
                          const SizedBox(height: 8),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _CardDetail(label: 'Blood', value: card['blood_group'] ?? '-'),
                              const SizedBox(width: 24),
                              _CardDetail(label: 'Gender', value: card['gender'] ?? '-'),
                              const SizedBox(width: 24),
                              _CardDetail(label: 'Age', value: '${card['age'] ?? '-'}'),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Show this QR code to your doctor or pharmacist for quick access to your medical records',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                  ),
                ],
              ),
            ),
    );
  }
}

class _CardDetail extends StatelessWidget {
  final String label;
  final String value;
  const _CardDetail({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(label, style: const TextStyle(color: Colors.white60, fontSize: 11)),
        Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
      ],
    );
  }
}
