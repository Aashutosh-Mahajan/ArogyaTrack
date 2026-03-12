import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../../config/theme.dart';
import '../../providers/auth_provider.dart';

class DoctorRegisterScreen extends StatefulWidget {
  const DoctorRegisterScreen({super.key});
  @override
  State<DoctorRegisterScreen> createState() => _DoctorRegisterScreenState();
}

class _DoctorRegisterScreenState extends State<DoctorRegisterScreen> {
  int _step = 0;
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _dobCtrl = TextEditingController();
  final _licenseCtrl = TextEditingController();
  final _specializationCtrl = TextEditingController();
  final _experienceCtrl = TextEditingController();
  final _clinicNameCtrl = TextEditingController();
  final _clinicAddressCtrl = TextEditingController();
  final _feeCtrl = TextEditingController();
  String _degree = 'MBBS';
  String? _licenseCertPath;
  String? _degreeCertPath;
  String? _govIdPath;
  bool _otpSent = false;
  final _otpCtrl = TextEditingController();

  final _degrees = ['MBBS', 'MD', 'MS', 'DNB', 'BDS', 'BAMS', 'BHMS', 'BUMS', 'Other'];

  Future<void> _pickFile(String type) async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery);
    if (file != null) {
      setState(() {
        if (type == 'license') _licenseCertPath = file.path;
        if (type == 'degree') _degreeCertPath = file.path;
        if (type == 'govId') _govIdPath = file.path;
      });
    }
  }

  Future<void> _register() async {
    final auth = context.read<AuthProvider>();
    if (!_otpSent) {
      final sent = await auth.sendOtp(_emailCtrl.text.trim());
      if (sent) {
        setState(() => _otpSent = true);
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('OTP sent!')));
      }
      return;
    }
    final verified = await auth.verifyEmail(_emailCtrl.text.trim(), _otpCtrl.text.trim());
    if (!verified && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(auth.error ?? 'Invalid OTP'), backgroundColor: AppTheme.danger));
      return;
    }
    final result = await auth.registerDoctor({
      'email': _emailCtrl.text.trim(),
      'password': _passwordCtrl.text,
      'first_name': _firstNameCtrl.text.trim(),
      'last_name': _lastNameCtrl.text.trim(),
      'phone': _phoneCtrl.text.trim(),
      'date_of_birth': _dobCtrl.text,
      'medical_license': _licenseCtrl.text.trim(),
      'degree': _degree,
      'specialization': _specializationCtrl.text.trim(),
      'experience_years': _experienceCtrl.text.trim(),
      'clinic_name': _clinicNameCtrl.text.trim(),
      'clinic_address': _clinicAddressCtrl.text.trim(),
      'consultation_fee': _feeCtrl.text.trim(),
      'terms_accepted': 'true',
    }, filePaths: {
      if (_licenseCertPath != null) 'license_certificate': _licenseCertPath!,
      if (_degreeCertPath != null) 'degree_certificate': _degreeCertPath!,
      if (_govIdPath != null) 'government_id': _govIdPath!,
    });
    if (result != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Registration submitted! Awaiting approval.'), backgroundColor: AppTheme.success),
      );
      Navigator.pushReplacementNamed(context, '/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Doctor Registration')),
      body: Stepper(
        currentStep: _step,
        onStepContinue: () {
          if (_step < 2) {
            setState(() => _step++);
          } else {
            _register();
          }
        },
        onStepCancel: _step > 0 ? () => setState(() => _step--) : null,
        controlsBuilder: (context, details) => Padding(
          padding: const EdgeInsets.only(top: 16),
          child: Row(children: [
            ElevatedButton(
              onPressed: auth.isLoading ? null : details.onStepContinue,
              child: auth.isLoading
                  ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(_step == 2 ? (_otpSent ? 'Verify & Register' : 'Send OTP') : 'Continue'),
            ),
            if (_step > 0) ...[const SizedBox(width: 12), OutlinedButton(onPressed: details.onStepCancel, child: const Text('Back'))],
          ]),
        ),
        steps: [
          Step(title: const Text('Account & Personal'), isActive: _step >= 0, content: Column(children: [
            TextField(controller: _emailCtrl, decoration: const InputDecoration(labelText: 'Email *'), keyboardType: TextInputType.emailAddress),
            const SizedBox(height: 12),
            TextField(controller: _passwordCtrl, decoration: const InputDecoration(labelText: 'Password *'), obscureText: true),
            const SizedBox(height: 12),
            TextField(controller: _firstNameCtrl, decoration: const InputDecoration(labelText: 'First Name *')),
            const SizedBox(height: 12),
            TextField(controller: _lastNameCtrl, decoration: const InputDecoration(labelText: 'Last Name *')),
            const SizedBox(height: 12),
            TextField(controller: _phoneCtrl, decoration: const InputDecoration(labelText: 'Phone *'), keyboardType: TextInputType.phone),
            const SizedBox(height: 12),
            TextField(controller: _dobCtrl, decoration: const InputDecoration(labelText: 'Date of Birth *', suffixIcon: Icon(Icons.calendar_today)), readOnly: true, onTap: () async {
              final d = await showDatePicker(context: context, initialDate: DateTime(1990), firstDate: DateTime(1940), lastDate: DateTime.now());
              if (d != null) _dobCtrl.text = '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
            }),
          ])),
          Step(title: const Text('Professional Info'), isActive: _step >= 1, content: Column(children: [
            TextField(controller: _licenseCtrl, decoration: const InputDecoration(labelText: 'Medical License Number *')),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(value: _degree, decoration: const InputDecoration(labelText: 'Degree'), items: _degrees.map((d) => DropdownMenuItem(value: d, child: Text(d))).toList(), onChanged: (v) => setState(() => _degree = v!)),
            const SizedBox(height: 12),
            TextField(controller: _specializationCtrl, decoration: const InputDecoration(labelText: 'Specialization *')),
            const SizedBox(height: 12),
            TextField(controller: _experienceCtrl, decoration: const InputDecoration(labelText: 'Years of Experience'), keyboardType: TextInputType.number),
            const SizedBox(height: 12),
            TextField(controller: _clinicNameCtrl, decoration: const InputDecoration(labelText: 'Clinic Name')),
            const SizedBox(height: 12),
            TextField(controller: _clinicAddressCtrl, decoration: const InputDecoration(labelText: 'Clinic Address')),
            const SizedBox(height: 12),
            TextField(controller: _feeCtrl, decoration: const InputDecoration(labelText: 'Consultation Fee'), keyboardType: TextInputType.number),
          ])),
          Step(title: const Text('Documents & Verify'), isActive: _step >= 2, content: Column(children: [
            OutlinedButton.icon(onPressed: () => _pickFile('license'), icon: const Icon(Icons.upload_file), label: Text(_licenseCertPath != null ? 'License ✓' : 'Upload License Certificate *')),
            const SizedBox(height: 8),
            OutlinedButton.icon(onPressed: () => _pickFile('degree'), icon: const Icon(Icons.upload_file), label: Text(_degreeCertPath != null ? 'Degree ✓' : 'Upload Degree Certificate *')),
            const SizedBox(height: 8),
            OutlinedButton.icon(onPressed: () => _pickFile('govId'), icon: const Icon(Icons.upload_file), label: Text(_govIdPath != null ? 'Gov ID ✓' : 'Upload Government ID *')),
            if (_otpSent) ...[const SizedBox(height: 16), TextField(controller: _otpCtrl, decoration: const InputDecoration(labelText: 'Enter OTP'), keyboardType: TextInputType.number)],
          ])),
        ],
      ),
    );
  }
}
