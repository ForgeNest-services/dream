'use client';

import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { useState } from 'react';

const navigationItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['owner', 'manager', 'staff', 'accountant'],
  },
  {
    label: 'Team Members',
    href: '/dashboard/team',
    icon: Users,
    roles: ['owner', 'manager'],
  },
  {
    label: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    roles: ['owner'],
  },
  {
    label: 'Admin Panel',
    href: '/admin',
    icon: Shield,
    roles: ['superadmin'],
  },
];

export function Sidebar() {
  const { user, userRole, logout, isOwner, isSuperAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.push('/');
    setIsOpen(false);
  };

  // Determine which navigation items to show
  const visibleItems = navigationItems.filter((item) => {
    if (isSuperAdmin) {
      return item.roles.includes('superadmin');
    }
    if (!userRole) {
      return false;
    }
    return item.roles.includes(userRole);
  });

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-900 text-white"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen w-64 bg-slate-900 text-white z-40 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo/Brand */}
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-2xl font-bold">Dream</h1>
          <p className="text-sm text-slate-400 mt-1">
            {isSuperAdmin ? 'Superadmin' : user.email || 'User'}
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-6 space-y-2">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-6 border-t border-slate-700">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2 rounded-lg w-full text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
