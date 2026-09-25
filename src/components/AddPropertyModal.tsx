import React, { useState } from 'react';
import { X, Building2, Plus, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface AddPropertyModalProps {
  onClose: () => void;
  onSuccess: (propertyNo: string) => void;
}

export const AddPropertyModal: React.FC<AddPropertyModalProps> = ({ onClose, onSuccess }) => {
  const [form, setForm] = useState({
    property_no: '',
    property_name: '',
    category: 'Condominium',
    property_type: 'Residential',
    status: 'Available' as const,
    project_name: '',
    location: '',
    zone: '',
    bedroom: 1,
    bathroom: 1,
    rent_price: 0,
    sale_price: 0,
    building_area: 0,
    land_area: 0,
    floor: '',
    description: '',
    contact_name: 'Owner',
    contact_type: 'Owner' as const,
    phone: '',
    email: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.property_no.trim()) {
      setErrorMsg('กรุณาระบุ Property No');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const contacts = [];
      if (form.phone.trim()) {
        contacts.push({
          contact_name: form.contact_name.trim() || 'Owner',
          contact_type: form.contact_type,
          phone: form.phone.trim(),
          email: form.email.trim(),
        });
      }

      const res = await api.createProperty({
        property_no: form.property_no.trim().toUpperCase(),
        property_name: form.property_name.trim() || form.property_no.trim().toUpperCase(),
        category: form.category,
        property_type: form.property_type,
        status: form.status,
        project_name: form.project_name.trim(),
        location: form.location.trim(),
        zone: form.zone.trim(),
        bedroom: Number(form.bedroom) || 0,
        bathroom: Number(form.bathroom) || 0,
        rent_price: Number(form.rent_price) || 0,
        sale_price: Number(form.sale_price) || 0,
        building_area: Number(form.building_area) || 0,
        land_area: Number(form.land_area) || 0,
        floor: form.floor.trim(),
        description: form.description.trim(),
        contacts,
      });

      onSuccess(res.property_no);
    } catch (err: any) {
      console.error('Create property failed:', err);
      setErrorMsg(err.message || 'ไม่สามารถสร้างทรัพย์ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-zinc-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-900 flex items-center justify-center text-white font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Add New Property (สร้างข้อมูลทรัพย์ใหม่)</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                บันทึกลงสู่ Supabase Database โดยตรง
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Core Identifiers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                Property No (รหัสทรัพย์)*
              </label>
              <input
                type="text"
                required
                placeholder="เช่น VN568, KT324"
                value={form.property_no}
                onChange={(e) => setForm({ ...form, property_no: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-mono font-bold focus:ring-2 focus:ring-red-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                Property Name (ชื่อทรัพย์)
              </label>
              <input
                type="text"
                placeholder="เช่น Ashton Asoke 2-Bed Luxury"
                value={form.property_name}
                onChange={(e) => setForm({ ...form, property_name: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs focus:ring-2 focus:ring-red-900 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Section 2: Category, Project, Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium"
              >
                <option value="Condominium">Condominium</option>
                <option value="House">House</option>
                <option value="Villa">Villa</option>
                <option value="Townhouse">Townhouse</option>
                <option value="Land">Land</option>
                <option value="Commercial">Commercial</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-700 mb-1">Project Name</label>
              <input
                type="text"
                placeholder="เช่น Ashton Asoke"
                value={form.project_name}
                onChange={(e) => setForm({ ...form, project_name: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                className="w-full px-2.5 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-medium"
              >
                <option value="Available">Available</option>
                <option value="Rented">Rented</option>
                <option value="Sold">Sold</option>
                <option value="Pending">Pending</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Section 3: Specs & Pricing */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 mb-1">Bedroom</label>
              <input
                type="number"
                min="0"
                value={form.bedroom}
                onChange={(e) => setForm({ ...form, bedroom: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-700 mb-1">Bathroom</label>
              <input
                type="number"
                min="0"
                value={form.bathroom}
                onChange={(e) => setForm({ ...form, bathroom: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-700 mb-1">Rent Price (THB)</label>
              <input
                type="number"
                min="0"
                placeholder="55000"
                value={form.rent_price || ''}
                onChange={(e) => setForm({ ...form, rent_price: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-mono font-bold text-red-900"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-700 mb-1">Sale Price (THB)</label>
              <input
                type="number"
                min="0"
                placeholder="12000000"
                value={form.sale_price || ''}
                onChange={(e) => setForm({ ...form, sale_price: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs font-mono font-bold text-zinc-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 mb-1">Location / Area</label>
              <input
                type="text"
                placeholder="Sukhumvit 21, Asoke"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 mb-1">Building Area (sqm)</label>
              <input
                type="number"
                min="0"
                value={form.building_area || ''}
                onChange={(e) => setForm({ ...form, building_area: Number(e.target.value) })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 mb-1">Floor</label>
              <input
                type="text"
                placeholder="28"
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs"
              />
            </div>
          </div>

          {/* Section 4: Initial Contact */}
          <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-3">
            <span className="text-[11px] font-bold text-zinc-900 uppercase tracking-wider block">
              Contact & Phone (เบอร์โทรผู้ติดต่อ)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">ชื่อผู้ติดต่อ</label>
                <input
                  type="text"
                  placeholder="เช่น คุณวิชัย (เจ้าของ)"
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">ประเภท</label>
                <select
                  value={form.contact_type}
                  onChange={(e) => setForm({ ...form, contact_type: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 bg-white border border-zinc-300 rounded text-xs"
                >
                  <option value="Owner">Owner (เจ้าของ)</option>
                  <option value="Agent">Agent (ตัวแทน)</option>
                  <option value="Co-Agent">Co-Agent (นายหน้าร่วม)</option>
                  <option value="Juristic">Juristic (นิติบุคคล)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">เบอร์โทรศัพท์ (Phone)</label>
                <input
                  type="text"
                  placeholder="081-xxx-xxxx"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-zinc-300 rounded text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Description */}
          <div>
            <label className="block text-[11px] font-bold text-zinc-700 mb-1">รายละเอียด (Description)</label>
            <textarea
              rows={2}
              placeholder="รายละเอียดห้อง เฟอร์นิเจอร์ หรือเงื่อนไขสัญญา..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2 bg-zinc-50 border border-zinc-300 rounded-lg text-xs"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-zinc-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-zinc-300 text-xs font-bold text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-red-900 hover:bg-red-800 disabled:bg-zinc-400 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Save Property
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
