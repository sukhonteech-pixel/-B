import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Search, ExternalLink, HardDrive, FolderUp, Layers } from 'lucide-react';
import { api } from '../services/api';
import { BulkFileUploadSection } from './BulkFileUploadSection';

interface FilesViewProps {
  onSelectProperty: (propertyNo: string) => void;
}

export const FilesView: React.FC<FilesViewProps> = ({ onSelectProperty }) => {
  const [activeSubTab, setActiveSubTab] = useState<'bulk-upload' | 'all-files'>('bulk-upload');
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getProperties({ limit: 100 });
      const allFiles: any[] = [];
      for (const p of res.items) {
        if (p.files_count > 0) {
          const detail = await api.getProperty(p.property_no);
          if (detail && detail.files) {
            detail.files.forEach((f) => {
              allFiles.push({
                ...f,
                property_no: p.property_no,
                property_name: p.property_name,
              });
            });
          }
        }
      }
      setFiles(allFiles);
    } catch (err) {
      console.error('Error fetching files:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const filtered = files.filter(
    (f) =>
      f.file_name.toLowerCase().includes(search.toLowerCase()) ||
      f.property_no.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs between Bulk Upload and Existing Document Repository */}
      <div className="bg-white p-2 rounded-xl border border-zinc-200 shadow-2xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('bulk-upload')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'bulk-upload'
                ? 'bg-red-900 text-white shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <FolderUp className="w-4 h-4" />
            Bulk File Upload (จับคู่ Property อัตโนมัติ)
            <span className="px-1.5 py-0.2 rounded-full bg-red-800 text-[10px] text-white font-mono">
              NEW
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('all-files')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'all-files'
                ? 'bg-zinc-900 text-white shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            All Documents & Files (ระบบไฟล์เดิม)
            <span className="px-1.5 py-0.2 rounded-full bg-zinc-200 text-zinc-800 text-[10px] font-mono">
              {files.length}
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={fetchFiles}
          className="text-xs text-zinc-500 hover:text-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 flex items-center gap-1.5"
          title="รีเฟรชข้อมูลไฟล์"
        >
          <HardDrive className="w-3.5 h-3.5" />
          รีเฟรชไฟล์
        </button>
      </div>

      {/* Section 1: Bulk File Upload (ระบบใหม่) */}
      {activeSubTab === 'bulk-upload' && (
        <BulkFileUploadSection
          onSelectProperty={onSelectProperty}
          onUploadSuccess={() => {
            fetchFiles();
          }}
        />
      )}

      {/* Section 2: All Documents & Files (ระบบไฟล์เดิม - ไม่มีการแก้ไขหรือลบออก) */}
      <div className={`space-y-6 ${activeSubTab === 'bulk-upload' ? 'mt-8 pt-6 border-t border-zinc-200' : ''}`}>
        {/* Header เดิม */}
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-zinc-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-900" />
              Property Documents & Files ({filtered.length})
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              ไฟล์สัญญา เอกสารทางกฎหมาย และไฟล์แนบทั้งหมดที่จัดเก็บใน Supabase Storage
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search documents or property..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-red-900 focus:outline-hidden"
            />
          </div>
        </div>

        {loading && (
          <div className="py-16 text-center text-zinc-400 text-xs">
            กำลังค้นหาและรวบรวมไฟล์เอกสาร...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center text-zinc-500 text-xs">
            ยังไม่มีไฟล์เอกสารในระบบ คุณสามารถอัปโหลดไฟล์ในหน้ารายละเอียดของแต่ละทรัพย์ หรือใช้ระบบ Bulk File Upload ด้านบน
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="bg-white rounded-xl border border-zinc-200 shadow-2xs overflow-hidden">
            <div className="divide-y divide-zinc-200">
              {filtered.map((file) => (
                <div
                  key={file.id}
                  className="p-4 flex items-center justify-between hover:bg-zinc-50 transition-colors text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-900 font-mono text-xs">{file.file_name}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-0.5">
                        <span className="font-mono font-bold text-red-900">{file.property_no}</span>
                        <span>•</span>
                        <span>{(file.file_size / 1024).toFixed(1)} KB</span>
                        <span>•</span>
                        <span>{new Date(file.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectProperty(file.property_no)}
                      className="text-zinc-600 hover:text-zinc-900 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      View Property <ExternalLink className="w-3.5 h-3.5" />
                    </button>

                    <a
                      href={file.public_url}
                      download={file.file_name}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-red-900 text-white font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
