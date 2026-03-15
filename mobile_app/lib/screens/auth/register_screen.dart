import 'package:flutter/material.dart';
import '../../config/theme.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create Account')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 24),
              const Text(
                'I am a...',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Choose your role to get started',
                style: TextStyle(color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 32),
              _RoleCard(
                icon: Icons.person,
                title: 'Patient',
                subtitle: 'Access health records, prescriptions & more',
                color: AppTheme.primary,
                onTap: () => Navigator.pushNamed(context, '/register/patient'),
              ),
              const SizedBox(height: 16),
              _RoleCard(
                icon: Icons.medical_services,
                title: 'Doctor',
                subtitle: 'Manage patients, records & prescriptions',
                color: AppTheme.secondary,
                onTap: () => Navigator.pushNamed(context, '/register/doctor'),
              ),
              const SizedBox(height: 16),
              _RoleCard(
                icon: Icons.local_pharmacy,
                title: 'Pharmacist',
                subtitle: 'Dispense medicines & manage inventory',
                color: AppTheme.accent,
                onTap: () => Navigator.pushNamed(context, '/register/pharmacist'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoleCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback onTap;

  const _RoleCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 28),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text(subtitle, style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: color),
            ],
          ),
        ),
      ),
    );
  }
}
