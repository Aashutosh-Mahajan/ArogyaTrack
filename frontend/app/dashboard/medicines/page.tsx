'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { withAuth } from '@/components/auth/withAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { Medicine } from '@/types';
import { FiSearch, FiShoppingBag, FiInfo } from 'react-icons/fi';

function MedicinesPage(): React.JSX.Element {
  const [search, setSearch] = useState('');

  const { data: medicines, isLoading } = useQuery<Medicine[]>({
    queryKey: ['medicines', search],
    queryFn: () => api.prescriptions.getMedicines({ search: search || undefined }),
  });

  const list = medicines || [];

  if (isLoading) {
    return (

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medicines</h1>
          <p className="mt-1 text-sm text-gray-500">Browse the medicine catalogue.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

    );
  }

  return (

    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Medicines</h1>
          <p className="mt-1 text-sm text-gray-500">
            {list.length} medicine{list.length !== 1 ? 's' : ''} in catalogue
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search medicines…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {list.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <FiShoppingBag className="mx-auto h-10 w-10 mb-3 text-gray-400" />
            <p className="text-lg font-medium">No medicines found</p>
            {search && <p className="text-sm mt-1">Try a different search term.</p>}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((med) => (
            <Card key={med.id} className="hover:shadow-md transition">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="bg-purple-100 p-2 rounded-lg">
                      <FiShoppingBag className="h-4 w-4 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{med.name}</h3>
                      {med.generic_name && (
                        <p className="text-xs text-gray-500">{med.generic_name}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={med.is_active ? 'success' : 'secondary'}>
                    {med.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-gray-600">
                  {med.drug_class && (
                    <p><span className="font-medium text-gray-700">Class:</span> {med.drug_class}</p>
                  )}
                  {med.therapeutic_category && (
                    <p><span className="font-medium text-gray-700">Category:</span> {med.therapeutic_category}</p>
                  )}
                  {med.allergens && med.allergens.length > 0 && (
                    <div className="flex items-center gap-1 text-amber-600">
                      <FiInfo className="h-3 w-3" />
                      <span>Allergens: {med.allergens.join(', ')}</span>
                    </div>
                  )}
                </div>

                {med.standard_dosages && Object.keys(med.standard_dosages).length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-medium text-gray-700 mb-1">Standard Dosages</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(med.standard_dosages).map(([key, val]) => (
                        <Badge key={key} variant="outline" className="text-xs">
                          {key}: {val}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>

  );
}

export default withAuth(MedicinesPage, ['patient']);
