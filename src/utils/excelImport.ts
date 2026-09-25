import * as XLSX from 'xlsx';

export interface RawExcelData {
  fileName: string;
  fileSize: number;
  sheets: string[];
  activeSheet: string;
  headers: string[];
  rawRows: Record<string, any>[];
  totalRows: number;
}

export type DbFieldKey =
  | 'property_no'
  | 'property_name'
  | 'category'
  | 'property_type'
  | 'status'
  | 'project_name'
  | 'location'
  | 'zone'
  | 'bedroom'
  | 'bathroom'
  | 'land_area'
  | 'building_area'
  | 'floor'
  | 'year_built'
  | 'furniture'
  | 'pool'
  | 'parking'
  | 'description'
  | 'rent_price'
  | 'sale_price'
  | 'phone'
  | 'contact_name'
  | 'ignore';

export interface ColumnMapping {
  excelColumn: string;
  dbField: DbFieldKey;
  confidence: number;
}

export interface ValidatedPropertyRow {
  index: number;
  property_no: string;
  property_name: string;
  category: string;
  property_type: string;
  status: 'Available' | 'Rented' | 'Sold' | 'Pending' | 'Inactive';
  project_name: string;
  location: string;
  zone: string;
  bedroom: number;
  bathroom: number;
  land_area: number;
  building_area: number;
  floor: string;
  year_built: string;
  furniture: string;
  pool: string;
  parking: string;
  description: string;
  rent_price: number;
  sale_price: number;
  phone: string;
  contact_name: string;
  additional_data: Record<string, any>;
  rowStatus: 'VALID' | 'INVALID' | 'DUPLICATE';
  errorMessage?: string;
}

// 1. EXCEL PARSER
export async function parseExcelFile(file: File): Promise<RawExcelData> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetNames = workbook.SheetNames;
  const activeSheet = sheetNames[0] || 'Sheet1';
  const worksheet = workbook.Sheets[activeSheet];

  // Convert sheet to json
  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
  let headers: string[] = [];

  if (rawRows.length > 0) {
    headers = Object.keys(rawRows[0]);
  } else {
    // Try to extract headers from range if empty
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell = worksheet[XLSX.utils.encode_cell({ c: C, r: range.s.r })];
      if (cell && cell.v) headers.push(String(cell.v).trim());
    }
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    sheets: sheetNames,
    activeSheet,
    headers,
    rawRows,
    totalRows: rawRows.length,
  };
}

// 2. COLUMN MAPPER
export const AVAILABLE_DB_FIELDS: { key: DbFieldKey; label: string; aliases: string[] }[] = [
  {
    key: 'property_no',
    label: 'Property No (รหัสทรัพย์)',
    aliases: ['property no', 'property_no', 'property id', 'property number', 'prop no', 'รหัสทรัพย์', 'รหัส', 'code', 'unit no', 'unit_no'],
  },
  {
    key: 'property_name',
    label: 'Property Name (ชื่อทรัพย์/โครงการ)',
    aliases: ['property name', 'property_name', 'name', 'title', 'ชื่อทรัพย์', 'ชื่อ', 'listing name'],
  },
  {
    key: 'category',
    label: 'Category (ประเภทอสังหาฯ)',
    aliases: ['category', 'type', 'property type', 'ประเภท', 'หมวดหมู่', 'asset type'],
  },
  {
    key: 'project_name',
    label: 'Project Name (ชื่อโครงการ)',
    aliases: ['project', 'project name', 'project_name', 'โครงการ', 'ชื่อโครงการ', 'building name', 'development'],
  },
  {
    key: 'location',
    label: 'Location (ทำเล/ที่ตั้ง)',
    aliases: ['location', 'address', 'area', 'ทำเล', 'ที่ตั้ง', 'city', 'district', 'subdistrict'],
  },
  {
    key: 'zone',
    label: 'Zone (โซน)',
    aliases: ['zone', 'โซน', 'sub-area'],
  },
  {
    key: 'bedroom',
    label: 'Bedroom (ห้องนอน)',
    aliases: ['bedroom', 'bed', 'bedrooms', 'ห้องนอน', 'beds'],
  },
  {
    key: 'bathroom',
    label: 'Bathroom (ห้องน้ำ)',
    aliases: ['bathroom', 'bath', 'bathrooms', 'ห้องน้ำ', 'baths'],
  },
  {
    key: 'rent_price',
    label: 'Rent Price (ราคาเช่า THB)',
    aliases: ['rent', 'rent price', 'rent_price', 'rental price', 'rental', 'ราคาเช่า', 'ค่าเช่า'],
  },
  {
    key: 'sale_price',
    label: 'Sale Price (ราคาขาย THB)',
    aliases: ['sale', 'sale price', 'sale_price', 'selling price', 'price', 'ราคาขาย', 'ราคา'],
  },
  {
    key: 'land_area',
    label: 'Land Area (ขนาดที่ดิน ตร.ว.)',
    aliases: ['land area', 'land_area', 'land', 'ที่ดิน', 'เนื้อที่', 'ขนาดที่ดิน'],
  },
  {
    key: 'building_area',
    label: 'Building Area (พื้นที่ใช้สอย ตร.ม.)',
    aliases: ['building area', 'building_area', 'usable area', 'size', 'area sq.m', 'พื้นที่ใช้สอย', 'ขนาดห้อง'],
  },
  {
    key: 'floor',
    label: 'Floor (ชั้น)',
    aliases: ['floor', 'storey', 'ชั้น'],
  },
  {
    key: 'year_built',
    label: 'Year Built (ปีที่สร้าง)',
    aliases: ['year built', 'year', 'built year', 'ปีที่สร้าง'],
  },
  {
    key: 'furniture',
    label: 'Furniture (เฟอร์นิเจอร์)',
    aliases: ['furniture', 'furnish', 'furnished', 'เฟอร์นิเจอร์'],
  },
  {
    key: 'phone',
    label: 'Phone (เบอร์โทรติดต่อ)',
    aliases: ['phone', 'tel', 'mobile', 'contact phone', 'เบอร์โทร', 'เบอร์ติดต่อ', 'โทร'],
  },
  {
    key: 'contact_name',
    label: 'Contact Name (ชื่อผู้ติดต่อ/เจ้าของ)',
    aliases: ['contact', 'contact name', 'owner', 'landlord', 'เจ้าของ', 'ผู้ติดต่อ', 'ชื่อเจ้าของ'],
  },
  {
    key: 'status',
    label: 'Status (สถานะ)',
    aliases: ['status', 'สถานะ', 'availability'],
  },
  {
    key: 'description',
    label: 'Description (รายละเอียด)',
    aliases: ['description', 'detail', 'details', 'remark', 'note', 'รายละเอียด', 'หมายเหตุ'],
  },
];

export function autoMapColumns(headers: string[]): ColumnMapping[] {
  const mappedDbFields = new Set<DbFieldKey>();

  return headers.map((header) => {
    const cleanHeader = header.trim().toLowerCase();

    let bestMatch: DbFieldKey = 'ignore';
    let highestScore = 0;

    for (const field of AVAILABLE_DB_FIELDS) {
      if (mappedDbFields.has(field.key)) continue;

      for (const alias of field.aliases) {
        if (cleanHeader === alias) {
          bestMatch = field.key;
          highestScore = 1.0;
          break;
        } else if (cleanHeader.includes(alias) || alias.includes(cleanHeader)) {
          if (highestScore < 0.7) {
            bestMatch = field.key;
            highestScore = 0.7;
          }
        }
      }
      if (highestScore === 1.0) break;
    }

    if (bestMatch !== 'ignore') {
      mappedDbFields.add(bestMatch);
    }

    return {
      excelColumn: header,
      dbField: bestMatch,
      confidence: highestScore,
    };
  });
}

// 3. VALIDATOR & NORMALIZER
export function cleanNumeric(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

export function validateAndMapRows(
  rawRows: Record<string, any>[],
  columnMappings: ColumnMapping[]
): {
  rows: ValidatedPropertyRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
} {
  const mapLookup: Record<string, DbFieldKey> = {};
  columnMappings.forEach((m) => {
    mapLookup[m.excelColumn] = m.dbField;
  });

  const seenPropertyNos = new Set<string>();
  const results: ValidatedPropertyRow[] = [];

  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  rawRows.forEach((raw, idx) => {
    const rowObj: Partial<ValidatedPropertyRow> = {
      index: idx + 1,
      additional_data: {},
    };

    // Extract mapped fields
    Object.entries(raw).forEach(([colName, cellVal]) => {
      const dbKey = mapLookup[colName];
      if (!dbKey || dbKey === 'ignore') {
        if (cellVal !== undefined && cellVal !== null && cellVal !== '') {
          rowObj.additional_data![colName] = cellVal;
        }
        return;
      }

      switch (dbKey) {
        case 'property_no':
          rowObj.property_no = String(cellVal || '').trim().toUpperCase();
          break;
        case 'property_name':
          rowObj.property_name = String(cellVal || '').trim();
          break;
        case 'category':
          rowObj.category = String(cellVal || '').trim();
          break;
        case 'property_type':
          rowObj.property_type = String(cellVal || '').trim();
          break;
        case 'project_name':
          rowObj.project_name = String(cellVal || '').trim();
          break;
        case 'location':
          rowObj.location = String(cellVal || '').trim();
          break;
        case 'zone':
          rowObj.zone = String(cellVal || '').trim();
          break;
        case 'status':
          const st = String(cellVal || '').trim().toLowerCase();
          if (st.includes('rent')) rowObj.status = 'Rented';
          else if (st.includes('sold')) rowObj.status = 'Sold';
          else if (st.includes('pending')) rowObj.status = 'Pending';
          else if (st.includes('inactive') || st.includes('archive')) rowObj.status = 'Inactive';
          else rowObj.status = 'Available';
          break;
        case 'bedroom':
          rowObj.bedroom = Math.floor(cleanNumeric(cellVal));
          break;
        case 'bathroom':
          rowObj.bathroom = Math.floor(cleanNumeric(cellVal));
          break;
        case 'land_area':
          rowObj.land_area = cleanNumeric(cellVal);
          break;
        case 'building_area':
          rowObj.building_area = cleanNumeric(cellVal);
          break;
        case 'floor':
          rowObj.floor = String(cellVal || '').trim();
          break;
        case 'year_built':
          rowObj.year_built = String(cellVal || '').trim();
          break;
        case 'furniture':
          rowObj.furniture = String(cellVal || '').trim();
          break;
        case 'pool':
          rowObj.pool = String(cellVal || '').trim();
          break;
        case 'parking':
          rowObj.parking = String(cellVal || '').trim();
          break;
        case 'description':
          rowObj.description = String(cellVal || '').trim();
          break;
        case 'rent_price':
          rowObj.rent_price = cleanNumeric(cellVal);
          break;
        case 'sale_price':
          rowObj.sale_price = cleanNumeric(cellVal);
          break;
        case 'phone':
          rowObj.phone = String(cellVal || '').trim();
          break;
        case 'contact_name':
          rowObj.contact_name = String(cellVal || '').trim();
          break;
      }
    });

    const pNo = rowObj.property_no || '';
    let rowStatus: ValidatedPropertyRow['rowStatus'] = 'VALID';
    let errorMessage: string | undefined;

    if (!pNo) {
      rowStatus = 'INVALID';
      errorMessage = 'Missing Property No';
      invalidCount++;
    } else if (seenPropertyNos.has(pNo)) {
      rowStatus = 'DUPLICATE';
      errorMessage = 'Duplicate Property No in this file';
      duplicateCount++;
    } else {
      seenPropertyNos.add(pNo);
      validCount++;
    }

    results.push({
      index: idx + 1,
      property_no: pNo,
      property_name: rowObj.property_name || pNo,
      category: rowObj.category || 'Condominium',
      property_type: rowObj.property_type || 'Residential',
      status: rowObj.status || 'Available',
      project_name: rowObj.project_name || '',
      location: rowObj.location || '',
      zone: rowObj.zone || '',
      bedroom: rowObj.bedroom || 0,
      bathroom: rowObj.bathroom || 0,
      land_area: rowObj.land_area || 0,
      building_area: rowObj.building_area || 0,
      floor: rowObj.floor || '',
      year_built: rowObj.year_built || '',
      furniture: rowObj.furniture || '',
      pool: rowObj.pool || '',
      parking: rowObj.parking || '',
      description: rowObj.description || '',
      rent_price: rowObj.rent_price || 0,
      sale_price: rowObj.sale_price || 0,
      phone: rowObj.phone || '',
      contact_name: rowObj.contact_name || 'Owner',
      additional_data: rowObj.additional_data || {},
      rowStatus,
      errorMessage,
    });
  });

  return {
    rows: results,
    totalRows: results.length,
    validRows: validCount,
    invalidRows: invalidCount,
    duplicateRows: duplicateCount,
  };
}
