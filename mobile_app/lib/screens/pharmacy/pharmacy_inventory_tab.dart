import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../config/theme.dart';
import '../../providers/pharmacy_provider.dart';
import '../../widgets/common_widgets.dart';

class PharmacyInventoryTab extends StatefulWidget {
  const PharmacyInventoryTab({super.key});
  @override
  State<PharmacyInventoryTab> createState() => _PharmacyInventoryTabState();
}

class _PharmacyInventoryTabState extends State<PharmacyInventoryTab> {
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PharmacyProvider>().loadInventory();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<PharmacyProvider>(
      builder: (context, prov, _) {
        if (prov.isLoading && prov.inventory.isEmpty) return const LoadingWidget();
        if (prov.error != null && prov.inventory.isEmpty) {
          return ErrorRetryWidget(message: prov.error!, onRetry: prov.loadInventory);
        }

        final query = _searchCtrl.text.toLowerCase();
        final filtered = query.isEmpty
            ? prov.inventory
            : prov.inventory.where((item) {
                final name = (item['name'] ?? item['medicine_name'] ?? '').toString().toLowerCase();
                return name.contains(query);
              }).toList();

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: TextField(
                controller: _searchCtrl,
                onChanged: (_) => setState(() {}),
                decoration: InputDecoration(
                  hintText: 'Search inventory...',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _searchCtrl.text.isNotEmpty
                      ? IconButton(icon: const Icon(Icons.clear), onPressed: () { _searchCtrl.clear(); setState(() {}); })
                      : null,
                ),
              ),
            ),
            Expanded(
              child: filtered.isEmpty
                  ? const EmptyStateWidget(icon: Icons.inventory_2, title: 'No inventory items')
                  : RefreshIndicator(
                      onRefresh: () => prov.loadInventory(),
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        itemCount: filtered.length,
                        itemBuilder: (context, i) {
                          final item = filtered[i];
                          final stock = item['quantity'] ?? item['stock'] ?? 0;
                          final isLow = (stock is int && stock < 10) || (stock is String && (int.tryParse(stock) ?? 0) < 10);
                          return Card(
                            margin: const EdgeInsets.only(bottom: 8),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: isLow ? AppTheme.danger.withValues(alpha: 0.1) : AppTheme.primary.withValues(alpha: 0.1),
                                child: Icon(Icons.medication, color: isLow ? AppTheme.danger : AppTheme.primary),
                              ),
                              title: Text(item['name'] ?? item['medicine_name'] ?? '-', style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Text('${item['category'] ?? item['type'] ?? ''} | Batch: ${item['batch_number'] ?? '-'}'),
                              trailing: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text('$stock', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: isLow ? AppTheme.danger : AppTheme.primary)),
                                  Text('in stock', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
            ),
          ],
        );
      },
    );
  }
}
