import * as XLSX from 'xlsx';

export interface ParsedPropertyRow {
  index: number;
  propertyNo: string;
  projectName?: string;
  notes?: string;
  status: 'READY' | 'EXISTING' | 'DUPLICATE' | 'INVALID';
  errorMessage?: string;
  selected: boolean;
}

export function parseExcelFile(fileBuffer: ArrayBuffer): {
  sheets: string[];
  activeSheet: string;
  rows: ParsedPropertyRow[];
  totalRawRows: number;
} {
  const workbook = XLSX.read(fileBuffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;
  const firstSheetName = sheetNames[0] || 'Sheet1';
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to JSON array of objects or arrays
  const jsonData = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });
  if (!jsonData || jsonData.length === 0) {
    return { sheets: sheetNames, activeSheet: firstSheetName, rows: [], totalRawRows: 0 };
  }

  // Find the column index for Property No
  let propertyColIndex = 0;
  let startRowIndex = 0;

  // Inspect first 3 rows for headers
  for (let r = 0; r < Math.min(jsonData.length, 3); r++) {
    const row = jsonData[r];
    if (Array.isArray(row)) {
      const idx = row.findIndex((cell) => {
        const val = String(cell || '').trim().toLowerCase();
        return (
          val.includes('property') ||
          val.includes('code') ||
          val.includes('รหัส') ||
          val.includes('unit') ||
          val.includes('no.') ||
          val === 'id'
        );
      });
      if (idx !== -1) {
        propertyColIndex = idx;
        startRowIndex = r + 1;
        break;
      }
    }
  }

  const seen = new Set<string>();
  const parsedRows: ParsedPropertyRow[] = [];
  let rowIndex = 1;

  for (let r = startRowIndex; r < jsonData.length; r++) {
    const row = jsonData[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rawVal = row[propertyColIndex];
    if (rawVal === undefined || rawVal === null) continue;

    const trimmed = String(rawVal).trim().toUpperCase();
    if (!trimmed) continue;

    // Optional project name column
    const projectCol = row[propertyColIndex + 1];
    const projectName = projectCol ? String(projectCol).trim() : undefined;

    // Validate format
    const isValidFormat = /^[A-Z0-9_#-]{2,25}$/.test(trimmed);
    const isDuplicate = seen.has(trimmed);

    let status: ParsedPropertyRow['status'] = 'READY';
    let errorMessage: string | undefined;

    if (!isValidFormat) {
      status = 'INVALID';
      errorMessage = 'Invalid format';
    } else if (isDuplicate) {
      status = 'DUPLICATE';
      errorMessage = 'Duplicate in file (will skip)';
    } else {
      seen.add(trimmed);
    }

    parsedRows.push({
      index: rowIndex++,
      propertyNo: trimmed,
      projectName,
      status,
      errorMessage,
      selected: status === 'READY',
    });
  }

  return {
    sheets: sheetNames,
    activeSheet: firstSheetName,
    rows: parsedRows,
    totalRawRows: jsonData.length,
  };
}

export function generateTemplateExcel(): Blob {
  const sampleData = [
    { 'Property No': 'VN568', 'Project Name': 'The River Sathorn', 'Type': 'Condo', 'Notes': 'Primary MVP Test Case (12 Photos)' },
    { 'Property No': 'KT324', 'Project Name': 'Ashton Asoke', 'Type': 'Condo', 'Notes': 'High Floor City View' },
    { 'Property No': 'CL2237', 'Project Name': 'Rhythm Ekkamai', 'Type': 'Condo', 'Notes': 'Duplex Suite' },
    { 'Property No': 'DXC005', 'Project Name': 'Noble Ploenchit', 'Type': 'Condo', 'Notes': 'Private Lift' },
    { 'Property No': 'CL470', 'Project Name': 'IDEO Q Sukhumvit 36', 'Type': 'Condo', 'Notes': 'Fully Furnished' },
    { 'Property No': 'TBR017', 'Project Name': 'Banyan Tree Residences', 'Type': 'Luxury Villa', 'Notes': 'Riverfront View' },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Properties');

  // Set column widths
  worksheet['!cols'] = [
    { wch: 16 }, // Property No
    { wch: 26 }, // Project Name
    { wch: 14 }, // Type
    { wch: 36 }, // Notes
  ];

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function exportBatchSummaryExcel(batchResults: any[]): Blob {
  const exportData = batchResults.map((item, idx) => ({
    '#': idx + 1,
    'Job No': item.jobNo,
    'Property No': item.propertyNo,
    'Status': item.status,
    'Landlord Name': item.resultData?.landlord?.name || 'N/A',
    'Landlord Phone': item.resultData?.landlord?.phone_no_1 || 'N/A',
    'Photos Synced': item.resultData?.photosCount || item.resultData?.photos?.length || 0,
    'Rent Price (THB)': item.resultData?.property?.rent_price_year || 'N/A',
    'Execution Time': item.completedAt ? new Date(item.completedAt).toLocaleTimeString() : 'N/A',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Batch_Summary');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
