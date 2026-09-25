import * as XLSX from 'xlsx';

export interface SourceLocation {
  fileName: string;
  sheetName: string;
  rowNumber: number;
  fieldsProvided: string[];
}

export interface FieldSourceTrace {
  fieldName: string;
  value: any;
  source: {
    fileName: string;
    sheetName: string;
    rowNumber: number;
  };
}

export interface MergedContactItem {
  contact_name: string;
  contact_type: 'Owner' | 'Agent' | 'Co-Agent' | 'Juristic' | 'Cleaning' | 'Other';
  phone: string;
  email?: string;
  source: {
    fileName: string;
    sheetName: string;
    rowNumber: number;
  };
}

export interface MergedPropertyItem {
  property_no: string;
  property_name?: string;
  category?: string;
  property_type?: string;
  status?: string;
  project_name?: string;
  location?: string;
  zone?: string;
  bedroom?: number;
  bathroom?: number;
  land_area?: number;
  building_area?: number;
  floor?: string;
  year_built?: string;
  furniture?: string;
  pool?: string;
  parking?: string;
  description?: string;
  rent_price?: number;
  sale_price?: number;
  additional_data: Record<string, any>;

  contacts: MergedContactItem[];
  photo_names: string[];
  file_names: string[];

  sources: SourceLocation[];
  filesFound: string[];
  fieldTraces: Record<string, FieldSourceTrace[]>;
}

export interface FileAnalysisResult {
  file: File;
  name: string;
  size: number;
  sheetNames: string[];
  totalRows: number;
  headers: string[];
  propertyNoColumn: string | null;
  columnMappings: Record<string, string>;
  rows: Record<string, any>[];
  detectedPropertyCount: number;
  error?: string;
}

// Auto-detect Property No column based on common English and Thai naming patterns
export function detectPropertyNoColumn(headers: string[]): string | null {
  const primaryPatterns = [
    /^(property[_\s]?(no|id|code|num|number)|รหัสทรัพย์|รหัส|เลขทรัพย์|asset[_\s]?no|listing[_\s]?id|unit[_\s]?no|house[_\s]?no)$/i,
    /^(id|code|ref|unit|asset)$/i,
  ];

  for (const pattern of primaryPatterns) {
    const found = headers.find((h) => pattern.test(h.trim()));
    if (found) return found;
  }

  // Fallback: check substring
  const subPatterns = [
    /รหัสทรัพย์/i,
    /property.*(no|id|code)/i,
    /รหัส/i,
  ];

  for (const pattern of subPatterns) {
    const found = headers.find((h) => pattern.test(h.trim()));
    if (found) return found;
  }

  return null;
}

// Auto-detect standard database field mapping for a column name
export function detectFieldMapping(header: string): string {
  const clean = header.trim().toLowerCase();

  // Property No
  if (
    /^(property[_\s]?(no|id|code|num|number)|รหัสทรัพย์|รหัส|เลขทรัพย์|unit[_\s]?no|house[_\s]?no)$/i.test(
      clean
    )
  ) {
    return 'property_no';
  }

  // Phone
  if (
    /^(phone|phone[_\s]?number|tel|telephone|mobile|contact[_\s]?phone|เบอร์โทร|เบอร์โทรศัพท์|โทร|เบอร์ติดต่อ|เบอร์)$/i.test(
      clean
    )
  ) {
    return 'phone';
  }

  // Owner / Contact Name
  if (
    /^(owner|owner[_\s]?name|contact|contact[_\s]?name|ชื่อเจ้าของ|เจ้าของ|ชื่อผู้ติดต่อ|ผู้ติดต่อ)$/i.test(
      clean
    )
  ) {
    return 'contact_name';
  }

  // Property Name / Project
  if (
    /^(property[_\s]?name|name|title|project|project[_\s]?name|ชื่อทรัพย์|ชื่อโครงการ|โครงการ|ชื่อบ้าน|ชื่อคอนโด)$/i.test(
      clean
    )
  ) {
    return 'property_name';
  }

  // Bedroom
  if (/^(bedroom|bedrooms|bed|beds|ห้องนอน|นอน)$/i.test(clean)) {
    return 'bedroom';
  }

  // Bathroom
  if (/^(bathroom|bathrooms|bath|baths|ห้องน้ำ|น้ำ)$/i.test(clean)) {
    return 'bathroom';
  }

  // Rent Price
  if (/^(rent[_\s]?price|rent|rental|ค่าเช่า|ราคาเช่า|เช่า)$/i.test(clean)) {
    return 'rent_price';
  }

  // Sale Price
  if (/^(sale[_\s]?price|price|selling[_\s]?price|ราคาขาย|ราคา|ขาย)$/i.test(clean)) {
    return 'sale_price';
  }

  // Land Area
  if (/^(land[_\s]?area|land|เนื้อที่|ขนาดที่ดิน|ที่ดิน|sqw|ตรว)$/i.test(clean)) {
    return 'land_area';
  }

  // Building Area
  if (
    /^(building[_\s]?area|usable[_\s]?area|floor[_\s]?area|area|พื้นที่ใช้สอย|พื้นที่|sqm|ตรม)$/i.test(
      clean
    )
  ) {
    return 'building_area';
  }

  // Category / Type
  if (/^(category|property[_\s]?type|type|ประเภท|ประเภททรัพย์|หมวดหมู่)$/i.test(clean)) {
    return 'category';
  }

  // Location / Zone
  if (/^(location|zone|district|ทำเล|โซน|ที่ตั้ง|ตำบล|อำเภอ)$/i.test(clean)) {
    return 'location';
  }

  // Floor
  if (/^(floor|storey|ชั้น)$/i.test(clean)) {
    return 'floor';
  }

  // Description
  if (/^(description|detail|details|note|notes|รายละเอียด|หมายเหตุ)$/i.test(clean)) {
    return 'description';
  }

  // Photo
  if (/^(photo|photos|image|images|รูป|รูปภาพ|ภาพ|รูปถ่าย)$/i.test(clean)) {
    return 'photo_names';
  }

  // Document / File
  if (/^(file|files|doc|document|documents|เอกสาร|ไฟล์)$/i.test(clean)) {
    return 'file_names';
  }

  // Default: Keep in additional_data with original header name
  return `extra:${header}`;
}

// Parse a single file
export async function parseExcelFile(file: File): Promise<FileAnalysisResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error('No sheets found in workbook');
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
      defval: '',
      raw: false,
    });

    if (rawData.length === 0) {
      return {
        file,
        name: file.name,
        size: file.size,
        sheetNames: workbook.SheetNames,
        totalRows: 0,
        headers: [],
        propertyNoColumn: null,
        columnMappings: {},
        rows: [],
        detectedPropertyCount: 0,
      };
    }

    const headers = Object.keys(rawData[0]);
    const detectedPropertyNo = detectPropertyNoColumn(headers);

    const columnMappings: Record<string, string> = {};
    headers.forEach((h) => {
      columnMappings[h] = detectFieldMapping(h);
    });

    // Count rows with valid property_no
    let validCount = 0;
    if (detectedPropertyNo) {
      rawData.forEach((row) => {
        const val = row[detectedPropertyNo];
        if (val && String(val).trim()) validCount++;
      });
    }

    return {
      file,
      name: file.name,
      size: file.size,
      sheetNames: workbook.SheetNames,
      totalRows: rawData.length,
      headers,
      propertyNoColumn: detectedPropertyNo,
      columnMappings,
      rows: rawData,
      detectedPropertyCount: validCount,
    };
  } catch (err: any) {
    return {
      file,
      name: file.name,
      size: file.size,
      sheetNames: [],
      totalRows: 0,
      headers: [],
      propertyNoColumn: null,
      columnMappings: {},
      rows: [],
      detectedPropertyCount: 0,
      error: err.message || 'Failed to read file',
    };
  }
}

// Clean and normalize number
function parseNumber(val: any): number | undefined {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'number') return isNaN(val) ? undefined : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? undefined : n;
}

// Clean phone string
function cleanPhone(val: any): string | null {
  if (!val) return null;
  const str = String(val).trim();
  // If starts with single quote or equal
  const normalized = str.replace(/^['=]/, '').trim();
  if (normalized.length < 5) return null;
  return normalized;
}

// Multi-File Merge Engine
export function mergeMultipleExcelFiles(
  analyzedFiles: FileAnalysisResult[]
): {
  mergedProperties: MergedPropertyItem[];
  totalRowsProcessed: number;
  filesProcessedCount: number;
  unlinkedRowsCount: number;
} {
  const propertyMap = new Map<string, MergedPropertyItem>();
  let totalRowsProcessed = 0;
  let unlinkedRowsCount = 0;

  for (const f of analyzedFiles) {
    const fileRows = f.rows || (f as any).allRows || [];
    if (!f.propertyNoColumn || fileRows.length === 0) continue;

    const propCol = f.propertyNoColumn;
    const mappings = f.columnMappings;

    fileRows.forEach((row, rowIdx) => {
      totalRowsProcessed++;
      const rawPropNo = row[propCol];
      if (!rawPropNo || !String(rawPropNo).trim()) {
        unlinkedRowsCount++;
        return;
      }

      const cleanNo = String(rawPropNo).trim().toUpperCase();

      let item = propertyMap.get(cleanNo);
      if (!item) {
        item = {
          property_no: cleanNo,
          additional_data: {},
          contacts: [],
          photo_names: [],
          file_names: [],
          sources: [],
          filesFound: [],
          fieldTraces: {},
        };
        propertyMap.set(cleanNo, item);
      }

      if (!item.filesFound.includes(f.name)) {
        item.filesFound.push(f.name);
      }

      const fieldsProvidedInRow: string[] = [];
      const rowLocation = {
        fileName: f.name,
        sheetName: f.sheetNames[0] || 'Sheet1',
        rowNumber: rowIdx + 2, // 1-indexed including header
      };

      // Extract values based on column mappings
      let rowPhone: string | null = null;
      let rowOwner: string | null = null;

      for (const [colName, mappedField] of Object.entries(mappings)) {
        const val = row[colName];
        if (val === undefined || val === null || val === '') continue;

        const stringVal = String(val).trim();
        if (!stringVal) continue;

        if (mappedField === 'property_no') {
          // Key already handled
          continue;
        }

        if (mappedField === 'phone') {
          const ph = cleanPhone(stringVal);
          if (ph) {
            rowPhone = ph;
            fieldsProvidedInRow.push('phone');
          }
          continue;
        }

        if (mappedField === 'contact_name') {
          rowOwner = stringVal;
          fieldsProvidedInRow.push('contact_name');
          continue;
        }

        if (mappedField === 'photo_names') {
          // Could be comma/newline-separated list of filenames
          const splitPhotos = stringVal
            .split(/[,;\n\r]+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          splitPhotos.forEach((p) => {
            if (!item!.photo_names.includes(p)) item!.photo_names.push(p);
          });
          fieldsProvidedInRow.push('photos');
          continue;
        }

        if (mappedField === 'file_names') {
          const splitDocs = stringVal
            .split(/[,;\n\r]+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          splitDocs.forEach((d) => {
            if (!item!.file_names.includes(d)) item!.file_names.push(d);
          });
          fieldsProvidedInRow.push('documents');
          continue;
        }

        if (mappedField.startsWith('extra:')) {
          const extraKey = mappedField.replace('extra:', '');
          item.additional_data[extraKey] = stringVal;
          fieldsProvidedInRow.push(extraKey);
          continue;
        }

        // Standard numeric or text property fields
        const numericFields = [
          'bedroom',
          'bathroom',
          'rent_price',
          'sale_price',
          'land_area',
          'building_area',
        ];

        let finalValue: any = stringVal;
        if (numericFields.includes(mappedField)) {
          const num = parseNumber(stringVal);
          if (num !== undefined) finalValue = num;
        }

        // Trace this field
        if (!item.fieldTraces[mappedField]) {
          item.fieldTraces[mappedField] = [];
        }
        item.fieldTraces[mappedField].push({
          fieldName: mappedField,
          value: finalValue,
          source: rowLocation,
        });

        // If field not already set on item, or if replacing empty
        if ((item as any)[mappedField] === undefined || (item as any)[mappedField] === '') {
          (item as any)[mappedField] = finalValue;
          fieldsProvidedInRow.push(mappedField);
        }
      }

      // Add contacts (Multiple Contacts Rule: Do not overwrite, merge owner & phone)
      if (rowOwner) {
        item.additional_data.owner_name = rowOwner;
      }

      if (rowPhone) {
        // If row has both phone and owner, or phone alone
        const existingWithPhone = item.contacts.find((c) => c.phone === rowPhone);
        if (existingWithPhone) {
          if (rowOwner && (!existingWithPhone.contact_name || existingWithPhone.contact_name === 'Owner')) {
            existingWithPhone.contact_name = rowOwner;
          }
        } else {
          // Check if there was a contact created without phone (e.g. from owner.xlsx)
          const contactWithoutPhone = item.contacts.find((c) => !c.phone || c.phone === '');
          if (contactWithoutPhone) {
            contactWithoutPhone.phone = rowPhone;
            if (rowOwner && (!contactWithoutPhone.contact_name || contactWithoutPhone.contact_name === 'Owner')) {
              contactWithoutPhone.contact_name = rowOwner;
            }
          } else {
            item.contacts.push({
              contact_name: rowOwner || (item.additional_data.owner_name as string) || 'Owner',
              contact_type: 'Owner',
              phone: rowPhone,
              source: rowLocation,
            });
          }
        }
      } else if (rowOwner) {
        // Owner name provided without phone (e.g. from owner.xlsx)
        const contactWithoutName = item.contacts.find(
          (c) => !c.contact_name || c.contact_name === 'Owner'
        );
        if (contactWithoutName) {
          contactWithoutName.contact_name = rowOwner;
        } else if (item.contacts.length === 0) {
          item.contacts.push({
            contact_name: rowOwner,
            contact_type: 'Owner',
            phone: '',
            source: rowLocation,
          });
        }
      }

      item.sources.push({
        ...rowLocation,
        fieldsProvided: fieldsProvidedInRow,
      });
    });
  }

  const mergedProperties = Array.from(propertyMap.values()).sort((a, b) =>
    a.property_no.localeCompare(b.property_no)
  );

  return {
    mergedProperties,
    totalRowsProcessed,
    filesProcessedCount: analyzedFiles.filter((f) => f.propertyNoColumn).length,
    unlinkedRowsCount,
  };
}
