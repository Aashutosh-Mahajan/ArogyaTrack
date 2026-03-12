import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';

import 'config/theme.dart';
import 'providers/auth_provider.dart';
import 'providers/patient_provider.dart';
import 'providers/doctor_provider.dart';
import 'providers/pharmacy_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/auth/patient_register_screen.dart';
import 'screens/auth/doctor_register_screen.dart';
import 'screens/auth/pharmacist_register_screen.dart';
import 'screens/auth/forgot_password_screen.dart';
import 'screens/patient/patient_dashboard.dart';
import 'screens/patient/patient_qr_card_screen.dart';
import 'screens/patient/patient_alerts_screen.dart';
import 'screens/patient/patient_security_screen.dart';
import 'screens/patient/patient_downloads_screen.dart';
import 'screens/patient/patient_labs_screen.dart';
import 'screens/patient/patient_health_trends_screen.dart';
import 'screens/doctor/doctor_dashboard.dart';
import 'screens/pharmacy/pharmacy_dashboard.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');
  runApp(const HealthSurveillanceApp());
}

class HealthSurveillanceApp extends StatelessWidget {
  const HealthSurveillanceApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => PatientProvider()),
        ChangeNotifierProvider(create: (_) => DoctorProvider()),
        ChangeNotifierProvider(create: (_) => PharmacyProvider()),
      ],
      child: MaterialApp(
        title: 'Health Surveillance',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.theme,
        initialRoute: '/login',
        routes: {
          '/login': (_) => const LoginScreen(),
          '/register': (_) => const RegisterScreen(),
          '/register/patient': (_) => const PatientRegisterScreen(),
          '/register/doctor': (_) => const DoctorRegisterScreen(),
          '/register/pharmacist': (_) => const PharmacistRegisterScreen(),
          '/forgot-password': (_) => const ForgotPasswordScreen(),
          '/patient/dashboard': (_) => const PatientDashboard(),
          '/patient/qr-card': (_) => const PatientQRCardScreen(),
          '/patient/alerts': (_) => const PatientAlertsScreen(),
          '/patient/security': (_) => const PatientSecurityScreen(),
          '/patient/downloads': (_) => const PatientDownloadsScreen(),
          '/patient/labs': (_) => const PatientLabsScreen(),
          '/patient/health-trends': (_) => const PatientHealthTrendsScreen(),
          '/doctor/dashboard': (_) => const DoctorDashboard(),
          '/pharmacy/dashboard': (_) => const PharmacyDashboard(),
        },
      ),
    );
  }
}
