import { WebSocket } from 'ws';
import { AutomationJob, JobStatus, LogLevel, PropertyData, LandlordData, PropertyPhoto } from '../src/types/automation';
import { automationStore } from './store';

export type BroadcastFunction = (event: string, payload: any) => void;
export type AgentSocketGetter = (deviceId: string) => WebSocket | undefined;

interface PendingJobWaiter {
  resolve: (val: any) => void;
  reject: (err: any) => void;
  timeoutHandle: NodeJS.Timeout;
}

export class AutomationEngine {
  private broadcast: BroadcastFunction;
  private getAgentSocket?: AgentSocketGetter;
  private pendingWaiters = new Map<string, PendingJobWaiter>();

  constructor(broadcast: BroadcastFunction, getAgentSocket?: AgentSocketGetter) {
    this.broadcast = broadcast;
    this.getAgentSocket = getAgentSocket;
  }

  setAgentSocketGetter(getter: AgentSocketGetter) {
    this.getAgentSocket = getter;
  }

  // Handle Pause
  pauseJob(jobId: string): boolean {
    const job = automationStore.getJobById(jobId);
    if (job && job.status !== 'COMPLETED' && job.status !== 'FAILED') {
      automationStore.updateJob(jobId, { status: 'PAUSED' });
      this.broadcast('job.paused', { jobId });
      automationStore.addLog({
        jobId,
        propertyNo: job.propertyNo,
        timestamp: new Date().toISOString(),
        level: 'WARNING',
        action: 'Job Paused',
        message: 'Automation execution paused by user',
      });

      // Send pause to agent if connected
      const agentWs = this.getAgentSocket?.(job.deviceId);
      if (agentWs && agentWs.readyState === WebSocket.OPEN) {
        agentWs.send(JSON.stringify({ event: 'job.pause', payload: { jobId } }));
      }
      return true;
    }
    return false;
  }

  // Handle Resume
  resumeJob(jobId: string): boolean {
    const job = automationStore.getJobById(jobId);
    if (job && job.status === 'PAUSED') {
      automationStore.updateJob(jobId, { status: 'RUNNING' });
      this.broadcast('job.resumed', { jobId });
      automationStore.addLog({
        jobId,
        propertyNo: job.propertyNo,
        timestamp: new Date().toISOString(),
        level: 'INFO',
        action: 'Job Resumed',
        message: 'Automation execution resumed',
      });

      // Send resume to agent if connected
      const agentWs = this.getAgentSocket?.(job.deviceId);
      if (agentWs && agentWs.readyState === WebSocket.OPEN) {
        agentWs.send(JSON.stringify({ event: 'job.resume', payload: { jobId } }));
      }
      return true;
    }
    return false;
  }

  // Handle Cancel / Emergency Stop
  cancelJob(jobId: string, isEmergency = false): boolean {
    const job = automationStore.getJobById(jobId);
    if (!job) return false;

    const waiter = this.pendingWaiters.get(jobId);
    if (waiter) {
      clearTimeout(waiter.timeoutHandle);
      this.pendingWaiters.delete(jobId);
      waiter.reject(new Error(isEmergency ? 'EMERGENCY_STOP' : 'JOB_CANCELLED'));
    }

    const updatedJob = automationStore.updateJob(jobId, {
      status: 'CANCELLED',
      errorMessage: isEmergency ? 'Emergency stop triggered by operator' : 'Job cancelled by user',
      completedAt: new Date().toISOString(),
    });

    this.broadcast('job.cancelled', { jobId, isEmergency });
    automationStore.addLog({
      jobId,
      propertyNo: job.propertyNo,
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      action: isEmergency ? 'EMERGENCY_STOP' : 'Cancel Job',
      message: isEmergency
        ? 'EMERGENCY STOPPED: Sent halt signal to desktop agent immediately.'
        : 'Job execution was cancelled by user request.',
    });

    // Send stop signal to Windows Agent
    const agentWs = this.getAgentSocket?.(job.deviceId);
    if (agentWs && agentWs.readyState === WebSocket.OPEN) {
      agentWs.send(
        JSON.stringify({
          event: isEmergency ? 'job.emergency_stop' : 'job.cancel',
          payload: { jobId, isEmergency },
        })
      );
    }

    return !!updatedJob;
  }

  // Run Job: Sends command to real Windows Agent via WebSocket and waits for response
  async runJob(jobId: string): Promise<void> {
    const job = automationStore.getJobById(jobId);
    if (!job) return;

    const propertyNo = job.propertyNo.toUpperCase();
    const device = automationStore.getDeviceById(job.deviceId);

    // 1. Check if Windows Agent is connected and device is ONLINE
    const agentWs = this.getAgentSocket?.(job.deviceId);
    const isDeviceOnline = device && device.status === 'ONLINE';
    const isSocketOpen = agentWs && agentWs.readyState === WebSocket.OPEN;

    if (!isDeviceOnline || !isSocketOpen) {
      const errMsg = `ไม่สามารถเริ่ม Automation ได้: Windows Agent (${device?.name || job.deviceId}) ออฟไลน์ กรุณาเปิดโปรแกรม PEAK Automation Agent บน Windows`;
      automationStore.updateJob(jobId, {
        status: 'FAILED',
        errorMessage: errMsg,
        completedAt: new Date().toISOString(),
      });

      const failLog = automationStore.addLog({
        jobId,
        propertyNo,
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        action: 'Agent Offline Check',
        message: errMsg,
        errorCode: 'AGENT_OFFLINE',
        errorMessage: errMsg,
      });

      this.broadcast('job.failed', {
        jobId,
        propertyNo,
        errorCode: 'AGENT_OFFLINE',
        errorMessage: errMsg,
      });
      this.broadcast('job.log', failLog);
      return;
    }

    // 2. Mark job as CONNECTING and notify clients
    automationStore.updateJob(jobId, {
      status: 'CONNECTING',
      startedAt: new Date().toISOString(),
      progress: 5,
      currentStep: `ส่งคำสั่งไปยัง Windows Agent (${device?.name || 'Office PC'})`,
    });

    this.broadcast('job.started', { jobId, propertyNo, deviceId: job.deviceId });

    const startLog = automationStore.addLog({
      jobId,
      propertyNo,
      timestamp: new Date().toISOString(),
      level: 'INFO',
      action: 'Dispatch Command',
      message: `Dispatching job to Windows Agent on ${device?.name || 'Office PC'} for Property No: ${propertyNo}`,
    });
    this.broadcast('job.log', startLog);

    // 3. Send command to Windows Agent via WebSocket
    try {
      agentWs.send(
        JSON.stringify({
          event: 'job.start',
          payload: {
            jobId,
            propertyNo,
            options: job.options,
            dryRun: job.dryRun,
          },
        })
      );
    } catch (err: any) {
      const sendErr = `Failed to send command to Windows Agent: ${err?.message || err}`;
      automationStore.updateJob(jobId, {
        status: 'FAILED',
        errorMessage: sendErr,
        completedAt: new Date().toISOString(),
      });
      this.broadcast('job.failed', { jobId, propertyNo, errorCode: 'DISPATCH_ERROR', errorMessage: sendErr });
      return;
    }

    // 4. Wait for real events from Windows Agent with a safety timeout (120 seconds)
    return new Promise<void>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingWaiters.delete(jobId);
        const timeoutMsg = `หมดเวลาการรอคอยข้อมูลจาก Windows Agent สำหรับรหัสทรัพย์ ${propertyNo} (TIMEOUT 120s)`;
        automationStore.updateJob(jobId, {
          status: 'FAILED',
          errorMessage: timeoutMsg,
          completedAt: new Date().toISOString(),
        });
        const tLog = automationStore.addLog({
          jobId,
          propertyNo,
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          action: 'Agent Timeout',
          message: timeoutMsg,
          errorCode: 'TIMEOUT',
          errorMessage: timeoutMsg,
        });
        this.broadcast('job.failed', {
          jobId,
          propertyNo,
          errorCode: 'TIMEOUT',
          errorMessage: timeoutMsg,
        });
        this.broadcast('job.log', tLog);
        resolve(); // resolve promise so batch sequential queue can proceed
      }, 120000);

      this.pendingWaiters.set(jobId, { resolve, reject, timeoutHandle });
    });
  }

  // Handle agent.step / job.progress from Windows Agent
  handleAgentStep(payload: any) {
    const { jobId, status, currentStep, progress, stepNumber } = payload;
    if (!jobId) return;

    const job = automationStore.getJobById(jobId);
    if (!job) return;

    const updates: Partial<AutomationJob> = {};
    if (status) updates.status = status;
    if (currentStep) updates.currentStep = currentStep;
    if (typeof progress === 'number') updates.progress = progress;

    automationStore.updateJob(jobId, updates);

    this.broadcast('job.progress', {
      jobId,
      propertyNo: job.propertyNo,
      status: updates.status || job.status,
      currentStep: updates.currentStep || job.currentStep,
      progress: updates.progress ?? job.progress,
      stepNumber,
    });
  }

  // Handle agent.log / job.log from Windows Agent
  handleAgentLog(payload: any) {
    const { jobId, level, action, message, timestamp, screenshotPath, errorCode, errorMessage } = payload;
    if (!jobId) return;

    const job = automationStore.getJobById(jobId);
    const log = automationStore.addLog({
      jobId,
      propertyNo: job?.propertyNo || '',
      timestamp: timestamp || new Date().toISOString(),
      level: (level as LogLevel) || 'INFO',
      action: action || 'Agent Action',
      message: message || '',
      screenshotPath,
      errorCode,
      errorMessage,
    });

    this.broadcast('job.log', log);
  }

  // Handle agent.data / job.screenshot from Windows Agent
  handleAgentData(payload: any) {
    const { jobId, screenshot, data } = payload;
    if (!jobId) return;

    const job = automationStore.getJobById(jobId);
    this.broadcast('job.screenshot', {
      jobId,
      propertyNo: job?.propertyNo || '',
      screenshot,
      data,
    });
  }

  // Handle agent.completed / job.completed from Windows Agent
  handleAgentCompleted(payload: any) {
    const { jobId, propertyNo, property, landlord, photosCount, photos } = payload;
    if (!jobId) return;

    const job = automationStore.getJobById(jobId);
    const cleanPropNo = (propertyNo || job?.propertyNo || '').toUpperCase();
    const propertyId = `prop-${cleanPropNo.toLowerCase()}-${Date.now().toString(36)}`;

    // Build real PropertyData from Agent payload
    const realProperty: PropertyData = {
      id: propertyId,
      property_no: cleanPropNo,
      project_name: property?.project_name || property?.projectName || cleanPropNo,
      category: property?.category || 'Condominium',
      status: property?.status || 'Available',
      approval_status: property?.approval_status || 'Approved',
      city: property?.city || 'Bangkok',
      area: property?.area || '',
      district: property?.district || '',
      room_type: property?.room_type || property?.roomType || '',
      room_no: property?.room_no || property?.roomNo || '',
      building_no: property?.building_no || property?.buildingNo || '',
      floor: property?.floor || '',
      bedroom: Number(property?.bedroom) || 0,
      bathroom: Number(property?.bathroom) || 0,
      building_area: Number(property?.building_area || property?.buildingArea) || 0,
      land_area: Number(property?.land_area || property?.landArea) || 0,
      agent: property?.agent || 'PEAK Automation',
      rent_price_year: Number(property?.rent_price_year || property?.rentPriceYear) || 0,
      sale_price: Number(property?.sale_price || property?.salePrice) || 0,
      rent_to: property?.rent_to || property?.rentTo || '',
      register_time: new Date().toISOString(),
      comments: property?.comments || 'Imported via Windows Agent',
      follow_up: property?.follow_up || property?.followUp || '',
      agency_type: property?.agency_type || property?.agencyType || 'Direct',
      website_status: property?.website_status || property?.websiteStatus || 'Draft',
      label: property?.label || '',
      source: 'Prime Global Asset',
      source_property_no: cleanPropNo,
      source_captured_at: new Date().toISOString(),
      source_device: job?.deviceName || 'Windows Agent',
      source_job_id: job?.jobNo || jobId,
    };

    // Build real LandlordData from Agent payload
    const realLandlord: LandlordData = {
      id: `lld-${propertyId}`,
      property_id: propertyId,
      name: landlord?.name || '',
      phone_no_1: landlord?.phone_no_1 || landlord?.phone || '',
      phone_no_2: landlord?.phone_no_2 || '',
      email: landlord?.email || '',
      national: landlord?.national || 'Thai',
      representatives: landlord?.representatives || [],
      cleaning_staff: landlord?.cleaning_staff || [],
      other_contacts: landlord?.other_contacts || [],
    };

    // Build real PropertyPhoto array
    const realPhotosList: PropertyPhoto[] = Array.isArray(photos)
      ? photos.map((ph: any, idx: number) => ({
          id: `ph-${cleanPropNo}-${idx + 1}`,
          property_id: propertyId,
          storage_path: ph.storagePath || `property-images/${cleanPropNo}/${idx + 1}.jpg`,
          public_url: ph.url || ph.publicUrl || '',
          file_name: ph.fileName || `${idx + 1}.jpg`,
          original_order: idx + 1,
          is_cover: idx === 0,
          is_published: true,
          source: 'Prime Global Asset',
          created_at: new Date().toISOString(),
        }))
      : [];

    const realPhotosCount = Number(photosCount) || realPhotosList.length || 0;

    // Save to database only if not dryRun
    if (!job?.dryRun) {
      automationStore.savePropertyData(realProperty, realLandlord, realPhotosList);
    }

    // Update job as COMPLETED with real resultData
    automationStore.updateJob(jobId, {
      status: 'COMPLETED',
      progress: 100,
      currentStep: 'ดึงข้อมูลและบันทึกลง PEAK สำเร็จเรียบร้อย',
      completedAt: new Date().toISOString(),
      resultData: {
        property: realProperty,
        landlord: realLandlord,
        photosCount: realPhotosCount,
        photos: realPhotosList,
        extractedAt: new Date().toISOString(),
      },
    });

    const completionLog = automationStore.addLog({
      jobId,
      propertyNo: cleanPropNo,
      timestamp: new Date().toISOString(),
      level: 'SUCCESS',
      action: 'Job Completed',
      message: `Property ${cleanPropNo} automation completed successfully: ${realPhotosCount} photos, Landlord: ${realLandlord.name || '—'} (${realLandlord.phone_no_1 || '—'})`,
    });

    this.broadcast('job.completed', {
      jobId,
      propertyNo: cleanPropNo,
      property: realProperty,
      landlord: realLandlord,
      photosCount: realPhotosCount,
    });
    this.broadcast('job.progress', {
      jobId,
      propertyNo: cleanPropNo,
      status: 'COMPLETED',
      currentStep: 'ดึงข้อมูลและบันทึกลง PEAK สำเร็จเรียบร้อย',
      progress: 100,
    });
    this.broadcast('job.log', completionLog);

    // Resolve waiter
    const waiter = this.pendingWaiters.get(jobId);
    if (waiter) {
      clearTimeout(waiter.timeoutHandle);
      this.pendingWaiters.delete(jobId);
      waiter.resolve(payload);
    }
  }

  // Handle agent.error / job.failed from Windows Agent
  handleAgentFailed(payload: any) {
    const { jobId, error, errorCode, errorMessage } = payload;
    if (!jobId) return;

    const job = automationStore.getJobById(jobId);
    const failMsg = error || errorMessage || 'เกิดข้อผิดพลาดในการทำงานของ Windows Agent';

    automationStore.updateJob(jobId, {
      status: 'FAILED',
      errorMessage: failMsg,
      completedAt: new Date().toISOString(),
    });

    const errLog = automationStore.addLog({
      jobId,
      propertyNo: job?.propertyNo || '',
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      action: 'Agent Execution Error',
      message: failMsg,
      errorCode: errorCode || 'AGENT_ERROR',
      errorMessage: failMsg,
    });

    this.broadcast('job.failed', {
      jobId,
      propertyNo: job?.propertyNo || '',
      errorCode: errorCode || 'AGENT_ERROR',
      errorMessage: failMsg,
    });
    this.broadcast('job.log', errLog);

    // Resolve waiter so sequential batch queue can proceed
    const waiter = this.pendingWaiters.get(jobId);
    if (waiter) {
      clearTimeout(waiter.timeoutHandle);
      this.pendingWaiters.delete(jobId);
      waiter.resolve(payload);
    }
  }
}
