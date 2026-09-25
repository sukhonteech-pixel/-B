import React from 'react';
import {
  Building2,
  Database,
  HardDrive,
  RefreshCw,
  Upload,
  FileText,
  Phone,
  Settings,
  LayoutDashboard,
  Layers,
} from 'lucide-react';
import { DashboardStats } from '../services/api';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  stats: DashboardStats;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  stats,
  onRefresh,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'properties', label: 'Properties', icon: Building2 },
    { id: 'import_merge', label: 'Import & Merge Excel', icon: Layers, badge: 'New' },
    { id: 'upload', label: 'Upload Excel (เดิม)', icon: Upload },
    { id: 'contacts', label: 'Contacts', icon: Phone },
    { id: 'files', label: 'Files', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <header className="bg-white border-b border-zinc-200 sticky top-0 z-40 shadow-xs">
      {/* Top Status Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-900 to-red-950 flex items-center justify-center text-white font-extrabold text-lg shadow-sm">
              P
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-wider text-zinc-900 text-lg uppercase font-sans">
                  PEAK
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-900 tracking-wide">
                  PROPERTY DATA
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 font-medium">
                Enterprise Real Estate Database & Asset Hub
              </p>
            </div>
          </div>

          {/* System Health Indicators */}
          <div className="hidden md:flex items-center gap-3 text-xs font-medium">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>Database: <strong className="text-zinc-900">{stats.totalProperties} items</strong></span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 text-zinc-700">
              <HardDrive className="w-3.5 h-3.5 text-blue-600" />
              <span>Storage: <strong className="text-zinc-900">property-files</strong></span>
            </div>

            <button
              onClick={onRefresh}
              title="Refresh Data"
              className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-600 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Submenu */}
      <div className="border-t border-zinc-100 bg-zinc-50/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    active
                      ? 'bg-zinc-900 text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                  {item.badge && (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-red-600 text-white animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
