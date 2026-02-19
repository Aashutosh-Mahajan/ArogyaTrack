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
    <header className="sticky top-0 z-30 glass-morphism shadow-glass rounded-b-2xl mx-2 mt-2">
      <div className="flex h-16 items-center justify-between px-6 lg:px-8">
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden text-teal-700 hover:text-teal-900 transition-colors p-2 rounded-xl hover:bg-teal-50"
          >
            <FiMenu className="h-6 w-6" />
          </button>

          <div className="relative hidden lg:block">
            <FiSearch className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-600" />
            <input
              type="search"
              placeholder="Search..."
              className="w-72 rounded-pill border border-gray-200 bg-white/80 py-2.5 pl-11 pr-5 text-sm text-heading placeholder:text-muted-text transition-all duration-200 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-400/50 hover:border-teal-300"
            />
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button className="relative rounded-full p-2.5 text-teal-700 hover:bg-teal-50 transition-all duration-200">
            <FiBell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center shadow-soft transition-transform duration-200 hover:scale-105">
            <span className="text-sm font-semibold text-white">
              {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
