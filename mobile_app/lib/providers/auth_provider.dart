import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api = ApiService();

  Map<String, dynamic>? _user;
  bool _isAuthenticated = false;
  bool _isLoading = false;
  String? _error;

  Map<String, dynamic>? get user => _user;
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String get userRole => _user?['role'] ?? '';

  Future<void> init() async {
    final token = await _api.getAccessToken();
    if (token != null) {
      try {
        final res = await _api.get('/auth/me/');
        _user = res.data;
        _isAuthenticated = true;
      } catch (_) {
        await _api.clearTokens();
      }
    }
    notifyListeners();
  }

  Future<bool> sendOtp(String email) async {
    _setLoading(true);
    try {
      await _api.post('/auth/send-otp/', data: {'email': email});
      _error = null;
      return true;
    } catch (e) {
      _error = _extractError(e);
      return false;
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> verifyEmail(String email, String otp) async {
    _setLoading(true);
    try {
      await _api.post('/auth/verify-email/', data: {'email': email, 'otp': otp});
      _error = null;
      return true;
    } catch (e) {
      _error = _extractError(e);
      return false;
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> login(String email, String password) async {
    _setLoading(true);
    try {
      final res = await _api.post('/auth/login/', data: {
        'email': email,
        'password': password,
      });
      final data = res.data;
      await _api.setTokens(data['access'], data['refresh']);
      _user = data['user'];
      _isAuthenticated = true;
      _error = null;
      notifyListeners();
      return true;
    } catch (e) {
      _error = _extractError(e);
      notifyListeners();
      return false;
    } finally {
      _setLoading(false);
    }
  }

  Future<Map<String, dynamic>?> registerPatient(Map<String, dynamic> data,
      {String? idProofPath}) async {
    _setLoading(true);
    try {
      final res = await _api.upload('/auth/register/patient/', data,
          files: idProofPath != null
              ? {'aadhar_id_proof': File(idProofPath)}
              : null);
      _error = null;
      return res.data;
    } catch (e) {
      _error = _extractError(e);
      return null;
    } finally {
      _setLoading(false);
    }
  }

  Future<Map<String, dynamic>?> registerDoctor(Map<String, dynamic> data,
      {Map<String, String>? filePaths}) async {
    _setLoading(true);
    try {
      Map<String, File>? files;
      if (filePaths != null) {
        files = filePaths.map((k, v) => MapEntry(k, File(v)));
      }
      final res = await _api.upload('/auth/register/doctor/', data, files: files);
      _error = null;
      return res.data;
    } catch (e) {
      _error = _extractError(e);
      return null;
    } finally {
      _setLoading(false);
    }
  }

  Future<Map<String, dynamic>?> registerPharmacist(Map<String, dynamic> data,
      {String? licensePath}) async {
    _setLoading(true);
    try {
      final res = await _api.upload('/auth/register/pharmacist/', data,
          files: licensePath != null
              ? {'license_certificate': File(licensePath)}
              : null);
      _error = null;
      return res.data;
    } catch (e) {
      _error = _extractError(e);
      return null;
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> requestPasswordReset(String email) async {
    _setLoading(true);
    try {
      await _api.post('/auth/password-reset/request/', data: {'email': email});
      _error = null;
      return true;
    } catch (e) {
      _error = _extractError(e);
      return false;
    } finally {
      _setLoading(false);
    }
  }

  Future<bool> confirmPasswordReset(
      String email, String otp, String newPassword) async {
    _setLoading(true);
    try {
      await _api.post('/auth/password-reset/confirm/', data: {
        'email': email,
        'otp': otp,
        'new_password': newPassword,
      });
      _error = null;
      return true;
    } catch (e) {
      _error = _extractError(e);
      return false;
    } finally {
      _setLoading(false);
    }
  }

  Future<void> logout() async {
    try {
      await _api.post('/auth/logout/');
    } catch (_) {}
    await _api.clearTokens();
    _user = null;
    _isAuthenticated = false;
    notifyListeners();
  }

  void _setLoading(bool v) {
    _isLoading = v;
    notifyListeners();
  }

  String _extractError(Object e) {
    if (e is DioException) {
      if (e.response?.data != null) {
        final d = e.response!.data;
        if (d is Map) {
          return d['detail'] ?? d['message'] ?? d.values.first?.toString() ?? 'Error';
        }
        return d.toString();
      }
      if (e.type == DioExceptionType.connectionTimeout ||
          e.type == DioExceptionType.receiveTimeout) {
        return 'Server timeout. Check your network.';
      }
      if (e.type == DioExceptionType.connectionError) {
        return 'Cannot reach server. Ensure Django is running and phone is on the same network.';
      }
      return e.message ?? 'Network error';
    }
    return e.toString();
  }
}
