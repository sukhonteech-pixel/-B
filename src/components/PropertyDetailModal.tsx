import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Building2,
  Phone,
  Image as ImageIcon,
  FileText,
  History,
  Edit2,
  Trash2,
  Archive,
  Save,
  Plus,
  Download,
  Star,
  Check,
  AlertCircle,
  Eye,
  RefreshCw,
  Clock,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  DollarSign,
  MapPin,
  FileSpreadsheet,
} from 'lucide-react';
import { PropertyDetailResponse, api } from '../services/api';

interface PropertyDetailModalProps {
  propertyNo: string;
  onClose: () => void;
  onRefreshList: () => void;
}

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({
  propertyNo,
  onClose,
  onRefreshList,
}) => {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [detail, setDetail] = useState<PropertyDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit Property Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saveLoading, setSaveLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New Contact Form state
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({
    contact_name: '',
    contact_type: 'Owner' as const,
    phone: '',
    email: '',
  });

  // Edit Contact inline state
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactForm, setEditContactForm] = useState({
    contact_name: '',
    contact_type: 'Owner' as const,
    phone: '',
    email: '',
  });

  // Photo Preview Modal
  const [previewPhoto, setPreviewPhoto] = useState<{ url: string; name: string; id: string } | null>(null);

  const loadPropertyDetail = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getProperty(propertyNo);
      setDetail(data);
      setEditForm(data.property);
    } catch (err: any) {
      console.error('Failed to load property details:', err);
      setErrorMsg(`ไม่สามารถโหลดข้อมูลทรัพย์: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPropertyDetail();
  }, [propertyNo]);

  const showFeedback = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  };

  // 1. Save Property Edit
  const handleSaveEdit = async () => {
    if (!detail) return;
    setSaveLoading(true);
    setErrorMsg(null);
    try {
      await api.updateProperty(detail.property.id, editForm);
      setIsEditing(false);
      await loadPropertyDetail();
      onRefreshList();
      showFeedback('บันทึกการแก้ไขข้อมูลทรัพย์เรียบร้อยแล้ว');
    } catch (err: any) {
      setErrorMsg(`เกิดข้อผิดพลาดในการบันทึก: ${err.message}`);
    } finally {
      setSaveLoading(false);
    }
  };

  // 2. Archive Property (Soft Delete)
  const handleArchive = async () => {
    if (!detail) return;
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการจัดเก็บ (Archive) ทรัพย์ ${detail.property.property_no}?`)) return;
    try {
      await api.archiveProperty(detail.property.id);
      onRefreshList();
      onClose();
    } catch (err: any) {
      alert(`Archive error: ${err.message}`);
    }
  };

  // 3. Delete Property Permanently (Hard Delete)
  const handleDeletePermanent = async () => {
    if (!detail) return;
    if (!window.confirm(`⚠️ คำเตือน: คุณต้องการลบทรัพย์ ${detail.property.property_no} และรูปภาพ/เอกสารทั้งหมดอย่างถาวรใช่หรือไม่? ข้อมูลจะไม่สามารถกู้คืนได้`)) return;
    try {
      await api.deletePropertyPermanently(detail.property.id);
      onRefreshList();
      onClose();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  // 4. Contact: Add
  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail || !newContact.phone.trim()) return;
    try {
      await api.addContact(detail.property.id, newContact);
      setNewContact({ contact_name: '', contact_type: 'Owner', phone: '', email: '' });
      setShowAddContact(false);
      await loadPropertyDetail();
      onRefreshList();
      showFeedback('เพิ่มเบอร์โทรผู้ติดต่อเรียบร้อยแล้ว');
    } catch (err: any) {
      alert(`Add contact error: ${err.message}`);
    }
  };

  // 5. Contact: Edit
  const handleStartEditContact = (c: any) => {
    setEditingContactId(c.id);
    setEditContactForm({
      contact_name: c.contact_name,
      contact_type: c.contact_type,
      phone: c.phone,
      email: c.email || '',
    });
  };

  const handleSaveContactEdit = async (contactId: string) => {
    if (!editContactForm.phone.trim()) {
      alert('กรุณาระบุเบอร์โทร');
      return;
    }
    try {
      await api.updateContact(contactId, editContactForm);
      setEditingContactId(null);
      await loadPropertyDetail();
      onRefreshList();
      showFeedback('อัปเดตข้อมูลผู้ติดต่อเรียบร้อยแล้ว');
    } catch (err: any) {
      alert(`Update contact error: ${err.message}`);
    }
  };

  // 6. Contact: Delete
  const handleDeleteContact = async (contactId: string) => {
    if (!window.confirm('คุณต้องการลบข้อมูลผู้ติดต่อนี้ใช่หรือไม่?')) return;
    try {
      await api.deleteContact(contactId);
      await loadPropertyDetail();
      onRefreshList();
      showFeedback('ลบเบอร์โทรผู้ติดต่อเรียบร้อยแล้ว');
    } catch (err: any) {
      alert(`Delete contact error: ${err.message}`);
    }
  };

  // 7. Photos: Upload Multiple
  const handleUploadPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !detail) return;
    setLoading(true);
    try {
      await api.uploadPhotos(detail.property.id, Array.from(files));
      await loadPropertyDetail();
      onRefreshList();
      showFeedback(`อัปโหลดรูปภาพ ${files.length} ไฟล์เข้า Supabase Storage เรียบร้อยแล้ว`);
    } catch (err: any) {
      alert(`Upload photos error: ${err.message}`);
    } finally {
      setLoading(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // 8. Photos: Set Cover Photo
  const handleSetCoverPhoto = async (photoId: string) => {
    if (!detail) return;
    try {
      await api.setCoverPhoto(detail.property.id, photoId);
      await loadPropertyDetail();
      onRefreshList();
      showFeedback('ตั้งค่ารูปหน้าปก (Cover Photo) เรียบร้อย');
    } catch (err: any) {
      alert(`Set cover error: ${err.message}`);
    }
  };

  // 9. Photos: Reorder
  const handleMovePhoto = async (photoId: string, direction: 'up' | 'down') => {
    if (!detail || detail.photos.length <= 1) return;
    const sorted = [...detail.photos].sort((a, b) => a.sort_order - b.sort_order);
    const index = sorted.findIndex((p) => p.id === photoId);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      const temp = sorted[index];
      sorted[index] = sorted[index - 1];
      sorted[index - 1] = temp;
    } else if (direction === 'down' && index < sorted.length - 1) {
      const temp = sorted[index];
      sorted[index] = sorted[index + 1];
      sorted[index + 1] = temp;
    } else {
      return;
    }

    try {
      const reorderedIds = sorted.map((p) => p.id);
      await api.reorderPhotos(detail.property.id, reorderedIds);
      await loadPropertyDetail();
      showFeedback('จัดลำดับรูปภาพเรียบร้อย');
    } catch (err: any) {
      alert(`Reorder error: ${err.message}`);
    }
  };

  // 10. Photos: Delete
  const handleDeletePhoto = async (photoId: string) => {
    if (!window.confirm('คุณต้องการลบรูปภาพนี้ใช่หรือไม่?')) return;
    try {
      await api.deletePhoto(photoId);
      await loadPropertyDetail();
      onRefreshList();
      showFeedback('ลบรูปภาพเรียบร้อยแล้ว');
    } catch (err: any) {
      alert(`Delete photo error: ${err.message}`);
    }
  };

  // 11. Files: Upload Multiple
  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !detail) return;
    setLoading(true);
    try {
      await api.uploadFiles(detail.property.id, Array.from(files));
      await loadPropertyDetail();
      onRefreshList();
      showFeedback(`อัปโหลดเอกสาร ${files.length} ไฟล์เข้า Supabase Storage เรียบร้อยแล้ว`);
    } catch (err: any) {
      alert(`Upload files error: ${err.message}`);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 12. Files: Delete
  const handleDeleteFile = async (fileId: string) => {
    if (!window.confirm('คุณต้องการลบไฟล์เอกสารนี้ใช่หรือไม่?')) return;
    try {
      await api.deleteFile(fileId);
      await loadPropertyDetail();
      onRefreshList();
      showFeedback('ลบไฟล์เอกสารเรียบร้อยแล้ว');
    } catch (err: any) {
      alert(`Delete file error: ${err.message}`);
    }
  };

  // Quick Section Navigation
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Sticky Header Bar */}
        <div className="p-4 sm:p-5 bg-zinc-900 text-white flex items-center justify-between gap-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-900 flex items-center justify-center font-bold text-white shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-extrabold tracking-wider text-red-400">
                  {detail?.property.property_no || propertyNo}
                </span>
                {detail && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      detail.property.status === 'Available'
                        ? 'bg-emerald-600 text-white'
                        : detail.property.status === 'Rented'
                        ? 'bg-blue-600 text-white'
                        : detail.property.status === 'Sold'
                        ? 'bg-zinc-700 text-white'
                        : 'bg-amber-600 text-white'
                    }`}
                  >
                    {detail.property.status}
                  </span>
                )}
              </div>
              <h2 className="text-xs sm:text-sm font-semibold text-zinc-300 truncate max-w-md mt-0.5">
                {detail?.property.property_name || 'Loading Property...'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {detail && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Edit Property
              </button>
            )}

            {isEditing && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={saveLoading}
                  className="px-4 py-1.5 rounded-lg bg-red-800 hover:bg-red-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                >
                  {saveLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleArchive}
              title="Archive Property"
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            >
              <Archive className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleDeletePermanent}
              title="Delete Permanently"
              className="p-2 rounded-lg bg-zinc-800 hover:bg-red-900 text-zinc-400 hover:text-white transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Section Quick Jump Bar */}
        <div className="flex border-b border-zinc-200 bg-zinc-50 px-4 sm:px-6 overflow-x-auto text-xs font-bold shrink-0 scrollbar-none py-2 gap-2">
          <button
            type="button"
            onClick={() => scrollToSection('sec-info')}
            className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
          >
            <Building2 className="w-3.5 h-3.5 text-zinc-500" />
            1. Property Info
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('sec-pricing')}
            className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            2. Pricing
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('sec-location')}
            className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
          >
            <MapPin className="w-3.5 h-3.5 text-zinc-500" />
            3. Location & Specs
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('sec-contacts')}
            className="px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-950 hover:bg-red-100 flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
          >
            <Phone className="w-3.5 h-3.5 text-red-800" />
            4. Phone Contacts ({detail?.contacts.length || 0})
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('sec-photos-files')}
            className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-950 hover:bg-blue-100 flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
          >
            <ImageIcon className="w-3.5 h-3.5 text-blue-800" />
            5. Photos & Files ({detail ? detail.photos.length + detail.files.length : 0})
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('sec-history')}
            className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100 flex items-center gap-1.5 shadow-2xs whitespace-nowrap ml-auto"
          >
            <History className="w-3.5 h-3.5 text-zinc-500" />
            History ({detail?.updateLogs.length || 0})
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {loading && !detail && (
            <div className="py-24 text-center text-zinc-400 text-xs flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-7 h-7 animate-spin text-red-900" />
              <span>กำลังโหลดข้อมูลจากฐานข้อมูล...</span>
            </div>
          )}

          {detail && (
            <>
              {/* ========================================================================= */}
              {/* SECTION 1: PROPERTY INFORMATION */}
              {/* ========================================================================= */}
              <section id="sec-info" className="bg-white rounded-xl border border-zinc-200 shadow-2xs p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                        1. Property Information (ข้อมูลทรัพย์สิน)
                      </h3>
                      <p className="text-[11px] text-zinc-500">
                        ข้อมูลหลัก รหัสทรัพย์ ชื่อโครงการ สถานะ และประเภทของอสังหาริมทรัพย์
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs px-2.5 py-1 rounded bg-zinc-100 font-bold text-zinc-800">
                    ID: {detail.property.property_no}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                  <div>
                    <label className="text-zinc-500 text-[11px] block font-semibold mb-1">Property No (รหัสทรัพย์)</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.property_no || ''}
                        onChange={(e) => setEditForm({ ...editForm, property_no: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded font-mono font-bold"
                      />
                    ) : (
                      <span className="font-mono font-bold text-zinc-900 text-sm">{detail.property.property_no}</span>
                    )}
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[11px] block font-semibold mb-1">Property Name (ชื่อทรัพย์)</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.property_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, property_name: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded font-semibold"
                      />
                    ) : (
                      <span className="font-semibold text-zinc-900">{detail.property.property_name}</span>
                    )}
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[11px] block font-semibold mb-1">Project Name (โครงการ)</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.project_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, project_name: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded"
                      />
                    ) : (
                      <span className="font-medium text-zinc-800">{detail.property.project_name || '-'}</span>
                    )}
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[11px] block font-semibold mb-1">Category (หมวดหมู่)</label>
                    {isEditing ? (
                      <select
                        value={editForm.category || 'Condominium'}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded"
                      >
                        <option value="Condominium">Condominium</option>
                        <option value="House">House</option>
                        <option value="Villa">Villa</option>
                        <option value="Townhouse">Townhouse</option>
                        <option value="Land">Land</option>
                        <option value="Commercial">Commercial</option>
                      </select>
                    ) : (
                      <span className="font-medium text-zinc-800">{detail.property.category}</span>
                    )}
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[11px] block font-semibold mb-1">Property Type</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.property_type || ''}
                        onChange={(e) => setEditForm({ ...editForm, property_type: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded"
                      />
                    ) : (
                      <span className="font-medium text-zinc-800">{detail.property.property_type || 'Residential'}</span>
                    )}
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[11px] block font-semibold mb-1">Status (สถานะ)</label>
                    {isEditing ? (
                      <select
                        value={editForm.status || 'Available'}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded font-semibold"
                      >
                        <option value="Available">Available</option>
                        <option value="Rented">Rented</option>
                        <option value="Sold">Sold</option>
                        <option value="Pending">Pending</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    ) : (
                      <span className="font-bold text-zinc-900">{detail.property.status}</span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <div className="pt-2">
                  <label className="text-zinc-500 text-[11px] block font-semibold mb-1">Description (รายละเอียดทรัพย์)</label>
                  {isEditing ? (
                    <textarea
                      rows={3}
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      className="w-full p-2.5 bg-zinc-50 border border-zinc-300 rounded-lg text-xs"
                    />
                  ) : (
                    <p className="text-zinc-700 whitespace-pre-wrap leading-relaxed bg-zinc-50/70 p-3 rounded-lg border border-zinc-100 text-xs">
                      {detail.property.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                    </p>
                  )}
                </div>
              </section>

              {/* ========================================================================= */}
              {/* SECTION 2: PRICING */}
              {/* ========================================================================= */}
              <section id="sec-pricing" className="bg-zinc-900 text-white rounded-xl p-5 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-zinc-800 flex items-center justify-center text-red-400">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                        2. Pricing (ราคาเช่าและราคาขาย - สกุลเงินบาท THB)
                      </h3>
                      <p className="text-[11px] text-zinc-400">
                        จัดเก็บและคำนวณเป็นค่าตัวเลขจริงในฐานข้อมูล
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Rent Price */}
                  <div className="bg-zinc-800/80 p-4 rounded-xl border border-zinc-700/80">
                    <span className="text-[11px] text-zinc-400 uppercase tracking-wider block font-semibold">
                      Rent Price (ราคาเช่า / เดือน)
                    </span>
                    {isEditing ? (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm font-mono text-zinc-400">฿</span>
                        <input
                          type="number"
                          value={editForm.rent_price || 0}
                          onChange={(e) => setEditForm({ ...editForm, rent_price: Number(e.target.value) })}
                          className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-red-400 font-mono font-bold text-base"
                        />
                        <span className="text-xs text-zinc-400">THB/mo</span>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold font-mono text-red-400 tracking-tight">
                          {detail.property.rent_price > 0 ? `฿${detail.property.rent_price.toLocaleString()}` : '-'}
                        </span>
                        {detail.property.rent_price > 0 && <span className="text-xs text-zinc-400">THB / month</span>}
                      </div>
                    )}
                  </div>

                  {/* Sale Price */}
                  <div className="bg-zinc-800/80 p-4 rounded-xl border border-zinc-700/80">
                    <span className="text-[11px] text-zinc-400 uppercase tracking-wider block font-semibold">
                      Sale Price (ราคาขาย)
                    </span>
                    {isEditing ? (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm font-mono text-zinc-400">฿</span>
                        <input
                          type="number"
                          value={editForm.sale_price || 0}
                          onChange={(e) => setEditForm({ ...editForm, sale_price: Number(e.target.value) })}
                          className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-600 rounded text-white font-mono font-bold text-base"
                        />
                        <span className="text-xs text-zinc-400">THB</span>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold font-mono text-white tracking-tight">
                          {detail.property.sale_price > 0 ? `฿${detail.property.sale_price.toLocaleString()}` : '-'}
                        </span>
                        {detail.property.sale_price > 0 && <span className="text-xs text-zinc-400">THB</span>}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* ========================================================================= */}
              {/* SECTION 3: LOCATION / OTHER DETAILS */}
              {/* ========================================================================= */}
              <section id="sec-location" className="bg-white rounded-xl border border-zinc-200 shadow-2xs p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                        3. Location & Specification Details (ทำเล สเปก และรายละเอียดอื่นๆ)
                      </h3>
                      <p className="text-[11px] text-zinc-500">
                        ตำแหน่งที่ตั้ง จำนวนห้องนอน ห้องน้ำ ขนาดพื้นที่ และข้อมูลนำเข้าเพิ่มเติม
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="text-zinc-500 text-[11px] block font-semibold mb-1">Location / Address</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.location || ''}
                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded"
                      />
                    ) : (
                      <span className="font-medium text-zinc-800">{detail.property.location || '-'}</span>
                    )}
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[11px] block font-semibold mb-1">Zone (โซน)</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.zone || ''}
                        onChange={(e) => setEditForm({ ...editForm, zone: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded"
                      />
                    ) : (
                      <span className="font-medium text-zinc-800">{detail.property.zone || '-'}</span>
                    )}
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[11px] block font-semibold mb-1">Bedrooms</label>
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        value={editForm.bedroom || 0}
                        onChange={(e) => setEditForm({ ...editForm, bedroom: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded"
                      />
                    ) : (
                      <span className="font-bold text-zinc-900">{detail.property.bedroom} Beds</span>
                    )}
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[11px] block font-semibold mb-1">Bathrooms</label>
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        value={editForm.bathroom || 0}
                        onChange={(e) => setEditForm({ ...editForm, bathroom: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded"
                      />
                    ) : (
                      <span className="font-bold text-zinc-900">{detail.property.bathroom} Baths</span>
                    )}
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[11px] block font-semibold mb-1">Building Area (ตร.ม.)</label>
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        value={editForm.building_area || 0}
                        onChange={(e) => setEditForm({ ...editForm, building_area: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded"
                      />
                    ) : (
                      <span className="font-mono text-zinc-800">{detail.property.building_area ? `${detail.property.building_area} m²` : '-'}</span>
                    )}
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[11px] block font-semibold mb-1">Land Area (ตร.ว.)</label>
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        value={editForm.land_area || 0}
                        onChange={(e) => setEditForm({ ...editForm, land_area: Number(e.target.value) })}
                        className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded"
                      />
                    ) : (
                      <span className="font-mono text-zinc-800">{detail.property.land_area ? `${detail.property.land_area} sqw` : '-'}</span>
                    )}
                  </div>

                  <div>
                    <label className="text-zinc-500 text-[11px] block font-semibold mb-1">Floor (ชั้น)</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editForm.floor || ''}
                        onChange={(e) => setEditForm({ ...editForm, floor: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-zinc-50 border border-zinc-300 rounded"
                      />
                    ) : (
                      <span className="text-zinc-800">{detail.property.floor || '-'}</span>
                    )}
                  </div>
                </div>

                {/* Additional Dynamic Data from Excel */}
                {detail.property.additional_data && Object.keys(detail.property.additional_data).length > 0 && (
                  <div className="pt-3 border-t border-zinc-100">
                    <span className="text-xs font-bold text-zinc-700 block mb-2">
                      Additional Columns from Excel:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      {Object.entries(detail.property.additional_data).map(([key, val]) => (
                        <div key={key} className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-200">
                          <span className="text-[10px] text-zinc-400 block uppercase font-mono">{key}</span>
                          <span className="text-xs font-semibold text-zinc-800 truncate block mt-0.5">
                            {String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* ========================================================================= */}
              {/* SECTION 4: PHONE CONTACTS (MUST BE AFTER PROPERTY INFO!) */}
              {/* ========================================================================= */}
              <section id="sec-contacts" className="bg-white rounded-xl border-2 border-red-900/30 shadow-2xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-100 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-900 font-bold">
                      <Phone className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                        4. Phone Contacts (เบอร์โทรศัพท์ผู้ติดต่อทั้งหมด)
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-900 text-[10px] font-mono">
                          {detail.contacts.length} เบอร์
                        </span>
                      </h3>
                      <p className="text-[11px] text-zinc-500">
                        อยู่หลังข้อมูล Property ทั้งหมด • รองรับหลายเบอร์โทร บันทึกลง Supabase Database จริง
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddContact(!showAddContact)}
                    className="px-3 py-1.5 rounded-lg bg-red-900 hover:bg-red-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    + เพิ่มเบอร์โทรศัพท์
                  </button>
                </div>

                {/* Add Contact Form Modal/Inline */}
                {showAddContact && (
                  <form onSubmit={handleAddContact} className="p-4 bg-red-50/40 rounded-xl border border-red-200 space-y-3">
                    <h4 className="font-bold text-xs text-red-950 flex items-center gap-1.5">
                      <Plus className="w-4 h-4" /> เพิ่มเบอร์โทรผู้ติดต่อใหม่
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] text-zinc-600 mb-1 font-semibold">ชื่อผู้ติดต่อ</label>
                        <input
                          type="text"
                          required
                          placeholder="เช่น คุณเอก (เจ้าของห้อง)"
                          value={newContact.contact_name}
                          onChange={(e) => setNewContact({ ...newContact, contact_name: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] text-zinc-600 mb-1 font-semibold">ประเภทผู้ติดต่อ</label>
                        <select
                          value={newContact.contact_type}
                          onChange={(e) => setNewContact({ ...newContact, contact_type: e.target.value as any })}
                          className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs font-semibold"
                        >
                          <option value="Owner">Owner (เจ้าของ)</option>
                          <option value="Agent">Agent (ตัวแทน)</option>
                          <option value="Co-Agent">Co-Agent (นายหน้าร่วม)</option>
                          <option value="Juristic">Juristic (นิติบุคคล)</option>
                          <option value="Cleaning">Cleaning (แม่บ้าน)</option>
                          <option value="Other">Other (อื่นๆ)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-zinc-600 mb-1 font-semibold">
                          เบอร์โทรศัพท์ (Phone No.)*
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="เช่น 081-999-8888"
                          value={newContact.phone}
                          onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg text-xs font-mono font-bold text-red-950"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddContact(false)}
                        className="px-3 py-1.5 rounded-lg border border-zinc-300 bg-white text-zinc-700 text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-red-900 hover:bg-red-800 text-white text-xs font-bold shadow-xs"
                      >
                        Save Contact
                      </button>
                    </div>
                  </form>
                )}

                {/* Contacts List */}
                {detail.contacts.length === 0 ? (
                  <div className="py-8 text-center text-zinc-400 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-xs">
                    ยังไม่มีเบอร์โทรสำหรับทรัพย์นี้ คลิกปุ่ม "+ เพิ่มเบอร์โทรศัพท์" ด้านบนเพื่อเพิ่มข้อมูล
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {detail.contacts.map((c, idx) => {
                      const isItemEditing = editingContactId === c.id;

                      if (isItemEditing) {
                        return (
                          <div key={c.id} className="p-4 rounded-xl border-2 border-red-900 bg-white shadow-xs space-y-2 text-xs">
                            <span className="font-bold text-red-950 block">แก้ไขข้อมูลผู้ติดต่อ P{idx + 1}</span>
                            <div className="space-y-2">
                              <div>
                                <label className="text-[10px] text-zinc-500 block">ชื่อ</label>
                                <input
                                  type="text"
                                  value={editContactForm.contact_name}
                                  onChange={(e) => setEditContactForm({ ...editContactForm, contact_name: e.target.value })}
                                  className="w-full px-2 py-1 border border-zinc-300 rounded text-xs"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-zinc-500 block">ประเภท</label>
                                  <select
                                    value={editContactForm.contact_type}
                                    onChange={(e) => setEditContactForm({ ...editContactForm, contact_type: e.target.value as any })}
                                    className="w-full px-2 py-1 border border-zinc-300 rounded text-xs"
                                  >
                                    <option value="Owner">Owner</option>
                                    <option value="Agent">Agent</option>
                                    <option value="Co-Agent">Co-Agent</option>
                                    <option value="Juristic">Juristic</option>
                                    <option value="Cleaning">Cleaning</option>
                                    <option value="Other">Other</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] text-zinc-500 block">เบอร์โทร</label>
                                  <input
                                    type="text"
                                    value={editContactForm.phone}
                                    onChange={(e) => setEditContactForm({ ...editContactForm, phone: e.target.value })}
                                    className="w-full px-2 py-1 border border-zinc-300 rounded text-xs font-mono font-bold text-red-900"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setEditingContactId(null)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-100 rounded"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveContactEdit(c.id)}
                                className="px-3 py-1 text-[11px] font-bold text-white bg-red-900 hover:bg-red-800 rounded"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={c.id}
                          className="p-4 rounded-xl border border-zinc-200 bg-white hover:border-zinc-300 shadow-2xs flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center font-mono font-bold text-zinc-700 text-xs">
                              P{idx + 1}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-zinc-900 text-xs">{c.contact_name}</span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-600">
                                  {c.contact_type}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 text-red-900 font-mono font-bold text-sm">
                                <Phone className="w-3.5 h-3.5 text-zinc-500" />
                                <span>{c.phone}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleStartEditContact(c)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                              title="Edit Phone / Contact"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteContact(c.id)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-700 hover:bg-red-50 transition-colors"
                              title="Delete Phone / Contact"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* ========================================================================= */}
              {/* SECTION 5: PHOTOS & FILES (MUST BE AFTER PHONE CONTACTS!) */}
              {/* ========================================================================= */}
              <section id="sec-photos-files" className="bg-white rounded-xl border border-zinc-200 shadow-2xs p-5 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-100 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-900 font-bold">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                        5. Photos & Files (รูปภาพและเอกสารสัญญา)
                      </h3>
                      <p className="text-[11px] text-zinc-500">
                        อยู่หลัง Phone Contacts • จัดเก็บจริงใน Supabase Storage • มีปุ่ม View และปุ่ม Download จริง
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-red-900 hover:bg-red-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      + Upload Photos
                    </button>
                    <input
                      ref={photoInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleUploadPhotos}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      + Upload Files
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.zip,.png,.jpg,.jpeg"
                      onChange={handleUploadFiles}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Sub-part 5.1: Photos Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-red-900" />
                      รูปภาพทรัพย์ (Photos - {detail.photos.length} รูป)
                    </h4>
                    <span className="text-[11px] text-zinc-500">
                      รองรับ JPG, JPEG, PNG, WEBP • กำหนดรูปหน้าปก & เรียงลำดับได้
                    </span>
                  </div>

                  {detail.photos.length === 0 ? (
                    <div className="py-8 text-center text-zinc-400 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-xs">
                      ยังไม่มีรูปภาพสำหรับทรัพย์นี้ คลิกปุ่ม "+ Upload Photos" เพื่ออัปโหลดจากคอมพิวเตอร์
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {detail.photos
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((photo, idx) => (
                          <div
                            key={photo.id}
                            className={`group rounded-xl border overflow-hidden bg-white shadow-2xs relative flex flex-col ${
                              photo.is_cover ? 'border-red-900 ring-2 ring-red-900/20' : 'border-zinc-200'
                            }`}
                          >
                            <div className="h-36 bg-zinc-100 relative overflow-hidden">
                              <img
                                src={photo.public_url}
                                alt={photo.file_name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />

                              {/* Cover Badge */}
                              {photo.is_cover && (
                                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-red-900 text-white text-[10px] font-bold shadow-xs flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-white" /> Cover
                                </span>
                              )}

                              {/* Order Badge */}
                              <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono">
                                #{idx + 1}
                              </span>

                              {/* Action Overlay */}
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewPhoto({
                                      url: photo.public_url,
                                      name: photo.file_name,
                                      id: photo.id,
                                    })
                                  }
                                  title="View Photo Preview"
                                  className="p-1.5 rounded-lg bg-white/90 text-zinc-900 hover:bg-white"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>

                                <a
                                  href={api.getPhotoDownloadUrl(photo.id)}
                                  download={photo.file_name}
                                  title="Download Photo"
                                  className="p-1.5 rounded-lg bg-white/90 text-zinc-900 hover:bg-white flex items-center justify-center"
                                >
                                  <Download className="w-4 h-4" />
                                </a>

                                {!photo.is_cover && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetCoverPhoto(photo.id)}
                                    title="Set as Cover"
                                    className="p-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600"
                                  >
                                    <Star className="w-4 h-4" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDeletePhoto(photo.id)}
                                  title="Delete Photo"
                                  className="p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Photo Details & Reorder Toolbar */}
                            <div className="p-2.5 bg-white flex items-center justify-between border-t border-zinc-100 text-[11px]">
                              <div className="truncate pr-2">
                                <span className="font-mono text-zinc-900 font-bold block truncate">
                                  {photo.file_name}
                                </span>
                                <span className="text-zinc-400 text-[10px]">
                                  {(photo.file_size / 1024).toFixed(0)} KB
                                </span>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMovePhoto(photo.id, 'up')}
                                  title="Move Left/Up"
                                  className="p-1 rounded bg-zinc-100 hover:bg-zinc-200 disabled:opacity-30 text-zinc-700"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === detail.photos.length - 1}
                                  onClick={() => handleMovePhoto(photo.id, 'down')}
                                  title="Move Right/Down"
                                  className="p-1 rounded bg-zinc-100 hover:bg-zinc-200 disabled:opacity-30 text-zinc-700"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                {/* Sub-part 5.2: Documents / Files Table */}
                <div className="space-y-3 pt-3 border-t border-zinc-100">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-900" />
                      เอกสารและสัญญา (Documents & Files - {detail.files.length} ไฟล์)
                    </h4>
                    <span className="text-[11px] text-zinc-500">
                      รองรับ PDF, Word, Excel, CSV, ZIP • ดาวน์โหลดและเปิดดูได้จริง
                    </span>
                  </div>

                  {detail.files.length === 0 ? (
                    <div className="py-8 text-center text-zinc-400 bg-zinc-50 rounded-xl border border-dashed border-zinc-200 text-xs">
                      ยังไม่มีไฟล์เอกสารสำหรับทรัพย์นี้ คลิกปุ่ม "+ Upload Files" เพื่ออัปโหลดจากคอมพิวเตอร์
                    </div>
                  ) : (
                    <div className="divide-y divide-zinc-200 border border-zinc-200 rounded-xl overflow-hidden bg-white text-xs">
                      {detail.files.map((file) => (
                        <div
                          key={file.id}
                          className="p-3.5 flex items-center justify-between hover:bg-zinc-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <h5 className="font-bold text-zinc-900 font-mono text-xs">{file.file_name}</h5>
                              <p className="text-[11px] text-zinc-500 mt-0.5">
                                {(file.file_size / 1024).toFixed(1)} KB • Uploaded {new Date(file.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* View / Open Button */}
                            <a
                              href={api.getFileViewUrl(file.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-100 text-zinc-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                              title="เปิดดูไฟล์ในแท็บใหม่"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              View / Open
                            </a>

                            {/* Real Download Button */}
                            <a
                              href={api.getFileDownloadUrl(file.id)}
                              download={file.file_name}
                              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-red-900 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                              title="ดาวน์โหลดไฟล์จริงจาก Storage"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </a>

                            {/* Delete File */}
                            <button
                              type="button"
                              onClick={() => handleDeleteFile(file.id)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-700 hover:bg-red-50"
                              title="Delete File"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* ========================================================================= */}
              {/* SECTION 6: UPDATE HISTORY / AUDIT LOG */}
              {/* ========================================================================= */}
              <section id="sec-history" className="bg-zinc-50/60 rounded-xl border border-zinc-200 p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-zinc-200 flex items-center justify-center text-zinc-700">
                      <History className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
                        6. Update History (ประวัติการเปลี่ยนแปลงข้อมูล)
                      </h3>
                      <p className="text-[11px] text-zinc-500">
                        บันทึกการแก้ไขทุกขั้นตอนในตาราง <code className="font-mono bg-zinc-100 px-1 py-0.5 rounded">property_update_logs</code>
                      </p>
                    </div>
                  </div>
                </div>

                {detail.updateLogs.length === 0 ? (
                  <div className="py-6 text-center text-zinc-400 text-xs">
                    ยังไม่มีประวัติการอัปเดต
                  </div>
                ) : (
                  <div className="space-y-2 text-xs">
                    {detail.updateLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-3 bg-white rounded-lg border border-zinc-200 flex items-start justify-between gap-4 shadow-2xs"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-zinc-100 flex items-center justify-center shrink-0 mt-0.5 text-zinc-600">
                            <Clock className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-zinc-900">{log.action}</span>
                              {log.changed_field && (
                                <span className="font-mono text-[10px] bg-zinc-100 text-zinc-800 px-1.5 py-0.5 rounded">
                                  {log.changed_field}
                                </span>
                              )}
                            </div>
                            {log.old_value && log.new_value ? (
                              <p className="text-[11px] text-zinc-600 mt-1">
                                เปลี่ยนจาก <span className="line-through text-zinc-400">{log.old_value}</span> เป็น <strong className="text-zinc-900">{log.new_value}</strong>
                              </p>
                            ) : log.new_value ? (
                              <p className="text-[11px] text-zinc-600 mt-0.5">{log.new_value}</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="text-right text-[11px] text-zinc-400 shrink-0">
                          <span>{new Date(log.created_at).toLocaleString()}</span>
                          <br />
                          <span>By {log.user_name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* Photo Preview Modal with Zoom & Real Download Button */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <img
              src={previewPhoto.url}
              alt={previewPhoto.name}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
            />
            <div className="mt-3 flex items-center gap-3 bg-zinc-900/90 text-white px-4 py-2 rounded-xl backdrop-blur-xs border border-zinc-700">
              <span className="text-xs font-mono font-bold truncate max-w-xs">{previewPhoto.name}</span>
              <a
                href={api.getPhotoDownloadUrl(previewPhoto.id)}
                download={previewPhoto.name}
                className="px-3 py-1 bg-red-900 hover:bg-red-800 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </a>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs font-bold transition-colors"
              >
                Close
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
