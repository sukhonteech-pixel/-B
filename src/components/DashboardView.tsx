import React from 'react';
import {
  Building2,
  Image as ImageIcon,
  FileText,
  Calendar,
  Upload,
  Plus,
  Search,
  Database,
  ArrowRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import { DashboardStats } from '../services/api';

interface DashboardViewProps {
  stats: DashboardStats;
  onNavigateTab: (tab: string) => void;
  onOpenAddModal: () => void;
  onFocusSearch: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  onNavigateTab,
  onOpenAddModal,
  onFocusSearch,
}) => {
  return (
    <div className="space-y-6">
      {/* Top Welcome Banner */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-red-950 text-white rounded-2xl p-6 sm:p-8 shadow-sm border border-zinc-800 relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-900/60 border border-red-700/50 text-red-200 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Real Estate Data Management Suite</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            PEAK PROPERTY DATA
          </h1>
          <p className="mt-2 text-sm text-zinc-300 leading-relaxed">
            ระบบศูนย์กลางรวบรวมและบริหารจัดการข้อมูลอสังหาริมทรัพย์ นำเข้าข้อมูลจำนวนมากผ่าน Excel
            จัดการรูปภาพ สัญญาเอกสาร และข้อมูลผู้ติดต่อ บันทึกตรงสู่ Supabase PostgreSQL & Storage
          </p>

          {/* Quick Action Buttons */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigateTab('import_merge')}
              className="px-4 py-2.5 rounded-xl bg-red-800 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              Import & Merge Excel (รวมหลายไฟล์)
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('upload')}
              className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              Upload Excel (เดิม)
            </button>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-100 text-zinc-900 text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              + Add Property
            </button>
            <button
              type="button"
              onClick={() => {
                onNavigateTab('properties');
                onFocusSearch();
              }}
              className="px-4 py-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold transition-all flex items-center gap-2"
            >
              <Search className="w-4 h-4" />
              Search Property
            </button>
          </div>
        </div>

        {/* Decorative background element */}
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-red-900/20 to-transparent pointer-events-none" />
      </div>

      {/* Real Statistics Cards (Read directly from DB: No fake or mock numbers!) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Properties */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Total Properties
            </span>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-zinc-900 tracking-tight font-mono">
              {stats.totalProperties.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
            <span>ในฐานข้อมูลทั้งหมด</span>
            <button
              onClick={() => onNavigateTab('properties')}
              className="text-red-900 font-bold hover:underline flex items-center gap-1"
            >
              ดูรายการ <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Total Photos */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Total Photos
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
              <ImageIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-zinc-900 tracking-tight font-mono">
              {stats.totalPhotos.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            <span>รูปภาพทรัพย์จริงใน Storage</span>
          </div>
        </div>

        {/* Total Files */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Total Files
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-zinc-900 tracking-tight font-mono">
              {stats.totalFiles.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            <span>เอกสาร สัญญา และไฟล์แนบ</span>
          </div>
        </div>

        {/* Properties Added Today */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Added Today
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-extrabold text-zinc-900 tracking-tight font-mono">
              {stats.propertiesAddedToday.toLocaleString()}
            </span>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            <span>ทรัพย์ที่เพิ่มในวันนี้</span>
          </div>
        </div>
      </div>

      {/* Database & Storage Status Section */}
      <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
          <div>
            <h2 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <Database className="w-4 h-4 text-red-900" />
              โครงสร้างฐานข้อมูล & ที่จัดเก็บถาวร (Supabase Architecture)
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              ข้อมูลทุกชุดได้รับการจัดเก็บถาวรในฐานข้อมูล PostgreSQL และ Supabase Storage Bucket <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">property-files</code>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                stats.isSupabaseConnected
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-zinc-100 text-zinc-800 border border-zinc-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  stats.isSupabaseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-500'
                }`}
              />
              {stats.isSupabaseConnected ? 'Supabase Live Connected' : 'Persistent Storage Active'}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200/80">
            <h3 className="font-bold text-zinc-900 mb-1">1. Excel Batch Import</h3>
            <p className="text-zinc-600 leading-relaxed">
              รองรับไฟล์ .xlsx, .xls, .csv พร้อมระบบจับคู่คอลัมน์อัตโนมัติ (Column Mapping) และตรวจสอบข้อมูลซ้ำ (Duplicate Handling)
            </p>
          </div>

          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200/80">
            <h3 className="font-bold text-zinc-900 mb-1">2. Contact & Phone Management</h3>
            <p className="text-zinc-600 leading-relaxed">
              เพิ่มและแก้ไขเบอร์โทรศัพท์ได้หลายเบอร์ต่อทรัพย์ (Phone 1, 2, 3...) ระบุประเภทผู้ติดต่อ (Owner, Agent, Co-Agent)
            </p>
          </div>

          <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200/80">
            <h3 className="font-bold text-zinc-900 mb-1">3. Real Photo & Document Upload</h3>
            <p className="text-zinc-600 leading-relaxed">
              อัปโหลดรูปภาพและไฟล์จริงจากคอมพิวเตอร์ กำหนดรูปหน้าปก (Cover Photo) จัดเรียงลำดับรูปภาพ และดาวน์โหลดไฟล์แนบ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
