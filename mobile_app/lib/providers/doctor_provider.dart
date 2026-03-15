import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class DoctorProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  bool _isLoading = false;
  String? _error;

  Map<String, dynamic>? _dashboardSummary;
  List<dynamic> _recentActivity = [];
  List<dynamic> _myPatients = [];
  List<dynamic> _highRiskPatients = [];
  Map<String, dynamic>? _scannedPatient;
  List<dynamic> _medicines = [];

  bool get isLoading => _isLoading;
  String? get error => _error;
  Map<String, dynamic>? get dashboardSummary => _dashboardSummary;
  List<dynamic> get recentActivity => _recentActivity;
  List<dynamic> get myPatients => _myPatients;
  List<dynamic> get highRiskPatients => _highRiskPatients;
  Map<String, dynamic>? get scannedPatient => _scannedPatient;
  List<dynamic> get medicines => _medicines;

  Future<void> loadDashboard() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final results = await Future.wait([
        _api.get('/doctors/dashboard-summary/').catchError((_) => Response(requestOptions: RequestOptions(), data: null)),
        _api.get('/doctors/recent-activity/').catchError((_) => Response(requestOptions: RequestOptions(), data: [])),
      ]);
      _dashboardSummary = results[0].data;
      if (results[1].data is List) _recentActivity = results[1].data;
    } catch (e) {
      _error = 'Failed to load dashboard';
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadMyPatients() async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.get('/doctors/my-patients/');
      final data = res.data;
      _myPatients = data is List ? data : (data is Map ? (data['results'] ?? []) : []);
    } catch (_) {}
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadHighRiskPatients() async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.get('/doctors/high-risk-patients/');
      final data = res.data;
      _highRiskPatients = data is List ? data : (data is Map ? (data['results'] ?? []) : []);
    } catch (_) {}
    _isLoading = false;
    notifyListeners();
  }

  Future<Map<String, dynamic>?> scanQR(String token) async {
    try {
      final res = await _api.post('/patients/scan-qr/', data: {'token': token});
      final data = res.data;
      // The response wraps patient info under 'patient' key
      _scannedPatient = data is Map && data.containsKey('patient') ? data['patient'] : data;
      notifyListeners();
      return _scannedPatient;
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> scanPatientById(String patientId) async {
    try {
      final res = await _api.post('/patients/scan-qr/', data: {'patient_id': patientId});
      _scannedPatient = res.data;
      notifyListeners();
      return res.data;
    } catch (_) {
      return null;
    }
  }

  Future<bool> addPatientToMyList(String patientId) async {
    try {
      await _api.post('/doctors/my-patients/add/', data: {'patient_id': patientId});
      await loadMyPatients();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> createVisitRecord(String patientId, Map<String, dynamic> data, {List<File>? files}) async {
    _isLoading = true;
    notifyListeners();
    try {
      if (files != null && files.isNotEmpty) {
        final formData = FormData.fromMap(data);
        for (final file in files) {
          formData.files.add(MapEntry(
            'reports',
            await MultipartFile.fromFile(file.path, filename: file.path.split(Platform.pathSeparator).last),
          ));
        }
        await _api.dio.post('/doctors/patients/$patientId/visit-records/create/', data: formData);
      } else {
        await _api.post('/doctors/patients/$patientId/visit-records/create/', data: data);
      }
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (_) {
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<bool> createPrescription(Map<String, dynamic> data) async {
    try {
      await _api.post('/prescriptions/create/', data: data);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<List<dynamic>> searchMedicines(String query) async {
    try {
      final res = await _api.get('/prescriptions/medicines/', params: {'search': query});
      final data = res.data;
      _medicines = data is List ? data : (data is Map ? (data['results'] ?? []) : []);
      return _medicines;
    } catch (_) {
      return [];
    }
  }

  Future<Map<String, dynamic>?> validatePrescription(Map<String, dynamic> data) async {
    try {
      final res = await _api.post('/prescriptions/validate/', data: data);
      return res.data;
    } catch (_) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> analyzeCDSS(String patientId, String symptoms) async {
    try {
      final res = await _api.post('/cdss/analyze/', data: {
        'patient_id': patientId,
        'current_symptoms': symptoms,
      });
      return res.data;
    } catch (_) {
      return null;
    }
  }

  void clearScannedPatient() {
    _scannedPatient = null;
    notifyListeners();
  }
}
