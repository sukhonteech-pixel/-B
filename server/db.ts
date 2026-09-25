import fs from 'fs';
import path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types for PEAK Property Data
export interface PropertyRecord {
  id: string;
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
  additional_data: Record<string, any>;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface PropertyContactRecord {
  id: string;
  property_id: string;
  contact_name: string;
  contact_type: 'Owner' | 'Agent' | 'Co-Agent' | 'Juristic' | 'Cleaning' | 'Other';
  phone: string;
  email?: string;
  note?: string;
  created_at: string;
  updated_at: string;
}

export interface PropertyPhotoRecord {
  id: string;
  property_id: string;
  storage_path: string;
  file_name: string;
  public_url: string;
  sort_order: number;
  is_cover: boolean;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface PropertyFileRecord {
  id: string;
  property_id: string;
  storage_path: string;
  file_name: string;
  public_url: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface PropertyUpdateLogRecord {
  id: string;
  property_id: string;
  action: string;
  changed_field?: string;
  old_value?: string;
  new_value?: string;
  user_name: string;
  created_at: string;
}

export interface ImportBatchRecord {
  id: string;
  batch_name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'Completed' | 'Rolled_Back';
  total_files: number;
  total_rows: number;
  processed_rows: number;
  new_properties: number;
  updated_properties: number;
  contacts_added: number;
  conflicts: number;
  errors: number;
  created_at: string;
  updated_at: string;
  // Compatibility & metadata
  files?: string[];
  total_properties?: number;
  photos_added?: number;
  files_added?: number;
  conflicts_count?: number;
  created_by?: string;
  metadata?: any;
}

export interface ImportBatchItemRecord {
  id: string;
  batch_id: string;
  property_no: string;
  source_file: string;
  source_sheet: string;
  source_row: number;
  data: Record<string, any>;
  status: 'pending' | 'merged' | 'conflict' | 'error';
  error_message?: string | null;
  created_at: string;
}

export class PeakDatabaseService {
  private supabase: SupabaseClient | null = null;
  private isSupabaseConnected = false;
  private storageBucket = 'property-files';

  // Environment determination
  // Production strictly enforces Supabase PostgreSQL as the sole Source of Truth.
  // Local store.json / memoryStore fallback is allowed ONLY in Development / Test.
  private isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL || !!process.env.NOW_REGION;
  private isVercel = !!process.env.VERCEL || !!process.env.NOW_REGION;
  private dataDir: string;
  private uploadDir: string;
  private storeFile: string;

  private memoryStore: {
    properties: PropertyRecord[];
    contacts: PropertyContactRecord[];
    photos: PropertyPhotoRecord[];
    files: PropertyFileRecord[];
    updateLogs: PropertyUpdateLogRecord[];
    importBatches: ImportBatchRecord[];
    importBatchItems: ImportBatchItemRecord[];
  } = {
    properties: [],
    contacts: [],
    photos: [],
    files: [],
    updateLogs: [],
    importBatches: [],
    importBatchItems: [],
  };

  constructor() {
    // On Vercel / serverless lambda, /var/task is read-only, so writable files must live in /tmp
    if (this.isVercel) {
      this.dataDir = path.join('/tmp', 'peak_data');
      this.uploadDir = path.join('/tmp', 'peak_uploads');
      this.storeFile = path.join(this.dataDir, 'store.json');
    } else {
      this.dataDir = path.join(process.cwd(), 'server', 'data');
      this.uploadDir = path.join(process.cwd(), 'public', 'uploads');
      this.storeFile = path.join(process.cwd(), 'server', 'data', 'store.json');
    }

    this.initFileSystem();
    this.initSupabase();
    this.loadStore();
  }

  public isProductionMode(): boolean {
    return this.isProduction;
  }

  public isSupabaseReady(): boolean {
    return this.isSupabaseConnected && this.supabase !== null;
  }

  // Strict Production Enforcement: Throws if Supabase is not ready in Production
  public ensureProductionDatabaseReady(operation = 'Database operation') {
    if (this.isProduction) {
      if (!this.supabase || !this.isSupabaseConnected) {
        throw new Error(
          `[Production Database Configuration Error] ${operation} failed: Supabase PostgreSQL is required as the Source of Truth in Production. ` +
          `Environment variables SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) must be provided in production deployment. ` +
          `Local fallback storage (store.json/memoryStore) is strictly disabled in Production.`
        );
      }
    }
  }

  public getUploadDir(): string {
    return this.uploadDir;
  }

  private initFileSystem() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
    } catch (err) {
      console.warn('[Database] Warning creating filesystem directories:', err);
    }
  }

  private initSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false },
        });
        this.isSupabaseConnected = true;
        console.log(`[Database] Connected to Supabase at ${supabaseUrl}`);
      } catch (err) {
        console.error('[Database] Failed to initialize Supabase client:', err);
        this.isSupabaseConnected = false;
      }
    } else {
      if (this.isProduction) {
        console.error('[Database CRITICAL] Production mode detected but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are NOT set. Local fallback is DISABLED.');
      } else {
        console.log('[Database] Development / Test Mode: Local store fallback enabled. Supabase credentials can be added to .env anytime.');
      }
    }
  }

  private loadStore() {
    if (this.isProduction) {
      // STRICT RULE: In Production, store.json is NEVER loaded. Supabase PostgreSQL is the Source of Truth.
      this.memoryStore = {
        properties: [],
        contacts: [],
        photos: [],
        files: [],
        updateLogs: [],
        importBatches: [],
        importBatchItems: [],
      };
      console.log('[Database] Production mode active: local store.json disabled. Source of Truth: Supabase PostgreSQL.');
      return;
    }

    try {
      let fileToRead = this.storeFile;
      if (!fs.existsSync(fileToRead)) {
        const bundledStore = path.join(process.cwd(), 'server', 'data', 'store.json');
        if (fs.existsSync(bundledStore)) {
          fileToRead = bundledStore;
        }
      }

      if (fs.existsSync(fileToRead)) {
        const raw = fs.readFileSync(fileToRead, 'utf-8');
        const parsed = JSON.parse(raw);
        this.memoryStore = {
          properties: parsed.properties || [],
          contacts: parsed.contacts || [],
          photos: parsed.photos || [],
          files: parsed.files || [],
          updateLogs: parsed.updateLogs || [],
          importBatches: parsed.importBatches || [],
          importBatchItems: parsed.importBatchItems || [],
        };
        console.log(`[Database] Loaded ${this.memoryStore.properties.length} properties and ${this.memoryStore.importBatches.length} import batches from local storage.`);
        if (fileToRead !== this.storeFile) {
          this.saveStore();
        }
      } else {
        this.memoryStore = {
          properties: [],
          contacts: [],
          photos: [],
          files: [],
          updateLogs: [],
          importBatches: [],
          importBatchItems: [],
        };
        this.saveStore();
      }
    } catch (e) {
      console.error('[Database] Error loading store file:', e);
    }
  }

  private saveStore() {
    if (this.isProduction) {
      // STRICT RULE: In Production, store.json is NEVER written. All persistence is in Supabase.
      return;
    }
    try {
      const dir = path.dirname(this.storeFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.storeFile, JSON.stringify(this.memoryStore, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[Database] Could not write store file (read-only environment):', e);
    }
  }

  // Dashboard Stats (Real counts from database)
  async getDashboardStats() {
    if (this.isProduction) {
      this.ensureProductionDatabaseReady('Fetch Dashboard Stats');
      const [
        { count: totalProps, error: errProps },
        { count: totalContacts, error: errContacts },
        { count: totalPhotos },
        { count: totalFiles },
      ] = await Promise.all([
        this.supabase!.from('properties').select('*', { count: 'exact', head: true }).eq('is_archived', false),
        this.supabase!.from('property_contacts').select('*', { count: 'exact', head: true }),
        this.supabase!.from('property_photos').select('*', { count: 'exact', head: true }),
        this.supabase!.from('property_files').select('*', { count: 'exact', head: true }),
      ]);

      if (errProps) throw new Error(`[Supabase Production Error] ${errProps.message}`);

      const todayStr = new Date().toISOString().slice(0, 10);
      const { count: propsToday } = await this.supabase!.from('properties')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStr);

      return {
        totalProperties: totalProps || 0,
        totalPhotos: totalPhotos || 0,
        totalFiles: totalFiles || 0,
        propertiesAddedToday: propsToday || 0,
        totalContacts: totalContacts || 0,
        isSupabaseConnected: true,
        sourceOfTruth: 'SUPABASE_POSTGRESQL',
      };
    }

    const properties = this.memoryStore.properties.filter((p) => !p.is_archived);
    const totalProperties = properties.length;
    const totalPhotos = this.memoryStore.photos.length;
    const totalFiles = this.memoryStore.files.length;

    // Added Today
    const todayStr = new Date().toISOString().slice(0, 10);
    const propertiesAddedToday = properties.filter((p) => p.created_at.startsWith(todayStr)).length;

    return {
      totalProperties,
      totalPhotos,
      totalFiles,
      propertiesAddedToday,
      totalContacts: this.memoryStore.contacts.length,
      isSupabaseConnected: this.isSupabaseConnected,
      sourceOfTruth: 'LOCAL_DEVELOPMENT_STORE',
    };
  }

  // Query Properties with Search, Filter & Pagination
  async getProperties(params: {
    search?: string;
    category?: string;
    status?: string;
    location?: string;
    project?: string;
    bedroom?: number | string;
    bathroom?: number | string;
    page?: number;
    limit?: number;
    includeArchived?: boolean;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Number(params.limit) || 20);

    if (this.isProduction) {
      this.ensureProductionDatabaseReady('Fetch Properties');
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = this.supabase!.from('properties').select('*, property_contacts(*), property_photos(*), property_files(*)', { count: 'exact' });

      if (!params.includeArchived) {
        query = query.eq('is_archived', false);
      }
      if (params.category && params.category !== 'ALL') {
        query = query.ilike('category', params.category);
      }
      if (params.status && params.status !== 'ALL') {
        query = query.eq('status', params.status);
      }
      if (params.location && params.location !== 'ALL') {
        query = query.ilike('location', `%${params.location}%`);
      }
      if (params.project && params.project !== 'ALL') {
        query = query.ilike('project_name', `%${params.project}%`);
      }
      if (params.bedroom !== undefined && params.bedroom !== 'ALL') {
        const b = Number(params.bedroom);
        if (b >= 4) {
          query = query.gte('bedroom', 4);
        } else if (!isNaN(b)) {
          query = query.eq('bedroom', b);
        }
      }
      if (params.bathroom !== undefined && params.bathroom !== 'ALL') {
        const b = Number(params.bathroom);
        if (b >= 3) {
          query = query.gte('bathroom', 3);
        } else if (!isNaN(b)) {
          query = query.eq('bathroom', b);
        }
      }
      if (params.search) {
        const s = params.search.trim();
        query = query.or(`property_no.ilike.%${s}%,property_name.ilike.%${s}%,project_name.ilike.%${s}%,location.ilike.%${s}%`);
      }

      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, count, error } = await query;
      if (error) throw new Error(`[Supabase Production Error] ${error.message}`);

      const items = (data || []).map((p: any) => {
        const photos = p.property_photos || [];
        const coverPhoto = photos.find((ph: any) => ph.is_cover) || photos[0] || null;
        return {
          ...p,
          cover_photo_url: coverPhoto ? coverPhoto.public_url : null,
          photos_count: photos.length,
          files_count: (p.property_files || []).length,
          contacts: p.property_contacts || [],
        };
      });

      return {
        items,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit) || 1,
        },
      };
    }

    const search = (params.search || '').trim().toLowerCase();

    let list = this.memoryStore.properties.filter((p) => {
      if (!params.includeArchived && p.is_archived) return false;
      return true;
    });

    // 1. Search across Property No, Property Name, Project Name, Location, and Contacts Phone
    if (search) {
      list = list.filter((p) => {
        const matchesProp =
          p.property_no.toLowerCase().includes(search) ||
          (p.property_name || '').toLowerCase().includes(search) ||
          (p.project_name || '').toLowerCase().includes(search) ||
          (p.location || '').toLowerCase().includes(search);

        if (matchesProp) return true;

        // Check associated phone numbers
        const pContacts = this.memoryStore.contacts.filter((c) => c.property_id === p.id);
        const matchesPhone = pContacts.some((c) => c.phone.includes(search) || c.contact_name.toLowerCase().includes(search));
        return matchesPhone;
      });
    }

    // 2. Filters
    if (params.category && params.category !== 'ALL') {
      list = list.filter((p) => (p.category || '').toLowerCase() === params.category!.toLowerCase());
    }
    if (params.status && params.status !== 'ALL') {
      list = list.filter((p) => p.status.toLowerCase() === params.status!.toLowerCase());
    }
    if (params.location && params.location !== 'ALL') {
      list = list.filter((p) => (p.location || '').toLowerCase().includes(params.location!.toLowerCase()));
    }
    if (params.project && params.project !== 'ALL') {
      list = list.filter((p) => (p.project_name || '').toLowerCase().includes(params.project!.toLowerCase()));
    }
    if (params.bedroom !== undefined && params.bedroom !== 'ALL') {
      const b = Number(params.bedroom);
      if (b >= 4) {
        list = list.filter((p) => p.bedroom >= 4);
      } else if (!isNaN(b)) {
        list = list.filter((p) => p.bedroom === b);
      }
    }
    if (params.bathroom !== undefined && params.bathroom !== 'ALL') {
      const b = Number(params.bathroom);
      if (b >= 3) {
        list = list.filter((p) => p.bathroom >= 3);
      } else if (!isNaN(b)) {
        list = list.filter((p) => p.bathroom === b);
      }
    }

    // Sort by latest created first
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = list.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginated = list.slice(startIndex, startIndex + limit);

    // Attach cover photo & contacts count to each item
    const items = paginated.map((p) => {
      const photos = this.memoryStore.photos.filter((ph) => ph.property_id === p.id);
      const coverPhoto = photos.find((ph) => ph.is_cover) || photos[0] || null;
      const contacts = this.memoryStore.contacts.filter((c) => c.property_id === p.id);
      const files = this.memoryStore.files.filter((f) => f.property_id === p.id);

      return {
        ...p,
        cover_photo_url: coverPhoto ? coverPhoto.public_url : null,
        photos_count: photos.length,
        files_count: files.length,
        contacts,
      };
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  // Get Property Detail by ID or Property No
  async getPropertyById(idOrNo: string) {
    if (this.isProduction) {
      this.ensureProductionDatabaseReady('Fetch Property Details');
      const { data: property, error } = await this.supabase!
        .from('properties')
        .select('*')
        .or(`id.eq.${idOrNo},property_no.ilike.${idOrNo}`)
        .maybeSingle();

      if (error) throw new Error(`[Supabase Production Error] ${error.message}`);
      if (!property) return null;

      const [
        { data: contacts },
        { data: photos },
        { data: files },
        { data: updateLogs },
      ] = await Promise.all([
        this.supabase!.from('property_contacts').select('*').eq('property_id', property.id),
        this.supabase!.from('property_photos').select('*').eq('property_id', property.id).order('sort_order', { ascending: true }),
        this.supabase!.from('property_files').select('*').eq('property_id', property.id),
        this.supabase!.from('property_update_logs').select('*').eq('property_id', property.id).order('created_at', { ascending: false }),
      ]);

      return {
        property,
        contacts: contacts || [],
        photos: photos || [],
        files: files || [],
        updateLogs: updateLogs || [],
      };
    }

    const property = this.memoryStore.properties.find(
      (p) => p.id === idOrNo || p.property_no.toUpperCase() === idOrNo.toUpperCase()
    );

    if (!property) return null;

    const contacts = this.memoryStore.contacts.filter((c) => c.property_id === property.id);
    const photos = this.memoryStore.photos
      .filter((ph) => ph.property_id === property.id)
      .sort((a, b) => a.sort_order - b.sort_order);
    const files = this.memoryStore.files.filter((f) => f.property_id === property.id);
    const updateLogs = this.memoryStore.updateLogs
      .filter((l) => l.property_id === property.id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      property,
      contacts,
      photos,
      files,
      updateLogs,
    };
  }

  // Create Property
  async createProperty(
    data: {
      property_no: string;
      property_name?: string;
      category?: string;
      property_type?: string;
      status?: 'Available' | 'Rented' | 'Sold' | 'Pending' | 'Inactive';
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
      additional_data?: Record<string, any>;
      contacts?: Array<{
        contact_name?: string;
        contact_type?: 'Owner' | 'Agent' | 'Co-Agent' | 'Juristic' | 'Cleaning' | 'Other';
        phone: string;
        email?: string;
      }>;
    },
    user = 'Admin',
    autoSave = true
  ): Promise<PropertyRecord> {
    const cleanNo = (data.property_no || '').trim().toUpperCase();
    if (!cleanNo) {
      throw new Error('Property No is required');
    }

    // Check Unique Constraint
    const existing = this.memoryStore.properties.find((p) => p.property_no === cleanNo);
    if (existing) {
      throw new Error(`Property No '${cleanNo}' already exists in database`);
    }

    const newId = `prop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const record: PropertyRecord = {
      id: newId,
      property_no: cleanNo,
      property_name: data.property_name?.trim() || cleanNo,
      category: data.category?.trim() || 'Condominium',
      property_type: data.property_type?.trim() || 'Residential',
      status: data.status || 'Available',
      project_name: data.project_name?.trim() || '',
      location: data.location?.trim() || '',
      zone: data.zone?.trim() || '',
      bedroom: Number(data.bedroom) || 0,
      bathroom: Number(data.bathroom) || 0,
      land_area: Number(data.land_area) || 0,
      building_area: Number(data.building_area) || 0,
      floor: String(data.floor || ''),
      year_built: String(data.year_built || ''),
      furniture: data.furniture?.trim() || '',
      pool: data.pool?.trim() || '',
      parking: data.parking?.trim() || '',
      description: data.description?.trim() || '',
      rent_price: Number(data.rent_price) || 0,
      sale_price: Number(data.sale_price) || 0,
      additional_data: data.additional_data || {},
      is_archived: false,
      created_at: now,
      updated_at: now,
    };

    this.memoryStore.properties.unshift(record);

    // Add initial contacts if provided
    if (data.contacts && Array.isArray(data.contacts)) {
      for (const c of data.contacts) {
        if (c.phone && c.phone.trim()) {
          this.memoryStore.contacts.push({
            id: `cnt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            property_id: newId,
            contact_name: c.contact_name?.trim() || 'Owner',
            contact_type: c.contact_type || 'Owner',
            phone: c.phone.trim(),
            email: c.email?.trim() || '',
            created_at: now,
            updated_at: now,
          });
        }
      }
    }

    // Log History
    this.memoryStore.updateLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_id: newId,
      action: 'Created',
      changed_field: 'All',
      new_value: `Created property ${cleanNo}`,
      user_name: user,
      created_at: now,
    });

    if (autoSave) {
      this.saveStore();

      // Mirror to Supabase if connected
      if (this.supabase) {
        (async () => {
          try {
            await this.supabase!.from('properties').insert([record]);
          } catch (err) {
            console.error('[Supabase Mirror] Error inserting property:', err);
          }
        })();
      }
    }

    return record;
  }

  // Update Property and Record Field-by-Field History
  async updateProperty(
    id: string,
    updates: Partial<PropertyRecord>,
    user = 'Admin',
    autoSave = true
  ): Promise<PropertyRecord> {
    const prop = this.memoryStore.properties.find((p) => p.id === id);
    if (!prop) {
      throw new Error(`Property with id '${id}' not found`);
    }

    const now = new Date().toISOString();
    const trackableFields: (keyof PropertyRecord)[] = [
      'property_name',
      'category',
      'property_type',
      'status',
      'project_name',
      'location',
      'zone',
      'bedroom',
      'bathroom',
      'land_area',
      'building_area',
      'floor',
      'year_built',
      'furniture',
      'pool',
      'parking',
      'description',
      'rent_price',
      'sale_price',
    ];

    for (const key of trackableFields) {
      if (updates[key] !== undefined && String(updates[key]) !== String(prop[key])) {
        this.memoryStore.updateLogs.unshift({
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          property_id: id,
          action: 'Updated',
          changed_field: key,
          old_value: String(prop[key] ?? ''),
          new_value: String(updates[key] ?? ''),
          user_name: user,
          created_at: now,
        });
      }
    }

    // If property_no is updated, check unique
    if (updates.property_no && updates.property_no.toUpperCase() !== prop.property_no) {
      const cleanNew = updates.property_no.trim().toUpperCase();
      const duplicate = this.memoryStore.properties.find((p) => p.id !== id && p.property_no === cleanNew);
      if (duplicate) {
        throw new Error(`Property No '${cleanNew}' is already taken by another property`);
      }
      prop.property_no = cleanNew;
    }

    Object.assign(prop, updates, { updated_at: now });

    if (autoSave) {
      this.saveStore();

      if (this.supabase) {
        (async () => {
          try {
            await this.supabase!.from('properties').update(prop).eq('id', id);
          } catch (err) {
            console.error('[Supabase Mirror] Error updating property:', err);
          }
        })();
      }
    }

    return prop;
  }

  // Archive Property (Soft Delete)
  async archiveProperty(id: string, user = 'Admin'): Promise<PropertyRecord> {
    const prop = await this.updateProperty(id, { is_archived: true, status: 'Inactive' }, user);
    this.memoryStore.updateLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_id: id,
      action: 'Archived',
      changed_field: 'is_archived',
      old_value: 'false',
      new_value: 'true',
      user_name: user,
      created_at: new Date().toISOString(),
    });
    this.saveStore();
    return prop;
  }

  // Restore Property from Archive
  async restoreProperty(id: string, user = 'Admin'): Promise<PropertyRecord> {
    const prop = await this.updateProperty(id, { is_archived: false, status: 'Available' }, user);
    this.memoryStore.updateLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_id: id,
      action: 'Restored',
      changed_field: 'is_archived',
      old_value: 'true',
      new_value: 'false',
      user_name: user,
      created_at: new Date().toISOString(),
    });
    this.saveStore();
    return prop;
  }

  // Hard Delete (Permanent)
  async deletePropertyPermanently(id: string, user = 'Super Admin') {
    const index = this.memoryStore.properties.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error(`Property with id '${id}' not found`);
    }

    const removed = this.memoryStore.properties.splice(index, 1)[0];

    // Remove cascading data
    this.memoryStore.contacts = this.memoryStore.contacts.filter((c) => c.property_id !== id);
    this.memoryStore.photos = this.memoryStore.photos.filter((ph) => ph.property_id !== id);
    this.memoryStore.files = this.memoryStore.files.filter((f) => f.property_id !== id);
    this.memoryStore.updateLogs = this.memoryStore.updateLogs.filter((l) => l.property_id !== id);

    this.saveStore();

    if (this.supabase) {
      (async () => {
        try {
          await this.supabase!.from('properties').delete().eq('id', id);
        } catch (err) {
          console.error('[Supabase Mirror] Error deleting property:', err);
        }
      })();
    }

    return removed;
  }

  // Add Contact to Property
  async addContact(
    propertyId: string,
    data: {
      contact_name: string;
      contact_type?: 'Owner' | 'Agent' | 'Co-Agent' | 'Juristic' | 'Cleaning' | 'Other';
      phone: string;
      email?: string;
      note?: string;
    },
    user = 'Admin',
    autoSave = true
  ) {
    const prop = this.memoryStore.properties.find((p) => p.id === propertyId);
    if (!prop) {
      throw new Error('Property not found');
    }
    if (!data.phone || !data.phone.trim()) {
      throw new Error('Phone number is required');
    }

    const now = new Date().toISOString();
    const contact: PropertyContactRecord = {
      id: `cnt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_id: propertyId,
      contact_name: data.contact_name?.trim() || 'Contact',
      contact_type: data.contact_type || 'Owner',
      phone: data.phone.trim(),
      email: data.email?.trim() || '',
      note: data.note?.trim() || '',
      created_at: now,
      updated_at: now,
    };

    this.memoryStore.contacts.push(contact);

    this.memoryStore.updateLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_id: propertyId,
      action: 'Contact Added',
      changed_field: 'contact',
      new_value: `${contact.contact_type}: ${contact.contact_name} (${contact.phone})`,
      user_name: user,
      created_at: now,
    });

    if (autoSave) {
      this.saveStore();
    }
    return contact;
  }

  // Update Contact
  async updateContact(
    contactId: string,
    data: {
      contact_name?: string;
      contact_type?: 'Owner' | 'Agent' | 'Co-Agent' | 'Juristic' | 'Cleaning' | 'Other';
      phone?: string;
      email?: string;
      note?: string;
    },
    user = 'Admin'
  ) {
    const contact = this.memoryStore.contacts.find((c) => c.id === contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }

    const oldInfo = `${contact.contact_name} (${contact.phone})`;
    if (data.contact_name !== undefined) contact.contact_name = data.contact_name.trim();
    if (data.contact_type !== undefined) contact.contact_type = data.contact_type;
    if (data.phone !== undefined) contact.phone = data.phone.trim();
    if (data.email !== undefined) contact.email = data.email.trim();
    if (data.note !== undefined) contact.note = data.note.trim();
    contact.updated_at = new Date().toISOString();

    this.memoryStore.updateLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_id: contact.property_id,
      action: 'Contact Updated',
      changed_field: 'contact',
      old_value: oldInfo,
      new_value: `${contact.contact_name} (${contact.phone})`,
      user_name: user,
      created_at: new Date().toISOString(),
    });

    this.saveStore();

    if (this.supabase) {
      (async () => {
        try {
          await this.supabase!.from('property_contacts').update(contact).eq('id', contactId);
        } catch (err) {
          console.error('[Supabase Mirror] Error updating contact:', err);
        }
      })();
    }

    return contact;
  }

  // Delete Contact
  async deleteContact(contactId: string, user = 'Admin') {
    const idx = this.memoryStore.contacts.findIndex((c) => c.id === contactId);
    if (idx === -1) {
      throw new Error('Contact not found');
    }
    const removed = this.memoryStore.contacts.splice(idx, 1)[0];

    this.memoryStore.updateLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_id: removed.property_id,
      action: 'Contact Removed',
      changed_field: 'contact',
      old_value: `${removed.contact_name} (${removed.phone})`,
      user_name: user,
      created_at: new Date().toISOString(),
    });

    this.saveStore();

    if (this.supabase) {
      (async () => {
        try {
          await this.supabase!.from('property_contacts').delete().eq('id', contactId);
        } catch (err) {
          console.error('[Supabase Mirror] Error deleting contact:', err);
        }
      })();
    }

    return removed;
  }

  // Get Photo Record with File Path
  getPhotoById(photoId: string): { photo: PropertyPhotoRecord; localPath: string } | null {
    const photo = this.memoryStore.photos.find((p) => p.id === photoId);
    if (!photo) return null;
    const prop = this.memoryStore.properties.find((p) => p.id === photo.property_id);
    const propNo = prop ? prop.property_no : 'default';
    const fileName = path.basename(photo.public_url);
    const localPath = path.join(this.uploadDir, propNo, 'photos', fileName);
    return { photo, localPath };
  }

  // Get Document / File Record with File Path
  getFileById(fileId: string): { file: PropertyFileRecord; localPath: string } | null {
    const doc = this.memoryStore.files.find((f) => f.id === fileId);
    if (!doc) return null;
    const prop = this.memoryStore.properties.find((p) => p.id === doc.property_id);
    const propNo = prop ? prop.property_no : 'default';
    const fileName = path.basename(doc.public_url);
    const localPath = path.join(this.uploadDir, propNo, 'documents', fileName);
    return { file: doc, localPath };
  }

  // Upload Photo to Storage and Register in Database
  async savePhoto(
    propertyId: string,
    file: {
      originalName: string;
      buffer: Buffer;
      mimeType: string;
      size: number;
    },
    isCover = false,
    user = 'Admin'
  ) {
    const prop = this.memoryStore.properties.find((p) => p.id === propertyId);
    if (!prop) throw new Error('Property not found');

    const cleanPropNo = prop.property_no;
    const extension = path.extname(file.originalName) || '.jpg';
    const timestamp = Date.now();
    const safeFileName = `${timestamp}-${Math.random().toString(36).substring(2, 6)}${extension}`;
    const storagePath = `${this.storageBucket}/${cleanPropNo}/photos/${safeFileName}`;

    // 1. Save to local public storage directory so it's always accessible
    const propPhotoDir = path.join(this.uploadDir, cleanPropNo, 'photos');
    if (!fs.existsSync(propPhotoDir)) {
      fs.mkdirSync(propPhotoDir, { recursive: true });
    }
    const localFilePath = path.join(propPhotoDir, safeFileName);
    fs.writeFileSync(localFilePath, file.buffer);
    const publicUrl = `/uploads/${cleanPropNo}/photos/${safeFileName}`;

    // 2. Upload to Supabase Storage if configured
    if (this.supabase) {
      try {
        const { error } = await this.supabase.storage
          .from(this.storageBucket)
          .upload(`${cleanPropNo}/photos/${safeFileName}`, file.buffer, {
            contentType: file.mimeType,
            upsert: true,
          });
        if (error) {
          console.warn('[Supabase Storage] Upload warning:', error.message);
        }
      } catch (err) {
        console.warn('[Supabase Storage] Upload exception:', err);
      }
    }

    // Determine sort_order
    const existingPhotos = this.memoryStore.photos.filter((ph) => ph.property_id === propertyId);
    const nextOrder = existingPhotos.length + 1;

    // If marked as cover, unmark others
    if (isCover || existingPhotos.length === 0) {
      existingPhotos.forEach((ph) => {
        ph.is_cover = false;
      });
      isCover = true;
    }

    const photoRecord: PropertyPhotoRecord = {
      id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_id: propertyId,
      storage_path: storagePath,
      file_name: file.originalName,
      public_url: publicUrl,
      sort_order: nextOrder,
      is_cover: isCover,
      file_size: file.size,
      mime_type: file.mimeType,
      created_at: new Date().toISOString(),
    };

    this.memoryStore.photos.push(photoRecord);

    this.memoryStore.updateLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_id: propertyId,
      action: 'Photo Uploaded',
      changed_field: 'photos',
      new_value: file.originalName,
      user_name: user,
      created_at: new Date().toISOString(),
    });

    this.saveStore();
    return photoRecord;
  }

  // Set Cover Photo
  async setCoverPhoto(propertyId: string, photoId: string, user = 'Admin') {
    const photos = this.memoryStore.photos.filter((ph) => ph.property_id === propertyId);
    let targetFound = false;

    for (const ph of photos) {
      if (ph.id === photoId) {
        ph.is_cover = true;
        targetFound = true;
      } else {
        ph.is_cover = false;
      }
    }

    if (!targetFound) throw new Error('Photo not found');

    this.memoryStore.updateLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_id: propertyId,
      action: 'Cover Photo Set',
      changed_field: 'is_cover',
      new_value: photoId,
      user_name: user,
      created_at: new Date().toISOString(),
    });

    this.saveStore();
    return true;
  }

  // Reorder Photos
  async reorderPhotos(propertyId: string, photoIds: string[], user = 'Admin') {
    photoIds.forEach((id, index) => {
      const ph = this.memoryStore.photos.find((p) => p.id === id && p.property_id === propertyId);
      if (ph) {
        ph.sort_order = index + 1;
      }
    });

    this.memoryStore.updateLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_id: propertyId,
      action: 'Photos Reordered',
      changed_field: 'sort_order',
      user_name: user,
      created_at: new Date().toISOString(),
    });

    this.saveStore();
    return true;
  }

  // Delete Photo
  async deletePhoto(photoId: string, user = 'Admin') {
    const idx = this.memoryStore.photos.findIndex((ph) => ph.id === photoId);
    if (idx === -1) throw new Error('Photo not found');

    const removed = this.memoryStore.photos.splice(idx, 1)[0];

    // If deleted was cover, designate another photo as cover
    const remaining = this.memoryStore.photos.filter((ph) => ph.property_id === removed.property_id);
    if (removed.is_cover && remaining.length > 0) {
      remaining[0].is_cover = true;
    }

    this.memoryStore.updateLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_id: removed.property_id,
      action: 'Photo Deleted',
      changed_field: 'photos',
      old_value: removed.file_name,
      user_name: user,
      created_at: new Date().toISOString(),
    });

    this.saveStore();
    return removed;
  }

  // Upload Document / File
  async saveFile(
    propertyId: string,
    file: {
      originalName: string;
      buffer: Buffer;
      mimeType: string;
      size: number;
    },
    user = 'Admin'
  ) {
    const prop = this.memoryStore.properties.find((p) => p.id === propertyId);
    if (!prop) throw new Error('Property not found');

    const cleanPropNo = prop.property_no;
    const extension = path.extname(file.originalName);
    const safeFileName = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}${extension}`;
    const storagePath = `${this.storageBucket}/${cleanPropNo}/documents/${safeFileName}`;

    const propDocDir = path.join(this.uploadDir, cleanPropNo, 'documents');
    if (!fs.existsSync(propDocDir)) {
      fs.mkdirSync(propDocDir, { recursive: true });
    }
    const localFilePath = path.join(propDocDir, safeFileName);
    fs.writeFileSync(localFilePath, file.buffer);
    const publicUrl = `/uploads/${cleanPropNo}/documents/${safeFileName}`;

    if (this.supabase) {
      try {
        await this.supabase.storage
          .from(this.storageBucket)
          .upload(`${cleanPropNo}/documents/${safeFileName}`, file.buffer, {
            contentType: file.mimeType,
            upsert: true,
          });
      } catch (err) {
        console.warn('[Supabase Storage] File upload warning:', err);
      }
    }

    const fileRecord: PropertyFileRecord = {
      id: `file-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_id: propertyId,
      storage_path: storagePath,
      file_name: file.originalName,
      public_url: publicUrl,
      file_size: file.size,
      mime_type: file.mimeType,
      created_at: new Date().toISOString(),
    };

    this.memoryStore.files.push(fileRecord);

    this.memoryStore.updateLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_id: propertyId,
      action: 'File Uploaded',
      changed_field: 'files',
      new_value: file.originalName,
      user_name: user,
      created_at: new Date().toISOString(),
    });

    this.saveStore();
    return fileRecord;
  }

  // Delete Document / File
  async deleteFile(fileId: string, user = 'Admin') {
    const idx = this.memoryStore.files.findIndex((f) => f.id === fileId);
    if (idx === -1) throw new Error('File not found');

    const removed = this.memoryStore.files.splice(idx, 1)[0];

    this.memoryStore.updateLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_id: removed.property_id,
      action: 'File Deleted',
      changed_field: 'files',
      old_value: removed.file_name,
      user_name: user,
      created_at: new Date().toISOString(),
    });

    this.saveStore();
    return removed;
  }

  // Batch Excel Import Engine
  async importExcelBatch(
    items: Array<{
      property_no: string;
      property_name?: string;
      category?: string;
      property_type?: string;
      status?: 'Available' | 'Rented' | 'Sold' | 'Pending' | 'Inactive';
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
      phone?: string;
      contact_name?: string;
      additional_data?: Record<string, any>;
    }>,
    duplicateStrategy: 'UPDATE' | 'SKIP' | 'CREATE' = 'UPDATE',
    user = 'Admin'
  ) {
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const failed: Array<{ property_no: string; error: string }> = [];

    for (const item of items) {
      try {
        const cleanNo = (item.property_no || '').trim().toUpperCase();
        if (!cleanNo) {
          failed.push({ property_no: 'UNKNOWN', error: 'Missing or empty Property No' });
          continue;
        }

        const existing = this.memoryStore.properties.find((p) => p.property_no === cleanNo);

        if (existing) {
          if (duplicateStrategy === 'SKIP') {
            skipped++;
            continue;
          } else if (duplicateStrategy === 'UPDATE') {
            await this.updateProperty(
              existing.id,
              {
                property_name: item.property_name || existing.property_name,
                category: item.category || existing.category,
                property_type: item.property_type || existing.property_type,
                status: item.status || existing.status,
                project_name: item.project_name || existing.project_name,
                location: item.location || existing.location,
                zone: item.zone || existing.zone,
                bedroom: item.bedroom !== undefined ? item.bedroom : existing.bedroom,
                bathroom: item.bathroom !== undefined ? item.bathroom : existing.bathroom,
                land_area: item.land_area !== undefined ? item.land_area : existing.land_area,
                building_area: item.building_area !== undefined ? item.building_area : existing.building_area,
                floor: item.floor || existing.floor,
                year_built: item.year_built || existing.year_built,
                furniture: item.furniture || existing.furniture,
                pool: item.pool || existing.pool,
                parking: item.parking || existing.parking,
                description: item.description || existing.description,
                rent_price: item.rent_price !== undefined ? item.rent_price : existing.rent_price,
                sale_price: item.sale_price !== undefined ? item.sale_price : existing.sale_price,
                additional_data: { ...existing.additional_data, ...item.additional_data },
              },
              user,
              false // autoSave = false for batch performance
            );

            // Add phone if provided and not already present
            if (item.phone) {
              const hasPhone = this.memoryStore.contacts.some(
                (c) => c.property_id === existing.id && c.phone === item.phone
              );
              if (!hasPhone) {
                await this.addContact(
                  existing.id,
                  {
                    contact_name: item.contact_name || 'Owner',
                    contact_type: 'Owner',
                    phone: item.phone,
                  },
                  user,
                  false // autoSave = false for batch performance
                );
              }
            }
            updated++;
          }
        } else {
          // Create new record
          const contacts = [];
          if (item.phone && item.phone.trim()) {
            contacts.push({
              contact_name: item.contact_name || 'Owner',
              contact_type: 'Owner' as const,
              phone: item.phone.trim(),
            });
          }

          await this.createProperty(
            {
              property_no: cleanNo,
              property_name: item.property_name || cleanNo,
              category: item.category || 'Condominium',
              property_type: item.property_type || 'Residential',
              status: item.status || 'Available',
              project_name: item.project_name || '',
              location: item.location || '',
              zone: item.zone || '',
              bedroom: item.bedroom || 0,
              bathroom: item.bathroom || 0,
              land_area: item.land_area || 0,
              building_area: item.building_area || 0,
              floor: item.floor || '',
              year_built: item.year_built || '',
              furniture: item.furniture || '',
              pool: item.pool || '',
              parking: item.parking || '',
              description: item.description || '',
              rent_price: item.rent_price || 0,
              sale_price: item.sale_price || 0,
              additional_data: item.additional_data || {},
              contacts,
            },
            user,
            false // autoSave = false for batch performance
          );
          imported++;
        }
      } catch (err: any) {
        failed.push({
          property_no: item.property_no || 'UNKNOWN',
          error: err.message || 'Unknown import error',
        });
      }
    }

    // Single atomic save at the end of the batch
    this.saveStore();

    return {
      total: items.length,
      imported,
      updated,
      skipped,
      failedCount: failed.length,
      failed,
    };
  }

  // Find matching property for a filename based on strict prefix matching rules
  findPropertyForFilename(filename: string): PropertyRecord | null {
    const baseName = path.parse(filename).name.trim();
    if (!baseName) return null;

    // Sort properties by property_no length descending so longer exact prefixes match first
    const activeProps = [...this.memoryStore.properties]
      .filter((p) => !p.is_archived)
      .sort((a, b) => b.property_no.length - a.property_no.length);

    for (const prop of activeProps) {
      const pNo = prop.property_no.trim();
      if (!pNo) continue;
      const escaped = pNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Must match at the start: ^pNo followed by end of baseName OR delimiter (_, -, space, dot, parenthesis, bracket)
      // Must NOT be followed by a letter or digit (which would mean a different property code like VN5680 vs VN568)
      const pattern = new RegExp(`^${escaped}(?:[_\\-\\s\\.\\(\\[].*|$)`, 'i');
      if (pattern.test(baseName)) {
        return prop;
      }
    }
    return null;
  }

  // Bulk upload files with automatic Property No matching from file name
  async bulkUploadAutoMatchedFiles(
    files: Array<{
      originalName: string;
      buffer: Buffer;
      mimeType: string;
      size: number;
    }>,
    user = 'Admin'
  ) {
    const matched: Array<{
      originalName: string;
      property_id: string;
      property_no: string;
      property_name: string;
      file_type: 'photo' | 'document';
      recordId: string;
      publicUrl: string;
      size: number;
    }> = [];

    const unmatched: Array<{
      originalName: string;
      reason: string;
      size: number;
    }> = [];

    const errors: Array<{
      originalName: string;
      error: string;
    }> = [];

    for (const file of files) {
      const matchedProp = this.findPropertyForFilename(file.originalName);

      if (!matchedProp) {
        // As strictly required: unmatched files MUST NOT be assigned to another property or uploaded randomly
        unmatched.push({
          originalName: file.originalName,
          reason: 'Property not found',
          size: file.size,
        });
        continue;
      }

      try {
        const ext = path.extname(file.originalName).toLowerCase();
        const isPhoto =
          file.mimeType.startsWith('image/') ||
          ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext);

        if (isPhoto) {
          const photoRecord = await this.savePhoto(
            matchedProp.id,
            file,
            false,
            user
          );
          matched.push({
            originalName: file.originalName,
            property_id: matchedProp.id,
            property_no: matchedProp.property_no,
            property_name: matchedProp.property_name,
            file_type: 'photo',
            recordId: photoRecord.id,
            publicUrl: photoRecord.public_url,
            size: file.size,
          });
        } else {
          const fileRecord = await this.saveFile(
            matchedProp.id,
            file,
            user
          );
          matched.push({
            originalName: file.originalName,
            property_id: matchedProp.id,
            property_no: matchedProp.property_no,
            property_name: matchedProp.property_name,
            file_type: 'document',
            recordId: fileRecord.id,
            publicUrl: fileRecord.public_url,
            size: file.size,
          });
        }
      } catch (err: any) {
        errors.push({
          originalName: file.originalName,
          error: err.message || 'Upload failed',
        });
      }
    }

    return {
      totalFiles: files.length,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      uploadedCount: matched.length,
      matched,
      unmatched,
      errors,
    };
  }

  // ==============================================================================
  // MULTI-EXCEL MERGE & IMPORT ENGINE
  // ==============================================================================

  // Preview properties and detect conflicts before merging
  previewMergeProperties(items: Array<{
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
    additional_data?: Record<string, any>;
    contacts?: Array<{
      contact_name?: string;
      contact_type?: 'Owner' | 'Agent' | 'Co-Agent' | 'Juristic' | 'Cleaning' | 'Other';
      phone: string;
      email?: string;
      source?: { fileName: string; sheetName?: string; rowNumber?: number };
    }>;
    photo_names?: string[];
    file_names?: string[];
    sources?: Array<{
      fileName: string;
      sheetName?: string;
      rowNumber?: number;
      fieldsProvided?: string[];
    }>;
    filesFound?: string[];
    fieldTraces?: Record<string, any[]>;
  }>) {
    const compareFields: (keyof PropertyRecord)[] = [
      'property_name',
      'category',
      'property_type',
      'status',
      'project_name',
      'location',
      'zone',
      'bedroom',
      'bathroom',
      'land_area',
      'building_area',
      'floor',
      'year_built',
      'furniture',
      'pool',
      'parking',
      'description',
      'rent_price',
      'sale_price',
    ];

    let totalNew = 0;
    let totalExisting = 0;
    let totalConflicts = 0;

    const previewList = items.map((item) => {
      const cleanNo = (item.property_no || '').trim().toUpperCase();
      const existing = this.memoryStore.properties.find((p) => p.property_no === cleanNo);
      const isExisting = !!existing;

      if (isExisting) {
        totalExisting++;
      } else {
        totalNew++;
      }

      const existingContacts = existing
        ? this.memoryStore.contacts.filter((c) => c.property_id === existing.id)
        : [];

      // Detect conflicts and incoming fields
      const conflicts: Array<{
        field: string;
        label: string;
        dbValue: any;
        excelValue: any;
        excelSource?: any;
      }> = [];

      let newFieldsCount = 0;

      if (existing) {
        for (const field of compareFields) {
          const excelVal = (item as any)[field];
          const dbVal = existing[field];

          const hasExcelVal =
            excelVal !== undefined &&
            excelVal !== null &&
            excelVal !== '' &&
            excelVal !== 0;

          const hasDbVal =
            dbVal !== undefined &&
            dbVal !== null &&
            dbVal !== '' &&
            dbVal !== 0;

          if (hasExcelVal && !hasDbVal) {
            newFieldsCount++;
          } else if (hasExcelVal && hasDbVal) {
            // Compare values
            const strDb = String(dbVal).trim().toLowerCase();
            const strExcel = String(excelVal).trim().toLowerCase();
            if (strDb !== strExcel) {
              conflicts.push({
                field: String(field),
                label: this.getFieldLabel(String(field)),
                dbValue: dbVal,
                excelValue: excelVal,
                excelSource: item.fieldTraces?.[field]?.[0]?.source,
              });
              totalConflicts++;
            }
          }
        }
      } else {
        // All non-empty fields in item are new fields
        for (const field of compareFields) {
          const excelVal = (item as any)[field];
          if (
            excelVal !== undefined &&
            excelVal !== null &&
            excelVal !== '' &&
            excelVal !== 0
          ) {
            newFieldsCount++;
          }
        }
      }

      // Detect new contacts
      const incomingContacts = item.contacts || [];
      const newContactsCount = incomingContacts.filter((inc) => {
        const cleanIncPhone = (inc.phone || '').replace(/[^0-9+]/g, '');
        return !existingContacts.some(
          (ex) => (ex.phone || '').replace(/[^0-9+]/g, '') === cleanIncPhone
        );
      }).length;

      return {
        property_no: cleanNo,
        filesFound: item.filesFound || item.sources?.map((s) => s.fileName) || [],
        isExisting,
        existingId: existing?.id || null,
        existingData: existing || null,
        incomingData: item,
        conflicts,
        hasConflicts: conflicts.length > 0,
        newFieldsCount,
        newContactsCount,
        sources: item.sources || [],
        fieldTraces: item.fieldTraces || {},
      };
    });

    return {
      total: items.length,
      newPropertiesCount: totalNew,
      existingPropertiesCount: totalExisting,
      totalConflicts,
      preview: previewList,
    };
  }

  // ==============================================================================
  // HIGH-RELIABILITY MULTI-EXCEL BATCH IMPORT ARCHITECTURE
  // ==============================================================================

  // 1. Create a new Import Batch
  async createImportBatch(data: {
    batch_name?: string;
    total_files: number;
    total_rows: number;
    file_names?: string[];
    user?: string;
  }): Promise<ImportBatchRecord> {
    this.ensureProductionDatabaseReady('Create Import Batch');

    const now = new Date().toISOString();
    const datePart = now.slice(0, 10).replace(/-/g, '');
    const batchId = `batch-${datePart}-${Math.random().toString(36).substring(2, 7)}`;
    const user = data.user || 'Admin';

    const record: ImportBatchRecord = {
      id: batchId,
      batch_name: data.batch_name || `Import Batch ${batchId}`,
      status: 'processing',
      total_files: data.total_files || 0,
      total_rows: data.total_rows || 0,
      processed_rows: 0,
      new_properties: 0,
      updated_properties: 0,
      contacts_added: 0,
      conflicts: 0,
      errors: 0,
      created_at: now,
      updated_at: now,
      files: data.file_names || [],
      total_properties: data.total_rows || 0,
      created_by: user,
    };

    if (this.isProduction) {
      const { error } = await this.supabase!.from('import_batches').insert([
        {
          id: record.id,
          batch_name: record.batch_name,
          status: record.status,
          total_files: record.total_files,
          total_rows: record.total_rows,
          processed_rows: record.processed_rows,
          new_properties: record.new_properties,
          updated_properties: record.updated_properties,
          contacts_added: record.contacts_added,
          conflicts: record.conflicts,
          errors: record.errors,
          created_at: record.created_at,
          updated_at: record.updated_at,
        },
      ]);
      if (error) {
        throw new Error(`[Supabase Production Error] Failed to create import batch: ${error.message}`);
      }
      return record;
    }

    this.memoryStore.importBatches.unshift(record);
    this.saveStore();

    if (this.supabase) {
      (async () => {
        try {
          await this.supabase!.from('import_batches').insert([
            {
              id: record.id,
              batch_name: record.batch_name,
              status: record.status,
              total_files: record.total_files,
              total_rows: record.total_rows,
              processed_rows: record.processed_rows,
              new_properties: record.new_properties,
              updated_properties: record.updated_properties,
              contacts_added: record.contacts_added,
              conflicts: record.conflicts,
              errors: record.errors,
              created_at: record.created_at,
              updated_at: record.updated_at,
            },
          ]);
        } catch (err) {
          console.warn('[Supabase Sync] Note: import_batches table sync in dev:', err);
        }
      })();
    }

    return record;
  }

  // 2. Process an Import Chunk (Processes 50-500 rows per request, atomic in-memory update & single disk write)
  async processImportChunk(
    batchId: string,
    payload: {
      chunkIndex: number;
      totalChunks?: number;
      items: any[];
      conflictDecisions?: Record<string, Record<string, 'keep_existing' | 'use_excel' | 'skip'>>;
      defaultStrategy?: 'keep_existing' | 'use_excel' | 'skip';
      user?: string;
    }
  ) {
    this.ensureProductionDatabaseReady('Process Import Chunk');

    let batch = this.memoryStore.importBatches.find((b) => b.id === batchId);
    if (!batch && this.isProduction) {
      const { data: dbBatch, error: bErr } = await this.supabase!
        .from('import_batches')
        .select('*')
        .eq('id', batchId)
        .maybeSingle();
      if (bErr || !dbBatch) {
        throw new Error(`Import batch "${batchId}" not found in Supabase: ${bErr?.message || 'Not found'}`);
      }
      batch = dbBatch as ImportBatchRecord;
    }

    if (!batch) {
      throw new Error(`Import batch "${batchId}" not found`);
    }

    const now = new Date().toISOString();
    const user = payload.user || batch.created_by || 'Admin';
    const fieldKeys: (keyof PropertyRecord)[] = [
      'property_name',
      'category',
      'property_type',
      'status',
      'project_name',
      'location',
      'zone',
      'bedroom',
      'bathroom',
      'land_area',
      'building_area',
      'floor',
      'year_built',
      'furniture',
      'pool',
      'parking',
      'description',
      'rent_price',
      'sale_price',
    ];

    let chunkNew = 0;
    let chunkUpdated = 0;
    let chunkContacts = 0;
    let chunkConflicts = 0;
    const chunkErrors: Array<{ property_no: string; error: string; row?: number; file?: string }> = [];
    const detectedConflicts: Array<any> = [];

    const newSupabaseProperties: PropertyRecord[] = [];
    const newSupabaseContacts: PropertyContactRecord[] = [];
    const updatedSupabaseProperties: Array<{ id: string; updates: Partial<PropertyRecord> }> = [];

    // In Production: prefetch existing properties and their contacts from Supabase
    let existingSupabaseProps: PropertyRecord[] = [];
    let existingSupabaseContacts: PropertyContactRecord[] = [];

    if (this.isProduction && payload.items.length > 0) {
      const propNos = payload.items.map((it) => String(it.property_no || '').trim().toUpperCase()).filter(Boolean);
      if (propNos.length > 0) {
        const { data: dbProps, error: queryErr } = await this.supabase!
          .from('properties')
          .select('*')
          .in('property_no', propNos);
        if (queryErr) throw new Error(`[Supabase Production Error] Failed to query existing properties: ${queryErr.message}`);
        existingSupabaseProps = (dbProps || []) as PropertyRecord[];

        const pIds = existingSupabaseProps.map((p) => p.id);
        if (pIds.length > 0) {
          const { data: dbContacts, error: cErr } = await this.supabase!
            .from('property_contacts')
            .select('*')
            .in('property_id', pIds);
          if (cErr) throw new Error(`[Supabase Production Error] Failed to query existing contacts: ${cErr.message}`);
          existingSupabaseContacts = (dbContacts || []) as PropertyContactRecord[];
        }
      }
    }

    for (let i = 0; i < payload.items.length; i++) {
      const item = payload.items[i];
      const sourceFile = item.sources?.[0]?.fileName || 'excel';
      const sourceSheet = item.sources?.[0]?.sheetName || '';
      const sourceRow = item.sources?.[0]?.rowNumber || (payload.chunkIndex * 100 + i + 1);

      try {
        const cleanNo = (item.property_no || '').trim().toUpperCase();
        if (!cleanNo) {
          chunkErrors.push({
            property_no: 'EMPTY',
            error: 'Property No is missing or empty',
            file: sourceFile,
            row: sourceRow,
          });
          this.recordBatchItem(batchId, 'UNKNOWN', sourceFile, sourceSheet, sourceRow, item, 'error', 'Property No is missing or empty');
          continue;
        }

        const existing = this.isProduction
          ? existingSupabaseProps.find((p) => p.property_no === cleanNo)
          : this.memoryStore.properties.find((p) => p.property_no === cleanNo);

        if (!existing) {
          // ==========================================
          // 1. CREATE NEW PROPERTY
          // ==========================================
          const newPropertyId = `prop-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          const newRecord: PropertyRecord = {
            id: newPropertyId,
            property_no: cleanNo,
            property_name: item.property_name?.trim() || cleanNo,
            category: item.category?.trim() || 'Condominium',
            property_type: item.property_type?.trim() || 'Residential',
            status: (item.status as any) || 'Available',
            project_name: item.project_name?.trim() || '',
            location: item.location?.trim() || '',
            zone: item.zone?.trim() || '',
            bedroom: Number(item.bedroom) || 0,
            bathroom: Number(item.bathroom) || 0,
            land_area: Number(item.land_area) || 0,
            building_area: Number(item.building_area) || 0,
            floor: String(item.floor || ''),
            year_built: String(item.year_built || ''),
            furniture: item.furniture?.trim() || '',
            pool: item.pool?.trim() || '',
            parking: item.parking?.trim() || '',
            description: item.description?.trim() || '',
            rent_price: Number(item.rent_price) || 0,
            sale_price: Number(item.sale_price) || 0,
            additional_data: {
              ...(item.additional_data || {}),
              _import_batch_id: batchId,
              _sources: item.sources || [],
              _created_via: 'batch_merge',
            },
            is_archived: false,
            created_at: now,
            updated_at: now,
          };

          if (this.isProduction) {
            existingSupabaseProps.push(newRecord);
          } else {
            this.memoryStore.properties.unshift(newRecord);
          }
          newSupabaseProperties.push(newRecord);
          chunkNew++;

          // Add Contacts (Multiple Contacts Rule: deduplicate only identical phone digits)
          if (item.contacts && Array.isArray(item.contacts)) {
            const addedPhones = new Set<string>();
            for (const c of item.contacts) {
              const cleanPhone = (c.phone || '').trim();
              const numOnly = cleanPhone.replace(/[^0-9+]/g, '');
              if (cleanPhone && !addedPhones.has(numOnly)) {
                addedPhones.add(numOnly);
                const contactRecord: PropertyContactRecord = {
                  id: `cnt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  property_id: newPropertyId,
                  contact_name: c.contact_name?.trim() || (item.additional_data?.owner_name as string) || 'Owner',
                  contact_type: c.contact_type || 'Owner',
                  phone: cleanPhone,
                  email: c.email?.trim() || '',
                  note: c.source?.fileName ? `Source: ${c.source.fileName}` : '',
                  created_at: now,
                  updated_at: now,
                };
                if (!this.isProduction) {
                  this.memoryStore.contacts.push(contactRecord);
                } else {
                  existingSupabaseContacts.push(contactRecord);
                }
                newSupabaseContacts.push(contactRecord);
                chunkContacts++;
              }
            }
          }

          this.recordBatchItem(batchId, cleanNo, sourceFile, sourceSheet, sourceRow, item, 'merged', null);
        } else {
          // ==========================================
          // 2. SAFE MERGE INTO EXISTING PROPERTY
          // ==========================================
          const updates: Partial<PropertyRecord> = {};
          let itemHasConflict = false;

          for (const key of fieldKeys) {
            const excelVal = (item as any)[key];
            const dbVal = existing[key];

            const hasExcelVal =
              excelVal !== undefined &&
              excelVal !== null &&
              excelVal !== '' &&
              excelVal !== 0;

            const hasDbVal =
              dbVal !== undefined &&
              dbVal !== null &&
              dbVal !== '' &&
              dbVal !== 0;

            if (hasExcelVal && !hasDbVal) {
              // 1. Fill empty DB field with Excel data
              (updates as any)[key] = excelVal;
            } else if (hasExcelVal && hasDbVal) {
              const strDb = String(dbVal).trim().toLowerCase();
              const strExcel = String(excelVal).trim().toLowerCase();

              if (strDb !== strExcel) {
                // 2. Values conflict!
                itemHasConflict = true;
                chunkConflicts++;

                const resolution =
                  payload.conflictDecisions?.[cleanNo]?.[String(key)] ||
                  item.resolvedConflicts?.[String(key)] ||
                  payload.defaultStrategy ||
                  'keep_existing';

                detectedConflicts.push({
                  property_no: cleanNo,
                  field: key,
                  field_label: this.getFieldLabel(key),
                  existing_value: dbVal,
                  excel_value: excelVal,
                  resolution,
                  source_file: sourceFile,
                  source_row: sourceRow,
                });

                if (resolution === 'use_excel') {
                  (updates as any)[key] = excelVal;
                }
                // If keep_existing, leave dbVal unchanged
              }
            }
          }

          // Merge additional_data and preserve all sources
          const existingSources = (existing.additional_data?._sources as any[]) || [];
          const combinedSources = [...existingSources, ...(item.sources || [])];
          updates.additional_data = {
            ...(existing.additional_data || {}),
            ...(item.additional_data || {}),
            _last_batch_id: batchId,
            _last_merged_at: now,
            _sources: combinedSources,
          };
          updates.updated_at = now;

          // Apply updates in memory without re-serializing disk per row
          Object.assign(existing, updates);
          updatedSupabaseProperties.push({ id: existing.id, updates });
          chunkUpdated++;

          // Multiple Contacts Safe Merge (CRITICAL: NEVER OVERWRITE EXISTING PHONE NUMBERS)
          if (item.contacts && Array.isArray(item.contacts)) {
            const currentContacts = this.isProduction
              ? existingSupabaseContacts.filter((c) => c.property_id === existing.id)
              : this.memoryStore.contacts.filter((c) => c.property_id === existing.id);

            const existingPhones = new Set(
              currentContacts.map((c) => (c.phone || '').replace(/[^0-9+]/g, ''))
            );

            for (const c of item.contacts) {
              const cleanPhone = (c.phone || '').trim();
              const numOnly = cleanPhone.replace(/[^0-9+]/g, '');

              if (cleanPhone && !existingPhones.has(numOnly)) {
                // NEW phone number -> add as a separate contact entry!
                existingPhones.add(numOnly);
                const newContact: PropertyContactRecord = {
                  id: `cnt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  property_id: existing.id,
                  contact_name: c.contact_name?.trim() || (item.additional_data?.owner_name as string) || 'Owner',
                  contact_type: c.contact_type || 'Owner',
                  phone: cleanPhone,
                  email: c.email?.trim() || '',
                  note: c.source?.fileName ? `Source: ${c.source.fileName}` : '',
                  created_at: now,
                  updated_at: now,
                };
                if (!this.isProduction) {
                  this.memoryStore.contacts.push(newContact);
                } else {
                  existingSupabaseContacts.push(newContact);
                }
                newSupabaseContacts.push(newContact);
                chunkContacts++;
              } else if (cleanPhone && existingPhones.has(numOnly)) {
                // Phone exists: update contact_name if previous was generic 'Owner'
                const existingContact = currentContacts.find(
                  (x) => x.property_id === existing.id && (x.phone || '').replace(/[^0-9+]/g, '') === numOnly
                );
                if (existingContact && (!existingContact.contact_name || existingContact.contact_name === 'Owner') && c.contact_name && c.contact_name !== 'Owner') {
                  existingContact.contact_name = c.contact_name;
                }
              }
            }
          }

          this.recordBatchItem(
            batchId,
            cleanNo,
            sourceFile,
            sourceSheet,
            sourceRow,
            item,
            itemHasConflict ? 'conflict' : 'merged',
            null
          );
        }
      } catch (err: any) {
        chunkErrors.push({
          property_no: item.property_no || 'UNKNOWN',
          error: err.message || 'Error processing row',
          file: sourceFile,
          row: sourceRow,
        });
        this.recordBatchItem(
          batchId,
          item.property_no || 'UNKNOWN',
          sourceFile,
          sourceSheet,
          sourceRow,
          item,
          'error',
          err.message
        );
      }
    }

    // Update batch cumulative counters
    batch.processed_rows += payload.items.length;
    batch.new_properties += chunkNew;
    batch.updated_properties += chunkUpdated;
    batch.contacts_added += chunkContacts;
    batch.conflicts += chunkConflicts;
    batch.errors += chunkErrors.length;
    batch.updated_at = now;

    if (this.isProduction) {
      // STRICT PRODUCTION SUPABASE WRITES (Zero local store fallback)
      if (newSupabaseProperties.length > 0) {
        const { error: insErr } = await this.supabase!.from('properties').insert(newSupabaseProperties);
        if (insErr) throw new Error(`[Supabase Production Error] Failed to insert properties: ${insErr.message}`);
      }
      if (newSupabaseContacts.length > 0) {
        const { error: cErr } = await this.supabase!.from('property_contacts').insert(newSupabaseContacts);
        if (cErr) throw new Error(`[Supabase Production Error] Failed to insert contacts: ${cErr.message}`);
      }
      for (const item of updatedSupabaseProperties) {
        const { error: updErr } = await this.supabase!.from('properties').update(item.updates).eq('id', item.id);
        if (updErr) throw new Error(`[Supabase Production Error] Failed to update property ${item.id}: ${updErr.message}`);
      }
      const { error: bErr } = await this.supabase!.from('import_batches').update({
        processed_rows: batch.processed_rows,
        new_properties: batch.new_properties,
        updated_properties: batch.updated_properties,
        contacts_added: batch.contacts_added,
        conflicts: batch.conflicts,
        errors: batch.errors,
        updated_at: now,
      }).eq('id', batchId);
      if (bErr) throw new Error(`[Supabase Production Error] Failed to update batch progress: ${bErr.message}`);
    } else {
      // Development mode
      this.saveStore();
      if (this.supabase) {
        (async () => {
          try {
            if (newSupabaseProperties.length > 0) {
              await this.supabase!.from('properties').insert(newSupabaseProperties);
            }
            if (newSupabaseContacts.length > 0) {
              await this.supabase!.from('property_contacts').insert(newSupabaseContacts);
            }
            for (const item of updatedSupabaseProperties) {
              await this.supabase!.from('properties').update(item.updates).eq('id', item.id);
            }
            await this.supabase!.from('import_batches').update({
              processed_rows: batch.processed_rows,
              new_properties: batch.new_properties,
              updated_properties: batch.updated_properties,
              contacts_added: batch.contacts_added,
              conflicts: batch.conflicts,
              errors: batch.errors,
              updated_at: now,
            }).eq('id', batchId);
          } catch (sbErr) {
            console.warn('[Supabase Sync] Note during chunk sync in dev:', sbErr);
          }
        })();
      }
    }

    return {
      success: true,
      batchId,
      chunkIndex: payload.chunkIndex,
      processedInChunk: payload.items.length,
      batch: { ...batch },
      conflicts: detectedConflicts,
      errors: chunkErrors,
    };
  }

  // 3. Complete Import Batch
  async completeImportBatch(batchId: string, user = 'Admin'): Promise<ImportBatchRecord> {
    this.ensureProductionDatabaseReady('Complete Import Batch');

    const now = new Date().toISOString();

    if (this.isProduction) {
      const { data, error } = await this.supabase!
        .from('import_batches')
        .update({
          status: 'completed',
          updated_at: now,
        })
        .eq('id', batchId)
        .select()
        .single();

      if (error) {
        throw new Error(`[Supabase Production Error] Failed to complete import batch: ${error.message}`);
      }
      return data as ImportBatchRecord;
    }

    const batch = this.memoryStore.importBatches.find((b) => b.id === batchId);
    if (!batch) {
      throw new Error(`Import batch "${batchId}" not found`);
    }

    batch.status = 'completed';
    batch.updated_at = now;

    // Record System Update Log
    this.memoryStore.updateLogs.unshift({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      property_id: 'SYSTEM',
      action: 'Batch Import Completed',
      changed_field: 'all',
      new_value: `Completed import batch ${batch.batch_name} (Total rows: ${batch.processed_rows}, New: ${batch.new_properties}, Updated: ${batch.updated_properties}, Contacts: ${batch.contacts_added})`,
      user_name: user,
      created_at: now,
    });

    this.saveStore();

    if (this.supabase) {
      (async () => {
        try {
          await this.supabase!.from('import_batches').update({
            status: 'completed',
            updated_at: now,
          }).eq('id', batchId);
        } catch (err) {
          console.warn('[Supabase] Note on batch completion in dev:', err);
        }
      })();
    }

    return batch;
  }

  // 4. Audit Trail for Batch Items
  private recordBatchItem(
    batchId: string,
    propertyNo: string,
    sourceFile: string,
    sourceSheet: string,
    sourceRow: number,
    data: Record<string, any>,
    status: 'pending' | 'merged' | 'conflict' | 'error',
    errorMessage?: string | null
  ) {
    const itemRecord: ImportBatchItemRecord = {
      id: `ibi-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      batch_id: batchId,
      property_no: propertyNo,
      source_file: sourceFile,
      source_sheet: sourceSheet,
      source_row: sourceRow,
      data: {
        property_no: propertyNo,
        category: data.category,
        bedroom: data.bedroom,
        bathroom: data.bathroom,
        sale_price: data.sale_price,
        rent_price: data.rent_price,
        phone: data.contacts?.[0]?.phone || data.phone,
        owner: data.contacts?.[0]?.contact_name || data.owner,
      },
      status,
      error_message: errorMessage || null,
      created_at: new Date().toISOString(),
    };

    if (!this.memoryStore.importBatchItems) {
      this.memoryStore.importBatchItems = [];
    }
    if (this.memoryStore.importBatchItems.length > 5000) {
      this.memoryStore.importBatchItems.splice(0, 1000);
    }
    this.memoryStore.importBatchItems.push(itemRecord);

    if (this.supabase) {
      (async () => {
        try {
          await this.supabase!.from('import_batch_items').insert([itemRecord]);
        } catch (err) {
          // Non-blocking audit log
        }
      })();
    }
  }

  // 5. Get Import Batch Details
  async getImportBatch(batchId: string) {
    if (this.isProduction) {
      this.ensureProductionDatabaseReady('Fetch Import Batch Details');
      const { data: batch, error: bErr } = await this.supabase!
        .from('import_batches')
        .select('*')
        .eq('id', batchId)
        .maybeSingle();
      if (bErr) throw new Error(`[Supabase Production Error] ${bErr.message}`);
      if (!batch) return null;

      const { data: items, error: iErr } = await this.supabase!
        .from('import_batch_items')
        .select('*')
        .eq('batch_id', batchId)
        .limit(100);
      if (iErr) console.warn('[Supabase Warning] Fetch batch items:', iErr.message);

      return {
        ...batch,
        itemsCount: (items || []).length,
        sampleItems: (items || []).slice(0, 50),
      };
    }

    const batch = this.memoryStore.importBatches.find((b) => b.id === batchId);
    if (!batch) return null;
    const items = (this.memoryStore.importBatchItems || []).filter((i) => i.batch_id === batchId);
    return {
      ...batch,
      itemsCount: items.length,
      sampleItems: items.slice(0, 50),
    };
  }

  // Backward-compatible mergeImportProperties wrapper (delegates to chunk architecture)
  async mergeImportProperties(
    items: Array<any>,
    options: {
      batchName?: string;
      fileNames: string[];
      defaultConflictResolution?: 'keep_existing' | 'use_excel' | 'skip';
      user?: string;
    }
  ) {
    const batch = await this.createImportBatch({
      batch_name: options.batchName,
      total_files: options.fileNames.length,
      total_rows: items.length,
      file_names: options.fileNames,
      user: options.user,
    });

    const chunkSize = 200;
    const totalChunks = Math.ceil(items.length / chunkSize) || 1;
    let allConflicts: any[] = [];
    let allErrors: any[] = [];

    for (let c = 0; c < totalChunks; c++) {
      const chunkItems = items.slice(c * chunkSize, (c + 1) * chunkSize);
      const res = await this.processImportChunk(batch.id, {
        chunkIndex: c,
        totalChunks,
        items: chunkItems,
        defaultStrategy: options.defaultConflictResolution,
        user: options.user,
      });
      allConflicts = allConflicts.concat(res.conflicts);
      allErrors = allErrors.concat(res.errors);
    }

    const completedBatch = await this.completeImportBatch(batch.id, options.user);

    return {
      success: true,
      batch: completedBatch,
      summary: {
        totalProperties: completedBatch.total_rows,
        newProperties: completedBatch.new_properties,
        updatedProperties: completedBatch.updated_properties,
        contactsAdded: completedBatch.contacts_added,
        photosAdded: 0,
        filesAdded: 0,
        conflictsResolved: completedBatch.conflicts,
        errorsCount: completedBatch.errors,
        errors: allErrors,
      },
    };
  }

  // Get list of import batches
  async getImportBatches(): Promise<ImportBatchRecord[]> {
    if (this.isProduction) {
      this.ensureProductionDatabaseReady('Fetch Import Batches');
      const { data, error } = await this.supabase!
        .from('import_batches')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(`[Supabase Production Error] Failed to fetch import batches: ${error.message}`);
      return (data || []) as ImportBatchRecord[];
    }

    return [...this.memoryStore.importBatches].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  // Get single import batch
  async getImportBatchById(batchId: string): Promise<ImportBatchRecord | null> {
    if (this.isProduction) {
      this.ensureProductionDatabaseReady('Fetch Import Batch');
      const { data, error } = await this.supabase!
        .from('import_batches')
        .select('*')
        .eq('id', batchId)
        .maybeSingle();
      if (error) throw new Error(`[Supabase Production Error] ${error.message}`);
      return (data as ImportBatchRecord) || null;
    }

    return this.memoryStore.importBatches.find((b) => b.id === batchId) || null;
  }

  private getFieldLabel(field: string): string {
    const labels: Record<string, string> = {
      property_name: 'ชื่อทรัพย์ / โครงการ',
      category: 'หมวดหมู่',
      property_type: 'ประเภท',
      status: 'สถานะ',
      project_name: 'ชื่อโครงการ',
      location: 'ทำเล / ที่ตั้ง',
      zone: 'โซน',
      bedroom: 'ห้องนอน',
      bathroom: 'ห้องน้ำ',
      land_area: 'เนื้อที่ (ตร.ว.)',
      building_area: 'พื้นที่ใช้สอย (ตร.ม.)',
      floor: 'ชั้น',
      year_built: 'ปีที่สร้าง',
      furniture: 'เฟอร์นิเจอร์',
      pool: 'สระว่ายน้ำ',
      parking: 'ที่จอดรถ',
      description: 'รายละเอียด',
      rent_price: 'ราคาเช่า',
      sale_price: 'ราคาขาย',
    };
    return labels[field] || field;
  }
}

export const peakDb = new PeakDatabaseService();
