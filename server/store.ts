import { AutomationJob, AutomationLog, Device, LandlordData, PropertyData, PropertyPhoto } from '../src/types/automation';

// In-Memory Production State Store for Automation Engine & Dashboard
class AutomationStore {
  devices: Device[] = [
    {
      id: 'dev-office-pc-01',
      name: 'Office PC',
      status: 'OFFLINE',
      os: 'Windows 11 Pro 64-bit (23H2)',
      ipAddress: '192.168.1.104',
      primeDetected: false,
      primeVersion: 'v4.2.1-prod',
      lastHeartbeat: new Date(Date.now() - 3600000 * 2).toISOString(),
      pairedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      authToken: 'pk_dev_office_pc_2026_authorized',
      activeJobId: null,
    },
    {
      id: 'dev-laptop-backoffice',
      name: 'Backoffice Automation Laptop',
      status: 'OFFLINE',
      os: 'Windows 10 Enterprise',
      ipAddress: '192.168.1.118',
      primeDetected: false,
      primeVersion: undefined,
      lastHeartbeat: new Date(Date.now() - 3600000 * 4).toISOString(),
      pairedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      authToken: 'pk_dev_laptop_backoffice_2026',
      activeJobId: null,
    },
  ];

  jobs: AutomationJob[] = [];
  logs: AutomationLog[] = [];
  properties: PropertyData[] = [];
  landlords: LandlordData[] = [];
  photos: PropertyPhoto[] = [];

  constructor() {
    // Initialized without mock records; data populated solely by live Windows Agent
  }

  // Devices
  getDevices() {
    return this.devices;
  }

  getDeviceById(id: string) {
    return this.devices.find((d) => d.id === id);
  }

  pairDevice(data: { name: string; os?: string; ipAddress?: string; primeDetected?: boolean }) {
    const newDevice: Device = {
      id: `dev-${Date.now().toString(36)}`,
      name: data.name,
      status: 'ONLINE',
      os: data.os || 'Windows 11 Pro 64-bit',
      ipAddress: data.ipAddress || '192.168.1.' + Math.floor(Math.random() * 200 + 50),
      primeDetected: data.primeDetected ?? false,
      primeVersion: 'v4.2.1-prod',
      lastHeartbeat: new Date().toISOString(),
      pairedAt: new Date().toISOString(),
      authToken: `pk_dev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      activeJobId: null,
    };
    this.devices.push(newDevice);
    return newDevice;
  }

  revokeDevice(id: string) {
    const idx = this.devices.findIndex((d) => d.id === id);
    if (idx !== -1) {
      const removed = this.devices.splice(idx, 1)[0];
      return removed;
    }
    return null;
  }

  updateDeviceHeartbeat(id: string, primeDetected?: boolean) {
    const device = this.devices.find((d) => d.id === id);
    if (device) {
      device.lastHeartbeat = new Date().toISOString();
      if (device.status === 'OFFLINE') {
        device.status = 'ONLINE';
      }
      if (primeDetected !== undefined) {
        device.primeDetected = primeDetected;
      }
    }
    return device;
  }

  setDeviceOffline(id: string): Device | null {
    const device = this.devices.find((d) => d.id === id);
    if (device) {
      device.status = 'OFFLINE';
      return device;
    }
    return null;
  }

  checkHeartbeatTimeouts(maxAgeMs: number = 15000): Device[] {
    const now = Date.now();
    const timedOut: Device[] = [];
    for (const d of this.devices) {
      if (d.status === 'ONLINE' && d.lastHeartbeat) {
        const last = new Date(d.lastHeartbeat).getTime();
        if (now - last > maxAgeMs) {
          d.status = 'OFFLINE';
          timedOut.push(d);
        }
      }
    }
    return timedOut;
  }

  // Jobs
  getJobs() {
    return [...this.jobs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getJobById(id: string) {
    return this.jobs.find((j) => j.id === id);
  }

  createJob(data: {
    propertyNo: string;
    deviceId: string;
    userId?: string;
    options: any;
    dryRun?: boolean;
  }): AutomationJob {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const jobCounter = String(this.jobs.length + 1).padStart(5, '0');
    const jobNo = `JOB-${todayStr}-${jobCounter}`;

    const device = this.getDeviceById(data.deviceId);

    const newJob: AutomationJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      jobNo,
      propertyNo: data.propertyNo.trim().toUpperCase(),
      deviceId: data.deviceId,
      deviceName: device ? device.name : 'Unknown Device',
      userId: data.userId || 'admin@peakrealestate.com',
      status: 'QUEUED',
      currentStep: 'Queued in Automation Dispatcher',
      progress: 0,
      createdAt: new Date().toISOString(),
      options: data.options,
      dryRun: data.dryRun ?? false,
    };

    this.jobs.unshift(newJob);
    return newJob;
  }

  updateJob(id: string, updates: Partial<AutomationJob>): AutomationJob | null {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return null;
    Object.assign(job, updates);
    return job;
  }

  // Logs
  getLogs(jobId?: string) {
    if (jobId) {
      return this.logs.filter((l) => l.jobId === jobId);
    }
    return [...this.logs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  addLog(data: Omit<AutomationLog, 'id'>) {
    const log: AutomationLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...data,
    };
    this.logs.unshift(log);
    return log;
  }

  // Property & Landlord & Photo Records
  savePropertyData(property: PropertyData, landlord?: LandlordData, photos?: PropertyPhoto[]) {
    // Upsert property
    const existingIdx = this.properties.findIndex((p) => p.property_no === property.property_no);
    if (existingIdx !== -1) {
      this.properties[existingIdx] = property;
    } else {
      this.properties.unshift(property);
    }

    // Upsert landlord
    if (landlord) {
      const lIdx = this.landlords.findIndex((l) => l.property_id === property.id);
      if (lIdx !== -1) {
        this.landlords[lIdx] = landlord;
      } else {
        this.landlords.unshift(landlord);
      }
    }

    // Upsert photos
    if (photos && photos.length > 0) {
      // Remove old photos for this property
      this.photos = this.photos.filter((ph) => ph.property_id !== property.id);
      this.photos.push(...photos);
    }
  }

  getProperty(propertyNo: string) {
    const property = this.properties.find((p) => p.property_no === propertyNo.toUpperCase());
    if (!property) return null;
    const landlord = this.landlords.find((l) => l.property_id === property.id);
    const photos = this.photos.filter((p) => p.property_id === property.id);
    return { property, landlord, photos };
  }

  getAllProperties() {
    return this.properties.map((p) => {
      const landlord = this.landlords.find((l) => l.property_id === p.id);
      const photos = this.photos.filter((ph) => ph.property_id === p.id);
      return { property: p, landlord, photosCount: photos.length };
    });
  }
}

export const automationStore = new AutomationStore();
