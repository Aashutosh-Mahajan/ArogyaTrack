import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:file_picker/file_picker.dart';
import 'dart:io';
import '../../config/theme.dart';
import '../../providers/doctor_provider.dart';

class DoctorAddRecordTab extends StatefulWidget {
  const DoctorAddRecordTab({super.key});
  @override
  State<DoctorAddRecordTab> createState() => _DoctorAddRecordTabState();
}

class _DoctorAddRecordTabState extends State<DoctorAddRecordTab> {
  final _patientIdCtrl = TextEditingController();
  final _diagnosisCtrl = TextEditingController();
  final _testsCtrl = TextEditingController();
  final _prescriptionCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  final _departmentCtrl = TextEditingController();
  List<File> _reportFiles = [];

  Future<void> _pickFiles() async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: true,
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
    );
    if (result != null) {
      setState(() {
        _reportFiles = result.paths.whereType<String>().map((p) => File(p)).toList();
      });
    }
  }

  Future<void> _submit() async {
    if (_patientIdCtrl.text.isEmpty || _diagnosisCtrl.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Patient ID and Diagnosis are required'), backgroundColor: AppTheme.danger),
      );
      return;
    }

    final doctor = context.read<DoctorProvider>();
    final success = await doctor.createVisitRecord(
      _patientIdCtrl.text.trim(),
      {
        'diagnosis': _diagnosisCtrl.text.trim(),
        'tests_performed': _testsCtrl.text.trim(),
        'prescription': _prescriptionCtrl.text.trim(),
        'doctor_notes': _notesCtrl.text.trim(),
        'department': _departmentCtrl.text.trim(),
      },
      files: _reportFiles.isNotEmpty ? _reportFiles : null,
    );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Visit record created!'), backgroundColor: AppTheme.success),
      );
      _clearForm();
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to create record'), backgroundColor: AppTheme.danger),
      );
    }
  }

  void _clearForm() {
    _patientIdCtrl.clear();
    _diagnosisCtrl.clear();
    _testsCtrl.clear();
    _prescriptionCtrl.clear();
    _notesCtrl.clear();
    _departmentCtrl.clear();
    setState(() => _reportFiles = []);
  }

  @override
  Widget build(BuildContext context) {
    final d = context.watch<DoctorProvider>();
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
                  const Text('Patient', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _patientIdCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Patient ID *',
                      hintText: 'Enter patient UUID or scan QR',
                      prefixIcon: Icon(Icons.person_search),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Visit Details', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  TextField(controller: _departmentCtrl, decoration: const InputDecoration(labelText: 'Department', prefixIcon: Icon(Icons.local_hospital))),
                  const SizedBox(height: 12),
                  TextField(controller: _diagnosisCtrl, decoration: const InputDecoration(labelText: 'Diagnosis *', prefixIcon: Icon(Icons.medical_information)), maxLines: 3),
                  const SizedBox(height: 12),
                  TextField(controller: _testsCtrl, decoration: const InputDecoration(labelText: 'Tests Performed', prefixIcon: Icon(Icons.science)), maxLines: 2),
                  const SizedBox(height: 12),
                  TextField(controller: _prescriptionCtrl, decoration: const InputDecoration(labelText: 'Prescription Notes', prefixIcon: Icon(Icons.receipt_long)), maxLines: 2),
                  const SizedBox(height: 12),
                  TextField(controller: _notesCtrl, decoration: const InputDecoration(labelText: 'Doctor Notes', prefixIcon: Icon(Icons.note)), maxLines: 3),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Reports & Attachments', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _pickFiles,
                    icon: const Icon(Icons.attach_file),
                    label: Text(_reportFiles.isEmpty ? 'Attach Reports (PDF/Images)' : '${_reportFiles.length} file(s) selected'),
                  ),
                  if (_reportFiles.isNotEmpty)
                    ..._reportFiles.map((f) => Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Chip(
                            label: Text(f.path.split(Platform.pathSeparator).last, style: const TextStyle(fontSize: 12)),
                            deleteIcon: const Icon(Icons.close, size: 16),
                            onDeleted: () => setState(() => _reportFiles.remove(f)),
                          ),
                        )),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          SizedBox(
            height: 52,
            child: ElevatedButton.icon(
              onPressed: d.isLoading ? null : _submit,
              icon: d.isLoading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.save),
              label: const Text('Create Visit Record', style: TextStyle(fontSize: 16)),
            ),
          ),
          const SizedBox(height: 80),
        ],
      ),
    );
  }
}
