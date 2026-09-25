-- ==============================================================================
-- PEAK AUTOMATION DATABASE SCHEMA & SUPABASE MIGRATION
-- Backward compatible with PEAK Real Estate schema
-- ==============================================================================

-- 1. Automation Devices
CREATE TABLE IF NOT EXISTS automation_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'OFFLINE', -- ONLINE, OFFLINE, BUSY, ERROR
  os VARCHAR(100) DEFAULT 'Windows 11 Pro',
  ip_address VARCHAR(100),
  prime_detected BOOLEAN DEFAULT FALSE,
  prime_version VARCHAR(50),
  auth_token VARCHAR(255) NOT NULL UNIQUE,
  paired_at TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  active_job_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Properties (PEAK Real Estate core table)
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_no VARCHAR(100) NOT NULL UNIQUE,
  comments TEXT,
  follow_up TEXT,
  city VARCHAR(100) NOT NULL DEFAULT 'Bangkok',
  area VARCHAR(100),
  district VARCHAR(100),
  category VARCHAR(100) DEFAULT 'Condo',
  status VARCHAR(50) DEFAULT 'Available',
  approval_status VARCHAR(50) DEFAULT 'Approved',
  label VARCHAR(100),
  agency_type VARCHAR(100) DEFAULT 'Direct',
  website_status VARCHAR(50) DEFAULT 'Published',
  is_black BOOLEAN DEFAULT FALSE,
  project_name VARCHAR(255) NOT NULL,
  house_pool VARCHAR(100),
  room_type VARCHAR(100) DEFAULT '1 Bedroom',
  room_no VARCHAR(100),
  building_no VARCHAR(100),
  floor VARCHAR(50),
  bedroom INTEGER DEFAULT 1,
  bathroom INTEGER DEFAULT 1,
  land_area NUMERIC(10, 2),
  building_area NUMERIC(10, 2),
  agent VARCHAR(100),
  rent_price_year NUMERIC(12, 2),
  sale_price NUMERIC(14, 2),
  rent_to VARCHAR(100),
  register_time TIMESTAMPTZ DEFAULT NOW(),
  -- Source tracking
  source VARCHAR(100) DEFAULT 'Prime Global Asset',
  source_property_no VARCHAR(100),
  source_captured_at TIMESTAMPTZ,
  source_device VARCHAR(255),
  source_job_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Landlords
CREATE TABLE IF NOT EXISTS landlords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  national VARCHAR(100),
  phone_no_1 VARCHAR(100) NOT NULL,
  phone_no_2 VARCHAR(100),
  phone_no_3 VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_property_landlord UNIQUE (property_id)
);

-- 4. Landlord Representatives
CREATE TABLE IF NOT EXISTS representatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  representative_no VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  relationship VARCHAR(100),
  phone VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Cleaning Staff
CREATE TABLE IF NOT EXISTS cleaning_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Other Contacts
CREATE TABLE IF NOT EXISTS other_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Property Photos (Supabase Storage reference)
CREATE TABLE IF NOT EXISTS property_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  storage_path VARCHAR(500) NOT NULL,
  public_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  original_order INTEGER NOT NULL DEFAULT 1,
  is_cover BOOLEAN DEFAULT FALSE,
  is_published BOOLEAN DEFAULT TRUE,
  file_hash VARCHAR(100),
  source VARCHAR(100) DEFAULT 'Prime Global Asset',
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Automation Jobs
CREATE TABLE IF NOT EXISTS automation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_no VARCHAR(100) NOT NULL UNIQUE,
  property_no VARCHAR(100) NOT NULL,
  device_id UUID REFERENCES automation_devices(id),
  user_id VARCHAR(100) DEFAULT 'admin@peakrealestate.com',
  status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
  current_step VARCHAR(255) DEFAULT 'Initialized',
  progress INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  dry_run BOOLEAN DEFAULT FALSE,
  options JSONB,
  result_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Automation Logs
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES automation_jobs(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  level VARCHAR(50) NOT NULL DEFAULT 'INFO', -- INFO, SUCCESS, WARNING, ERROR
  action VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  screenshot_path TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for high-performance lookup
CREATE INDEX IF NOT EXISTS idx_properties_property_no ON properties(property_no);
CREATE INDEX IF NOT EXISTS idx_property_photos_property_id ON property_photos(property_id);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_job_no ON automation_jobs(job_no);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_property_no ON automation_jobs(property_no);
CREATE INDEX IF NOT EXISTS idx_automation_logs_job_id ON automation_logs(job_id);

-- Setup Supabase Storage Bucket policy hint
-- Bucket: 'property-images'
-- Structure: 'property-images/{property_no}/{01..12}.jpg'
