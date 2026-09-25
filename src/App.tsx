import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { PropertiesView } from './components/PropertiesView';
import { UploadExcelView } from './components/UploadExcelView';
import { ContactsView } from './components/ContactsView';
import { FilesView } from './components/FilesView';
import { SettingsView } from './components/SettingsView';
import { ImportMergeExcelView } from './components/ImportMergeExcelView';
import { PropertyDetailModal } from './components/PropertyDetailModal';
import { AddPropertyModal } from './components/AddPropertyModal';
import { api, DashboardStats } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('properties');
  const [selectedPropertyNo, setSelectedPropertyNo] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalProperties: 0,
    totalPhotos: 0,
    totalFiles: 0,
    propertiesAddedToday: 0,
    totalContacts: 0,
    isSupabaseConnected: false,
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadStats = useCallback(async () => {
    try {
      const data = await api.getDashboardStats();
      if (data) setStats(data);
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleFocusSearch = () => {
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 flex flex-col font-sans selection:bg-red-900 selection:text-white">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        stats={stats}
        onRefresh={loadStats}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            stats={stats}
            onNavigateTab={setActiveTab}
            onOpenAddModal={() => setShowAddModal(true)}
            onFocusSearch={handleFocusSearch}
          />
        )}

        {activeTab === 'properties' && (
          <PropertiesView
            onSelectProperty={(pNo) => setSelectedPropertyNo(pNo)}
            onOpenUploadExcel={() => setActiveTab('upload')}
            onOpenImportMerge={() => setActiveTab('import_merge')}
            onOpenAddModal={() => setShowAddModal(true)}
            searchInputRef={searchInputRef}
          />
        )}

        {activeTab === 'import_merge' && (
          <ImportMergeExcelView
            onMergeCompleted={() => {
              loadStats();
            }}
            onNavigateToProperties={(pNo) => {
              setActiveTab('properties');
              loadStats();
              if (pNo) setSelectedPropertyNo(pNo);
            }}
          />
        )}

        {activeTab === 'upload' && (
          <UploadExcelView
            onImportCompleted={() => {
              loadStats();
            }}
            onNavigateToProperties={() => {
              setActiveTab('properties');
              loadStats();
            }}
          />
        )}

        {activeTab === 'contacts' && (
          <ContactsView
            onSelectProperty={(pNo) => setSelectedPropertyNo(pNo)}
          />
        )}

        {activeTab === 'files' && (
          <FilesView
            onSelectProperty={(pNo) => setSelectedPropertyNo(pNo)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView stats={stats} />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-200 py-4 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-zinc-900 tracking-wider">PEAK PROPERTY DATA</span>
            <span>•</span>
            <span>Enterprise Property Asset Management</span>
            <span>•</span>
            <span>PostgreSQL & Supabase Storage</span>
          </div>
          <p className="text-zinc-400 font-mono text-[11px]">
            Bucket: property-files • Real Database Mode
          </p>
        </div>
      </footer>

      {/* Property Detail Modal */}
      {selectedPropertyNo && (
        <PropertyDetailModal
          propertyNo={selectedPropertyNo}
          onClose={() => setSelectedPropertyNo(null)}
          onRefreshList={loadStats}
        />
      )}

      {/* Add Property Modal */}
      {showAddModal && (
        <AddPropertyModal
          onClose={() => setShowAddModal(false)}
          onSuccess={(pNo) => {
            setShowAddModal(false);
            loadStats();
            setSelectedPropertyNo(pNo);
          }}
        />
      )}
    </div>
  );
}
