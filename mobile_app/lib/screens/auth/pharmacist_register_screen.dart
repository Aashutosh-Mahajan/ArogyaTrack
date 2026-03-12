import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../../config/theme.dart';
import '../../providers/auth_provider.dart';

class PharmacistRegisterScreen extends StatefulWidget {
  const PharmacistRegisterScreen({super.key});
  @override
  State<PharmacistRegisterScreen> createState() => _PharmacistRegisterScreenState();
}

class _PharmacistRegisterScreenState extends State<PharmacistRegisterScreen> {
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _licenseCtrl = TextEditingController();
  final _degreeCtrl = TextEditingController();
  final _pharmacyNameCtrl = TextEditingController();
  String? _licensePath;
  bool _otpSent = false;
  final _otpCtrl = TextEditingController();

  Future<void> _register() async {
    final auth = context.read<AuthProvider>();
    if (!_otpSent) {
      final sent = await auth.sendOtp(_emailCtrl.text.trim());
      if (sent) setState(() => _otpSent = true);
      return;
    }
    final verified = await auth.verifyEmail(_emailCtrl.text.trim(), _otpCtrl.text.trim());
    if (!verified && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(auth.error ?? 'Invalid OTP'), backgroundColor: AppTheme.danger));
      return;
    }
    final result = await auth.registerPharmacist({
      'email': _emailCtrl.text.trim(),
      'password': _passwordCtrl.text,
      'first_name': _firstNameCtrl.text.trim(),
      'last_name': _lastNameCtrl.text.trim(),
      'license_number': _licenseCtrl.text.trim(),
      'degree': _degreeCtrl.text.trim(),
      'pharmacy_name': _pharmacyNameCtrl.text.trim(),
      'terms_accepted': 'true',
    }, licensePath: _licensePath);
    if (result != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Registration successful!'), backgroundColor: AppTheme.success));
      Navigator.pushReplacementNamed(context, '/login');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Pharmacist Registration')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(children: [
          TextField(controller: _emailCtrl, decoration: const InputDecoration(labelText: 'Email *'), keyboardType: TextInputType.emailAddress),
          const SizedBox(height: 12),
          TextField(controller: _passwordCtrl, decoration: const InputDecoration(labelText: 'Password *'), obscureText: true),
          const SizedBox(height: 12),
          TextField(controller: _firstNameCtrl, decoration: const InputDecoration(labelText: 'First Name *')),
          const SizedBox(height: 12),
          TextField(controller: _lastNameCtrl, decoration: const InputDecoration(labelText: 'Last Name *')),
          const SizedBox(height: 12),
          TextField(controller: _licenseCtrl, decoration: const InputDecoration(labelText: 'License Number *')),
          const SizedBox(height: 12),
          TextField(controller: _degreeCtrl, decoration: const InputDecoration(labelText: 'Degree *')),
          const SizedBox(height: 12),
          TextField(controller: _pharmacyNameCtrl, decoration: const InputDecoration(labelText: 'Pharmacy Name')),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () async {
              final file = await ImagePicker().pickImage(source: ImageSource.gallery);
              if (file != null) setState(() => _licensePath = file.path);
            },
            icon: const Icon(Icons.upload_file),
            label: Text(_licensePath != null ? 'License Uploaded ✓' : 'Upload License Certificate *'),
          ),
          if (_otpSent) ...[
            const SizedBox(height: 16),
            TextField(controller: _otpCtrl, decoration: const InputDecoration(labelText: 'Enter OTP'), keyboardType: TextInputType.number),
          ],
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: auth.isLoading ? null : _register,
              child: auth.isLoading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(_otpSent ? 'Verify & Register' : 'Send OTP'),
            ),
          ),
        ]),
      ),
    );
  }
}
