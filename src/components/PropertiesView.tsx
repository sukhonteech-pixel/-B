import React, { useState, useEffect } from 'react';
import {
  Building2,
  Search,
  Filter,
  Grid,
  List as ListIcon,
  Plus,
  Upload,
  Phone,
  Bed,
  Bath,
  MapPin,
  Image as ImageIcon,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Eye,
  Layers,
} from 'lucide-react';
import { PropertyListItem, api } from '../services/api';

interface PropertiesViewProps {
  onSelectProperty: (propertyNo: string) => void;
  onOpenUploadExcel: () => void;
  onOpenImportMerge?: () => void;
  onOpenAddModal: () => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export const PropertiesView: React.FC<PropertiesViewProps> = ({
  onSelectProperty,
  onOpenUploadExcel,
  onOpenImportMerge,
  onOpenAddModal,
  searchInputRef,
}) => {
  // State
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');

  // Search & Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [bedroom, setBedroom] = useState('ALL');
  const [bathroom, setBathroom] = useState('ALL');
  const [location, setLocation] = useState('ALL');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter expand toggle on mobile
  const [showFilters, setShowFilters] = useState(false);

  // Load properties from DB
  const fetchProperties = async () => {
    setLoading(true);
    try {
      const res = await api.getProperties({
        search,
        category: category !== 'ALL' ? category : undefined,
        status: status !== 'ALL' ? status : undefined,
        bedroom: bedroom !== 'ALL' ? bedroom : undefined,
        bathroom: bathroom !== 'ALL' ? bathroom : undefined,
        location: location !== 'ALL' ? location : undefined,
        page,
        limit,
      });

      setProperties(res.items || []);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err) {
      console.error('Failed to fetch properties:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [page, limit, category, status, bedroom, bathroom, location]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProperties();
  };

  const handleClearFilters = () => {
    setSearch('');
    setCategory('ALL');
    setStatus('ALL');
    setBedroom('ALL');
    setBathroom('ALL');
    setLocation('ALL');
    setPage(1);
    setTimeout(() => {
      fetchProperties();
    }, 50);
  };

  const hasActiveFilters =
    search !== '' ||
    category !== 'ALL' ||
    status !== 'ALL' ||
    bedroom !== 'ALL' ||
    bathroom !== 'ALL' ||
    location !== 'ALL';

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="bg-white p-5 rounded-xl border border-zinc-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-bold text-zinc-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-red-900" />
            Properties Directory ({total.toLocaleString()})
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            ฐานข้อมูลทรัพย์ทั้งหมด ค้นหา กรองข้อมูล แก้ไขรายทรัพย์ อัปโหลดรูปภาพและไฟล์
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Card / Table Toggle */}
          <div className="flex items-center border border-zinc-200 rounded-lg p-1 bg-zinc-50">
            <button
              type="button"
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded text-xs font-semibold ${
                viewMode === 'card'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
              title="Card View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded text-xs font-semibold ${
                viewMode === 'table'
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
              title="Table View"
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          {onOpenImportMerge && (
            <button
              type="button"
              onClick={onOpenImportMerge}
              className="px-3.5 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Layers className="w-3.5 h-3.5 text-red-700" />
              Import & Merge Excel
            </button>
          )}

          <button
            type="button"
            onClick={onOpenUploadExcel}
            className="px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Excel
          </button>

          <button
            type="button"
            onClick={onOpenAddModal}
            className="px-3.5 py-2 rounded-lg bg-red-900 hover:bg-red-800 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            + Add Property
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-2xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
            <input
              ref={searchInputRef as any}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Property No, Name, Project, Location, or Phone..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-zinc-50 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-red-900 focus:outline-hidden"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  fetchProperties();
                }}
                className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-red-900 text-white text-xs font-bold transition-colors"
          >
            Search
          </button>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 sm:hidden ${
              showFilters ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-zinc-100 text-zinc-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
          </button>
        </form>

        {/* Filter Selects */}
        <div
          className={`${
            showFilters ? 'block' : 'hidden'
          } sm:flex flex-wrap items-center gap-3 pt-2 border-t border-zinc-100 text-xs`}
        >
          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 text-[11px] font-medium">Category:</span>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="px-2 py-1.5 rounded-md bg-zinc-50 border border-zinc-300 text-xs font-semibold text-zinc-800"
            >
              <option value="ALL">All Categories</option>
              <option value="Condominium">Condo</option>
              <option value="House">House</option>
              <option value="Villa">Villa</option>
              <option value="Townhouse">Townhouse</option>
              <option value="Land">Land</option>
              <option value="Commercial">Commercial</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 text-[11px] font-medium">Status:</span>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="px-2 py-1.5 rounded-md bg-zinc-50 border border-zinc-300 text-xs font-semibold text-zinc-800"
            >
              <option value="ALL">All Status</option>
              <option value="Available">Available</option>
              <option value="Rented">Rented</option>
              <option value="Sold">Sold</option>
              <option value="Pending">Pending</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          {/* Bedroom Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 text-[11px] font-medium">Bedroom:</span>
            <select
              value={bedroom}
              onChange={(e) => {
                setBedroom(e.target.value);
                setPage(1);
              }}
              className="px-2 py-1.5 rounded-md bg-zinc-50 border border-zinc-300 text-xs font-semibold text-zinc-800"
            >
              <option value="ALL">Any Bedroom</option>
              <option value="1">1 Bed</option>
              <option value="2">2 Beds</option>
              <option value="3">3 Beds</option>
              <option value="4">4+ Beds</option>
            </select>
          </div>

          {/* Bathroom Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500 text-[11px] font-medium">Bathroom:</span>
            <select
              value={bathroom}
              onChange={(e) => {
                setBathroom(e.target.value);
                setPage(1);
              }}
              className="px-2 py-1.5 rounded-md bg-zinc-50 border border-zinc-300 text-xs font-semibold text-zinc-800"
            >
              <option value="ALL">Any Bath</option>
              <option value="1">1 Bath</option>
              <option value="2">2 Baths</option>
              <option value="3">3+ Baths</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="px-2.5 py-1.5 rounded-md text-red-900 hover:bg-red-50 text-xs font-bold transition-colors flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Clear Filters
            </button>
          )}

          {/* Items Per Page */}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-zinc-500 text-[11px]">Show:</span>
            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 rounded-md bg-zinc-50 border border-zinc-300 text-xs font-semibold text-zinc-800"
            >
              <option value="20">20 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="py-16 text-center text-zinc-500 text-xs flex flex-col items-center justify-center space-y-2">
          <div className="w-7 h-7 border-2 border-red-900 border-t-transparent rounded-full animate-spin" />
          <span>กำลังโหลดข้อมูลอสังหาริมทรัพย์...</span>
        </div>
      )}

      {/* Empty State (No properties found) */}
      {!loading && properties.length === 0 && (
        <div className="bg-white rounded-2xl border border-zinc-200 p-12 text-center shadow-2xs space-y-4 max-w-lg mx-auto">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-zinc-900">No properties found.</h3>
            <p className="text-xs text-zinc-500 mt-1">
              {hasActiveFilters
                ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหาหรือตัวกรองที่เลือก ลองล้างตัวกรองเพื่อค้นหาใหม่'
                : 'ยังไม่มีข้อมูลทรัพย์ในระบบ คุณสามารถเริ่มสร้างข้อมูลได้โดยการ Upload Excel หรือเพิ่มข้อมูลรายทรัพย์'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 transition-colors"
              >
                Clear Filters
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onOpenUploadExcel}
                  className="px-4 py-2 rounded-xl bg-red-900 text-white text-xs font-bold hover:bg-red-800 transition-colors flex items-center gap-1.5 shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload Excel
                </button>
                <button
                  type="button"
                  onClick={onOpenAddModal}
                  className="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-900 text-xs font-bold hover:bg-zinc-200 transition-colors flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Property
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* CARD VIEW */}
      {!loading && viewMode === 'card' && properties.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {properties.map((prop) => {
            const hasPhone = prop.contacts && prop.contacts.length > 0 && prop.contacts[0].phone;
            return (
              <div
                key={prop.id}
                onClick={() => onSelectProperty(prop.property_no)}
                className="bg-white rounded-xl border border-zinc-200 hover:border-red-900 hover:shadow-sm transition-all duration-150 overflow-hidden cursor-pointer flex flex-col group"
              >
                {/* Image Cover */}
                <div className="h-40 bg-zinc-100 relative overflow-hidden flex items-center justify-center">
                  {prop.cover_photo_url ? (
                    <img
                      src={prop.cover_photo_url}
                      alt={prop.property_name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-400">
                      <ImageIcon className="w-8 h-8 stroke-1" />
                      <span className="text-[10px] mt-1">No Cover Photo</span>
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-2.5 left-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shadow-xs ${
                        prop.status === 'Available'
                          ? 'bg-emerald-600 text-white'
                          : prop.status === 'Rented'
                          ? 'bg-blue-600 text-white'
                          : prop.status === 'Sold'
                          ? 'bg-zinc-800 text-white'
                          : 'bg-amber-600 text-white'
                      }`}
                    >
                      {prop.status}
                    </span>
                  </div>

                  {/* Badges for photos and files */}
                  <div className="absolute bottom-2 right-2 flex items-center gap-1.5 text-[10px] bg-black/60 backdrop-blur-xs text-white px-2 py-0.5 rounded font-mono">
                    <span className="flex items-center gap-0.5">
                      <ImageIcon className="w-2.5 h-2.5" />
                      {prop.photos_count || 0}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-0.5">
                      <FileText className="w-2.5 h-2.5" />
                      {prop.files_count || 0}
                    </span>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono font-bold text-xs text-red-950 px-1.5 py-0.5 bg-red-50 rounded border border-red-200">
                        {prop.property_no}
                      </span>
                      <span className="text-[11px] text-zinc-500 font-medium truncate max-w-28">
                        {prop.category}
                      </span>
                    </div>

                    <h3 className="font-bold text-xs text-zinc-900 mt-2 truncate" title={prop.property_name}>
                      {prop.property_name}
                    </h3>

                    {prop.project_name && (
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                        {prop.project_name}
                      </p>
                    )}

                    {prop.location && (
                      <p className="text-[11px] text-zinc-500 truncate flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 shrink-0 text-zinc-400" />
                        <span>{prop.location}</span>
                      </p>
                    )}
                  </div>

                  {/* Spec Row */}
                  <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-600">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Bed className="w-3.5 h-3.5 text-zinc-400" />
                        {prop.bedroom} Bed
                      </span>
                      <span className="flex items-center gap-1">
                        <Bath className="w-3.5 h-3.5 text-zinc-400" />
                        {prop.bathroom} Bath
                      </span>
                    </div>

                    {prop.building_area > 0 && (
                      <span className="font-mono text-[11px] text-zinc-500">
                        {prop.building_area} m²
                      </span>
                    )}
                  </div>

                  {/* Pricing Row */}
                  <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                    <div>
                      {prop.rent_price > 0 ? (
                        <div>
                          <span className="text-[10px] text-zinc-400 uppercase block font-semibold">Rent</span>
                          <span className="text-xs font-mono font-bold text-red-900">
                            ฿{prop.rent_price.toLocaleString()}/mo
                          </span>
                        </div>
                      ) : prop.sale_price > 0 ? (
                        <div>
                          <span className="text-[10px] text-zinc-400 uppercase block font-semibold">Sale</span>
                          <span className="text-xs font-mono font-bold text-zinc-900">
                            ฿{prop.sale_price.toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400 italic">Price on request</span>
                      )}
                    </div>

                    {hasPhone && (
                      <div className="flex items-center gap-1 text-[11px] font-mono font-semibold text-zinc-700 bg-zinc-100 px-2 py-1 rounded">
                        <Phone className="w-3 h-3 text-zinc-500" />
                        <span>{prop.contacts[0].phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TABLE VIEW */}
      {!loading && viewMode === 'table' && properties.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Property No</th>
                  <th className="py-2.5 px-3">Property Name</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3 text-center">Bed / Bath</th>
                  <th className="py-2.5 px-3 text-right">Rent (THB)</th>
                  <th className="py-2.5 px-3 text-right">Sale (THB)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Phone Contacts</th>
                  <th className="py-2.5 px-3 text-center">Photos & Files</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-zinc-800">
                {properties.map((prop) => (
                  <tr
                    key={prop.id}
                    onClick={() => onSelectProperty(prop.property_no)}
                    className="hover:bg-red-50/30 transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-red-950">
                      {prop.property_no}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-zinc-900 truncate max-w-xs">
                        {prop.property_name}
                      </div>
                      {prop.project_name && (
                        <div className="text-[11px] text-zinc-500 truncate max-w-xs">
                          {prop.project_name}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-600 truncate max-w-28">
                      {prop.category}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-600 truncate max-w-36">
                      {prop.location || '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center text-zinc-600">
                      {prop.bedroom}B / {prop.bathroom}B
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-red-900">
                      {prop.rent_price > 0 ? `฿${prop.rent_price.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-zinc-900">
                      {prop.sale_price > 0 ? `฿${prop.sale_price.toLocaleString()}` : '-'}
                    </td>
                    {/* Status Column */}
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          prop.status === 'Available'
                            ? 'bg-emerald-100 text-emerald-800'
                            : prop.status === 'Rented'
                            ? 'bg-blue-100 text-blue-800'
                            : prop.status === 'Sold'
                            ? 'bg-zinc-200 text-zinc-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {prop.status}
                      </span>
                    </td>
                    {/* Phone Contacts (ถัดจาก Status) */}
                    <td className="py-2.5 px-3">
                      {prop.contacts && prop.contacts.length > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 font-mono font-bold text-red-950 text-xs">
                            <Phone className="w-3 h-3 text-red-800 shrink-0" />
                            <span>{prop.contacts[0].phone}</span>
                            {prop.contacts.length > 1 && (
                              <span
                                className="px-1.5 py-0.2 rounded-full bg-red-100 text-red-900 text-[10px] font-semibold"
                                title={`มีทั้งหมด ${prop.contacts.length} เบอร์โทร`}
                              >
                                +{prop.contacts.length - 1}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-500 truncate max-w-28">
                            {prop.contacts[0].contact_name} ({prop.contacts[0].contact_type})
                          </span>
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic text-[11px]">- ไม่มีเบอร์ -</span>
                      )}
                    </td>
                    {/* Photos & Files (ถัดจาก Phone Contacts) */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {prop.cover_photo_url ? (
                          <div className="w-8 h-8 rounded-md overflow-hidden bg-zinc-100 border border-zinc-200 shrink-0">
                            <img
                              src={prop.cover_photo_url}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-md bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400 shrink-0">
                            <ImageIcon className="w-4 h-4" />
                          </div>
                        )}
                        <div className="flex flex-col items-start gap-0.5 text-[10px] font-mono">
                          <span className={`flex items-center gap-1 ${prop.photos_count ? 'text-zinc-800 font-bold' : 'text-zinc-400'}`}>
                            <ImageIcon className="w-3 h-3 text-blue-700" />
                            {prop.photos_count || 0} รูป
                          </span>
                          <span className={`flex items-center gap-1 ${prop.files_count ? 'text-zinc-800 font-bold' : 'text-zinc-400'}`}>
                            <FileText className="w-3 h-3 text-emerald-700" />
                            {prop.files_count || 0} ไฟล์
                          </span>
                        </div>
                      </div>
                    </td>
                    {/* Action Column */}
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectProperty(prop.property_no);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-red-900 text-white font-bold text-xs flex items-center gap-1 transition-colors shadow-2xs mx-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        ดูข้อมูล
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-zinc-200 shadow-2xs text-xs">
          <span className="text-zinc-500">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} properties
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-zinc-800 font-mono">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
