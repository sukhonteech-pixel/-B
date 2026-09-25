import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Files,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Download,
  Trash2,
  RefreshCw,
  Eye,
  Check,
  Building2,
  X,
  FolderUp,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api';

interface BulkFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  isPhoto: boolean;
  matched: boolean;
  property_no: string | null;
  property_name: string | null;
  property_id: string | null;
}

interface BulkFileUploadSectionProps {
  onUploadSuccess?: () => void;
  onSelectProperty?: (propertyNo: string) => void;
}

export const BulkFileUploadSection: React.FC<BulkFileUploadSectionProps> = ({
  onUploadSuccess,
  onSelectProperty,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<BulkFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadResult, setUploadResult] = useState<{
    totalFiles: number;
    matchedCount: number;
    unmatchedCount: number;
    uploadedCount: number;
    matched: Array<{
      originalName: string;
      property_id: string;
      property_no: string;
      property_name: string;
      file_type: 'photo' | 'document';
      recordId: string;
      publicUrl: string;
      size: number;
    }>;
    unmatched: Array<{
      originalName: string;
      reason: string;
      size: number;
    }>;
    errors: Array<{
      originalName: string;
      error: string;
    }>;
  } | null>(null);

  const [filterMode, setFilterMode] = useState<'all' | 'matched' | 'unmatched'>('all');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Handle files selected via input or drop
  const handleFilesAdded = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    if (rawFiles.length === 0) return;

    setIsAnalyzing(true);
    setUploadResult(null);
    setErrorBanner(null);

    try {
      const fileNames = rawFiles.map((f) => f.name);
      let previewItems: Array<{
        fileName: string;
        matched: boolean;
        property_no: string | null;
        property_name: string | null;
        property_id: string | null;
        file_type: 'photo' | 'document';
      }> = [];

      try {
        // 1. Try server-side preview matching first
        const previewRes = await api.previewBulkFiles(fileNames);
        previewItems = previewRes.preview;
      } catch (apiErr: any) {
        console.warn('Backend preview API unreachable, using client-side fallback matching:', apiErr);

        // 2. Client-side fallback matching
        let properties: any[] = [];
        try {
          const propRes = await api.getProperties({ limit: 1000 });
          properties = propRes.items || [];
        } catch {
          properties = [];
        }

        previewItems = fileNames.map((fn) => {
          const ext = fn.split('.').pop()?.toLowerCase() || '';
          const isPhoto =
            ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext);
          const baseName = fn.replace(/\.[^/.]+$/, '').trim();

          // Match against properties in memory/database
          let foundProp: any = null;
          const sorted = [...properties].sort((a, b) => b.property_no.length - a.property_no.length);
          for (const p of sorted) {
            const pNo = (p.property_no || '').trim();
            if (!pNo) continue;
            const escaped = pNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pattern = new RegExp(`^${escaped}(?:[_\\-\\s\\.\\(\\[].*|$)`, 'i');
            if (pattern.test(baseName)) {
              foundProp = p;
              break;
            }
          }

          if (foundProp) {
            return {
              fileName: fn,
              matched: true,
              property_no: foundProp.property_no,
              property_name: foundProp.property_name,
              property_id: foundProp.id,
              file_type: isPhoto ? 'photo' : 'document',
            };
          }

          // Extract candidate prefix from filename (e.g., VN568_01.jpg -> VN568)
          const candidateMatch = baseName.match(/^([a-zA-Z0-9]+)/);
          const candidate = candidateMatch ? candidateMatch[1].toUpperCase() : null;

          return {
            fileName: fn,
            matched: false,
            property_no: candidate,
            property_name: null,
            property_id: null,
            file_type: isPhoto ? 'photo' : 'document',
          };
        });

        if (properties.length === 0) {
          setErrorBanner(
            'คำแนะนำ: ในฐานข้อมูลยังไม่มีรายการทรัพย์สิน (Database: 0 items) ระบบจึงยังไม่สามารถจับคู่ไฟล์กับทรัพย์ได้ กรุณาไปที่แท็บ "Upload Excel" เพื่อนำเข้ารายการทรัพย์สินก่อน'
          );
        }
      }

      const items: BulkFileItem[] = rawFiles.map((file, idx) => {
        const preview = previewItems[idx];
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const isPhoto =
          file.type.startsWith('image/') ||
          ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext);

        return {
          id: `${file.name}-${Date.now()}-${idx}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type || ext,
          isPhoto,
          matched: preview ? preview.matched : false,
          property_no: preview ? preview.property_no : null,
          property_name: preview ? preview.property_name : null,
          property_id: preview ? preview.property_id : null,
        };
      });

      setSelectedFiles((prev) => [...prev, ...items]);
    } catch (err: any) {
      console.error('Failed to preview filenames:', err);
      setErrorBanner(`เกิดข้อผิดพลาดในการวิเคราะห์ไฟล์: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag and Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  }, []);

  // Remove a single file from selected list
  const handleRemoveItem = (id: string) => {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  // Clear all
  const handleClearAll = () => {
    setSelectedFiles([]);
    setUploadResult(null);
    setErrorBanner(null);
  };

  // Upload matched files
  const handleStartBulkUpload = async () => {
    setErrorBanner(null);
    const filesToUpload = selectedFiles
      .filter((item) => item.matched)
      .map((item) => item.file);

    if (filesToUpload.length === 0) {
      setErrorBanner('ไม่มีไฟล์ที่จับคู่กับ Property ได้ กรุณาตรวจสอบว่ามี Property ในระบบและชื่อไฟล์ขึ้นต้นด้วย Property No');
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);

    try {
      setUploadProgress(40);
      const res = await api.bulkUploadFiles(filesToUpload);
      setUploadProgress(100);
      setUploadResult(res);
      setSelectedFiles([]);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      console.error('Bulk upload error:', err);
      const is404 = err.status === 404 || (err.message && err.message.includes('404'));
      if (is404) {
        setErrorBanner(
          'HTTP 404 Not Found: ไม่พบ API Endpoint สำหรับการอัปโหลดไฟล์ หากใช้งานบน Vercel ให้ตรวจสอบว่าได้ Deploy ไฟล์ vercel.json และ api/index.ts เพื่อเปิดใช้งาน Serverless Function'
        );
      } else {
        setErrorBanner(`อัปโหลดล้มเหลว: ${err.message || 'Server error'}`);
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Calculations
  const totalCount = selectedFiles.length;
  const matchedCount = selectedFiles.filter((f) => f.matched).length;
  const unmatchedCount = totalCount - matchedCount;
  const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  const displayedFiles = selectedFiles.filter((f) => {
    if (filterMode === 'matched') return f.matched;
    if (filterMode === 'unmatched') return !f.matched;
    return true;
  });

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-2xs overflow-hidden">
      {/* Header Banner */}
      <div className="p-5 bg-gradient-to-r from-red-950 via-zinc-900 to-zinc-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-red-900 text-white font-mono text-xs font-extrabold flex items-center gap-1.5 shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              NEW FEATURE
            </span>
            <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
              <FolderUp className="w-5 h-5 text-red-400" />
              Bulk File Upload (จับคู่ Property อัตโนมัติจากชื่อไฟล์)
            </h2>
          </div>
          <p className="text-xs text-zinc-300 mt-1 max-w-2xl leading-relaxed">
            อัปโหลดไฟล์หลายไฟล์พร้อมกัน ระบบจะตรวจจับรหัสทรัพย์ที่ส่วนต้นของชื่อไฟล์ (เช่น <code className="bg-zinc-800 px-1 py-0.5 rounded text-amber-300 font-mono">VN568_01.jpg</code>, <code className="bg-zinc-800 px-1 py-0.5 rounded text-amber-300 font-mono">VN568_contract.pdf</code>) และแยกเก็บเข้า Storage ของแต่ละทรัพย์ใน Supabase อัตโนมัติ
          </p>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2.5 rounded-xl bg-red-800 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          เลือกไฟล์จากคอมพิวเตอร์
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => {
            if (e.target.files) handleFilesAdded(e.target.files);
          }}
          className="hidden"
        />
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Error / Instruction Banner */}
        {errorBanner && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start justify-between gap-3 shadow-2xs">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">แจ้งเตือน / คำแนะนำ:</span>
                <span className="leading-relaxed">{errorBanner}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="text-amber-700 hover:text-amber-900 text-xs font-bold p-1 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Drag & Drop Upload Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-3 ${
            isDragging
              ? 'border-red-900 bg-red-50/60 scale-[1.005]'
              : 'border-zinc-300 bg-zinc-50/70 hover:bg-zinc-50 hover:border-zinc-400'
          }`}
        >
          <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-zinc-200 flex items-center justify-center text-red-900">
            {isAnalyzing ? (
              <RefreshCw className="w-6 h-6 animate-spin text-red-900" />
            ) : (
              <FolderUp className="w-7 h-7 text-red-900" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900">
              ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกหลายไฟล์พร้อมกัน
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              รองรับรูปภาพ (JPG, PNG, WEBP) และเอกสาร (PDF, DOCX, XLSX, CSV, ZIP) สูงสุด 100 ไฟล์ต่อครั้ง
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-zinc-600">
            <span className="px-2 py-0.5 rounded bg-white border border-zinc-200 font-mono">
              VN568.jpg → VN568
            </span>
            <span className="px-2 py-0.5 rounded bg-white border border-zinc-200 font-mono">
              VN568_01.jpg → VN568
            </span>
            <span className="px-2 py-0.5 rounded bg-white border border-zinc-200 font-mono">
              VN568_contract.pdf → VN568
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 font-mono">
              ABC.pdf → ไม่พบทรัพย์ (ป้องกันจับคู่ผิด)
            </span>
          </div>
        </div>

        {/* Selected Files Summary & Action Bar */}
        {selectedFiles.length > 0 && (
          <div className="space-y-4">
            {/* Stat Counters */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs">
                <span className="text-zinc-500 block text-[11px] font-semibold">ไฟล์ทั้งหมดที่เลือก</span>
                <span className="text-lg font-bold font-mono text-zinc-900 mt-0.5 block">
                  {totalCount} ไฟล์
                </span>
                <span className="text-[10px] text-zinc-400">{(totalBytes / 1024 / 1024).toFixed(2)} MB</span>
              </div>

              <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs">
                <span className="text-emerald-800 block text-[11px] font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  พบทรัพย์ (Matched)
                </span>
                <span className="text-lg font-bold font-mono text-emerald-900 mt-0.5 block">
                  {matchedCount} ไฟล์
                </span>
                <span className="text-[10px] text-emerald-700">พร้อมอัปโหลดเข้า Storage ทันที</span>
              </div>

              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 text-xs">
                <span className="text-amber-800 block text-[11px] font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  ไม่พบทรัพย์ (Unmatched)
                </span>
                <span className="text-lg font-bold font-mono text-amber-900 mt-0.5 block">
                  {unmatchedCount} ไฟล์
                </span>
                <span className="text-[10px] text-amber-700">จะถูกข้าม ป้องกันการจัดเก็บผิด</span>
              </div>

              <div className="p-3 bg-zinc-900 text-white rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-zinc-400 block text-[10px] font-semibold">ACTION</span>
                  <span className="text-xs font-bold text-white mt-0.5 block">
                    อัปโหลด {matchedCount} ไฟล์
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    disabled={matchedCount === 0 || isUploading}
                    onClick={handleStartBulkUpload}
                    className="w-full py-1.5 px-3 rounded-lg bg-red-800 hover:bg-red-700 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isUploading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        กำลังอัปโหลด...
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        เริ่ม Bulk Upload
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Filter Tabs & Clear Button */}
            <div className="flex items-center justify-between gap-2 pt-2">
              <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    filterMode === 'all' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  ทั้งหมด ({totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('matched')}
                  className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                    filterMode === 'matched' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  พบทรัพย์ ({matchedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('unmatched')}
                  className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                    filterMode === 'unmatched' ? 'bg-amber-600 text-white shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  ไม่พบทรัพย์ ({unmatchedCount})
                </button>
              </div>

              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs font-semibold text-zinc-500 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                ล้างรายการทั้งหมด
              </button>
            </div>

            {/* Upload Progress Bar */}
            {isUploading && (
              <div className="p-4 bg-zinc-900 text-white rounded-xl space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span>กำลังอัปโหลดและจับคู่เข้า Supabase Storage...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-red-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Preview Table */}
            <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-100 text-zinc-700 font-bold sticky top-0 border-b border-zinc-200 z-10">
                    <tr>
                      <th className="py-2.5 px-4">ชื่อไฟล์ (File Name)</th>
                      <th className="py-2.5 px-3">ขนาด</th>
                      <th className="py-2.5 px-3">ประเภท</th>
                      <th className="py-2.5 px-3">Property No ที่ตรวจพบ</th>
                      <th className="py-2.5 px-3">ชื่อทรัพย์สินในฐานข้อมูล</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-center">ลบ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white">
                    {displayedFiles.map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-zinc-50 transition-colors ${
                          !item.matched ? 'bg-amber-50/20' : ''
                        }`}
                      >
                        <td className="py-2.5 px-4 font-mono font-bold text-zinc-900 flex items-center gap-2">
                          {item.isPhoto ? (
                            <ImageIcon className="w-4 h-4 text-blue-600 shrink-0" />
                          ) : (
                            <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                          )}
                          <span className="truncate max-w-xs">{item.name}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-zinc-500 whitespace-nowrap">
                          {(item.size / 1024).toFixed(1)} KB
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.isPhoto
                                ? 'bg-blue-100 text-blue-900'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {item.isPhoto ? 'Photo' : 'Document'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-extrabold">
                          {item.property_no ? (
                            <span className="text-red-950 px-2 py-0.5 rounded bg-red-50 border border-red-200">
                              {item.property_no}
                            </span>
                          ) : (
                            <span className="text-zinc-400 italic text-[11px]">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-700 truncate max-w-xs">
                          {item.property_name || <span className="text-zinc-400 italic text-[11px]">- ไม่พบในระบบ -</span>}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {item.matched ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[10px]">
                              <Check className="w-3 h-3 text-emerald-700" /> พบทรัพย์
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px]" title="ไม่ตรงกับ Property No ใดในฐานข้อมูล">
                              <AlertTriangle className="w-3 h-3 text-amber-700" /> ไม่พบทรัพย์
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1 rounded text-zinc-400 hover:text-red-700 hover:bg-zinc-100"
                            title="ลบไฟล์นี้ออก"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Upload Result Report */}
        {uploadResult && (
          <div className="p-5 bg-zinc-900 text-white rounded-xl border border-zinc-800 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">
                  ผลการดำเนินการ Bulk Upload
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-emerald-400">
                  ✓ สำเร็จ: {uploadResult.uploadedCount} ไฟล์
                </span>
                {uploadResult.unmatchedCount > 0 && (
                  <span className="text-amber-400">
                    ⚠ ข้าม (ไม่พบทรัพย์): {uploadResult.unmatchedCount} ไฟล์
                  </span>
                )}
              </div>
            </div>

            {uploadResult.uploadedCount > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  ไฟล์ที่จัดเก็บลง Supabase Storage และเชื่อมต่อ Property สำเร็จ:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {uploadResult.matched.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-zinc-800/90 rounded-lg border border-zinc-700 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 truncate">
                        {m.file_type === 'photo' ? (
                          <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
                        ) : (
                          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                        )}
                        <div className="truncate">
                          <span className="font-mono text-zinc-200 font-bold block truncate">
                            {m.originalName}
                          </span>
                          <span className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                            <span className="text-red-400 font-mono font-bold">{m.property_no}</span>
                            <span>•</span>
                            <span className="truncate max-w-xs">{m.property_name}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {onSelectProperty && (
                          <button
                            type="button"
                            onClick={() => onSelectProperty(m.property_no)}
                            className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-[11px] font-bold flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" /> ดูทรัพย์
                          </button>
                        )}
                        <a
                          href={m.publicUrl}
                          download={m.originalName}
                          className="px-2 py-1 bg-red-900 hover:bg-red-800 text-white rounded text-[11px] font-bold flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> ดาวน์โหลด
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {uploadResult.unmatchedCount > 0 && (
              <div className="pt-2 border-t border-zinc-800 text-xs">
                <span className="text-amber-400 font-bold flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  รายการไฟล์ที่ไม่มี Property ในฐานข้อมูล (ถูกป้องกัน ไม่ให้อัปโหลดผิดทรัพย์):
                </span>
                <div className="flex flex-wrap gap-2">
                  {uploadResult.unmatched.map((u, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-[11px]"
                    >
                      {u.originalName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
