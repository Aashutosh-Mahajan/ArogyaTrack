import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../../config/theme.dart';
import '../../providers/auth_provider.dart';

class PatientRegisterScreen extends StatefulWidget {
  const PatientRegisterScreen({super.key});

  @override
  State<PatientRegisterScreen> createState() => _PatientRegisterScreenState();
}

class _PatientRegisterScreenState extends State<PatientRegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  int _step = 0;
  final _emailCtrl = TextEditingController();
  final _passwordCtrl = TextEditingController();
  final _firstNameCtrl = TextEditingController();
  final _lastNameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _dobCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _districtCtrl = TextEditingController();
  final _stateCtrl = TextEditingController();
  final _pincodeCtrl = TextEditingController();
  String _gender = 'male';
  String _bloodGroup = 'O+';
  String? _idProofPath;
  bool _termsAccepted = false;
  bool _consentStore = false;
  bool _consentDoctor = false;
  bool _otpSent = false;
  final _otpCtrl = TextEditingController();

  final _bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passwordCtrl.dispose();
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _phoneCtrl.dispose();
    _dobCtrl.dispose();
    _addressCtrl.dispose();
    _districtCtrl.dispose();
    _stateCtrl.dispose();
    _pincodeCtrl.dispose();
    _otpCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickIdProof() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery);
    if (file != null) setState(() => _idProofPath = file.path);
  }

  Future<void> _pickDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime(2000),
      firstDate: DateTime(1920),
      lastDate: DateTime.now(),
    );
    if (date != null) {
      _dobCtrl.text = '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
    }
  }

  Future<void> _register() async {
    final auth = context.read<AuthProvider>();
    // First send OTP
    if (!_otpSent) {
      final sent = await auth.sendOtp(_emailCtrl.text.trim());
      if (sent) {
        setState(() => _otpSent = true);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('OTP sent to your email'), backgroundColor: AppTheme.success),
          );
        }
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(auth.error ?? 'Failed to send OTP'), backgroundColor: AppTheme.danger),
        );
      }
      return;
    }

    // Verify OTP first
    final verified = await auth.verifyEmail(_emailCtrl.text.trim(), _otpCtrl.text.trim());
    if (!verified) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(auth.error ?? 'Invalid OTP'), backgroundColor: AppTheme.danger),
        );
      }
      return;
    }

    // Then register
    final result = await auth.registerPatient({
      'email': _emailCtrl.text.trim(),
      'password': _passwordCtrl.text,
      'first_name': _firstNameCtrl.text.trim(),
      'last_name': _lastNameCtrl.text.trim(),
      'date_of_birth': _dobCtrl.text,
      'gender': _gender,
      'phone': _phoneCtrl.text.trim(),
      'blood_group': _bloodGroup,
      'address': _addressCtrl.text.trim(),
      'district': _districtCtrl.text.trim(),
      'state': _stateCtrl.text.trim(),
      'country': 'India',
      'pincode': _pincodeCtrl.text.trim(),
      'terms_accepted': 'true',
      'consent_store_data': 'true',
      'consent_doctor_access': 'true',
    }, idProofPath: _idProofPath);

    if (result != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Registration successful! Please login.'), backgroundColor: AppTheme.success),
      );
      Navigator.pushReplacementNamed(context, '/login');
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(auth.error ?? 'Registration failed'), backgroundColor: AppTheme.danger),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Patient Registration')),
      body: Form(
        key: _formKey,
        child: Stepper(
          currentStep: _step,
          onStepContinue: () {
            if (_step < 3) {
              setState(() => _step++);
            } else {
              _register();
            }
          },
          onStepCancel: _step > 0 ? () => setState(() => _step--) : null,
          controlsBuilder: (context, details) {
            return Padding(
              padding: const EdgeInsets.only(top: 16),
              child: Row(
                children: [
                  ElevatedButton(
                    onPressed: auth.isLoading ? null : details.onStepContinue,
                    child: auth.isLoading
                        ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text(_step == 3 ? (_otpSent ? 'Verify & Register' : 'Send OTP') : 'Continue'),
                  ),
                  if (_step > 0) ...[
                    const SizedBox(width: 12),
                    OutlinedButton(onPressed: details.onStepCancel, child: const Text('Back')),
                  ],
                ],
              ),
            );
          },
          steps: [
            Step(
              title: const Text('Account'),
              isActive: _step >= 0,
              content: Column(
                children: [
                  TextField(controller: _emailCtrl, decoration: const InputDecoration(labelText: 'Email *'), keyboardType: TextInputType.emailAddress),
                  const SizedBox(height: 12),
                  TextField(controller: _passwordCtrl, decoration: const InputDecoration(labelText: 'Password *'), obscureText: true),
                ],
              ),
            ),
            Step(
              title: const Text('Personal Info'),
              isActive: _step >= 1,
              content: Column(
                children: [
                  TextField(controller: _firstNameCtrl, decoration: const InputDecoration(labelText: 'First Name *')),
                  const SizedBox(height: 12),
                  TextField(controller: _lastNameCtrl, decoration: const InputDecoration(labelText: 'Last Name *')),
                  const SizedBox(height: 12),
                  TextField(controller: _phoneCtrl, decoration: const InputDecoration(labelText: 'Phone *'), keyboardType: TextInputType.phone),
                  const SizedBox(height: 12),
                  TextField(controller: _dobCtrl, decoration: const InputDecoration(labelText: 'Date of Birth *', suffixIcon: Icon(Icons.calendar_today)), readOnly: true, onTap: _pickDate),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _gender,
                    decoration: const InputDecoration(labelText: 'Gender'),
                    items: ['male', 'female', 'other'].map((g) => DropdownMenuItem(value: g, child: Text(g[0].toUpperCase() + g.substring(1)))).toList(),
                    onChanged: (v) => setState(() => _gender = v!),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _bloodGroup,
                    decoration: const InputDecoration(labelText: 'Blood Group'),
                    items: _bloodGroups.map((b) => DropdownMenuItem(value: b, child: Text(b))).toList(),
                    onChanged: (v) => setState(() => _bloodGroup = v!),
                  ),
                ],
              ),
            ),
            Step(
              title: const Text('Address & Documents'),
              isActive: _step >= 2,
              content: Column(
                children: [
                  TextField(controller: _addressCtrl, decoration: const InputDecoration(labelText: 'Address *'), maxLines: 2),
                  const SizedBox(height: 12),
                  TextField(controller: _districtCtrl, decoration: const InputDecoration(labelText: 'District *')),
                  const SizedBox(height: 12),
                  TextField(controller: _stateCtrl, decoration: const InputDecoration(labelText: 'State *')),
                  const SizedBox(height: 12),
                  TextField(controller: _pincodeCtrl, decoration: const InputDecoration(labelText: 'Pincode *'), keyboardType: TextInputType.number),
                  const SizedBox(height: 16),
                  OutlinedButton.icon(
                    onPressed: _pickIdProof,
                    icon: const Icon(Icons.upload_file),
                    label: Text(_idProofPath != null ? 'ID Proof Selected' : 'Upload ID Proof *'),
                  ),
                ],
              ),
            ),
            Step(
              title: const Text('Consent & Verify'),
              isActive: _step >= 3,
              content: Column(
                children: [
                  CheckboxListTile(
                    value: _termsAccepted,
                    onChanged: (v) => setState(() => _termsAccepted = v!),
                    title: const Text('I accept the Terms & Conditions', style: TextStyle(fontSize: 14)),
                    controlAffinity: ListTileControlAffinity.leading,
                    contentPadding: EdgeInsets.zero,
                  ),
                  CheckboxListTile(
                    value: _consentStore,
                    onChanged: (v) => setState(() => _consentStore = v!),
                    title: const Text('I consent to data storage', style: TextStyle(fontSize: 14)),
                    controlAffinity: ListTileControlAffinity.leading,
                    contentPadding: EdgeInsets.zero,
                  ),
                  CheckboxListTile(
                    value: _consentDoctor,
                    onChanged: (v) => setState(() => _consentDoctor = v!),
                    title: const Text('I consent to doctor access', style: TextStyle(fontSize: 14)),
                    controlAffinity: ListTileControlAffinity.leading,
                    contentPadding: EdgeInsets.zero,
                  ),
                  if (_otpSent) ...[
                    const SizedBox(height: 16),
                    TextField(controller: _otpCtrl, decoration: const InputDecoration(labelText: 'Enter OTP'), keyboardType: TextInputType.number),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
