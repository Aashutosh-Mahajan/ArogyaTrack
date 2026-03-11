import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class PatientProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  bool _isLoading = false;
  String? _error;

  // Data
  Map<String, dynamic>? _profile;
  Map<String, dynamic>? _patientCard;
  Map<String, dynamic>? _dashboardSummary;
  Map<String, dynamic>? _kpis;
  List<dynamic> _recentRecords = [];
  List<dynamic> _labTests = [];
  Map<String, dynamic>? _healthTrends;
  List<dynamic> _alerts = [];
  List<dynamic> _prescriptions = [];
  List<dynamic> _allergies = [];
  List<dynamic> _chronicConditions = [];
  List<dynamic> _adherenceTrackers = [];
  List<dynamic> _upcomingDoses = [];
  List<dynamic> _missedDoses = [];
  List<dynamic> _medicalRecords = [];
  Map<String, dynamic>? _securityInfo;
  List<dynamic> _downloads = [];

  // Getters
  bool get isLoading => _isLoading;
  String? get error => _error;
  Map<String, dynamic>? get profile => _profile;
  Map<String, dynamic>? get patientCard => _patientCard;
  Map<String, dynamic>? get dashboardSummary => _dashboardSummary;
  Map<String, dynamic>? get kpis => _kpis;
  List<dynamic> get recentRecords => _recentRecords;
  List<dynamic> get labTests => _labTests;
  Map<String, dynamic>? get healthTrends => _healthTrends;
  List<dynamic> get alerts => _alerts;
  List<dynamic> get prescriptions => _prescriptions;
  List<dynamic> get allergies => _allergies;
  List<dynamic> get chronicConditions => _chronicConditions;
  List<dynamic> get adherenceTrackers => _adherenceTrackers;
  List<dynamic> get upcomingDoses => _upcomingDoses;
  List<dynamic> get missedDoses => _missedDoses;
  List<dynamic> get medicalRecords => _medicalRecords;
  Map<String, dynamic>? get securityInfo => _securityInfo;
  List<dynamic> get downloads => _downloads;

  int get unreadAlerts => _alerts.where((a) => a['is_read'] != true && a['is_dismissed'] != true).length;

  Future<void> loadDashboard() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final results = await Future.wait([
        _api.get('/dashboard/summary/').catchError((_) => Response(requestOptions: RequestOptions(), data: null)),
        _api.get('/dashboard/kpis/').catchError((_) => Response(requestOptions: RequestOptions(), data: null)),
        _api.get('/dashboard/recent-records/', params: {'limit': 5}).catchError((_) => Response(requestOptions: RequestOptions(), data: null)),
        _api.get('/dashboard/alerts/').catchError((_) => Response(requestOptions: RequestOptions(), data: null)),
        _api.get('/patients/my-card/').catchError((_) => Response(requestOptions: RequestOptions(), data: null)),
      ]);
      _dashboardSummary = results[0].data;
      _kpis = results[1].data;
      if (results[2].data is List) _recentRecords = results[2].data;
      if (results[3].data is List) _alerts = results[3].data;
      _patientCard = results[4].data;
    } catch (e) {
      _error = 'Failed to load dashboard';
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadProfile() async {
    try {
      final res = await _api.get('/patients/profile/');
      _profile = res.data;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> loadMedicalRecords() async {
    _isLoading = true;
    notifyListeners();
    try {
      final results = await Future.wait([
        _api.get('/doctors/visit-records/'),
        _api.get('/doctors/my-allergies/').catchError((_) => Response(requestOptions: RequestOptions(), data: [])),
        _api.get('/doctors/my-conditions/').catchError((_) => Response(requestOptions: RequestOptions(), data: [])),
      ]);
      final data = results[0].data;
      _medicalRecords = data is Map ? (data['results'] ?? []) : (data ?? []);
      if (results[1].data is List) _allergies = results[1].data;
      if (results[2].data is List) _chronicConditions = results[2].data;
    } catch (_) {}
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadPrescriptions() async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.get('/prescriptions/my-prescriptions/');
      final data = res.data;
      _prescriptions = data is Map ? (data['results'] ?? []) : (data ?? []);
    } catch (_) {}
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadAdherence() async {
    _isLoading = true;
    notifyListeners();
    try {
      final results = await Future.wait([
        _api.get('/adherence/my-trackers/'),
        _api.get('/adherence/upcoming-doses/').catchError((_) => Response(requestOptions: RequestOptions(), data: [])),
        _api.get('/adherence/missed-doses/').catchError((_) => Response(requestOptions: RequestOptions(), data: [])),
      ]);
      final data = results[0].data;
      _adherenceTrackers = data is Map ? (data['results'] ?? []) : (data ?? []);
      if (results[1].data is List) _upcomingDoses = results[1].data;
      if (results[2].data is List) _missedDoses = results[2].data;
    } catch (_) {}
    _isLoading = false;
    notifyListeners();
  }

  Future<bool> markDoseTaken(Map<String, dynamic> data) async {
    try {
      await _api.post('/adherence/record-dose/', data: data);
      await loadAdherence();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> loadLabTests() async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.get('/dashboard/lab-monitoring/');
      if (res.data is List) _labTests = res.data;
    } catch (_) {}
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadHealthTrends({int months = 6}) async {
    try {
      final res = await _api.get('/dashboard/health-trends/', params: {'months': months});
      _healthTrends = res.data;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> loadAlerts() async {
    try {
      final res = await _api.get('/dashboard/alerts/');
      if (res.data is List) _alerts = res.data;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> dismissAlert(String id) async {
    try {
      await _api.patch('/dashboard/alerts/$id/', data: {'is_dismissed': true});
      _alerts = _alerts.map((a) {
        if (a['id'].toString() == id) return {...a, 'is_dismissed': true};
        return a;
      }).toList();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> markAlertRead(String id) async {
    try {
      await _api.patch('/dashboard/alerts/$id/', data: {'is_read': true});
      _alerts = _alerts.map((a) {
        if (a['id'].toString() == id) return {...a, 'is_read': true};
        return a;
      }).toList();
      notifyListeners();
    } catch (_) {}
  }

  Future<void> loadSecurity() async {
    try {
      final res = await _api.get('/dashboard/security/');
      _securityInfo = res.data;
      notifyListeners();
    } catch (_) {}
  }

  Future<bool> changePassword(String oldPw, String newPw, String confirmPw) async {
    try {
      await _api.post('/dashboard/change-password/', data: {
        'old_password': oldPw,
        'new_password': newPw,
        'confirm_password': confirmPw,
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> loadDownloads() async {
    try {
      final res = await _api.get('/dashboard/downloads/');
      if (res.data is List) _downloads = res.data;
      notifyListeners();
    } catch (_) {}
  }

  Future<Map<String, dynamic>?> generateHealthCard() async {
    try {
      final res = await _api.post('/patients/health-card/');
      return res.data;
    } catch (_) {
      return null;
    }
  }
}
