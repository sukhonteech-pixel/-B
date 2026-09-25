import React, { useState, useEffect } from 'react';
import { Phone, Search, Building2, User, ExternalLink } from 'lucide-react';
import { api } from '../services/api';

interface ContactsViewProps {
  onSelectProperty: (propertyNo: string) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({ onSelectProperty }) => {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await api.getProperties({ limit: 100 });
        const allContacts: any[] = [];
        res.items.forEach((p) => {
          if (p.contacts && p.contacts.length > 0) {
            p.contacts.forEach((c) => {
              allContacts.push({
                ...c,
                property_no: p.property_no,
                property_name: p.property_name,
                location: p.location,
              });
            });
          }
        });
        setContacts(allContacts);
      } catch (err) {
        console.error('Error fetching contacts:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      (c.phone || '').includes(search) ||
      (c.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (c.property_no || '').toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === 'ALL' || c.contact_type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <Phone className="w-5 h-5 text-red-900" />
            Contacts Directory ({filtered.length})
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            สมุดรายชื่อและเบอร์โทรศัพท์ผู้ติดต่อทั้งหมดที่ผูกกับทรัพย์สินในระบบ
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by phone, name, or prop..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-red-900 focus:outline-hidden"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-lg bg-zinc-50 border border-zinc-300 text-xs font-semibold text-zinc-800"
          >
            <option value="ALL">All Contact Types</option>
            <option value="Owner">Owner</option>
            <option value="Agent">Agent</option>
            <option value="Co-Agent">Co-Agent</option>
            <option value="Juristic">Juristic</option>
            <option value="Cleaning">Cleaning</option>
          </select>
        </div>
      </div>

      {loading && (
        <div className="py-16 text-center text-zinc-400 text-xs">
          กำลังโหลดรายชื่อผู้ติดต่อ...
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center text-zinc-500 text-xs">
          ไม่พบข้อมูลผู้ติดต่อ
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl border border-zinc-200 bg-white hover:border-zinc-300 shadow-2xs flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-700">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-zinc-900">{item.contact_name}</h3>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">
                        {item.contact_type}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 text-red-900 font-mono font-bold text-sm bg-red-50/60 p-2 rounded-lg border border-red-100">
                  <Phone className="w-4 h-4 text-red-800 shrink-0" />
                  <span>{item.phone}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
                <div className="text-zinc-600 truncate max-w-44">
                  <span className="font-mono font-bold text-zinc-900 mr-1.5">
                    {item.property_no}
                  </span>
                  <span>{item.property_name}</span>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectProperty(item.property_no)}
                  className="text-red-900 font-bold hover:underline flex items-center gap-1 shrink-0"
                >
                  View Property <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
