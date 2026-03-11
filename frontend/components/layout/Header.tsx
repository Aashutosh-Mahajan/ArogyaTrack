'use client';

import React from 'react';
import { FiMenu, FiBell, FiSearch } from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';

import { LanguageSelector } from '@/components/dashboard/LanguageSelector';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 glass-morphism shadow-glass rounded-2xl mx-4 mt-4 border border-white/40">
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
              placeholder="Search patients, records..."
              className="w-80 rounded-full border border-teal-100 bg-white/50 py-2.5 pl-11 pr-5 text-sm text-heading placeholder:text-muted-text transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10 hover:bg-white/80"
            />
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <LanguageSelector />

          <button className="relative rounded-full p-2.5 text-teal-700 hover:bg-teal-50 transition-all duration-200">
            <FiBell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
          </button>

          <div className="h-9 w-px bg-teal-100 hidden sm:block"></div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-heading leading-none">{user?.first_name} {user?.last_name}</p>
              <p className="text-xs text-muted-text mt-1">{user?.role}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center shadow-soft ring-4 ring-teal-50 cursor-pointer hover:ring-teal-100 transition-all">
              <span className="text-sm font-bold text-white">
                {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
