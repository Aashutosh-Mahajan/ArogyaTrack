'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      
      <div className="lg:pl-64">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
