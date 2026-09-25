export class ApiError extends Error {
  status: number;
  code?: string;
  data?: any;

  constructor(message: string, status: number, code?: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err: any) {
    throw new ApiError(
      `ไม่สามารถเชื่อมต่อ Server ได้: ${err?.message || 'Network request failed'}`,
      0,
      'NETWORK_ERROR'
    );
  }

  let body: any = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      body = await res.json();
    } catch {
      body = null;
    }
  } else {
    try {
      body = await res.text();
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    let errorMsg = '';
    let errorCode = `HTTP_${res.status}`;

    if (body && typeof body === 'object') {
      errorMsg = body.error || body.message || body.detail || '';
      if (typeof body.error === 'string') errorCode = body.error;
    } else if (typeof body === 'string' && body.trim()) {
      const titleMatch = body.match(/<title>(.*?)<\/title>/i);
      errorMsg = titleMatch ? titleMatch[1].trim() : body.slice(0, 200).trim();
    }

    if (!errorMsg) {
      errorMsg = res.statusText || `HTTP Error ${res.status}`;
    }

    throw new ApiError(errorMsg, res.status, errorCode, body);
  }

  return body as T;
}

export interface PropertyListItem {
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
  cover_photo_url: string | null;
  photos_count: number;
  files_count: number;
  contacts: Array<{
    id: string;
    contact_name: string;
    contact_type: string;
    phone: string;
    email?: string;
  }>;
}

export interface PropertyDetailResponse {
  property: PropertyListItem;
  contacts: Array<{
    id: string;
    property_id: string;
    contact_name: string;
    contact_type: 'Owner' | 'Agent' | 'Co-Agent' | 'Juristic' | 'Cleaning' | 'Other';
    phone: string;
    email?: string;
    note?: string;
    created_at: string;
    updated_at: string;
  }>;
  photos: Array<{
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
  }>;
  files: Array<{
    id: string;
    property_id: string;
    storage_path: string;
    file_name: string;
    public_url: string;
    file_size: number;
    mime_type: string;
    created_at: string;
  }>;
  updateLogs: Array<{
    id: string;
    property_id: string;
    action: string;
    changed_field?: string;
    old_value?: string;
    new_value?: string;
    user_name: string;
    created_at: string;
  }>;
}

export interface DashboardStats {
  totalProperties: number;
  totalPhotos: number;
  totalFiles: number;
  propertiesAddedToday: number;
  totalContacts: number;
  isSupabaseConnected: boolean;
}

export const api = {
  // System Health
  async getHealth() {
    return request<any>('/api/health');
  },

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    return request<DashboardStats>('/api/dashboard/stats');
  },

  // Properties Query
  async getProperties(params?: {
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
  }): Promise<{
    items: PropertyListItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const query = new URLSearchParams();
    if (params) {
      if (params.search) query.set('search', params.search);
      if (params.category && params.category !== 'ALL') query.set('category', params.category);
      if (params.status && params.status !== 'ALL') query.set('status', params.status);
      if (params.location && params.location !== 'ALL') query.set('location', params.location);
      if (params.project && params.project !== 'ALL') query.set('project', params.project);
      if (params.bedroom !== undefined && params.bedroom !== 'ALL') query.set('bedroom', String(params.bedroom));
      if (params.bathroom !== undefined && params.bathroom !== 'ALL') query.set('bathroom', String(params.bathroom));
      if (params.page) query.set('page', String(params.page));
      if (params.limit) query.set('limit', String(params.limit));
      if (params.includeArchived) query.set('includeArchived', 'true');
    }
    const qStr = query.toString();
    return request(`/api/properties${qStr ? `?${qStr}` : ''}`);
  },

  // Property Detail
  async getProperty(idOrNo: string): Promise<PropertyDetailResponse> {
    return request<PropertyDetailResponse>(`/api/properties/${encodeURIComponent(idOrNo)}`);
  },

  // Create Property
  async createProperty(data: any): Promise<PropertyListItem> {
    return request<PropertyListItem>('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  // Update Property
  async updateProperty(id: string, data: any): Promise<PropertyListItem> {
    return request<PropertyListItem>(`/api/properties/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  // Archive Property (Soft Delete)
  async archiveProperty(id: string): Promise<{ success: boolean; property: PropertyListItem }> {
    return request<{ success: boolean; property: PropertyListItem }>(`/api/properties/${id}`, {
      method: 'DELETE',
    });
  },

  // Restore Property
  async restoreProperty(id: string): Promise<{ success: boolean; property: PropertyListItem }> {
    return request<{ success: boolean; property: PropertyListItem }>(`/api/properties/${id}/restore`, {
      method: 'POST',
    });
  },

  // Delete Permanently
  async deletePropertyPermanently(id: string): Promise<{ success: boolean; property: PropertyListItem }> {
    return request<{ success: boolean; property: PropertyListItem }>(`/api/properties/${id}?permanent=true`, {
      method: 'DELETE',
    });
  },

  // Batch Import Excel
  async importProperties(
    items: any[],
    duplicateStrategy: 'UPDATE' | 'SKIP' | 'CREATE' = 'UPDATE'
  ): Promise<{
    total: number;
    imported: number;
    updated: number;
    skipped: number;
    failedCount: number;
    failed: Array<{ property_no: string; error: string }>;
  }> {
    return request('/api/properties/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, duplicateStrategy }),
    });
  },

  // Multi-Excel Merge: Preview & Conflict Detection
  async previewMergeProperties(items: any[]): Promise<{
    total: number;
    newPropertiesCount: number;
    existingPropertiesCount: number;
    totalConflicts: number;
    preview: Array<{
      property_no: string;
      filesFound: string[];
      isExisting: boolean;
      existingId: string | null;
      existingData: any;
      incomingData: any;
      conflicts: Array<{
        field: string;
        label: string;
        dbValue: any;
        excelValue: any;
        excelSource?: any;
      }>;
      hasConflicts: boolean;
      newFieldsCount: number;
      newContactsCount: number;
      sources: Array<{
        fileName: string;
        sheetName?: string;
        rowNumber?: number;
        fieldsProvided?: string[];
      }>;
      fieldTraces: Record<string, any[]>;
    }>;
  }> {
    return request('/api/properties/merge-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
  },

  // Multi-Excel Merge: Execute Merge Import (Legacy wrapper)
  async executeMergeImport(
    items: any[],
    options: {
      batchName?: string;
      fileNames: string[];
      defaultConflictResolution?: 'keep_existing' | 'use_excel' | 'skip';
      user?: string;
    }
  ): Promise<any> {
    return request('/api/properties/merge-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, options }),
    });
  },

  // High-Reliability Batch Import Endpoints
  async createImportBatch(data: {
    batch_name: string;
    total_files: number;
    total_rows: number;
    file_names: string[];
    default_strategy?: string;
    user?: string;
  }): Promise<{
    success: boolean;
    batchId: string;
    batch: any;
  }> {
    return request('/api/imports/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async processImportChunk(
    batchId: string,
    data: {
      chunkIndex: number;
      totalChunks: number;
      items: any[];
      conflictDecisions?: Record<string, Record<string, string>>;
      defaultStrategy?: string;
      user?: string;
    }
  ): Promise<{
    success: boolean;
    batchId: string;
    chunkIndex: number;
    processedInChunk: number;
    batch: any;
    conflicts: any[];
    errors: any[];
  }> {
    return request(`/api/imports/${encodeURIComponent(batchId)}/chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async getImportBatchStatus(batchId: string): Promise<{
    success: boolean;
    batch: any;
  }> {
    return request(`/api/imports/${encodeURIComponent(batchId)}/status`);
  },

  async completeImportBatch(
    batchId: string,
    user?: string
  ): Promise<{
    success: boolean;
    batch: any;
  }> {
    return request(`/api/imports/${encodeURIComponent(batchId)}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user }),
    });
  },

  // Get Import Batches History
  async getImportBatches(): Promise<
    Array<{
      id: string;
      batch_name: string;
      files: string[];
      total_properties: number;
      new_properties: number;
      updated_properties: number;
      contacts_added: number;
      photos_added: number;
      files_added: number;
      conflicts_count: number;
      status: string;
      created_at: string;
      created_by: string;
    }>
  > {
    return request('/api/import-batches');
  },

  // Get Single Import Batch Detail
  async getImportBatch(id: string) {
    return request(`/api/import-batches/${id}`);
  },

  // Add Contact
  async addContact(
    propertyId: string,
    data: { contact_name: string; contact_type: string; phone: string; email?: string }
  ) {
    return request(`/api/properties/${propertyId}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  // Update Contact
  async updateContact(
    contactId: string,
    data: { contact_name?: string; contact_type?: string; phone?: string; email?: string; note?: string }
  ) {
    return request(`/api/contacts/${contactId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  // Delete Contact
  async deleteContact(contactId: string) {
    return request(`/api/contacts/${contactId}`, {
      method: 'DELETE',
    });
  },

  // Download / View URLs (Real Stream from Storage)
  getPhotoDownloadUrl(photoId: string): string {
    return `/api/photos/${photoId}/download`;
  },
  getPhotoViewUrl(photoId: string): string {
    return `/api/photos/${photoId}/view`;
  },
  getFileDownloadUrl(fileId: string): string {
    return `/api/files/${fileId}/download`;
  },
  getFileViewUrl(fileId: string): string {
    return `/api/files/${fileId}/view`;
  },

  // Upload Photos (multiple)
  async uploadPhotos(propertyId: string, files: File[]) {
    const formData = new FormData();
    files.forEach((f) => formData.append('photos', f));

    return request<{ count: number; photos: any[] }>(`/api/properties/${propertyId}/photos`, {
      method: 'POST',
      body: formData,
    });
  },

  // Set Cover Photo
  async setCoverPhoto(propertyId: string, photoId: string) {
    return request<{ success: boolean }>(`/api/photos/${photoId}/cover`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId }),
    });
  },

  // Reorder Photos
  async reorderPhotos(propertyId: string, photoIds: string[]) {
    return request<{ success: boolean }>(`/api/properties/${propertyId}/photos/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds }),
    });
  },

  // Delete Photo
  async deletePhoto(photoId: string) {
    return request<{ success: boolean }>(`/api/photos/${photoId}`, {
      method: 'DELETE',
    });
  },

  // Upload Files / Documents
  async uploadFiles(propertyId: string, files: File[]) {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));

    return request<{ count: number; files: any[] }>(`/api/properties/${propertyId}/files`, {
      method: 'POST',
      body: formData,
    });
  },

  // Delete File
  async deleteFile(fileId: string) {
    return request<{ success: boolean }>(`/api/files/${fileId}`, {
      method: 'DELETE',
    });
  },

  // Update History
  async getPropertyHistory(propertyId: string) {
    return request<any[]>(`/api/properties/${propertyId}/history`);
  },

  // Bulk File Upload: Preview matching
  async previewBulkFiles(fileNames: string[]): Promise<{
    total: number;
    matchedCount: number;
    unmatchedCount: number;
    preview: Array<{
      fileName: string;
      matched: boolean;
      property_no: string | null;
      property_name: string | null;
      property_id: string | null;
      file_type: 'photo' | 'document';
    }>;
  }> {
    return request('/api/files/bulk-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileNames }),
    });
  },

  // Bulk File Upload: Upload batch
  async bulkUploadFiles(files: File[]): Promise<{
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
  }> {
    const formData = new FormData();
    files.forEach((f) => formData.append('files', f));

    return request('/api/files/bulk-upload', {
      method: 'POST',
      body: formData,
    });
  },
};
