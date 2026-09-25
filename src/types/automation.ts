export type JobStatus =
  | 'QUEUED'
  | 'CONNECTING'
  | 'RUNNING'
  | 'READING_PROPERTY'
  | 'READING_LANDLORD'
  | 'READING_PRICE'
  | 'READING_PHOTOS'
  | 'UPLOADING_PHOTOS'
  | 'SAVING_DATABASE'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'PAUSED';

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'BUSY' | 'ERROR';

export type LogLevel = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export interface Device {
  id: string;
  name: string;
  status: DeviceStatus;
  os: string;
  ipAddress: string;
  primeDetected: boolean;
  primeVersion?: string;
  lastHeartbeat: string;
  pairedAt: string;
  authToken: string;
  activeJobId?: string | null;
}

export interface JobOptions {
  propertyInfo: boolean;
  landlordInfo: boolean;
  priceInfo: boolean;
  photos: boolean;
  videos: boolean;
  occupancyStatus: boolean;
  followup: boolean;
  viewingRecords: boolean;
  dryRun?: boolean;
}

export interface AutomationJob {
  id: string;
  jobNo: string;
  propertyNo: string;
  deviceId: string;
  deviceName?: string;
  userId: string;
  status: JobStatus;
  currentStep: string;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  createdAt: string;
  options: JobOptions;
  dryRun?: boolean;
  resultData?: {
    property?: PropertyData;
    landlord?: LandlordData;
    photos?: PropertyPhoto[];
    fieldsCount?: number;
    photosCount?: number;
    verificationNotes?: string[];
    extractedAt?: string;
  };
}

export interface AutomationLog {
  id: string;
  jobId: string;
  propertyNo?: string;
  deviceId?: string;
  step?: string;
  status?: string;
  timestamp: string;
  duration?: number;
  errorCode?: string;
  errorMessage?: string;
  level: LogLevel;
  action: string;
  message: string;
  screenshot?: string;
  screenshotPath?: string;
  metadata?: Record<string, unknown>;
}

export interface PropertyData {
  id: string;
  property_no: string;
  comments?: string;
  follow_up?: string;
  city: string;
  area: string;
  district: string;
  category: string;
  status: string;
  approval_status: string;
  label?: string;
  agency_type?: string;
  website_status?: string;
  is_black?: boolean;
  project_name: string;
  house_pool?: string;
  room_type: string;
  room_no?: string;
  building_no?: string;
  floor?: string;
  bedroom: number;
  bathroom: number;
  land_area?: number;
  building_area?: number;
  agent?: string;
  rent_price_year?: number;
  sale_price?: number;
  rent_to?: string;
  register_time?: string;
  source: string;
  source_property_no: string;
  source_captured_at: string;
  source_device: string;
  source_job_id: string;
}

export interface LandlordData {
  id: string;
  property_id: string;
  name: string;
  email?: string;
  national?: string;
  phone_no_1: string;
  phone_no_2?: string;
  phone_no_3?: string;
  representatives?: {
    id: string;
    representative_no: string;
    name: string;
    relationship: string;
    phone: string;
  }[];
  cleaning_staff?: {
    id: string;
    name: string;
    phone: string;
  }[];
  other_contacts?: {
    id: string;
    name: string;
    phone: string;
  }[];
}

export interface PropertyPhoto {
  id: string;
  property_id: string;
  storage_path: string;
  public_url: string;
  file_name: string;
  original_order: number;
  is_cover: boolean;
  is_published: boolean;
  source: string;
  source_url?: string;
  created_at: string;
  file_size?: number;
  mime_type?: string;
}

export interface AutomationStep {
  step: number;
  name: string;
  description: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  duration?: string;
  screenshot?: string;
}

export interface WebSocketMessage {
  event: string;
  payload: any;
}
