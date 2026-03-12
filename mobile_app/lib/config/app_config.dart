import 'package:flutter_dotenv/flutter_dotenv.dart';

class AppConfig {
  static String get apiUrl => dotenv.env['API_URL'] ?? 'http://localhost:8000/api';
  static String get appName => dotenv.env['APP_NAME'] ?? 'Health Surveillance';
  static String get appVersion => dotenv.env['APP_VERSION'] ?? '1.0.0';
}
