import { FormEvent, Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import apiService from '../services/api';
import { Shipment, ShipmentMode } from '../types';

interface ClientInformation {
  id: string;
  businessName: string;
}

type WeightUnit = 'kg' | 'g';
type DimensionUnit = 'cm' | 'inches' | 'mm';

interface BookingFormState {
  customerName: string;
  waybillNumber: string;
  portOrigin: string;
  portDestination: string;
  serviceMode: ShipmentMode;
  commodity: string;
  declaredValue: string;
  totalPieces: number;
  boxesCasesText: string;
  weight: number;
  weightUnit: WeightUnit;
  cbm: string;
  dimension: string;
  dimensionUnit: DimensionUnit;
  pickupDateTime: string;
  estimatedArrival: string;
  specialInstruction: string;
  shipperName: string;
  pickupAddress: string;
  shipperContactPerson: string;
  shipperTelephone: string;
  consigneeName: string;
  deliveryAddress: string;
  consigneeContactPerson: string;
  consigneeTelephone: string;
  returnDocuments: string;
}

type BookingFieldErrorKey =
  | 'customerName'
  | 'waybillNumber'
  | 'portOrigin'
  | 'portDestination'
  | 'commodity'
  | 'shipperName'
  | 'consigneeName'
  | 'pickupDateTime'
  | 'estimatedArrival'
  | 'totalPieces'
  | 'weight';

const toDateTimeLocal = (value?: string): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

const formatDateTimeDisplay = (value?: string): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const extractApiErrorMessage = (err: unknown, fallback: string): string => {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as {
      response?: { data?: { error?: string; message?: string } };
    }).response;
    const serverMessage = response?.data?.error || response?.data?.message;
    if (serverMessage) return serverMessage;
  }

  return err instanceof Error ? err.message : fallback;
};

const parseCommodityDescription = (description?: string): Record<string, string> => {
  if (!description) return {};

  return description.split(' | ').reduce<Record<string, string>>((acc, part) => {
    const splitIndex = part.indexOf(':');
    if (splitIndex === -1) return acc;

    const key = part.slice(0, splitIndex).trim();
    const value = part.slice(splitIndex + 1).trim();
    if (key) acc[key] = value;
    return acc;
  }, {});
};

const toKilograms = (weight: number, unit: WeightUnit): number =>
  unit === 'g' ? weight / 1000 : weight;

const fromKilograms = (weightKg: number, unit: WeightUnit): number =>
  unit === 'g' ? Number((weightKg * 1000).toFixed(2)) : Number(weightKg.toFixed(2));

const initialState: BookingFormState = {
  customerName: '',
  waybillNumber: '',
  portOrigin: '',
  portDestination: '',
  serviceMode: ShipmentMode.AIR,
  commodity: '',
  declaredValue: '',
  totalPieces: 1,
  boxesCasesText: '',
  weight: 1,
  weightUnit: 'kg',
  cbm: '',
  dimension: '',
  dimensionUnit: 'cm',
  pickupDateTime: '',
  estimatedArrival: '',
  specialInstruction: '',
  shipperName: '',
  pickupAddress: '',
  shipperContactPerson: '',
  shipperTelephone: '',
  consigneeName: '',
  deliveryAddress: '',
  consigneeContactPerson: '',
  consigneeTelephone: '',
  returnDocuments: '',
};

const CreateBookingPage: React.FC = () => {
  const clients = useMemo(() => {
    const listRaw = localStorage.getItem('clientInformationList');
    if (!listRaw) return [] as ClientInformation[];

    try {
      const parsed = JSON.parse(listRaw) as ClientInformation[];
      return parsed.filter((item) => item.businessName);
    } catch {
      return [] as ClientInformation[];
    }
  }, []);

  const [form, setForm] = useState<BookingFormState>({
    ...initialState,
    customerName: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdShipment, setCreatedShipment] = useState<Shipment | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<BookingFieldErrorKey, string>>>({});
  const [bookings, setBookings] = useState<Shipment[]>([]);
  const [bookingSearchQuery, setBookingSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [pendingDeleteBookingId, setPendingDeleteBookingId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const filteredBookings = useMemo(() => {
    const query = bookingSearchQuery.trim().toLowerCase();
    if (!query) return bookings;

    return bookings.filter((shipment) =>
      [
        shipment.booking_ref,
        shipment.waybill_number,
        shipment.shipper_name,
        shipment.consignee_name,
        shipment.origin_city,
        shipment.destination_city,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }, [bookings, bookingSearchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / pageSize));
  const paginatedBookings = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredBookings.slice(startIndex, startIndex + pageSize);
  }, [filteredBookings, currentPage]);

  const loadBookings = async (): Promise<void> => {
    setIsLoadingBookings(true);
    try {
      const response = await apiService.listShipments(0, 100);
      setBookings(response.data || []);
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Failed to load bookings'));
    } finally {
      setIsLoadingBookings(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [bookingSearchQuery, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const updateField = <K extends keyof BookingFormState>(key: K, value: BookingFormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key as BookingFieldErrorKey]) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const getFieldClass = (field: BookingFieldErrorKey): string =>
    `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
      fieldErrors[field]
        ? 'border-red-400 focus:ring-red-300'
        : 'border-brand-amber/40 focus:ring-brand-red/40'
    }`;

  const buildCommodityDescription = (): string =>
    [
      `Commodity: ${form.commodity}`,
      form.customerName ? `Customer: ${form.customerName}` : '',
      form.declaredValue ? `Declared Value: ${form.declaredValue}` : '',
      form.boxesCasesText ? `Items/Boxes/Cases: ${form.boxesCasesText}` : '',
      form.weightUnit ? `Weight Unit: ${form.weightUnit}` : '',
      form.cbm ? `CBM: ${form.cbm}` : '',
      form.dimension ? `Dimension: ${form.dimension}` : '',
      form.dimensionUnit ? `Dimension Unit: ${form.dimensionUnit}` : '',
      form.pickupDateTime ? `Pick-up Date and Time: ${form.pickupDateTime}` : '',
      form.specialInstruction ? `Special Instruction: ${form.specialInstruction}` : '',
      form.returnDocuments ? `Return Documents: ${form.returnDocuments}` : '',
      form.shipperContactPerson ? `Shipper Contact: ${form.shipperContactPerson}` : '',
      form.shipperTelephone ? `Shipper Phone: ${form.shipperTelephone}` : '',
      form.consigneeContactPerson ? `Consignee Contact: ${form.consigneeContactPerson}` : '',
      form.consigneeTelephone ? `Consignee Phone: ${form.consigneeTelephone}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

  const mapShipmentToForm = (shipment: Shipment): BookingFormState => {
    const parsed = parseCommodityDescription(shipment.commodity_description);
    const parsedWeightUnit = (parsed['Weight Unit'] || 'kg').toLowerCase() === 'g' ? 'g' : 'kg';
    const parsedDimensionUnitRaw = (parsed['Dimension Unit'] || 'cm').toLowerCase();
    const parsedDimensionUnit: DimensionUnit =
      parsedDimensionUnitRaw === 'inches' || parsedDimensionUnitRaw === 'mm' ? parsedDimensionUnitRaw : 'cm';
    const displayWeight = fromKilograms(Number(shipment.total_weight), parsedWeightUnit);

    return {
      customerName: parsed.Customer || '',
      waybillNumber: shipment.waybill_number,
      portOrigin: shipment.origin_city,
      portDestination: shipment.destination_city,
      serviceMode: shipment.mode as ShipmentMode,
      commodity: parsed.Commodity || shipment.commodity_description || '',
      declaredValue: parsed['Declared Value'] || '',
      totalPieces: shipment.total_pieces,
      boxesCasesText: parsed['Items/Boxes/Cases'] || '',
      weight: displayWeight,
      weightUnit: parsedWeightUnit,
      cbm: parsed.CBM || '',
      dimension: parsed.Dimension || '',
      dimensionUnit: parsedDimensionUnit,
      pickupDateTime: toDateTimeLocal(parsed['Pick-up Date and Time']),
      estimatedArrival: toDateTimeLocal(shipment.estimated_arrival),
      specialInstruction: parsed['Special Instruction'] || '',
      shipperName: shipment.shipper_name,
      pickupAddress: shipment.shipper_address,
      shipperContactPerson: parsed['Shipper Contact'] || '',
      shipperTelephone: parsed['Shipper Phone'] || '',
      consigneeName: shipment.consignee_name,
      deliveryAddress: shipment.consignee_address,
      consigneeContactPerson: parsed['Consignee Contact'] || '',
      consigneeTelephone: parsed['Consignee Phone'] || '',
      returnDocuments: parsed['Return Documents'] || '',
    };
  };

  const handleEditBooking = (shipment: Shipment): void => {
    setForm(mapShipmentToForm(shipment));
    setEditingBookingId(shipment.id);
    setFieldErrors({});
    setSuccess(null);
    setError(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDeleteBookingRequest = (bookingId: string): void => {
    setPendingDeleteBookingId(bookingId);
    setError(null);
    setSuccess(null);
  };

  const handleConfirmDeleteBooking = async (): Promise<void> => {
    if (!pendingDeleteBookingId) return;

    try {
      await apiService.deleteBooking(pendingDeleteBookingId);
      if (editingBookingId === pendingDeleteBookingId) {
        setEditingBookingId(null);
        setForm({
          ...initialState,
          customerName: '',
        });
      }
      setPendingDeleteBookingId(null);
      setExpandedBookingId(null);
      setSuccess('Booking deleted successfully.');
      await loadBookings();
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Failed to delete booking'));
    }
  };

  const handleCancelDeleteBooking = (): void => {
    setPendingDeleteBookingId(null);
    setError('Deletion cancelled. No booking was removed.');
    setSuccess(null);
  };

  const handleCancelEditBooking = (): void => {
    setEditingBookingId(null);
    setFieldErrors({});
    setForm({
      ...initialState,
      customerName: '',
    });
    setSuccess('Edit cancelled. Create form restored.');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setCreatedShipment(null);
    setFieldErrors({});

    const requiredFields: Array<{ key: BookingFieldErrorKey; label: string; isMissing: boolean }> = [
      { key: 'customerName', label: 'Customer Name', isMissing: !form.customerName.trim() },
      { key: 'waybillNumber', label: 'Waybill Number', isMissing: !form.waybillNumber.trim() },
      { key: 'portOrigin', label: 'Port Origin', isMissing: !form.portOrigin.trim() },
      { key: 'portDestination', label: 'Port Destination', isMissing: !form.portDestination.trim() },
      { key: 'commodity', label: 'Commodity', isMissing: !form.commodity.trim() },
      { key: 'shipperName', label: "Shipper's Name", isMissing: !form.shipperName.trim() },
      { key: 'consigneeName', label: "Consignee's Name", isMissing: !form.consigneeName.trim() },
      { key: 'pickupDateTime', label: 'Pick-up Date and Time', isMissing: !form.pickupDateTime },
      { key: 'estimatedArrival', label: 'Estimated Time Arrival', isMissing: !form.estimatedArrival },
    ];

    const nextFieldErrors: Partial<Record<BookingFieldErrorKey, string>> = {};
    const missingLabels = requiredFields
      .filter((field) => {
        if (field.isMissing) {
          nextFieldErrors[field.key] = 'This field is required.';
          return true;
        }
        return false;
      })
      .map((field) => field.label);

    if (form.totalPieces < 1) {
      nextFieldErrors.totalPieces = 'Must be at least 1.';
    }

    if (form.weight <= 0) {
      nextFieldErrors.weight = 'Must be greater than 0.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setError(
        missingLabels.length > 0
          ? `Please complete required fields: ${missingLabels.join(', ')}`
          : 'Please fix highlighted numeric fields.'
      );
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        waybillNumber: form.waybillNumber,
        shipperName: form.shipperName,
        shipperAddress: form.pickupAddress,
        consigneeName: form.consigneeName,
        consigneeAddress: form.deliveryAddress,
        originCity: form.portOrigin,
        originCountry: 'PH',
        destinationCity: form.portDestination,
        destinationCountry: 'PH',
        mode: form.serviceMode,
        totalPieces: form.totalPieces,
        totalWeight: toKilograms(form.weight, form.weightUnit),
        commodityDescription: buildCommodityDescription(),
        estimatedArrival: form.estimatedArrival,
      };

      const shipment = editingBookingId
        ? await apiService.updateBooking(editingBookingId, payload)
        : await apiService.createBooking(payload);

      setCreatedShipment(shipment);
      setSuccess(editingBookingId ? 'Booking updated successfully.' : 'Booking created successfully.');
      setForm({
        ...initialState,
        customerName: '',
      });
      setEditingBookingId(null);
      await loadBookings();
    } catch (err) {
      setError(extractApiErrorMessage(err, 'Failed to create booking'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-sand py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-red font-semibold mb-2">
              Booking Workflow - Step 1
            </p>
            <h1 className="text-4xl text-brand-ink">Create Booking</h1>
          </div>
          <Link
            to="/dashboard"
            className="bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-4 py-2 rounded-lg"
          >
            Dashboard
          </Link>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 border border-brand-amber/20 space-y-5">
          {editingBookingId && (
            <div className="p-3 bg-amber-100 border border-amber-300 text-amber-800 rounded-lg">
              You are editing an existing booking.
            </div>
          )}

          <p className="text-sm text-brand-charcoal/80">Fields marked with * are required.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Customer Name *</label>
              {clients.length > 0 ? (
                <select
                  value={form.customerName}
                  onChange={(e) => updateField('customerName', e.currentTarget.value)}
                  className={getFieldClass('customerName')}
                  required
                >
                  <option value="">Select customer</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.businessName}>
                      {client.businessName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.customerName}
                  onChange={(e) => updateField('customerName', e.currentTarget.value)}
                  placeholder="Enter customer name"
                  className={getFieldClass('customerName')}
                  required
                />
              )}
              {fieldErrors.customerName && <p className="text-sm text-red-600 mt-1">{fieldErrors.customerName}</p>}
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Waybill Number *</label>
              <input
                type="text"
                value={form.waybillNumber}
                onChange={(e) => updateField('waybillNumber', e.currentTarget.value)}
                placeholder="Enter waybill number"
                className={getFieldClass('waybillNumber')}
                required
              />
              {fieldErrors.waybillNumber && <p className="text-sm text-red-600 mt-1">{fieldErrors.waybillNumber}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Port Origin *</label>
              <input type="text" value={form.portOrigin} onChange={(e) => updateField('portOrigin', e.currentTarget.value)} className={getFieldClass('portOrigin')} required />
              {fieldErrors.portOrigin && <p className="text-sm text-red-600 mt-1">{fieldErrors.portOrigin}</p>}
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Port Destination *</label>
              <input type="text" value={form.portDestination} onChange={(e) => updateField('portDestination', e.currentTarget.value)} className={getFieldClass('portDestination')} required />
              {fieldErrors.portDestination && <p className="text-sm text-red-600 mt-1">{fieldErrors.portDestination}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Service Mode *</label>
              <select value={form.serviceMode} onChange={(e) => updateField('serviceMode', e.currentTarget.value as ShipmentMode)} className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40">
                <option value={ShipmentMode.AIR}>Airfreight</option>
                <option value={ShipmentMode.SEA}>Sea Freight</option>
                <option value={ShipmentMode.LAND}>Land</option>
              </select>
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Weight *</label>
              <div className="flex gap-2">
                <input type="number" min={0.01} step={form.weightUnit === 'g' ? '1' : '0.01'} value={form.weight} onChange={(e) => updateField('weight', Number(e.currentTarget.value))} className={getFieldClass('weight')} required />
                <select
                  value={form.weightUnit}
                  onChange={(e) => updateField('weightUnit', e.currentTarget.value as WeightUnit)}
                  className="px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                >
                  <option value="kg">KG</option>
                  <option value="g">Grams</option>
                </select>
              </div>
              {fieldErrors.weight && <p className="text-sm text-red-600 mt-1">{fieldErrors.weight}</p>}
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">No. of Items / Boxes / Cases *</label>
              <input type="number" min={1} value={form.totalPieces} onChange={(e) => updateField('totalPieces', Number(e.currentTarget.value))} className={getFieldClass('totalPieces')} required disabled={!!editingBookingId} />
              {fieldErrors.totalPieces && <p className="text-sm text-red-600 mt-1">{fieldErrors.totalPieces}</p>}
              {editingBookingId && <p className="text-sm text-brand-charcoal/70 mt-1">Total pieces cannot be changed during edit.</p>}
            </div>
          </div>

          <div>
            <label className="block text-brand-charcoal font-semibold mb-2">Commodity *</label>
            <input type="text" value={form.commodity} onChange={(e) => updateField('commodity', e.currentTarget.value)} className={getFieldClass('commodity')} required />
            {fieldErrors.commodity && <p className="text-sm text-red-600 mt-1">{fieldErrors.commodity}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Declared Value</label>
              <input type="text" value={form.declaredValue} onChange={(e) => updateField('declaredValue', e.currentTarget.value)} className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40" />
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">CBM</label>
              <input type="text" value={form.cbm} onChange={(e) => updateField('cbm', e.currentTarget.value)} className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40" />
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Dimension (Length x Width x Height)</label>
              <div className="flex gap-2">
                <input type="text" value={form.dimension} onChange={(e) => updateField('dimension', e.currentTarget.value)} placeholder="e.g. 34 x 16 x 19" className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40" />
                <select
                  value={form.dimensionUnit}
                  onChange={(e) => updateField('dimensionUnit', e.currentTarget.value as DimensionUnit)}
                  className="px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                >
                  <option value="cm">CM</option>
                  <option value="inches">Inches</option>
                  <option value="mm">MM</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Pick-up Date and Time *</label>
              <input type="datetime-local" value={form.pickupDateTime} onChange={(e) => updateField('pickupDateTime', e.currentTarget.value)} className={getFieldClass('pickupDateTime')} required />
              {fieldErrors.pickupDateTime && <p className="text-sm text-red-600 mt-1">{fieldErrors.pickupDateTime}</p>}
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Estimated Time Arrival *</label>
              <input type="datetime-local" value={form.estimatedArrival} onChange={(e) => updateField('estimatedArrival', e.currentTarget.value)} className={getFieldClass('estimatedArrival')} required />
              {fieldErrors.estimatedArrival && <p className="text-sm text-red-600 mt-1">{fieldErrors.estimatedArrival}</p>}
            </div>
            <div>
              <label className="block text-brand-charcoal font-semibold mb-2">Items / Boxes / Cases Detail</label>
              <input type="text" value={form.boxesCasesText} onChange={(e) => updateField('boxesCasesText', e.currentTarget.value)} className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40" />
            </div>
          </div>

          <div>
            <label className="block text-brand-charcoal font-semibold mb-2">Remarks / Special Instruction</label>
            <textarea value={form.specialInstruction} onChange={(e) => updateField('specialInstruction', e.currentTarget.value)} rows={2} className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40" />
          </div>

          <div className="border-t border-brand-amber/30 pt-4">
            <h2 className="text-xl text-brand-ink mb-3">Shipper Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-brand-charcoal font-semibold mb-2">Shipper's Name *</label>
                <input type="text" value={form.shipperName} onChange={(e) => updateField('shipperName', e.currentTarget.value)} className={getFieldClass('shipperName')} required />
                {fieldErrors.shipperName && <p className="text-sm text-red-600 mt-1">{fieldErrors.shipperName}</p>}
              </div>
              <div>
                <label className="block text-brand-charcoal font-semibold mb-2">Contact Person</label>
                <input type="text" value={form.shipperContactPerson} onChange={(e) => updateField('shipperContactPerson', e.currentTarget.value)} className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-brand-charcoal font-semibold mb-2">Pick-up Address</label>
                <input type="text" value={form.pickupAddress} onChange={(e) => updateField('pickupAddress', e.currentTarget.value)} className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40" />
              </div>
              <div>
                <label className="block text-brand-charcoal font-semibold mb-2">Telephone Number</label>
                <input type="text" value={form.shipperTelephone} onChange={(e) => updateField('shipperTelephone', e.currentTarget.value)} className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40" />
              </div>
            </div>
          </div>

          <div className="border-t border-brand-amber/30 pt-4">
            <h2 className="text-xl text-brand-ink mb-3">Consignee Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-brand-charcoal font-semibold mb-2">Consignee's Name *</label>
                <input type="text" value={form.consigneeName} onChange={(e) => updateField('consigneeName', e.currentTarget.value)} className={getFieldClass('consigneeName')} required />
                {fieldErrors.consigneeName && <p className="text-sm text-red-600 mt-1">{fieldErrors.consigneeName}</p>}
              </div>
              <div>
                <label className="block text-brand-charcoal font-semibold mb-2">Contact Person</label>
                <input type="text" value={form.consigneeContactPerson} onChange={(e) => updateField('consigneeContactPerson', e.currentTarget.value)} className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-brand-charcoal font-semibold mb-2">Delivery Address</label>
                <input type="text" value={form.deliveryAddress} onChange={(e) => updateField('deliveryAddress', e.currentTarget.value)} className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40" />
              </div>
              <div>
                <label className="block text-brand-charcoal font-semibold mb-2">Telephone Number</label>
                <input type="text" value={form.consigneeTelephone} onChange={(e) => updateField('consigneeTelephone', e.currentTarget.value)} className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-brand-charcoal font-semibold mb-2">Return Documents</label>
            <input type="text" value={form.returnDocuments} onChange={(e) => updateField('returnDocuments', e.currentTarget.value)} className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40" />
          </div>

          {error && <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">{error}</div>}
          {success && <div className="p-3 bg-green-100 border border-green-300 text-green-700 rounded-lg">{success}</div>}

          {createdShipment && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg">
              <p className="font-semibold">Booking Reference: {createdShipment.booking_ref}</p>
              <p className="font-semibold">Waybill Number: {createdShipment.waybill_number}</p>
            </div>
          )}

          <div className="flex justify-end">
            {editingBookingId && (
              <button
                type="button"
                onClick={handleCancelEditBooking}
                className="bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-6 py-2 rounded-lg mr-2"
              >
                Cancel Edit
              </button>
            )}
            <button
              type="submit"
              disabled={isSaving}
              className="bg-brand-red hover:bg-brand-redDark disabled:bg-brand-charcoal/40 text-white font-semibold px-6 py-2 rounded-lg"
            >
              {isSaving ? (editingBookingId ? 'Updating Booking...' : 'Creating Booking...') : editingBookingId ? 'Update Booking' : 'Create Booking'}
            </button>
          </div>
        </form>

        <div className="mt-6 bg-white rounded-xl shadow p-6 border border-brand-amber/20">
          <h2 className="text-2xl text-brand-ink mb-4">Booking Information</h2>

          {pendingDeleteBookingId && (
            <div className="mb-4 p-4 rounded-lg border border-brand-red/40 bg-red-50 text-brand-charcoal">
              <p className="font-semibold mb-3">Are you sure you want to delete this booking?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmDeleteBooking}
                  className="bg-brand-red hover:bg-brand-redDark text-white font-semibold px-4 py-2 rounded-lg"
                >
                  Confirm Delete
                </button>
                <button
                  type="button"
                  onClick={handleCancelDeleteBooking}
                  className="bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-4 py-2 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-brand-charcoal font-semibold mb-2">Search Booking</label>
            <input
              type="text"
              value={bookingSearchQuery}
              onChange={(e) => {
                setBookingSearchQuery(e.currentTarget.value);
                setCurrentPage(1);
              }}
              placeholder="Search by booking ref, waybill, shipper, consignee, origin or destination"
              className="w-full md:w-2/3 px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
            />
          </div>

          {isLoadingBookings ? (
            <p className="text-brand-charcoal/80">Loading bookings...</p>
          ) : filteredBookings.length === 0 ? (
            <p className="text-brand-charcoal/80">No bookings found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-amber/30 text-left text-brand-charcoal">
                    <th className="py-2 pr-4">Booking Ref</th>
                    <th className="py-2 pr-4">Waybill</th>
                    <th className="py-2 pr-4">Shipper</th>
                    <th className="py-2 pr-4">Consignee</th>
                    <th className="py-2 pr-4">Mode</th>
                    <th className="py-2 pr-4">Pieces</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBookings.map((shipment) => {
                    const parsedDetails = parseCommodityDescription(shipment.commodity_description);
                    const detailsWeightUnit = (parsedDetails['Weight Unit'] || 'kg').toLowerCase() === 'g' ? 'g' : 'kg';
                    const detailsWeightValue = fromKilograms(Number(shipment.total_weight), detailsWeightUnit);
                    const detailsDimension = parsedDetails.Dimension || '-';
                    const detailsDimensionUnit = parsedDetails['Dimension Unit'] || 'cm';

                    return (
                    <Fragment key={shipment.id}>
                      <tr className="border-b border-brand-amber/15 text-brand-charcoal">
                        <td className="py-2 pr-4 font-semibold">{shipment.booking_ref}</td>
                        <td className="py-2 pr-4">{shipment.waybill_number}</td>
                        <td className="py-2 pr-4">{shipment.shipper_name}</td>
                        <td className="py-2 pr-4">{shipment.consignee_name}</td>
                        <td className="py-2 pr-4 uppercase">{shipment.mode}</td>
                        <td className="py-2 pr-4">{shipment.total_pieces}</td>
                        <td className="py-2 pr-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedBookingId((prev) => (prev === shipment.id ? null : shipment.id))
                              }
                              className="bg-brand-charcoal hover:bg-brand-ink text-white px-3 py-1 rounded"
                            >
                              {expandedBookingId === shipment.id ? 'Hide' : 'View'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditBooking(shipment)}
                              className="bg-brand-charcoal hover:bg-brand-ink text-white px-3 py-1 rounded"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBookingRequest(shipment.id)}
                              className="bg-brand-red hover:bg-brand-redDark text-white px-3 py-1 rounded"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedBookingId === shipment.id && (
                        <tr className="border-b border-brand-amber/15 bg-brand-sand/60 text-brand-charcoal">
                          <td colSpan={7} className="py-3 pr-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <p><span className="font-semibold">Origin:</span> {shipment.origin_city}</p>
                              <p><span className="font-semibold">Destination:</span> {shipment.destination_city}</p>
                              <p><span className="font-semibold">Shipper Address:</span> {shipment.shipper_address}</p>
                              <p><span className="font-semibold">Consignee Address:</span> {shipment.consignee_address}</p>
                              <p><span className="font-semibold">Weight:</span> {detailsWeightValue} {detailsWeightUnit === 'g' ? 'Grams' : 'KG'}</p>
                              <p><span className="font-semibold">Dimension:</span> {detailsDimension} {detailsDimension === '-' ? '' : detailsDimensionUnit.toUpperCase()}</p>
                              <p><span className="font-semibold">Pick-up Date and Time:</span> {formatDateTimeDisplay(parsedDetails['Pick-up Date and Time'])}</p>
                              <p><span className="font-semibold">Estimated Time Arrival:</span> {formatDateTimeDisplay(shipment.estimated_arrival)}</p>
                              <p className="md:col-span-2"><span className="font-semibold">Details:</span> {shipment.commodity_description || '-'}</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                    );
                  })}
                </tbody>
              </table>

              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-brand-charcoal/80">
                  Showing {(currentPage - 1) * pageSize + 1}
                  -{Math.min(currentPage * pageSize, filteredBookings.length)} of {filteredBookings.length}
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-brand-charcoal font-semibold">Rows:</label>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.currentTarget.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 border border-brand-amber/40 rounded focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="bg-brand-charcoal hover:bg-brand-ink text-white px-3 py-1 rounded disabled:bg-gray-400"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-brand-charcoal font-semibold">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="bg-brand-charcoal hover:bg-brand-ink text-white px-3 py-1 rounded disabled:bg-gray-400"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateBookingPage;
