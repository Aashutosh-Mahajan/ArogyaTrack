import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;

  late final Dio dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  ApiService._internal() {
    dio = Dio(BaseOptions(
      baseUrl: AppConfig.apiUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Content-Type': 'application/json'},
    ));

    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'access_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          final refreshed = await _refreshToken();
          if (refreshed) {
            final token = await _storage.read(key: 'access_token');
            error.requestOptions.headers['Authorization'] = 'Bearer $token';
            final response = await dio.fetch(error.requestOptions);
            return handler.resolve(response);
          }
        }
        return handler.next(error);
      },
    ));
  }

  void updateBaseUrl(String url) {
    dio.options.baseUrl = url;
  }

  Future<bool> _refreshToken() async {
    try {
      final refresh = await _storage.read(key: 'refresh_token');
      if (refresh == null) return false;

      final response = await Dio(BaseOptions(baseUrl: dio.options.baseUrl))
          .post('/auth/token/refresh/', data: {'refresh': refresh});

      await _storage.write(key: 'access_token', value: response.data['access']);
      return true;
    } catch (_) {
      await clearTokens();
      return false;
    }
  }

  Future<void> setTokens(String access, String refresh) async {
    await _storage.write(key: 'access_token', value: access);
    await _storage.write(key: 'refresh_token', value: refresh);
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
  }

  Future<String?> getAccessToken() => _storage.read(key: 'access_token');

  // GET
  Future<Response> get(String path, {Map<String, dynamic>? params}) =>
      dio.get(path, queryParameters: params);

  // POST
  Future<Response> post(String path, {dynamic data}) =>
      dio.post(path, data: data);

  // PATCH
  Future<Response> patch(String path, {dynamic data}) =>
      dio.patch(path, data: data);

  // PUT
  Future<Response> put(String path, {dynamic data}) =>
      dio.put(path, data: data);

  // DELETE
  Future<Response> delete(String path) => dio.delete(path);

  // Upload with multipart
  Future<Response> upload(String path, Map<String, dynamic> fields,
      {Map<String, File>? files}) async {
    final formData = FormData.fromMap(fields);
    if (files != null) {
      for (final entry in files.entries) {
        formData.files.add(MapEntry(
          entry.key,
          await MultipartFile.fromFile(entry.value.path,
              filename: entry.value.path.split(Platform.pathSeparator).last),
        ));
      }
    }
    return dio.post(path, data: formData);
  }

  // Download file
  Future<Response> download(String path, String savePath,
      {Map<String, dynamic>? params}) {
    return dio.download(path, savePath, queryParameters: params);
  }
}
