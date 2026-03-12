import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import '../../config/theme.dart';
import '../../providers/patient_provider.dart';
import '../../widgets/common_widgets.dart';

class PatientHealthTrendsScreen extends StatefulWidget {
  const PatientHealthTrendsScreen({super.key});
  @override
  State<PatientHealthTrendsScreen> createState() => _PatientHealthTrendsScreenState();
}

class _PatientHealthTrendsScreenState extends State<PatientHealthTrendsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => context.read<PatientProvider>().loadHealthTrends());
  }

  @override
  Widget build(BuildContext context) {
    final p = context.watch<PatientProvider>();
    final trends = p.healthTrends;

    return Scaffold(
      appBar: AppBar(title: const Text('Health Trends')),
      body: trends == null
          ? const EmptyStateWidget(icon: Icons.trending_up, title: 'No health trends data')
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (trends['trends'] is List)
                  ...(trends['trends'] as List).map((series) {
                    final data = series['data'] as List? ?? [];
                    if (data.isEmpty) return const SizedBox.shrink();

                    return Card(
                      margin: const EdgeInsets.only(bottom: 16),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '${series['label'] ?? series['metric']} (${series['unit'] ?? ''})',
                              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                            const SizedBox(height: 16),
                            SizedBox(
                              height: 200,
                              child: LineChart(
                                LineChartData(
                                  gridData: const FlGridData(show: true, drawVerticalLine: false),
                                  titlesData: FlTitlesData(
                                    leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 40)),
                                    bottomTitles: AxisTitles(
                                      sideTitles: SideTitles(
                                        showTitles: true,
                                        reservedSize: 28,
                                        getTitlesWidget: (value, _) {
                                          final idx = value.toInt();
                                          if (idx >= 0 && idx < data.length && idx % (data.length ~/ 4 + 1) == 0) {
                                            final date = data[idx]['date']?.toString() ?? '';
                                            return Text(date.length >= 5 ? date.substring(5) : date, style: const TextStyle(fontSize: 10));
                                          }
                                          return const Text('');
                                        },
                                      ),
                                    ),
                                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                                  ),
                                  borderData: FlBorderData(show: false),
                                  lineBarsData: [
                                    LineChartBarData(
                                      spots: List.generate(data.length, (i) => FlSpot(i.toDouble(), (data[i]['value'] ?? 0).toDouble())),
                                      isCurved: true,
                                      color: AppTheme.primary,
                                      barWidth: 2,
                                      dotData: const FlDotData(show: false),
                                      belowBarData: BarAreaData(show: true, color: AppTheme.primary.withValues(alpha: 0.1)),
                                    ),
                                    if (data.any((d) => d['secondary_value'] != null))
                                      LineChartBarData(
                                        spots: List.generate(data.length, (i) => FlSpot(i.toDouble(), (data[i]['secondary_value'] ?? 0).toDouble())),
                                        isCurved: true,
                                        color: AppTheme.secondary,
                                        barWidth: 2,
                                        dotData: const FlDotData(show: false),
                                      ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }),
              ],
            ),
    );
  }
}
