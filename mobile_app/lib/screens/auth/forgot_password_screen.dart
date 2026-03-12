import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/auth_provider.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _emailCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  final _newPwCtrl = TextEditingController();
  bool _otpSent = false;

  Future<void> _submit() async {
    final auth = context.read<AuthProvider>();
    if (!_otpSent) {
      final sent = await auth.requestPasswordReset(_emailCtrl.text.trim());
      if (sent) {
        setState(() => _otpSent = true);
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('OTP sent to your email')));
      }
    } else {
      final success = await auth.confirmPasswordReset(_emailCtrl.text.trim(), _otpCtrl.text.trim(), _newPwCtrl.text);
      if (success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Password reset! Please login.'), backgroundColor: AppTheme.success));
        Navigator.pushReplacementNamed(context, '/login');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return Scaffold(
      appBar: AppBar(title: const Text('Reset Password')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          TextField(controller: _emailCtrl, decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email)), keyboardType: TextInputType.emailAddress, enabled: !_otpSent),
          if (_otpSent) ...[
            const SizedBox(height: 16),
            TextField(controller: _otpCtrl, decoration: const InputDecoration(labelText: 'OTP', prefixIcon: Icon(Icons.pin)), keyboardType: TextInputType.number),
            const SizedBox(height: 16),
            TextField(controller: _newPwCtrl, decoration: const InputDecoration(labelText: 'New Password', prefixIcon: Icon(Icons.lock)), obscureText: true),
          ],
          const SizedBox(height: 24),
          SizedBox(
            height: 50,
            child: ElevatedButton(
              onPressed: auth.isLoading ? null : _submit,
              child: auth.isLoading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text(_otpSent ? 'Reset Password' : 'Send OTP'),
            ),
          ),
          if (auth.error != null) Padding(padding: const EdgeInsets.only(top: 16), child: Text(auth.error!, style: const TextStyle(color: AppTheme.danger))),
        ]),
      ),
    );
  }
}
