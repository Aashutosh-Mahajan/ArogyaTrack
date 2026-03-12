import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class PharmacyProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  bool _isLoading = false;
  String? _error;

  Map<String, dynamic>? _dashboardStats;
  Map<String, dynamic>? _scannedPrescription;
  List<dynamic> _dispensingHistory = [];
  List<dynamic> _inventory = [];

  bool get isLoading => _isLoading;
  String? get error => _error;
  Map<String, dynamic>? get dashboardStats => _dashboardStats;
  Map<String, dynamic>? get scannedPrescription => _scannedPrescription;
  List<dynamic> get dispensingHistory => _dispensingHistory;
  List<dynamic> get inventory => _inventory;

  Future<void> loadDashboard() async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final results = await Future.wait([
        _api.get('/pharmacy/dashboard-stats/').catchError((_) => Response(requestOptions: RequestOptions(), data: null)),
        _api.get('/pharmacy/dispensing-history/', params: {'limit': 10}).catchError((_) => Response(requestOptions: RequestOptions(), data: [])),
      ]);
      _dashboardStats = results[0].data;
      final histData = results[1].data;
      _dispensingHistory = histData is List ? histData : (histData is Map ? (histData['results'] ?? []) : []);
    } catch (e) {
      _error = 'Failed to load dashboard';
    }
    _isLoading = false;
    notifyListeners();
  }

  Future<Map<String, dynamic>?> scanPrescription(String qrData) async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.post('/pharmacy/scan-prescription/', data: {'qr_data': qrData});
      _scannedPrescription = res.data;
      _isLoading = false;
      notifyListeners();
      return res.data;
    } catch (_) {
      _isLoading = false;
      notifyListeners();
      return null;
    }
  }

  Future<Map<String, dynamic>?> scanPatient({String? token, String? patientId}) async {
    try {
      final data = <String, dynamic>{};
      if (token != null) data['token'] = token;
      if (patientId != null) data['patient_id'] = patientId;
      final res = await _api.post('/pharmacy/scan-patient/', data: data);
      return res.data;
    } catch (_) {
      return null;
    }
  }

  Future<bool> dispenseMedicine(Map<String, dynamic> data) async {
    try {
      await _api.post('/pharmacy/dispense-medicine/', data: data);
      await loadDispensingHistory();
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> loadDispensingHistory() async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.get('/pharmacy/dispensing-history/');
      final data = res.data;
      _dispensingHistory = data is List ? data : (data is Map ? (data['results'] ?? []) : []);
    } catch (_) {}
    _isLoading = false;
    notifyListeners();
  }

  Future<void> loadInventory() async {
    _isLoading = true;
    notifyListeners();
    try {
      final res = await _api.get('/pharmacy/inventory/');
      final data = res.data;
      _inventory = data is List ? data : (data is Map ? (data['results'] ?? []) : []);
    } catch (_) {}
    _isLoading = false;
    notifyListeners();
  }

  Future<bool> addInventoryItem(Map<String, dynamic> data) async {
    try {
      await _api.post('/pharmacy/inventory/', data: data);
      await loadInventory();
      return true;
    } catch (_) {
      return false;
    }
  }

  void clearScannedPrescription() {
    _scannedPrescription = null;
    notifyListeners();
  }
}
