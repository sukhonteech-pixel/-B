import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { peakDb } from './db';

const app = express();
const PORT = 3000;

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Vercel Serverless URL normalizer (ensures /api prefix is retained when rewritten)
app.use((req, res, next) => {
  if (!req.url.startsWith('/api') && !req.url.startsWith('/uploads')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  next();
});

// Serve uploaded files statically
const uploadDir = peakDb.getUploadDir();
app.use('/uploads', express.static(uploadDir));

// Multer memory storage configuration for file uploads (max 50MB per file)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    // Validate MIME types and extensions
    const allowedMime = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed',
      'text/plain',
    ];
    if (allowedMime.includes(file.mimetype.toLowerCase()) || file.originalname.match(/\.(jpe?g|png|webp|pdf|docx?|xlsx?|csv|zip)$/i)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

const isServerless = !!process.env.VERCEL || !!process.env.NOW_REGION || process.env.SERVERLESS === '1';
const connectedClients = new Set<any>();

let customBroadcast: ((event: string, payload: any) => void) | null = null;

export function setBroadcaster(fn: (event: string, payload: any) => void) {
  customBroadcast = fn;
}

function broadcast(event: string, payload: any) {
  if (customBroadcast) {
    customBroadcast(event, payload);
    return;
  }
  if (isServerless || connectedClients.size === 0) return;
  const message = JSON.stringify({ event, payload });
  connectedClients.forEach((client) => {
    if (client.readyState === 1) { // 1 === WebSocket.OPEN
      try {
        client.send(message);
      } catch (err) {
        console.error('Error broadcasting WS message:', err);
      }
    }
  });
}

// ==============================================================================
// REST API ENDPOINTS: PEAK PROPERTY DATA
// ==============================================================================

// 1. Health & Status
app.get(['/api/health', '/api/automation/health'], async (req, res) => {
  const stats = await peakDb.getDashboardStats();
  res.json({
    status: 'OK',
    system: 'PEAK PROPERTY DATA',
    timestamp: new Date().toISOString(),
    components: {
      database: 'OK',
      storage: 'OK',
      server: 'OK',
      supabase: stats.isSupabaseConnected ? 'CONNECTED' : 'STANDALONE_PERSISTENT',
    },
    stats,
  });
});

// 2. Dashboard Statistics
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const stats = await peakDb.getDashboardStats();
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Properties: List & Query
app.get('/api/properties', async (req, res) => {
  try {
    const result = await peakDb.getProperties({
      search: req.query.search as string,
      category: req.query.category as string,
      status: req.query.status as string,
      location: req.query.location as string,
      project: req.query.project as string,
      bedroom: req.query.bedroom as string,
      bathroom: req.query.bathroom as string,
      page: req.query.page ? Number(req.query.page) : 1,
      limit: req.query.limit ? Number(req.query.limit) : 20,
      includeArchived: req.query.includeArchived === 'true',
    });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Property Detail: Single Property by ID or Property No
app.get('/api/properties/:id', async (req, res) => {
  try {
    const data = await peakDb.getPropertyById(req.params.id);
    if (!data) {
      return res.status(404).json({ error: `Property '${req.params.id}' not found` });
    }
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Create Property (Manual Add)
app.post('/api/properties', async (req, res) => {
  try {
    const user = (req.headers['x-user'] as string) || 'Admin';
    const property = await peakDb.createProperty(req.body, user);
    broadcast('property.created', property);
    res.status(201).json(property);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Update Property
app.put('/api/properties/:id', async (req, res) => {
  try {
    const user = (req.headers['x-user'] as string) || 'Admin';
    const updated = await peakDb.updateProperty(req.params.id, req.body, user);
    broadcast('property.updated', updated);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 7. Archive / Delete Property
app.delete('/api/properties/:id', async (req, res) => {
  try {
    const user = (req.headers['x-user'] as string) || 'Admin';
    const permanent = req.query.permanent === 'true';

    if (permanent) {
      const removed = await peakDb.deletePropertyPermanently(req.params.id, user);
      broadcast('property.deleted', { id: req.params.id });
      return res.json({ success: true, message: 'Property permanently deleted', property: removed });
    } else {
      const archived = await peakDb.archiveProperty(req.params.id, user);
      broadcast('property.archived', archived);
      return res.json({ success: true, message: 'Property archived', property: archived });
    }
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Restore Archived Property
app.post('/api/properties/:id/restore', async (req, res) => {
  try {
    const user = (req.headers['x-user'] as string) || 'Admin';
    const restored = await peakDb.restoreProperty(req.params.id, user);
    broadcast('property.updated', restored);
    res.json({ success: true, property: restored });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 9. Batch Excel Import
app.post('/api/properties/import', async (req, res) => {
  try {
    const { items, duplicateStrategy } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }

    const user = (req.headers['x-user'] as string) || 'Admin';
    const result = await peakDb.importExcelBatch(items, duplicateStrategy || 'UPDATE', user);
    try {
      broadcast('properties.imported', result);
    } catch (wsErr) {
      console.warn('[WebSocket] Broadcast error:', wsErr);
    }
    res.status(200).json(result);
  } catch (err: any) {
    console.error('[Batch Import Error]', err);
    res.status(500).json({ error: err.message || 'Internal import error' });
  }
});

// 9.1 Multi-Excel Merge: Preview & Conflict Detection
app.post('/api/properties/merge-preview', (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'items array is required' });
    }
    const preview = peakDb.previewMergeProperties(items);
    res.status(200).json(preview);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.2 Multi-Excel Merge: Legacy endpoint (backward compatible)
app.post('/api/properties/merge-import', async (req, res) => {
  try {
    const { items, options } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        stage: 'validation',
        message: 'items array is required',
      });
    }
    const user = (req.headers['x-user'] as string) || options?.user || 'Admin';
    const result = await peakDb.mergeImportProperties(items, { ...options, user });
    broadcast('properties.merged_import', result);
    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      stage: 'database_merge',
      file: req.body?.items?.[0]?.sources?.[0]?.fileName || 'Excel',
      row: req.body?.items?.[0]?.sources?.[0]?.rowNumber || 1,
      propertyNo: req.body?.items?.[0]?.property_no || 'UNKNOWN',
      message: err.message || 'Error executing merge import',
    });
  }
});

// ==============================================================================
// 9.3 NEW HIGH-SCALE BATCH / CHUNKED IMPORT API ARCHITECTURE
// Eliminates Serverless Function timeouts & memory limit crashes
// ==============================================================================

// Create Import Batch
app.post('/api/imports/create', async (req, res) => {
  try {
    const { batch_name, total_files, total_rows, file_names, default_strategy } = req.body;
    const user = (req.headers['x-user'] as string) || req.body.user || 'Admin';
    const batch = await peakDb.createImportBatch({
      batch_name,
      total_files: Number(total_files) || 0,
      total_rows: Number(total_rows) || 0,
      file_names: file_names || [],
      user,
    });
    broadcast('import.batch_created', batch);
    res.status(201).json({
      success: true,
      batchId: batch.id,
      batch,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      stage: 'batch_creation',
      message: err.message || 'Failed to create import batch',
    });
  }
});

// Process Import Chunk
app.post('/api/imports/:batchId/chunk', async (req, res) => {
  const { batchId } = req.params;
  try {
    const { chunkIndex, totalChunks, items, conflictDecisions, defaultStrategy } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        batchId,
        stage: 'chunk_validation',
        message: 'items array is required in chunk payload',
      });
    }

    const user = (req.headers['x-user'] as string) || req.body.user || 'Admin';
    const result = await peakDb.processImportChunk(batchId, {
      chunkIndex: Number(chunkIndex) || 0,
      totalChunks: Number(totalChunks) || 1,
      items,
      conflictDecisions,
      defaultStrategy,
      user,
    });

    broadcast('import.chunk_processed', result);
    res.status(200).json(result);
  } catch (err: any) {
    const sampleItem = req.body?.items?.[0];
    res.status(500).json({
      success: false,
      batchId,
      stage: 'database_merge',
      file: sampleItem?.sources?.[0]?.fileName || 'Excel',
      row: sampleItem?.sources?.[0]?.rowNumber || (Number(req.body?.chunkIndex || 0) * 100 + 1),
      propertyNo: sampleItem?.property_no || 'UNKNOWN',
      message: err.message || 'Error processing import chunk',
    });
  }
});

// Get Import Batches List
app.get('/api/imports', async (req, res) => {
  try {
    const batches = await peakDb.getImportBatches();
    res.json(batches);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Import Batch Status & Progress
app.get('/api/imports/:batchId/status', async (req, res) => {
  try {
    const batch = await peakDb.getImportBatch(req.params.batchId);
    if (!batch) {
      return res.status(404).json({
        success: false,
        batchId: req.params.batchId,
        message: `Import batch "${req.params.batchId}" not found`,
      });
    }
    res.status(200).json({
      success: true,
      batch,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      batchId: req.params.batchId,
      message: err.message,
    });
  }
});

// Complete Import Batch
app.post('/api/imports/:batchId/complete', async (req, res) => {
  const { batchId } = req.params;
  try {
    const user = (req.headers['x-user'] as string) || req.body.user || 'Admin';
    const batch = await peakDb.completeImportBatch(batchId, user);
    broadcast('import.completed', batch);
    res.status(200).json({
      success: true,
      batch,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      batchId,
      stage: 'batch_completion',
      message: err.message || 'Failed to complete import batch',
    });
  }
});

// 9.4 Import Batches History
app.get('/api/import-batches', (req, res) => {
  try {
    const batches = peakDb.getImportBatches();
    res.status(200).json(batches);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9.4 Single Import Batch Details
app.get('/api/import-batches/:id', (req, res) => {
  try {
    const batch = peakDb.getImportBatchById(req.params.id);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    res.status(200).json(batch);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Contacts: Add Phone/Contact to Property
app.post('/api/properties/:id/contacts', async (req, res) => {
  try {
    const user = (req.headers['x-user'] as string) || 'Admin';
    const contact = await peakDb.addContact(req.params.id, req.body, user);
    broadcast('contact.added', { propertyId: req.params.id, contact });
    res.status(201).json(contact);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 11. Contacts: Update Phone/Contact
app.put('/api/contacts/:id', async (req, res) => {
  try {
    const user = (req.headers['x-user'] as string) || 'Admin';
    const updated = await peakDb.updateContact(req.params.id, req.body, user);
    broadcast('contact.updated', { contactId: req.params.id, propertyId: updated.property_id, contact: updated });
    res.json({ success: true, contact: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 12. Contacts: Delete Contact
app.delete('/api/contacts/:id', async (req, res) => {
  try {
    const user = (req.headers['x-user'] as string) || 'Admin';
    const removed = await peakDb.deleteContact(req.params.id, user);
    broadcast('contact.deleted', { contactId: req.params.id, propertyId: removed.property_id });
    res.json({ success: true, contact: removed });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 12. Photos: Upload Multiple Photos from Computer
app.post('/api/properties/:id/photos', upload.array('photos', 20), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No photo files uploaded' });
    }

    const user = (req.headers['x-user'] as string) || 'Admin';
    const uploadedPhotos = [];

    for (const file of files) {
      const photo = await peakDb.savePhoto(
        req.params.id,
        {
          originalName: file.originalname,
          buffer: file.buffer,
          mimeType: file.mimetype,
          size: file.size,
        },
        false,
        user
      );
      uploadedPhotos.push(photo);
    }

    broadcast('photos.uploaded', { propertyId: req.params.id, count: uploadedPhotos.length });
    res.status(201).json({ count: uploadedPhotos.length, photos: uploadedPhotos });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 13. Photos: Set Cover Photo
app.put('/api/photos/:id/cover', async (req, res) => {
  try {
    const { propertyId } = req.body;
    if (!propertyId) {
      return res.status(400).json({ error: 'propertyId is required' });
    }
    const user = (req.headers['x-user'] as string) || 'Admin';
    await peakDb.setCoverPhoto(propertyId, req.params.id, user);
    broadcast('photo.cover_changed', { propertyId, photoId: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 14. Photos: Reorder
app.put('/api/properties/:id/photos/reorder', async (req, res) => {
  try {
    const { photoIds } = req.body;
    if (!photoIds || !Array.isArray(photoIds)) {
      return res.status(400).json({ error: 'photoIds array is required' });
    }
    const user = (req.headers['x-user'] as string) || 'Admin';
    await peakDb.reorderPhotos(req.params.id, photoIds, user);
    broadcast('photos.reordered', { propertyId: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 15. Photos: Delete Photo
app.delete('/api/photos/:id', async (req, res) => {
  try {
    const user = (req.headers['x-user'] as string) || 'Admin';
    const removed = await peakDb.deletePhoto(req.params.id, user);
    broadcast('photo.deleted', { photoId: req.params.id, propertyId: removed.property_id });
    res.json({ success: true, photo: removed });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 16. Documents/Files: Upload Multiple Files from Computer
app.post('/api/properties/:id/files', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const user = (req.headers['x-user'] as string) || 'Admin';
    const uploadedFiles = [];

    for (const file of files) {
      const doc = await peakDb.saveFile(
        req.params.id,
        {
          originalName: file.originalname,
          buffer: file.buffer,
          mimeType: file.mimetype,
          size: file.size,
        },
        user
      );
      uploadedFiles.push(doc);
    }

    broadcast('files.uploaded', { propertyId: req.params.id, count: uploadedFiles.length });
    res.status(201).json({ count: uploadedFiles.length, files: uploadedFiles });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 17. Documents/Files: Delete File
app.delete('/api/files/:id', async (req, res) => {
  try {
    const user = (req.headers['x-user'] as string) || 'Admin';
    const removed = await peakDb.deleteFile(req.params.id, user);
    broadcast('file.deleted', { fileId: req.params.id, propertyId: removed.property_id });
    res.json({ success: true, file: removed });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// 17.1 Bulk Files: Preview Filename Matching
app.post('/api/files/bulk-preview', (req, res) => {
  try {
    const { fileNames } = req.body;
    if (!fileNames || !Array.isArray(fileNames)) {
      return res.status(400).json({ error: 'fileNames array is required' });
    }

    const preview = fileNames.map((name: string) => {
      const prop = peakDb.findPropertyForFilename(name);
      const ext = path.extname(name).toLowerCase();
      const isPhoto = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext);

      return {
        fileName: name,
        matched: !!prop,
        property_no: prop ? prop.property_no : null,
        property_name: prop ? prop.property_name : null,
        property_id: prop ? prop.id : null,
        file_type: isPhoto ? 'photo' : 'document',
      };
    });

    const matchedCount = preview.filter((p) => p.matched).length;
    const unmatchedCount = preview.length - matchedCount;

    res.json({
      total: preview.length,
      matchedCount,
      unmatchedCount,
      preview,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 17.2 Bulk Files: Auto-Match & Upload Multiple Files
app.post('/api/files/bulk-upload', upload.array('files', 100), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided for bulk upload' });
    }

    const user = (req.headers['x-user'] as string) || 'Admin';
    const preparedFiles = files.map((f) => ({
      originalName: f.originalname,
      buffer: f.buffer,
      mimeType: f.mimetype,
      size: f.size,
    }));

    const result = await peakDb.bulkUploadAutoMatchedFiles(preparedFiles, user);
    broadcast('files.bulk_uploaded', {
      total: result.totalFiles,
      matchedCount: result.matchedCount,
      unmatchedCount: result.unmatchedCount,
    });

    res.status(200).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 18. Files: Download Real File (Attachment)
app.get('/api/files/:id/download', (req, res) => {
  try {
    const item = peakDb.getFileById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (fs.existsSync(item.localPath)) {
      res.setHeader('Content-Type', item.file.mime_type || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(item.file.file_name)}"`
      );
      return res.sendFile(path.resolve(item.localPath));
    }

    // Fallback redirect to public URL
    return res.redirect(item.file.public_url);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 19. Files: View Real File Inline
app.get('/api/files/:id/view', (req, res) => {
  try {
    const item = peakDb.getFileById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'File not found' });
    }

    if (fs.existsSync(item.localPath)) {
      res.setHeader('Content-Type', item.file.mime_type || 'application/octet-stream');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(item.file.file_name)}"`
      );
      return res.sendFile(path.resolve(item.localPath));
    }

    return res.redirect(item.file.public_url);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 20. Photos: Download Real Photo (Attachment)
app.get('/api/photos/:id/download', (req, res) => {
  try {
    const item = peakDb.getPhotoById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    if (fs.existsSync(item.localPath)) {
      res.setHeader('Content-Type', item.photo.mime_type || 'image/jpeg');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(item.photo.file_name)}"`
      );
      return res.sendFile(path.resolve(item.localPath));
    }

    return res.redirect(item.photo.public_url);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 21. Photos: View Real Photo Inline
app.get('/api/photos/:id/view', (req, res) => {
  try {
    const item = peakDb.getPhotoById(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    if (fs.existsSync(item.localPath)) {
      res.setHeader('Content-Type', item.photo.mime_type || 'image/jpeg');
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${encodeURIComponent(item.photo.file_name)}"`
      );
      return res.sendFile(path.resolve(item.localPath));
    }

    return res.redirect(item.photo.public_url);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 22. Update History Logs
app.get('/api/properties/:id/history', async (req, res) => {
  try {
    const detail = await peakDb.getPropertyById(req.params.id);
    if (!detail) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(detail.updateLogs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================================================================

export default app;
export { app, broadcast };
