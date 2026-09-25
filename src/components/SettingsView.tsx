import React, { useState } from 'react';
import { Database, HardDrive, ShieldCheck, Copy, Check, Terminal, ExternalLink } from 'lucide-react';
import { DashboardStats } from '../services/api';

interface SettingsViewProps {
  stats: DashboardStats;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ stats }) => {
  const [copied, setCopied] = useState(false);

  const migrationSql = `-- Run this in your Supabase SQL Editor:
-- Safe & Idempotent Migration
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_no VARCHAR(100) NOT NULL UNIQUE,
  property_name VARCHAR(255),
  category VARCHAR(100) DEFAULT 'Condominium',
  property_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Available',
  project_name VARCHAR(255),
  location VARCHAR(255),
  zone VARCHAR(100),
  bedroom INTEGER DEFAULT 0,
  bathroom INTEGER DEFAULT 0,
  land_area NUMERIC(12, 2) DEFAULT 0,
  building_area NUMERIC(12, 2) DEFAULT 0,
  floor VARCHAR(50),
  description TEXT,
  rent_price NUMERIC(14, 2) DEFAULT 0,
  sale_price NUMERIC(14, 2) DEFAULT 0,
  additional_data JSONB DEFAULT '{}'::jsonb,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  contact_name VARCHAR(255) NOT NULL DEFAULT 'Contact',
  contact_type VARCHAR(100) NOT NULL DEFAULT 'Owner',
  phone VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  storage_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  public_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_cover BOOLEAN DEFAULT FALSE,
  file_size BIGINT DEFAULT 0,
  mime_type VARCHAR(100) DEFAULT 'image/jpeg',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  storage_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  public_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  mime_type VARCHAR(100) DEFAULT 'application/octet-stream',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_update_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  changed_field VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  user_name VARCHAR(100) DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(migrationSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs">
        <h1 className="text-base font-bold text-zinc-900 flex items-center gap-2">
          <Database className="w-5 h-5 text-red-900" />
          Database & Storage Settings
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          การเชื่อมต่อ Supabase PostgreSQL Database และ Supabase Storage Bucket
        </p>
      </div>

      {/* Connection Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Supabase Database */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-700 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600" />
              Supabase Database
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                stats.isSupabaseConnected
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-zinc-100 text-zinc-800'
              }`}
            >
              {stats.isSupabaseConnected ? 'Connected (PostgreSQL)' : 'Active (File Store Mirrored)'}
            </span>
          </div>

          <p className="text-xs text-zinc-600 leading-relaxed">
            ตารางฐานข้อมูลหลัก: <code className="font-mono text-zinc-900 font-bold">properties</code>,{' '}
            <code className="font-mono text-zinc-900 font-bold">property_contacts</code>,{' '}
            <code className="font-mono text-zinc-900 font-bold">property_photos</code>,{' '}
            <code className="font-mono text-zinc-900 font-bold">property_files</code>,{' '}
            <code className="font-mono text-zinc-900 font-bold">property_update_logs</code>
          </p>

          <div className="text-[11px] text-zinc-500 pt-2 border-t border-zinc-100 flex items-center justify-between">
            <span>Total Records: {stats.totalProperties} properties</span>
            <span className="font-mono">UUID Primary Key</span>
          </div>
        </div>

        {/* Supabase Storage */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-700 flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-blue-600" />
              Supabase Storage Bucket
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
              property-files
            </span>
          </div>

          <div className="text-xs font-mono bg-zinc-50 p-2.5 rounded border border-zinc-200 space-y-1 text-zinc-700">
            <div>📁 property-files/{"{property_no}"}/photos/</div>
            <div>📁 property-files/{"{property_no}"}/documents/</div>
          </div>

          <div className="text-[11px] text-zinc-500 pt-2 border-t border-zinc-100 flex items-center justify-between">
            <span>Storage Size Limit: 50MB per file</span>
            <span className="text-emerald-700 font-semibold">Public URL Enabled</span>
          </div>
        </div>
      </div>

      {/* Migration Script Viewer */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-2xs overflow-hidden">
        <div className="p-4 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-red-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono">
              Database Migration SQL (db/migration.sql)
            </h3>
          </div>

          <button
            type="button"
            onClick={copyToClipboard}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 flex items-center gap-1.5 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'คัดลอกแล้ว!' : 'Copy SQL'}
          </button>
        </div>

        <pre className="p-4 bg-zinc-950 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-80 leading-relaxed">
          {migrationSql}
        </pre>
      </div>
    </div>
  );
};
