import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  Table as TableIcon,
  ChevronRight,
  FileCheck,
} from 'lucide-react';
import {
  parseExcelFile,
  autoMapColumns,
  validateAndMapRows,
  RawExcelData,
  ColumnMapping,
  ValidatedPropertyRow,
  AVAILABLE_DB_FIELDS,
  DbFieldKey,
} from '../utils/excelImport';
import { api } from '../services/api';

interface UploadExcelViewProps {
  onImportCompleted: () => void;
  onNavigateToProperties: () => void;
}

export const UploadExcelView: React.FC<UploadExcelViewProps> = ({
  onImportCompleted,
  onNavigateToProperties,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawData, setRawData] = useState<RawExcelData | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [validatedData, setValidatedData] = useState<{
    rows: ValidatedPropertyRow[];
    totalRows: number;
    validRows: number;
    invalidRows: number;
    duplicateRows: number;
  } | null>(null);

  const [duplicateStrategy, setDuplicateStrategy] = useState<'UPDATE' | 'SKIP' | 'CREATE'>('UPDATE');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<{
    total: number;
    imported: number;
    updated: number;
    skipped: number;
    failedCount: number;
    failed: Array<{ property_no: string; error: string }>;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showMappingEditor, setShowMappingEditor] = useState(false);

  // 1. File Selection & Parsing
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg(null);
    setImportResult(null);
    setSelectedFile(file);
    setIsProcessing(true);

    try {
      const parsed = await parseExcelFile(file);
      setRawData(parsed);

      // Auto-detect column mappings
      const initialMappings = autoMapColumns(parsed.headers);
      setMappings(initialMappings);

      // Auto validate and map
      const validated = validateAndMapRows(parsed.rawRows, initialMappings);
      setValidatedData(validated);
    } catch (err: any) {
      console.error('Error parsing excel:', err);
      setErrorMsg(`ไม่สามารถอ่านไฟล์ Excel ได้: ${err.message || 'ไฟล์เสียหายหรือไม่ถูกต้อง'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Adjust mapping
  const handleMappingChange = (excelCol: string, newDbField: DbFieldKey) => {
    const updatedMappings = mappings.map((m) =>
      m.excelColumn === excelCol ? { ...m, dbField: newDbField } : m
    );
    setMappings(updatedMappings);

    // Re-validate rows with new mappings
    if (rawData) {
      const reValidated = validateAndMapRows(rawData.rawRows, updatedMappings);
      setValidatedData(reValidated);
    }
  };

  // 3. Import Properties
  const handleImport = async () => {
    if (!validatedData || validatedData.rows.length === 0) return;

    // Filter out invalid rows (missing Property No)
    const validRowsToImport = validatedData.rows.filter((r) => r.rowStatus !== 'INVALID');
    if (validRowsToImport.length === 0) {
      setErrorMsg('ไม่มีรายการที่มี Property No ถูกต้องสำหรับนำเข้า');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);
    setImportProgress({ current: 0, total: validRowsToImport.length });

    try {
      // Chunking for optimal server response time and high reliability
      const chunkSize = 100;
      let totalImported = 0;
      let totalUpdated = 0;
      let totalSkipped = 0;
      const allFailed: Array<{ property_no: string; error: string }> = [];

      for (let i = 0; i < validRowsToImport.length; i += chunkSize) {
        const chunk = validRowsToImport.slice(i, i + chunkSize);
        setImportProgress({ current: Math.min(i + chunkSize, validRowsToImport.length), total: validRowsToImport.length });

        const res = await api.importProperties(chunk, duplicateStrategy);
        totalImported += res.imported;
        totalUpdated += res.updated;
        totalSkipped += res.skipped;
        if (res.failed && res.failed.length > 0) {
          allFailed.push(...res.failed);
        }
      }

      setImportResult({
        total: validRowsToImport.length,
        imported: totalImported,
        updated: totalUpdated,
        skipped: totalSkipped,
        failedCount: allFailed.length,
        failed: allFailed,
      });

      onImportCompleted();
    } catch (err: any) {
      console.error('Import failed:', err);
      const is404 = err.status === 404 || (err.message && err.message.includes('404'));
      if (is404) {
        setErrorMsg(
          'HTTP 404 Not Found (เซิร์ฟเวอร์ Backend ยังไม่พร้อมบน Vercel): ระบบต้องการ Serverless Function ในการประมวลผล /api/properties/import ซึ่งขณะนี้ได้เพิ่มไฟล์ vercel.json และ api/index.ts ในโปรเจกต์แล้ว กรุณากด Redeploy บน Vercel หรือรันแบบ Full-Stack ด้วยคำสั่ง npm run dev'
        );
      } else {
        const detail = err.data?.error || err.message || 'Server error';
        setErrorMsg(`เกิดข้อผิดพลาดในการนำเข้าข้อมูล: ${detail}`);
      }
    } finally {
      setIsProcessing(false);
      setImportProgress(null);
    }
  };

  const resetAll = () => {
    setSelectedFile(null);
    setRawData(null);
    setMappings([]);
    setValidatedData(null);
    setImportResult(null);
    setErrorMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-red-900" />
            Upload Property Excel
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            นำเข้าข้อมูลอสังหาริมทรัพย์จำนวนมาก รองรับไฟล์ .xlsx, .xls, .csv พร้อมระบบจับคู่คอลัมน์อัตโนมัติ
          </p>
        </div>

        {selectedFile && (
          <button
            type="button"
            onClick={resetAll}
            className="text-xs text-zinc-600 hover:text-zinc-900 font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 transition-colors flex items-center gap-1.5 self-start"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            เลือกไฟล์ใหม่
          </button>
        )}
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">เกิดข้อผิดพลาด: </span>
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* Step 1: File Upload Box */}
      {!selectedFile && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="bg-white border-2 border-dashed border-zinc-300 hover:border-red-900 hover:bg-red-50/20 rounded-2xl p-10 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center space-y-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-900 flex items-center justify-center shadow-xs">
            <Upload className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900">
              คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              รองรับไฟล์ <strong className="text-zinc-700">.xlsx, .xls, .csv</strong> (ขนาดสูงสุด 50MB, ไม่จำกัดจำนวนแถว)
            </p>
          </div>
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-red-900 text-white text-xs font-bold transition-all shadow-xs"
          >
            Choose Excel File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {/* Step 2: File Meta & Stats Bar */}
      {selectedFile && rawData && (
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-zinc-900 font-mono">
                  {rawData.fileName}
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  ขนาดไฟล์: {(rawData.fileSize / 1024).toFixed(1)} KB • Sheet: {rawData.activeSheet}
                </p>
              </div>
            </div>

            {/* Counts */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="px-3 py-1.5 rounded-lg bg-zinc-100 text-zinc-800 font-medium">
                Total Rows: <strong className="font-mono font-bold">{validatedData?.totalRows || 0}</strong>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                Valid: <strong className="font-mono font-bold">{validatedData?.validRows || 0}</strong>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 font-medium">
                Duplicate in file: <strong className="font-mono font-bold">{validatedData?.duplicateRows || 0}</strong>
              </div>
              {validatedData && validatedData.invalidRows > 0 && (
                <div className="px-3 py-1.5 rounded-lg bg-red-50 text-red-800 border border-red-200 font-medium">
                  Invalid: <strong className="font-mono font-bold">{validatedData.invalidRows}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Configuration & Actions Bar */}
          <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              {/* Duplicate Strategy */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-zinc-700">เมื่อพบรหัสทรัพย์ซ้ำใน Database:</span>
                <select
                  value={duplicateStrategy}
                  onChange={(e) => setDuplicateStrategy(e.target.value as any)}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-50 border border-zinc-300 text-xs font-semibold text-zinc-900 focus:ring-2 focus:ring-red-900 focus:outline-hidden"
                >
                  <option value="UPDATE">Update Existing (อัปเดตข้อมูลเดิม)</option>
                  <option value="SKIP">Skip Duplicate (ข้ามรายการที่ซ้ำ)</option>
                  <option value="CREATE">Create New (เพิ่มรายการใหม่)</option>
                </select>
              </div>

              {/* Column Mapping Toggle */}
              <button
                type="button"
                onClick={() => setShowMappingEditor(!showMappingEditor)}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  showMappingEditor
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-zinc-100 text-zinc-700 border-zinc-300 hover:bg-zinc-200'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                {showMappingEditor ? 'ซ่อนการตั้งค่าคอลัมน์' : 'ปรับแก้ Column Mapping'}
              </button>
            </div>

            {/* Import Button */}
            {!importResult && (
              <button
                type="button"
                onClick={handleImport}
                disabled={isProcessing || !validatedData || validatedData.validRows === 0}
                className="px-6 py-2.5 rounded-xl bg-red-900 hover:bg-red-800 disabled:bg-zinc-400 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 justify-center"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>
                      {importProgress
                        ? `Importing ${importProgress.current} / ${importProgress.total}...`
                        : 'กำลังนำเข้า...'}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Import Properties ({validatedData?.validRows || 0})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Column Mapping Editor (Collapsible) */}
      {selectedFile && showMappingEditor && (
        <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-zinc-600" />
              การจับคู่คอลัมน์ Excel → ฐานข้อมูล Database (Column Mapping)
            </h3>
            <span className="text-[11px] text-zinc-500">
              * คอลัมน์ที่ไม่ได้จับคู่จะถูกบันทึกใน Additional Data โดยไม่สูญหาย
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {mappings.map((m) => (
              <div
                key={m.excelColumn}
                className="p-3 rounded-lg border border-zinc-200 bg-zinc-50/60 flex flex-col justify-between"
              >
                <div className="mb-2">
                  <span className="text-[11px] text-zinc-500 block">Excel Column</span>
                  <span className="text-xs font-mono font-bold text-zinc-900 break-all">
                    {m.excelColumn}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-500 block mb-1">Mapped to Field</span>
                  <select
                    value={m.dbField}
                    onChange={(e) => handleMappingChange(m.excelColumn, e.target.value as DbFieldKey)}
                    className={`w-full text-xs font-semibold px-2 py-1.5 rounded border ${
                      m.dbField !== 'ignore'
                        ? 'bg-white border-zinc-300 text-zinc-900'
                        : 'bg-zinc-100 border-zinc-200 text-zinc-400'
                    }`}
                  >
                    <option value="ignore">-- ละเว้น (เก็บใน Additional Data) --</option>
                    {AVAILABLE_DB_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Import Result Summary Banner */}
      {importResult && (
        <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-2xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                นำเข้าข้อมูลสำเร็จเรียบร้อย (Import Completed)
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                ข้อมูลได้รับการบันทึกและซิงค์ตรงสู่ Supabase PostgreSQL Database เรียบร้อยแล้ว
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
              <span className="text-emerald-700 block text-[11px]">Imported (เพิ่มใหม่):</span>
              <span className="text-lg font-bold font-mono text-emerald-900">
                {importResult.imported}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
              <span className="text-blue-700 block text-[11px]">Updated (อัปเดต):</span>
              <span className="text-lg font-bold font-mono text-blue-900">
                {importResult.updated}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-100 border border-zinc-200">
              <span className="text-zinc-600 block text-[11px]">Skipped (ข้าม):</span>
              <span className="text-lg font-bold font-mono text-zinc-800">
                {importResult.skipped}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-red-50 border border-red-200">
              <span className="text-red-700 block text-[11px]">Failed (ล้มเหลว):</span>
              <span className="text-lg font-bold font-mono text-red-900">
                {importResult.failedCount}
              </span>
            </div>
          </div>

          {importResult.failed.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-xs space-y-1">
              <h4 className="font-bold text-red-900">รายการที่ไม่สามารถนำเข้าได้:</h4>
              <ul className="list-disc list-inside space-y-0.5 text-red-800">
                {importResult.failed.map((f, idx) => (
                  <li key={idx}>
                    <strong>{f.property_no}</strong>: {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={resetAll}
              className="px-4 py-2 rounded-lg border border-zinc-300 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
            >
              นำเข้าไฟล์อื่นเพิ่มเติม
            </button>
            <button
              type="button"
              onClick={onNavigateToProperties}
              className="px-5 py-2 rounded-lg bg-zinc-900 hover:bg-red-900 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              ไปที่หน้ารายการทรัพย์ (Properties) <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Excel Data Preview Table */}
      {validatedData && validatedData.rows.length > 0 && !importResult && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-zinc-600" />
              <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                ตัวอย่างข้อมูล (Preview Table - แสดงสูงสุด 50 แถวแรก)
              </h3>
            </div>
            <span className="text-xs text-zinc-500 font-mono">
              กำลังแสดง {Math.min(50, validatedData.rows.length)} จาก {validatedData.rows.length} รายการ
            </span>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 sticky top-0 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3">Property No</th>
                  <th className="py-2.5 px-3">Name / Project</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3 text-center">Bed / Bath</th>
                  <th className="py-2.5 px-3 text-right">Rent Price (THB)</th>
                  <th className="py-2.5 px-3 text-right">Sale Price (THB)</th>
                  <th className="py-2.5 px-3">Contact Phone</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-800">
                {validatedData.rows.slice(0, 50).map((row) => (
                  <tr
                    key={row.index}
                    className={`hover:bg-zinc-50/80 transition-colors ${
                      row.rowStatus === 'INVALID'
                        ? 'bg-red-50/50'
                        : row.rowStatus === 'DUPLICATE'
                        ? 'bg-amber-50/30'
                        : ''
                    }`}
                  >
                    <td className="py-2 px-3 text-center font-mono text-zinc-400">
                      {row.index}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-zinc-900">
                      {row.property_no || (
                        <span className="text-red-500 italic">Missing ID</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-zinc-900 truncate max-w-xs">
                        {row.property_name}
                      </div>
                      {row.project_name && (
                        <div className="text-[11px] text-zinc-500 truncate max-w-xs">
                          {row.project_name}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-zinc-600 truncate max-w-28">
                      {row.category}
                    </td>
                    <td className="py-2 px-3 text-zinc-600 truncate max-w-32">
                      {row.location || '-'}
                    </td>
                    <td className="py-2 px-3 text-center text-zinc-600">
                      {row.bedroom}B / {row.bathroom}B
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-zinc-900">
                      {row.rent_price > 0 ? `฿${row.rent_price.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-zinc-900">
                      {row.sale_price > 0 ? `฿${row.sale_price.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2 px-3 font-mono text-zinc-700">
                      {row.phone || '-'}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.rowStatus === 'VALID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : row.rowStatus === 'DUPLICATE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {row.rowStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
