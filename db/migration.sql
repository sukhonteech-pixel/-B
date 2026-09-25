-- ==============================================================================
-- PEAK PROPERTY DATA - SUPABASE MIGRATION SCRIPT
-- Safe & Idempotent Migration for Production Real Estate Management
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Properties Table
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_no VARCHAR(100) NOT NULL UNIQUE,
  property_name VARCHAR(255),
  category VARCHAR(100) DEFAULT 'Condominium',
  property_type VARCHAR(100),
  status VARCHAR(50) DEFAULT 'Available',
  project_name VARCHAR(255),
  location VARCHAR(255),
  zone VARCHAR(100),
  bedroom INTEGER DEFAULT 0,
  bathroom INTEGER DEFAULT 0,
  land_area NUMERIC(12, 2) DEFAULT 0,
  building_area NUMERIC(12, 2) DEFAULT 0,
  floor VARCHAR(50),
  year_built VARCHAR(50),
  furniture VARCHAR(100),
  pool VARCHAR(100),
  parking VARCHAR(100),
  description TEXT,
  rent_price NUMERIC(14, 2) DEFAULT 0,
  sale_price NUMERIC(14, 2) DEFAULT 0,
  additional_data JSONB DEFAULT '{}'::jsonb,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all requested columns exist even if table was previously created
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_name VARCHAR(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_type VARCHAR(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS zone VARCHAR(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS year_built VARCHAR(50);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS furniture VARCHAR(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS pool VARCHAR(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS parking VARCHAR(100);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS rent_price NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS sale_price NUMERIC(14, 2) DEFAULT 0;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS additional_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- 3. Property Contacts Table (Multiple contacts per property)
CREATE TABLE IF NOT EXISTS property_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  contact_name VARCHAR(255) NOT NULL DEFAULT 'Contact',
  contact_type VARCHAR(100) NOT NULL DEFAULT 'Owner', -- Owner, Agent, Co-Agent, Juristic, Cleaning, Other
  phone VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Property Photos Table
CREATE TABLE IF NOT EXISTS property_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  storage_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  public_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_cover BOOLEAN DEFAULT FALSE,
  file_size BIGINT DEFAULT 0,
  mime_type VARCHAR(100) DEFAULT 'image/jpeg',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Property Documents & Files Table
CREATE TABLE IF NOT EXISTS property_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  storage_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  public_url TEXT NOT NULL,
  file_size BIGINT DEFAULT 0,
  mime_type VARCHAR(100) DEFAULT 'application/octet-stream',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Property Update History Logs Table
CREATE TABLE IF NOT EXISTS property_update_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- Created, Updated, Archived, Contact Added, Photo Added, etc.
  changed_field VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  user_name VARCHAR(100) DEFAULT 'Admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_properties_property_no ON properties(property_no);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_is_archived ON properties(is_archived);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_contacts_property_id ON property_contacts(property_id);
CREATE INDEX IF NOT EXISTS idx_property_contacts_phone ON property_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_property_photos_property_id ON property_photos(property_id);
CREATE INDEX IF NOT EXISTS idx_property_photos_sort ON property_photos(property_id, sort_order ASC);
CREATE INDEX IF NOT EXISTS idx_property_files_property_id ON property_files(property_id);
CREATE INDEX IF NOT EXISTS idx_property_update_logs_prop ON property_update_logs(property_id, created_at DESC);

-- 8. Supabase Storage Bucket Initialization (property-files)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-files',
  'property-files',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', 'application/zip']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800;

-- Storage Policies for Public Reading and Authenticated/Service Upload
CREATE POLICY IF NOT EXISTS "Allow Public Read Access on property-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-files');

CREATE POLICY IF NOT EXISTS "Allow Upload on property-files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'property-files');

CREATE POLICY IF NOT EXISTS "Allow Delete on property-files"
ON storage.objects FOR DELETE
USING (bucket_id = 'property-files');

-- 9. Import Batches Table (High-Reliability Multi-Excel Batch System)
CREATE TABLE IF NOT EXISTS import_batches (
  id VARCHAR(100) PRIMARY KEY,
  batch_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'processing', -- pending, processing, completed, failed, cancelled
  total_files INTEGER DEFAULT 0,
  total_rows INTEGER DEFAULT 0,
  processed_rows INTEGER DEFAULT 0,
  new_properties INTEGER DEFAULT 0,
  updated_properties INTEGER DEFAULT 0,
  contacts_added INTEGER DEFAULT 0,
  conflicts INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Import Batch Items Table (Audit trail & conflict tracking)
CREATE TABLE IF NOT EXISTS import_batch_items (
  id VARCHAR(100) PRIMARY KEY,
  batch_id VARCHAR(100) NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  property_no VARCHAR(100) NOT NULL,
  source_file VARCHAR(255),
  source_sheet VARCHAR(100),
  source_row INTEGER,
  data JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, merged, conflict, error
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_batches_status ON import_batches(status);
CREATE INDEX IF NOT EXISTS idx_import_batches_created ON import_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_batch_items_batch ON import_batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_import_batch_items_prop_no ON import_batch_items(property_no);

