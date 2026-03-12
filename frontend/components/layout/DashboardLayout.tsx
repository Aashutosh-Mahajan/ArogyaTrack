'use client';

import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
    }}>
      <Sidebar />
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minWidth: 0,
        marginLeft: 290,
      }}>
        <Header />
        <main style={{
          flex: 1,
          overflowY: 'auto',
          padding: '24px 28px',
          background: '#EEF3F2',
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
