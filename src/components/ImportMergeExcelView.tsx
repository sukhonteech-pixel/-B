import React, { useState, useRef, useMemo } from 'react';
import {
  Layers,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Phone,
  RefreshCw,
  Search,
  Eye,
  Filter,
  Check,
  ChevronDown,
  ChevronUp,
  History,
  ArrowRight,
  ShieldCheck,
  Building2,
  Trash2,
  Info,
  SlidersHorizontal,
  X,
  GitMerge,
  Database,
} from 'lucide-react';
import {
  parseExcelFile,
  mergeMultipleExcelFiles,
  FileAnalysisResult,
  MergedPropertyItem,
} from '../utils/excelMultiMerge';
import { api } from '../services/api';

interface ImportMergeExcelViewProps {
  onMergeCompleted: () => void;
  onNavigateToProperties?: (propertyNo?: string) => void;
}

export const ImportMergeExcelView: React.FC<ImportMergeExcelViewProps> = ({
  onMergeCompleted,
  onNavigateToProperties,
}) => {
  // Wizard Steps: 1: Files, 2: Preview & Conflicts, 3: Completed
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // File states
  const [files, setFiles] = useState<FileAnalysisResult[]>([]);
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Merged results from client
  const [mergedItems, setMergedItems] = useState<MergedPropertyItem[]>([]);
  const [unlinkedRowsCount, setUnlinkedRowsCount] = useState(0);

  // Server Preview & Conflict states
  const [serverPreview, setServerPreview] = useState<any | null>(null);
  const [isPreviewingServer, setIsPreviewingServer] = useState(false);

  // Conflict resolutions per property: { propertyNo: { field: 'keep_existing' | 'use_excel' | 'skip' } }
  const [conflictDecisions, setConflictDecisions] = useState<
    Record<string, Record<string, 'keep_existing' | 'use_excel' | 'skip'>>
  >({});
  const [defaultStrategy, setDefaultStrategy] = useState<
    'keep_existing' | 'use_excel' | 'skip'
  >('keep_existing');

  // Search & Filter in Preview
  const [previewSearch, setPreviewSearch] = useState('');
  const [filterMode, setFilterMode] = useState<
    'all' | 'conflicts' | 'new' | 'existing'
  >('all');

  // Inspection Drawer
  const [inspectingProperty, setInspectingProperty] = useState<any | null>(null);

  // Mapping inspector modal
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null);

  // Execution states
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<number>(0);
  const [importResult, setImportResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Real-Time Batch / Chunked Progress & Error Tracking
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [progressStages, setProgressStages] = useState<{
    reading: number;
    processing: number;
    merging: number;
    saving: number;
    complete: number;
  }>({
    reading: 0,
    processing: 0,
    merging: 0,
    saving: 0,
    complete: 0,
  });
  const [batchStats, setBatchStats] = useState<{
    totalRows: number;
    processedRows: number;
    newProperties: number;
    updatedProperties: number;
    contactsAdded: number;
    conflicts: number;
    errors: number;
  }>({
    totalRows: 0,
    processedRows: 0,
    newProperties: 0,
    updatedProperties: 0,
    contactsAdded: 0,
    conflicts: 0,
    errors: 0,
  });
  const [detailedError, setDetailedError] = useState<{
    stage: string;
    file: string;
    row: number;
    propertyNo: string;
    message: string;
    batchId?: string;
  } | null>(null);

  // Batch History tab
  const [showHistory, setShowHistory] = useState(false);
  const [historyBatches, setHistoryBatches] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // --------------------------------------------------------------------------
  // Step 1: File Upload & Parsing
  // --------------------------------------------------------------------------
  const handleFilesSelected = async (fileList: FileList | File[]) => {
    const rawFiles = Array.from(fileList);
    if (rawFiles.length === 0) return;

    setIsReadingFiles(true);
    setErrorMsg(null);

    try {
      const analyzedPromises = rawFiles.map((f) => parseExcelFile(f));
      const results = await Promise.all(analyzedPromises);

      // Append new files, avoiding exact duplicates by name and size
      setFiles((prev) => {
        const existingKeys = new Set(prev.map((p) => `${p.name}-${p.size}`));
        const filteredNew = results.filter(
          (r) => !existingKeys.has(`${r.name}-${r.size}`)
        );
        return [...prev, ...filteredNew];
      });
    } catch (err: any) {
      console.error('Error parsing files:', err);
      setErrorMsg(`เกิดข้อผิดพลาดในการอ่านไฟล์ Excel: ${err.message}`);
    } finally {
      setIsReadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleClearAllFiles = () => {
    setFiles([]);
    setMergedItems([]);
    setServerPreview(null);
    setConflictDecisions({});
    setErrorMsg(null);
  };

  // --------------------------------------------------------------------------
  // Step 2: Analyze & Match (Client + Server Comparison)
  // --------------------------------------------------------------------------
  const handleAnalyzeAndMatch = async () => {
    if (files.length === 0) {
      setErrorMsg('กรุณาเลือกไฟล์ Excel อย่างน้อย 1 ไฟล์');
      return;
    }

    const filesWithoutKey = files.filter((f) => !f.propertyNoColumn);
    if (filesWithoutKey.length > 0) {
      setErrorMsg(
        `ไฟล์ "${filesWithoutKey.map((f) => f.name).join(', ')}" ยังไม่ได้กำหนดคอลัมน์ Property No กรุณากำหนดคอลัมน์ก่อนดำเนินการต่อ`
      );
      return;
    }

    setIsPreviewingServer(true);
    setErrorMsg(null);

    try {
      // 1. Client-Side Multi-File Merger
      const { mergedProperties, unlinkedRowsCount: unlinked } =
        mergeMultipleExcelFiles(files);
      setMergedItems(mergedProperties);
      setUnlinkedRowsCount(unlinked);

      if (mergedProperties.length === 0) {
        setErrorMsg('ไม่พบข้อมูลที่มี Property No ที่ถูกต้องในไฟล์ที่เลือก');
        setIsPreviewingServer(false);
        return;
      }

      // 2. Server-side comparison & conflict detection
      try {
        const previewRes = await api.previewMergeProperties(mergedProperties);
        setServerPreview(previewRes);
      } catch (srvErr: any) {
        console.warn('Server preview endpoint error, falling back to client analysis:', srvErr);
        // Fallback: construct client-side preview structure
        setServerPreview({
          total: mergedProperties.length,
          newPropertiesCount: mergedProperties.length,
          existingPropertiesCount: 0,
          totalConflicts: 0,
          preview: mergedProperties.map((m) => ({
            property_no: m.property_no,
            filesFound: m.filesFound,
            isExisting: false,
            existingId: null,
            existingData: null,
            incomingData: m,
            conflicts: [],
            hasConflicts: false,
            newFieldsCount: Object.keys(m).filter((k) => (m as any)[k] !== undefined).length,
            newContactsCount: m.contacts.length,
            sources: m.sources,
            fieldTraces: m.fieldTraces,
          })),
        });
      }

      setCurrentStep(2);
    } catch (err: any) {
      console.error('Failed to analyze and merge:', err);
      setErrorMsg(`เกิดข้อผิดพลาดในการวิเคราะห์และรวมข้อมูล: ${err.message}`);
    } finally {
      setIsPreviewingServer(false);
    }
  };

  // --------------------------------------------------------------------------
  // Step 3: Conflict Decision Handlers
  // --------------------------------------------------------------------------
  const handleResolveConflict = (
    propertyNo: string,
    field: string,
    decision: 'keep_existing' | 'use_excel' | 'skip'
  ) => {
    setConflictDecisions((prev) => ({
      ...prev,
      [propertyNo]: {
        ...(prev[propertyNo] || {}),
        [field]: decision,
      },
    }));
  };

  const handleApplyGlobalResolution = (
    decision: 'keep_existing' | 'use_excel' | 'skip'
  ) => {
    setDefaultStrategy(decision);
    if (!serverPreview) return;

    const newDecisions: Record<string, Record<string, 'keep_existing' | 'use_excel' | 'skip'>> = {};
    serverPreview.preview.forEach((item: any) => {
      if (item.conflicts && item.conflicts.length > 0) {
        newDecisions[item.property_no] = {};
        item.conflicts.forEach((c: any) => {
          newDecisions[item.property_no][c.field] = decision;
        });
      }
    });
    setConflictDecisions(newDecisions);
  };

  // --------------------------------------------------------------------------
  // Step 4: Execute Import & Safe Merge (Chunked Batch Architecture)
  // --------------------------------------------------------------------------
  const handleExecuteMergeImport = async () => {
    if (!serverPreview || serverPreview.preview.length === 0) return;

    setIsImporting(true);
    setErrorMsg(null);
    setDetailedError(null);
    setProgressStages({
      reading: 100,
      processing: 100,
      merging: 10,
      saving: 0,
      complete: 0,
    });

    const itemsToImport = serverPreview.preview.map((p: any) => ({
      ...p.incomingData,
      resolvedConflicts: conflictDecisions[p.property_no] || {},
    }));

    const totalRows = itemsToImport.length;
    const fileNames = files.map((f) => f.name);
    const batchName = `Batch ${files.map((f) => f.name.replace(/\.[^/.]+$/, '')).join(' + ')}`;

    setBatchStats({
      totalRows,
      processedRows: 0,
      newProperties: 0,
      updatedProperties: 0,
      contactsAdded: 0,
      conflicts: 0,
      errors: 0,
    });

    try {
      // Step 1: Create Import Batch on Server
      const createRes = await api.createImportBatch({
        batch_name: batchName,
        total_files: fileNames.length,
        total_rows: totalRows,
        file_names: fileNames,
        default_strategy: defaultStrategy,
      });

      const batchId = createRes.batchId;
      setActiveBatchId(batchId);

      // Step 2: Process in Chunks (100 rows per chunk - prevents serverless timeouts)
      const chunkSize = 100;
      const totalChunks = Math.ceil(totalRows / chunkSize);
      let cumulativeNew = 0;
      let cumulativeUpdated = 0;
      let cumulativeContacts = 0;
      let cumulativeConflicts = 0;
      let cumulativeErrors = 0;
      const accumulatedErrors: any[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const chunkItems = itemsToImport.slice(i * chunkSize, (i + 1) * chunkSize);
        const percent = Math.round(((i + 1) / totalChunks) * 100);

        setProgressStages((prev) => ({
          ...prev,
          merging: percent,
        }));

        const chunkRes = await api.processImportChunk(batchId, {
          chunkIndex: i,
          totalChunks,
          items: chunkItems,
          conflictDecisions,
          defaultStrategy,
        });

        setProgressStages((prev) => ({
          ...prev,
          saving: percent,
        }));

        if (chunkRes.batch) {
          cumulativeNew = chunkRes.batch.new_properties;
          cumulativeUpdated = chunkRes.batch.updated_properties;
          cumulativeContacts = chunkRes.batch.contacts_added;
          cumulativeConflicts = chunkRes.batch.conflicts;
          cumulativeErrors = chunkRes.batch.errors;
        }

        if (chunkRes.errors && chunkRes.errors.length > 0) {
          accumulatedErrors.push(...chunkRes.errors);
        }

        setBatchStats({
          totalRows,
          processedRows: Math.min((i + 1) * chunkSize, totalRows),
          newProperties: cumulativeNew,
          updatedProperties: cumulativeUpdated,
          contactsAdded: cumulativeContacts,
          conflicts: cumulativeConflicts,
          errors: cumulativeErrors,
        });
      }

      // Step 3: Complete Import Batch
      const completeRes = await api.completeImportBatch(batchId);
      setProgressStages({
        reading: 100,
        processing: 100,
        merging: 100,
        saving: 100,
        complete: 100,
      });
      setImportProgress(100);

      setImportResult({
        success: true,
        batch: completeRes.batch,
        summary: {
          totalProperties: totalRows,
          newProperties: completeRes.batch.new_properties,
          updatedProperties: completeRes.batch.updated_properties,
          contactsAdded: completeRes.batch.contacts_added,
          photosAdded: 0,
          filesAdded: 0,
          conflictsResolved: completeRes.batch.conflicts,
          errorsCount: completeRes.batch.errors,
          errors: accumulatedErrors,
        },
      });

      setCurrentStep(3);
      onMergeCompleted();
    } catch (err: any) {
      console.error('Batch import execution error:', err);
      const serverErr = err.data || {};
      const stage = serverErr.stage || 'database_merge';
      const file = serverErr.file || files[0]?.name || 'Excel';
      const row = serverErr.row || 1;
      const propertyNo = serverErr.propertyNo || 'UNKNOWN';
      const message = serverErr.message || err.message || 'Serverless invocation error';

      setDetailedError({
        stage,
        file,
        row,
        propertyNo,
        message,
        batchId: activeBatchId || undefined,
      });

      setErrorMsg(
        `เกิดข้อผิดพลาดในการนำเข้าข้อมูล: ${message} (Stage: ${stage}, File: ${file}, Row: ${row}, Property No: ${propertyNo})`
      );
    } finally {
      setIsImporting(false);
    }
  };

  // Load batch history
  const handleLoadHistory = async () => {
    setIsLoadingHistory(true);
    setShowHistory(true);
    try {
      const batches = await api.getImportBatches();
      setHistoryBatches(batches);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleResetAll = () => {
    setCurrentStep(1);
    setFiles([]);
    setMergedItems([]);
    setServerPreview(null);
    setConflictDecisions({});
    setImportResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filtered preview items
  const filteredPreview = useMemo(() => {
    if (!serverPreview) return [];
    return serverPreview.preview.filter((item: any) => {
      // Search
      if (previewSearch.trim()) {
        const q = previewSearch.toLowerCase();
        const matchNo = item.property_no.toLowerCase().includes(q);
        const matchFiles = item.filesFound.some((f: string) =>
          f.toLowerCase().includes(q)
        );
        if (!matchNo && !matchFiles) return false;
      }
      // Status filter
      if (filterMode === 'conflicts') return item.hasConflicts;
      if (filterMode === 'new') return !item.isExisting;
      if (filterMode === 'existing') return item.isExisting;
      return true;
    });
  }, [serverPreview, previewSearch, filterMode]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-red-100 text-red-900 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                Import & Merge Excel (รวมข้อมูลอสังหาริมทรัพย์จาก Excel หลายไฟล์)
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  Safe Merge Engine
                </span>
              </h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                เลือก Excel หลายไฟล์พร้อมกัน ระบบจะรวมข้อมูลของ Property No เดียวกันเข้าด้วยกัน และไม่ทำข้อมูลเดิมสูญหาย
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleLoadHistory}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <History className="w-3.5 h-3.5 text-zinc-500" />
            ประวัติการ Merge ({historyBatches.length > 0 ? historyBatches.length : 'ดูประวัติ'})
          </button>
          {(files.length > 0 || currentStep > 1) && (
            <button
              type="button"
              onClick={handleResetAll}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-zinc-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
              เริ่มชุดใหม่
            </button>
          )}
        </div>
      </div>

      {/* Error Message Banner & Detailed Error Diagnostics */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-3 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-sm block">เกิดข้อผิดพลาดในการประมวลผล (Import Error)</span>
                <span className="leading-relaxed text-xs text-red-950 mt-0.5 block">{errorMsg}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setDetailedError(null);
              }}
              className="text-red-700 hover:text-red-900 p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Structured Diagnostic Info */}
          {detailedError && (
            <div className="p-3 rounded-lg bg-white/80 border border-red-200/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono">
              <div>
                <span className="text-zinc-500 block">Stage:</span>
                <span className="font-bold text-red-900">{detailedError.stage}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">File:</span>
                <span className="font-bold text-zinc-900 truncate block" title={detailedError.file}>
                  {detailedError.file}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block">Row:</span>
                <span className="font-bold text-zinc-900">{detailedError.row}</span>
              </div>
              <div>
                <span className="text-zinc-500 block">Property No:</span>
                <span className="font-bold text-red-900">{detailedError.propertyNo}</span>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleExecuteMergeImport}
                className="px-3 py-1.5 rounded-lg bg-red-900 text-white font-bold hover:bg-red-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                ลองใหม่อีกครั้ง (Retry)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stepper Navigation */}
      <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs flex items-center justify-between text-xs">
        <div
          className={`flex items-center gap-2 font-bold px-3 py-1.5 rounded-lg ${
            currentStep === 1
              ? 'bg-red-900 text-white'
              : 'text-zinc-500 hover:text-zinc-900 cursor-pointer'
          }`}
          onClick={() => currentStep > 1 && setCurrentStep(1)}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px]">
            1
          </span>
          1. เลือกไฟล์ Excel หลายไฟล์ ({files.length})
        </div>
        <ArrowRight className="w-4 h-4 text-zinc-300" />
        <div
          className={`flex items-center gap-2 font-bold px-3 py-1.5 rounded-lg ${
            currentStep === 2
              ? 'bg-red-900 text-white'
              : 'text-zinc-500'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px]">
            2
          </span>
          2. ตรวจสอบ Preview & จัดการ Conflict ({serverPreview?.total || 0})
        </div>
        <ArrowRight className="w-4 h-4 text-zinc-300" />
        <div
          className={`flex items-center gap-2 font-bold px-3 py-1.5 rounded-lg ${
            currentStep === 3
              ? 'bg-red-900 text-white'
              : 'text-zinc-400'
          }`}
        >
          <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[11px]">
            3
          </span>
          3. สรุปผลการนำเข้า (Result)
        </div>
      </div>

      {/* =======================================================================
          STEP 1: MULTIPLE EXCEL FILES SELECTION
          ======================================================================= */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-3 bg-white ${
              isDragging
                ? 'border-red-900 bg-red-50/60 scale-[1.005]'
                : 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50/50'
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-900 border border-red-100 flex items-center justify-center shadow-xs">
              {isReadingFiles ? (
                <RefreshCw className="w-6 h-6 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-7 h-7" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                ลากไฟล์ Excel หลายไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                รองรับ .xlsx, .xls, .csv เช่น: ข้อมูลบ้าน, เบอร์โทร, ข้อมูลเจ้าของ, ข้อมูลราคา ฯลฯ
              </p>
            </div>
            <div className="pt-1">
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold shadow-xs transition-colors">
                <Upload className="w-4 h-4" />
                เลือกไฟล์ Excel หลายไฟล์พร้อมกัน
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                if (e.target.files) handleFilesSelected(e.target.files);
              }}
              className="hidden"
            />
          </div>

          {/* Selected Files List */}
          {files.length > 0 && (
            <div className="bg-white rounded-xl border border-zinc-200 shadow-2xs overflow-hidden">
              <div className="p-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                    รายการไฟล์ที่เลือก ({files.length} ไฟล์)
                  </h3>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    รวมแถวข้อมูลทั้งหมด: {files.reduce((acc, f) => acc + f.totalRows, 0).toLocaleString()} แถว
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClearAllFiles}
                  className="text-xs text-red-700 hover:text-red-900 font-semibold cursor-pointer"
                >
                  ล้างไฟล์ทั้งหมด
                </button>
              </div>

              <div className="divide-y divide-zinc-200">
                {files.map((fileRes, idx) => (
                  <div
                    key={`${fileRes.name}-${idx}`}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-50/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0">
                        <FileSpreadsheet className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-zinc-900 font-mono">
                            {fileRes.name}
                          </span>
                          <span className="text-[11px] text-zinc-500">
                            ({(fileRes.size / 1024).toFixed(1)} KB)
                          </span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 font-semibold">
                            {fileRes.totalRows} แถว
                          </span>
                        </div>

                        {/* Mapping & Key Status */}
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap text-xs">
                          {fileRes.propertyNoColumn ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                              <Check className="w-3 h-3 text-emerald-700" />
                              Key: &ldquo;{fileRes.propertyNoColumn}&rdquo;
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              ยังไม่พบคอลัมน์ Property No
                            </span>
                          )}

                          <span className="text-[11px] text-zinc-500">
                            ตรวจพบคอลัมน์: {fileRes.headers.length} คอลัมน์
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => setEditingFileIndex(idx)}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-700 flex items-center gap-1 cursor-pointer"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        ปรับคอลัมน์ ({fileRes.headers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="text-zinc-400 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        title="ลบไฟล์นี้"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Bar */}
              <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-zinc-600 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>
                    ระบบจะใช้ <strong>Property No</strong> เชื่อมโยงข้อมูลทุกไฟล์ และ Safe Merge เข้าฐานข้อมูลจริง
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleAnalyzeAndMatch}
                  disabled={isReadingFiles || isPreviewingServer}
                  className="px-6 py-2.5 rounded-xl bg-red-900 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isPreviewingServer ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      กำลังวิเคราะห์และจับคู่ข้อมูล...
                    </>
                  ) : (
                    <>
                      <Layers className="w-4 h-4" />
                      วิเคราะห์ & จับคู่ข้อมูล (Analyze & Match)
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =======================================================================
          STEP 2: PREVIEW & CONFLICT RESOLUTION
          ======================================================================= */}
      {currentStep === 2 && serverPreview && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-white border border-zinc-200 shadow-2xs">
              <span className="text-[11px] text-zinc-500 font-medium block">
                Properties ทั้งหมด
              </span>
              <span className="text-xl font-bold font-mono text-zinc-900 mt-1 block">
                {serverPreview.total.toLocaleString()}
              </span>
              <span className="text-[11px] text-zinc-400 mt-0.5 block">
                จาก {files.length} ไฟล์ Excel
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-emerald-200 shadow-2xs">
              <span className="text-[11px] text-emerald-700 font-medium block">
                New Properties (สร้างใหม่)
              </span>
              <span className="text-xl font-bold font-mono text-emerald-900 mt-1 block">
                {serverPreview.newPropertiesCount.toLocaleString()}
              </span>
              <span className="text-[11px] text-emerald-600 mt-0.5 block">
                ยังไม่มีใน Database
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-blue-200 shadow-2xs">
              <span className="text-[11px] text-blue-700 font-medium block">
                Existing (อัปเดต/Safe Merge)
              </span>
              <span className="text-xl font-bold font-mono text-blue-900 mt-1 block">
                {serverPreview.existingPropertiesCount.toLocaleString()}
              </span>
              <span className="text-[11px] text-blue-600 mt-0.5 block">
                เติมข้อมูลที่ยังขาด
              </span>
            </div>

            <div className="p-4 rounded-xl bg-white border border-purple-200 shadow-2xs">
              <span className="text-[11px] text-purple-700 font-medium block">
                Contacts ทั้งหมด
              </span>
              <span className="text-xl font-bold font-mono text-purple-900 mt-1 block">
                {serverPreview.preview.reduce(
                  (acc: number, item: any) => acc + (item.incomingData?.contacts?.length || 0),
                  0
                )}
              </span>
              <span className="text-[11px] text-purple-600 mt-0.5 block">
                เก็บหลายเบอร์ ไม่เขียนทับ
              </span>
            </div>

            <div
              className={`p-4 rounded-xl bg-white border shadow-2xs ${
                serverPreview.totalConflicts > 0
                  ? 'border-amber-300 bg-amber-50/30'
                  : 'border-zinc-200'
              }`}
            >
              <span className="text-[11px] text-amber-800 font-medium block">
                Conflicts ที่ตรวจพบ
              </span>
              <span
                className={`text-xl font-bold font-mono mt-1 block ${
                  serverPreview.totalConflicts > 0
                    ? 'text-amber-900'
                    : 'text-zinc-400'
                }`}
              >
                {serverPreview.totalConflicts}
              </span>
              <span className="text-[11px] text-amber-700 mt-0.5 block">
                {serverPreview.totalConflicts > 0
                  ? 'มีข้อมูลต่างจากใน DB'
                  : 'ไม่มีข้อมูลขัดแย้ง'}
              </span>
            </div>
          </div>

          {/* Safe Merge Policy Banner & Global Resolution */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-zinc-900 to-zinc-800 text-white shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-xs font-bold tracking-wide uppercase">
                  นโยบาย Safe Merge (ห้ามข้อมูลเดิมสูญหาย)
                </h3>
              </div>
              <p className="text-[11px] text-zinc-300">
                หากในฐานข้อมูลมีข้อมูลอยู่แล้ว และ Excel ไม่มีข้อมูล → ระบบจะรักษาข้อมูลเดิมไว้
                หากมีข้อมูลขัดแย้ง ท่านสามารถเลือกวิธีจัดการได้ด้านขวา
              </p>
            </div>

            <div className="flex items-center gap-2 bg-zinc-800/80 p-1.5 rounded-xl border border-zinc-700 shrink-0">
              <span className="text-[11px] text-zinc-300 pl-2">
                เมื่อพบ Conflict:
              </span>
              <button
                type="button"
                onClick={() => handleApplyGlobalResolution('keep_existing')}
                className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  defaultStrategy === 'keep_existing'
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                รักษาข้อมูลเดิม (Safe)
              </button>
              <button
                type="button"
                onClick={() => handleApplyGlobalResolution('use_excel')}
                className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                  defaultStrategy === 'use_excel'
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                ใช้ข้อมูลจาก Excel
              </button>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white p-3 rounded-xl border border-zinc-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  filterMode === 'all'
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                ทั้งหมด ({serverPreview.preview.length})
              </button>
              {serverPreview.totalConflicts > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterMode('conflicts')}
                  className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                    filterMode === 'conflicts'
                      ? 'bg-amber-600 text-white'
                      : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
                  }`}
                >
                  มี Conflict ({serverPreview.totalConflicts})
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterMode('new')}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  filterMode === 'new'
                    ? 'bg-emerald-700 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                สร้างใหม่ ({serverPreview.newPropertiesCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('existing')}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  filterMode === 'existing'
                    ? 'bg-blue-700 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100'
                }`}
              >
                อัปเดตเดิม ({serverPreview.existingPropertiesCount})
              </button>
            </div>

            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={previewSearch}
                onChange={(e) => setPreviewSearch(e.target.value)}
                placeholder="ค้นหารหัสทรัพย์..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-zinc-200 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-red-900"
              />
            </div>
          </div>

          {/* Properties Preview Table */}
          <div className="bg-white rounded-xl border border-zinc-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 font-bold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Property No</th>
                    <th className="py-3 px-4">พบในกี่ไฟล์ (Files Found)</th>
                    <th className="py-3 px-4">สถานะ (Status)</th>
                    <th className="py-3 px-4">ฟิลด์ที่จะเติม/อัปเดต</th>
                    <th className="py-3 px-4">Contacts (เบอร์โทร)</th>
                    <th className="py-3 px-4">Conflict</th>
                    <th className="py-3 px-4 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredPreview.map((item: any) => {
                    const conflicts = item.conflicts || [];
                    const hasConflict = conflicts.length > 0;

                    return (
                      <tr
                        key={item.property_no}
                        className={`hover:bg-zinc-50/70 transition-colors ${
                          hasConflict ? 'bg-amber-50/30' : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-zinc-900">
                          {item.property_no}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-zinc-900">
                              {item.filesFound.length} ไฟล์:
                            </span>
                            {item.filesFound.map((fn: string) => (
                              <span
                                key={fn}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 truncate max-w-[130px]"
                                title={fn}
                              >
                                {fn}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {item.isExisting ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900">
                              Existing (อัปเดต)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                              New (สร้างใหม่)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-zinc-700">
                          {item.newFieldsCount} fields
                        </td>
                        <td className="py-3 px-4">
                          {item.incomingData?.contacts?.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-purple-700" />
                              <span className="font-mono font-bold text-purple-900">
                                {item.incomingData.contacts.length} เบอร์
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {hasConflict ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                              {conflicts.length} ข้อขัดแย้ง
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold">
                              <Check className="w-3 h-3" />
                              Ready
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setInspectingProperty(item)}
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-800 flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            <Eye className="w-3 h-3 text-zinc-500" />
                            ดูรายละเอียด & แหล่งที่มา
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Bottom Action Bar */}
            <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-xs font-bold text-zinc-600 hover:text-zinc-900 px-3 py-2 cursor-pointer"
              >
                ← ย้อนกลับไปเลือกไฟล์
              </button>

              <button
                type="button"
                onClick={handleExecuteMergeImport}
                disabled={isImporting}
                className="px-6 py-2.5 rounded-xl bg-red-900 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    กำลังรวมและนำเข้าข้อมูล ({importProgress}%)...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    ยืนยันการนำเข้าและรวมข้อมูล ({serverPreview.total.toLocaleString()} รายการ)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          STEP 3: COMPLETED RESULT SUMMARY
          ======================================================================= */}
      {currentStep === 3 && importResult && (
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-2xs space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                รวมข้อมูลและนำเข้าสำเร็จเรียบร้อย! (Multi-Excel Merge Completed)
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                ข้อมูลทุกไฟล์ถูกเชื่อมโยงด้วย Property No และ Safe Merge เข้าฐานข้อมูล Supabase PostgreSQL เรียบร้อยแล้ว
              </p>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-[11px] text-emerald-700 block font-medium">
                New Properties (สร้างใหม่):
              </span>
              <span className="text-xl font-bold font-mono text-emerald-900 mt-1 block">
                {importResult.summary.newProperties}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-[11px] text-blue-700 block font-medium">
                Updated (รวม/อัปเดตข้อมูลเดิม):
              </span>
              <span className="text-xl font-bold font-mono text-blue-900 mt-1 block">
                {importResult.summary.updatedProperties}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
              <span className="text-[11px] text-purple-700 block font-medium">
                Contacts Added (เบอร์โทรที่เพิ่ม):
              </span>
              <span className="text-xl font-bold font-mono text-purple-900 mt-1 block">
                {importResult.summary.contactsAdded}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-[11px] text-amber-700 block font-medium">
                Conflicts Resolved:
              </span>
              <span className="text-xl font-bold font-mono text-amber-900 mt-1 block">
                {importResult.summary.conflictsResolved}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleResetAll}
              className="px-4 py-2 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
            >
              นำเข้าไฟล์ชุดใหม่
            </button>
            {onNavigateToProperties && (
              <button
                type="button"
                onClick={() => onNavigateToProperties()}
                className="px-5 py-2 rounded-lg bg-red-900 hover:bg-red-800 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                ดูรายการทรัพย์สินในระบบ →
              </button>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL: INSPECT PROPERTY & BREAKDOWN BY SOURCE FILE
          ======================================================================= */}
      {inspectingProperty && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-red-900" />
                  รายละเอียดการรวมข้อมูล: {inspectingProperty.property_no}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  ตรวจพบข้อมูลใน {inspectingProperty.filesFound?.length || 0} ไฟล์ Excel
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingProperty(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Source Breakdown (ตามโจทย์: Excel_A -> Bedroom, Bathroom, etc.) */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                1. แหล่งที่มาของข้อมูลแต่ละไฟล์ (Source Files & Fields):
              </h4>
              <div className="space-y-2">
                {inspectingProperty.sources?.map((s: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-zinc-900 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                        {s.fileName} (แถวที่ {s.rowNumber})
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-600 flex items-center gap-1 flex-wrap">
                      <span className="font-semibold text-zinc-700">ฟิลด์ที่ได้รับ:</span>
                      {s.fieldsProvided && s.fieldsProvided.length > 0 ? (
                        s.fieldsProvided.map((f: string) => (
                          <span
                            key={f}
                            className="px-1.5 py-0.5 rounded bg-white border border-zinc-200 font-mono text-[10px]"
                          >
                            {f}
                          </span>
                        ))
                      ) : (
                        <span className="text-zinc-400">ไม่มีฟิลด์เพิ่มเติม</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Contacts breakdown */}
            {inspectingProperty.incomingData?.contacts?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-purple-700" />
                  2. รายการผู้ติดต่อ / เบอร์โทร ({inspectingProperty.incomingData.contacts.length} รายการ):
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {inspectingProperty.incomingData.contacts.map((c: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-purple-50/50 border border-purple-200 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-purple-950 block">
                          {c.contact_name || 'Owner'}
                        </span>
                        <span className="text-[11px] font-mono text-purple-800">
                          {c.phone}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {c.source?.fileName}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conflicts resolution if present */}
            {inspectingProperty.conflicts?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  3. ข้อขัดแย้งกับข้อมูลเดิมในฐานข้อมูล (Conflict Resolution):
                </h4>
                <div className="space-y-2 text-xs">
                  {inspectingProperty.conflicts.map((c: any) => {
                    const currentDecision =
                      conflictDecisions[inspectingProperty.property_no]?.[c.field] ||
                      defaultStrategy;

                    return (
                      <div
                        key={c.field}
                        className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-amber-950">
                            ฟิลด์: {c.label || c.field}
                          </span>
                          <span className="text-[10px] text-amber-800 font-mono">
                            ที่มา: {c.excelSource?.fileName || 'Excel'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 rounded bg-white border border-amber-200">
                            <span className="text-[10px] text-zinc-500 block">Existing DB Value:</span>
                            <span className="font-mono font-bold text-zinc-900">
                              {String(c.dbValue || '-')}
                            </span>
                          </div>
                          <div className="p-2 rounded bg-white border border-amber-200">
                            <span className="text-[10px] text-zinc-500 block">Excel Incoming Value:</span>
                            <span className="font-mono font-bold text-zinc-900">
                              {String(c.excelValue || '-')}
                            </span>
                          </div>
                        </div>

                        {/* Resolution choice */}
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[11px] text-amber-900 font-medium">
                            เลือก:
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleResolveConflict(
                                inspectingProperty.property_no,
                                c.field,
                                'keep_existing'
                              )
                            }
                            className={`text-xs px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                              currentDecision === 'keep_existing'
                                ? 'bg-emerald-700 text-white'
                                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                            }`}
                          >
                            Keep Existing (รักษาข้อมูลเดิม)
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleResolveConflict(
                                inspectingProperty.property_no,
                                c.field,
                                'use_excel'
                              )
                            }
                            className={`text-xs px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                              currentDecision === 'use_excel'
                                ? 'bg-blue-700 text-white'
                                : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50'
                            }`}
                          >
                            Use Excel (ใช้ค่าจาก Excel)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingProperty(null)}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL: EDIT COLUMN MAPPINGS FOR A FILE
          ======================================================================= */}
      {editingFileIndex !== null && files[editingFileIndex] && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  ปรับแต่งคอลัมน์: {files[editingFileIndex].name}
                </h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  เลือกคอลัมน์ที่เป็น Property No และจับคู่ฟิลด์ฐานข้อมูลตามต้องการ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingFileIndex(null)}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Property No Selector */}
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-1">
              <label className="text-xs font-bold text-red-950 block">
                คอลัมน์ที่เป็น Property No (Primary Key)*:
              </label>
              <select
                value={files[editingFileIndex].propertyNoColumn || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFiles((prev) =>
                    prev.map((f, i) =>
                      i === editingFileIndex
                        ? { ...f, propertyNoColumn: val || null }
                        : f
                    )
                  );
                }}
                className="w-full text-xs font-bold px-3 py-2 rounded-lg bg-white border border-red-300 text-zinc-900 focus:outline-none"
              >
                <option value="">-- กรุณาเลือกคอลัมน์ Property No --</option>
                {files[editingFileIndex].headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>

            {/* Other Columns Mapping */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">
                การจับคู่คอลัมน์อื่นๆ:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {files[editingFileIndex].headers.map((h) => (
                  <div
                    key={h}
                    className="p-2.5 rounded-lg border border-zinc-200 bg-zinc-50 flex items-center justify-between gap-2"
                  >
                    <span className="font-mono text-zinc-900 font-semibold truncate max-w-[140px]" title={h}>
                      {h}
                    </span>
                    <select
                      value={files[editingFileIndex].columnMappings[h] || `extra:${h}`}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFiles((prev) =>
                          prev.map((f, i) =>
                            i === editingFileIndex
                              ? {
                                  ...f,
                                  columnMappings: {
                                    ...f.columnMappings,
                                    [h]: val,
                                  },
                                }
                              : f
                          )
                        );
                      }}
                      className="text-xs px-2 py-1 rounded bg-white border border-zinc-300 text-zinc-800"
                    >
                      <option value="property_no">Property No (รหัสทรัพย์)</option>
                      <option value="phone">Phone (เบอร์โทร)</option>
                      <option value="contact_name">Owner/Contact Name (เจ้าของ)</option>
                      <option value="property_name">Property Name (ชื่อทรัพย์)</option>
                      <option value="bedroom">Bedroom (ห้องนอน)</option>
                      <option value="bathroom">Bathroom (ห้องน้ำ)</option>
                      <option value="rent_price">Rent Price (ค่าเช่า)</option>
                      <option value="sale_price">Sale Price (ราคาขาย)</option>
                      <option value="land_area">Land Area (เนื้อที่ ตร.ว.)</option>
                      <option value="building_area">Building Area (พื้นที่ ตร.ม.)</option>
                      <option value="category">Category (หมวดหมู่)</option>
                      <option value="location">Location (ทำเล/โซน)</option>
                      <option value="floor">Floor (ชั้น)</option>
                      <option value="photo_names">Photos (ชื่อรูปภาพ)</option>
                      <option value="file_names">Documents (ชื่อเอกสาร)</option>
                      <option value={`extra:${h}`}>เก็บใน Additional Data ({h})</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setEditingFileIndex(null)}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 cursor-pointer"
              >
                บันทึกการตั้งค่า
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL: BATCH HISTORY VIEW
          ======================================================================= */}
      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-red-900" />
                <h3 className="text-sm font-bold text-zinc-900">
                  ประวัติการนำเข้าและรวมข้อมูล (Import & Merge Batches)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="p-8 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-red-900" />
                กำลังโหลดประวัติ...
              </div>
            ) : historyBatches.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-500 space-y-1">
                <p className="font-semibold">ยังไม่มีประวัติการ Merge ข้อมูล</p>
                <p className="text-zinc-400">
                  เมื่อคุณรวมไฟล์ Excel รายการบันทึกจะแสดงที่นี่เพื่อตรวจสอบย้อนหลังได้เสมอ
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 text-xs">
                {historyBatches.map((b) => (
                  <div key={b.id} className="py-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-zinc-900">{b.batch_name}</span>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {new Date(b.created_at).toLocaleString('th-TH')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-zinc-600 flex-wrap">
                      <span className="font-mono px-2 py-0.5 rounded bg-zinc-100 font-bold">
                        {b.total_properties} ทรัพย์
                      </span>
                      <span className="text-emerald-700 font-medium">
                        +{b.new_properties} สร้างใหม่
                      </span>
                      <span className="text-blue-700 font-medium">
                        +{b.updated_properties} อัปเดต
                      </span>
                      <span className="text-purple-700 font-medium">
                        +{b.contacts_added} Contacts
                      </span>
                      <span className="text-amber-700 font-medium">
                        {b.conflicts_count} Conflicts
                      </span>
                    </div>

                    <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 flex-wrap">
                      <span>ไฟล์:</span>
                      {b.files?.map((fn: string) => (
                        <span
                          key={fn}
                          className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200"
                        >
                          {fn}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistory(false)}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          MODAL: REAL-TIME BATCH IMPORT PROGRESS TRACKER
          ======================================================================= */}
      {isImporting && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-6 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-900 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">
                    กำลังประมวลผลนำเข้าและรวมข้อมูล (Batch Processing)
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-zinc-500 font-mono">
                      Batch ID:
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-800">
                      {activeBatchId || 'กำลังสร้าง Batch...'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Real-time Multi-Stage Progress Bars */}
            <div className="space-y-4 bg-zinc-50/80 p-4 rounded-xl border border-zinc-200/80">
              {/* Stage 1: Reading Files */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-700 flex items-center gap-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-500" />
                    Reading Files
                  </span>
                  <span className="font-mono font-bold text-zinc-900">
                    {progressStages.reading}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-200 overflow-hidden">
                  <div
                    className="h-full bg-zinc-700 transition-all duration-300 rounded-full"
                    style={{ width: `${progressStages.reading}%` }}
                  />
                </div>
              </div>

              {/* Stage 2: Processing Rows */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-700 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    Processing Rows
                  </span>
                  <span className="font-mono font-bold text-zinc-900">
                    {progressStages.processing}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-200 overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300 rounded-full"
                    style={{ width: `${progressStages.processing}%` }}
                  />
                </div>
              </div>

              {/* Stage 3: Merging Properties */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-700 flex items-center gap-1.5">
                    <GitMerge className="w-3.5 h-3.5 text-purple-600" />
                    Merging Properties
                  </span>
                  <span className="font-mono font-bold text-zinc-900">
                    {progressStages.merging}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-200 overflow-hidden">
                  <div
                    className="h-full bg-purple-600 transition-all duration-300 rounded-full"
                    style={{ width: `${progressStages.merging}%` }}
                  />
                </div>
              </div>

              {/* Stage 4: Saving Database */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-700 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-emerald-600" />
                    Saving Database
                  </span>
                  <span className="font-mono font-bold text-zinc-900">
                    {progressStages.saving}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-200 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                    style={{ width: `${progressStages.saving}%` }}
                  />
                </div>
              </div>

              {/* Stage 5: Complete */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-zinc-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-red-900" />
                    Complete
                  </span>
                  <span className="font-mono font-bold text-zinc-900">
                    {progressStages.complete}%
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-zinc-200 overflow-hidden">
                  <div
                    className="h-full bg-red-900 transition-all duration-300 rounded-full"
                    style={{ width: `${progressStages.complete}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">
                <span className="text-[11px] text-zinc-500 block font-medium">Total Rows</span>
                <span className="text-base font-mono font-bold text-zinc-900 mt-0.5 block">
                  {batchStats.totalRows.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80">
                <span className="text-[11px] text-blue-700 block font-medium">Processed</span>
                <span className="text-base font-mono font-bold text-blue-900 mt-0.5 block">
                  {batchStats.processedRows.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                <span className="text-[11px] text-emerald-700 block font-medium">New Properties</span>
                <span className="text-base font-mono font-bold text-emerald-900 mt-0.5 block">
                  +{batchStats.newProperties.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-indigo-50/60 border border-indigo-200/80">
                <span className="text-[11px] text-indigo-700 block font-medium">Updated Properties</span>
                <span className="text-base font-mono font-bold text-indigo-900 mt-0.5 block">
                  +{batchStats.updatedProperties.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-purple-50/60 border border-purple-200/80">
                <span className="text-[11px] text-purple-700 block font-medium">Contacts Added</span>
                <span className="text-base font-mono font-bold text-purple-900 mt-0.5 block">
                  +{batchStats.contactsAdded.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200/80">
                <span className="text-[11px] text-amber-700 block font-medium">Conflicts</span>
                <span className="text-base font-mono font-bold text-amber-900 mt-0.5 block">
                  {batchStats.conflicts.toLocaleString()}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-red-50/60 border border-red-200/80 sm:col-span-2">
                <span className="text-[11px] text-red-700 block font-medium">Errors</span>
                <span className="text-base font-mono font-bold text-red-900 mt-0.5 block">
                  {batchStats.errors.toLocaleString()}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-center text-zinc-500">
              Chunk Size: 100 รายการต่อ Request ป้องกัน Function Timeout บน Serverless
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
