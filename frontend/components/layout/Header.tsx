'use client';

import React from 'react';
import { FiMenu, FiBell, FiSearch } from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 border-b bg-white shadow-sm">
      <div className="flex h-16 items-center justify-between px-4 lg:px-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <FiMenu className="h-6 w-6" />
          </button>

          <div className="relative hidden lg:block">
            <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search..."
              className="w-64 rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <button className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100">
            <FiBell className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" />
          </button>

          <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary-600">
              {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
