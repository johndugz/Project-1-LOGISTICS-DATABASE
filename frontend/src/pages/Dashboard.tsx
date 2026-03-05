import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import apiService from '../services/api';
import { Shipment, UserRole } from '../types';
import { useAuthStore } from '../utils/authStore';

interface ShipmentPackage {
  id: string;
  barcode?: string;
  qr_code?: string;
  piece_number: number;
  status?: string;
}

interface ShipmentEvent {
  id: string;
  event_type: string;
  location?: string;
  notes?: string;
  created_at: string;
  created_by_email?: string;
  created_by_first_name?: string;
  created_by_last_name?: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_mime_type?: string;
  attachment_file_size?: number;
}

interface ShipmentDetailsResponse {
  shipment: Shipment;
  packages: ShipmentPackage[];
  events: ShipmentEvent[];
}

interface EventDraft {
  eventType: string;
  location: string;
  notes: string;
  actualArrival: string;
  attachedFileName: string;
  attachedFile: File | null;
}

interface ActivityNotification {
  type: 'new_user' | 'booking_created' | 'transit_event_added' | 'transit_event_updated';
  message: string;
  createdAt: string;
  shipmentId?: string;
}

const transitEventOptions = [
  { value: 'booked', label: 'Booked', status: 'created' },
  { value: 'picked_up', label: 'Picked Up', status: 'picked_up' },
  { value: 'in_transit', label: 'In Transit', status: 'departed' },
  { value: 'to_warehouse', label: 'to Warehouse', status: 'at_depot' },
  { value: 'for_consolidation', label: 'For Consolidation', status: 'loaded' },
  { value: 'out_for_delivery_land', label: 'Out for Delivery - LAND', status: 'out_for_delivery' },
  { value: 'out_for_delivery_sea', label: 'Out for Delivery - SEA', status: 'out_for_delivery' },
  { value: 'out_for_delivery_air', label: 'Out for Delivery - AIR', status: 'out_for_delivery' },
  { value: 'delivered', label: 'Delivered', status: 'delivered' },
  { value: 'completed', label: 'Completed', status: 'completed' },
] as const;

const getMappedStatus = (eventType: string): string => {
  const match = transitEventOptions.find((option) => option.value === eventType);
  return match?.status || 'at_depot';
};

const getEventLabel = (eventType: string): string => {
  const match = transitEventOptions.find((option) => option.value === eventType);
  return match?.label || eventType;
};

const normalizeStatus = (status: string): string => status.toLowerCase();

const getStatusBadgeClass = (status: string): string => {
  const normalizedStatus = normalizeStatus(status);

  switch (normalizedStatus) {
    case 'at_depot':
      return 'bg-yellow-400 text-black';
    case 'departed':
      return 'bg-red-600 text-white';
    case 'out_for_delivery':
      return 'bg-sky-500 text-white';
    case 'picked_up':
      return 'bg-violet-600 text-white';
    case 'arrived':
      return 'bg-red-600 text-white';
    case 'delivered':
      return 'bg-green-600 text-white';
    case 'completed':
      return 'bg-brand-ink text-white';
    default:
      return 'bg-brand-charcoal text-white';
  }
};

const getShipmentStatusLabel = (status: string, mode: string): string => {
  const normalizedStatus = normalizeStatus(status);

  switch (normalizedStatus) {
    case 'created':
      return 'Booked';
    case 'picked_up':
      return 'Picked Up';
    case 'departed':
    case 'arrived':
      return 'In Transit';
    case 'at_depot':
      return 'to Warehouse';
    case 'loaded':
      return 'For Consolidation';
    case 'out_for_delivery':
      return `Out for Delivery - ${mode.toUpperCase()}`;
    case 'delivered':
      return 'Delivered';
    case 'completed':
      return 'Completed';
    default:
      return normalizedStatus.replace(/_/g, ' ');
  }
};

const extractAttachmentUrl = (notes?: string): string | null => {
  if (!notes) return null;

  const explicitMatch = notes.match(/Attachment URL:\s*([^|\s]+)/i);
  if (explicitMatch?.[1]) {
    return explicitMatch[1].trim();
  }

  const fallbackMatch = notes.match(/(https?:\/\/[^\s|]+\/uploads\/[^\s|]+|\/uploads\/[^\s|]+)/i);
  return fallbackMatch?.[1] || null;
};

const extractAttachmentName = (notes?: string): string | null => {
  if (!notes) return null;

  const match = notes.match(/Attachment:\s*([^|]+)/i);
  return match?.[1]?.trim() || null;
};

const cleanEventNotes = (notes?: string): string => {
  if (!notes) {
    return '-';
  }

  const sanitized = notes
    .replace(/\s*\|\s*Attachment:\s*[^|]+/gi, '')
    .replace(/\s*\|\s*Attachment URL:\s*[^|\s]+/gi, '')
    .trim();

  return sanitized || '-';
};

const resolveAttachmentUrl = (attachmentUrl: string): string => {
  if (/^https?:\/\//i.test(attachmentUrl)) {
    return attachmentUrl;
  }

  const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';

  if (apiBaseUrl.startsWith('http')) {
    const backendOrigin = new URL(apiBaseUrl).origin;
    return `${backendOrigin}${attachmentUrl.startsWith('/') ? attachmentUrl : `/${attachmentUrl}`}`;
  }

  return `${window.location.origin}${attachmentUrl.startsWith('/') ? attachmentUrl : `/${attachmentUrl}`}`;
};

const formatRelativeTime = (isoDate: string): string => {
  const target = new Date(isoDate).getTime();
  const diffMs = Date.now() - target;

  if (Number.isNaN(target) || diffMs < 0) return 'just now';

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

const parseCommodityMetadata = (description?: string): Record<string, string> => {
  if (!description) return {};

  return description
    .split(' | ')
    .reduce<Record<string, string>>((acc, item) => {
      const separatorIndex = item.indexOf(':');
      if (separatorIndex < 0) return acc;

      const key = item.slice(0, separatorIndex).trim();
      const value = item.slice(separatorIndex + 1).trim();

      if (!key || !value) return acc;
      acc[key] = value;
      return acc;
    }, {});
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const token = useAuthStore((state) => state.token);
  const hasRole = useAuthStore((state) => state.hasRole);
  const isAdmin = hasRole(UserRole.ADMIN);
  const isOperator = hasRole(UserRole.OPERATOR);
  const canManage = isAdmin || isOperator;
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [summaryShipments, setSummaryShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    mode: '',
    completionView: 'all' as 'active' | 'completed' | 'all',
  });
  const [expandedShipmentId, setExpandedShipmentId] = useState<string | null>(null);
  const [detailsByShipment, setDetailsByShipment] = useState<Record<string, ShipmentDetailsResponse>>({});
  const [detailsLoadingId, setDetailsLoadingId] = useState<string | null>(null);
  const [detailsErrorByShipment, setDetailsErrorByShipment] = useState<Record<string, string>>({});
  const [eventDraftByShipment, setEventDraftByShipment] = useState<Record<string, EventDraft>>({});
  const [eventSavingId, setEventSavingId] = useState<string | null>(null);
  const [eventDeletingId, setEventDeletingId] = useState<string | null>(null);
  const [expandedAttachmentByEvent, setExpandedAttachmentByEvent] = useState<Record<string, boolean>>({});
  const [enlargedAttachmentByEvent, setEnlargedAttachmentByEvent] = useState<Record<string, boolean>>({});
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [activityNotifications, setActivityNotifications] = useState<ActivityNotification[]>([]);
  const [lastNotificationAt, setLastNotificationAt] = useState<string | null>(null);
  const [pendingOpenShipmentId, setPendingOpenShipmentId] = useState<string | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const activityNotificationDedupRef = useRef<Map<string, number>>(new Map());

  const addActivityNotification = useCallback((notification: ActivityNotification): void => {
    const dedupKey = `${notification.type}|${notification.shipmentId || ''}|${notification.message}`;
    const now = Date.now();
    const lastSeenAt = activityNotificationDedupRef.current.get(dedupKey);

    if (lastSeenAt && now - lastSeenAt < 4000) {
      return;
    }

    activityNotificationDedupRef.current.set(dedupKey, now);
    setActivityNotifications((prev) => [notification, ...prev].slice(0, 20));
    setLastNotificationAt(notification.createdAt || new Date().toISOString());
  }, []);

  const shipmentSummary = useMemo(() => {
    const counts = {
      booked: 0,
      pickedUp: 0,
      inTransit: 0,
      toWarehouse: 0,
      forConsolidation: 0,
      outForDeliveryLand: 0,
      outForDeliverySea: 0,
      outForDeliveryAir: 0,
      delivered: 0,
      completed: 0,
    };

    summaryShipments.forEach((shipment) => {
      switch (normalizeStatus(shipment.current_status)) {
        case 'created':
          counts.booked += 1;
          break;
        case 'picked_up':
          counts.pickedUp += 1;
          break;
        case 'departed':
        case 'arrived':
          counts.inTransit += 1;
          break;
        case 'at_depot':
          counts.toWarehouse += 1;
          break;
        case 'loaded':
          counts.forConsolidation += 1;
          break;
        case 'out_for_delivery':
          if (shipment.mode === 'land') {
            counts.outForDeliveryLand += 1;
          } else if (shipment.mode === 'sea') {
            counts.outForDeliverySea += 1;
          } else {
            counts.outForDeliveryAir += 1;
          }
          break;
        case 'delivered':
          counts.delivered += 1;
          break;
        case 'completed':
          counts.completed += 1;
          break;
        default:
          break;
      }
    });

    return counts;
  }, [summaryShipments]);

  const loadShipments = useCallback(async (showLoading = true): Promise<void> => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      const response = await apiService.listShipments(0, 200, {});
      const allShipments = Array.isArray(response.data) ? response.data : [];

      let visibleShipments = allShipments;

      if (filters.completionView === 'active') {
        visibleShipments = visibleShipments.filter(
          (shipment) => normalizeStatus(shipment.current_status) !== 'completed'
        );
      }

      if (filters.completionView === 'completed') {
        visibleShipments = visibleShipments.filter(
          (shipment) => normalizeStatus(shipment.current_status) === 'completed'
        );
      }

      if (filters.status) {
        visibleShipments = visibleShipments.filter(
          (shipment) => normalizeStatus(shipment.current_status) === filters.status
        );
      }

      if (filters.mode) {
        visibleShipments = visibleShipments.filter((shipment) => shipment.mode === filters.mode);
      }

      setShipments(visibleShipments);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shipments');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }, [filters]);

  const loadShipmentSummary = useCallback(async (): Promise<void> => {
    try {
      const response = await apiService.listShipments(0, 200, {});
      setSummaryShipments(Array.isArray(response.data) ? response.data : []);
    } catch {
      setSummaryShipments([]);
    }
  }, []);

  const loadPendingApprovals = useCallback(async (): Promise<void> => {
    if (!isAdmin) {
      setPendingApprovalCount(0);
      return;
    }

    try {
      const pendingUsers = await apiService.listPendingUsers();
      setPendingApprovalCount(pendingUsers.length);
    } catch {
      setPendingApprovalCount(0);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  useEffect(() => {
    loadShipmentSummary();
  }, [loadShipmentSummary]);

  useEffect(() => {
    loadPendingApprovals();
  }, [loadPendingApprovals]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadShipments(false);
      loadShipmentSummary();
      loadPendingApprovals();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadShipments, loadShipmentSummary, loadPendingApprovals]);

  useEffect(() => {
    if (!canManage || !token) return;

    const apiBaseUrl = import.meta.env.VITE_API_URL || '/api';
    const backendOrigin = apiBaseUrl.startsWith('http')
      ? new URL(apiBaseUrl).origin
      : window.location.origin;

    const socket = io(backendOrigin, {
      auth: { token },
      transports: ['websocket'],
    });

    if (isAdmin) {
      socket.on('pending-approvals-updated', () => {
        loadPendingApprovals();
        setLastNotificationAt(new Date().toISOString());
      });

      socket.on('admin-activity-notification', (notification: ActivityNotification) => {
        addActivityNotification(notification);
      });
    }

    socket.on('operations-activity-notification', (notification: ActivityNotification) => {
      if (notification.type === 'new_user') {
        return;
      }
      addActivityNotification(notification);
    });

    return () => {
      socket.disconnect();
    };
  }, [isAdmin, canManage, token, loadPendingApprovals, addActivityNotification]);

  useEffect(() => {
    if (!pendingOpenShipmentId) return;

    const existsInList = shipments.some((shipment) => shipment.id === pendingOpenShipmentId);
    if (!existsInList) return;

    handleToggleDetails(pendingOpenShipmentId);
    setPendingOpenShipmentId(null);

    window.setTimeout(() => {
      const card = document.getElementById(`shipment-card-${pendingOpenShipmentId}`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 250);
  }, [pendingOpenShipmentId, shipments]);

  useEffect(() => {
    if (!isSettingsMenuOpen && !isNotificationMenuOpen) return;

    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node;
      if (!settingsMenuRef.current?.contains(target)) {
        setIsSettingsMenuOpen(false);
        setIsNotificationMenuOpen(false);
      }
    };

    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [isSettingsMenuOpen, isNotificationMenuOpen]);

  const handleLogout = (): void => {
    logout();
    navigate('/login');
  };

  const handleToggleDetails = async (shipmentId: string): Promise<void> => {
    if (expandedShipmentId === shipmentId) {
      setExpandedShipmentId(null);
      return;
    }

    setExpandedShipmentId(shipmentId);

    if (detailsByShipment[shipmentId]) {
      return;
    }

    if (!eventDraftByShipment[shipmentId]) {
      setEventDraftByShipment((prev) => ({
        ...prev,
        [shipmentId]: {
          eventType: 'booked',
          location: '',
          notes: '',
          actualArrival: '',
          attachedFileName: '',
          attachedFile: null,
        },
      }));
    }

    try {
      setDetailsLoadingId(shipmentId);
      const response = (await apiService.getShipment(shipmentId)) as unknown as ShipmentDetailsResponse;
      setDetailsByShipment((prev) => ({ ...prev, [shipmentId]: response }));
      setDetailsErrorByShipment((prev) => ({ ...prev, [shipmentId]: '' }));
    } catch (err) {
      setDetailsErrorByShipment((prev) => ({
        ...prev,
        [shipmentId]: err instanceof Error ? err.message : 'Failed to load details',
      }));
    } finally {
      setDetailsLoadingId(null);
    }
  };

  const handleEventDraftChange = (
    shipmentId: string,
    field: keyof EventDraft,
    value: string
  ): void => {
    setEventDraftByShipment((prev) => ({
      ...prev,
      [shipmentId]: {
        eventType: prev[shipmentId]?.eventType || 'booked',
        location: prev[shipmentId]?.location || '',
        notes: prev[shipmentId]?.notes || '',
        actualArrival: prev[shipmentId]?.actualArrival || '',
        attachedFileName: prev[shipmentId]?.attachedFileName || '',
        attachedFile: prev[shipmentId]?.attachedFile || null,
        [field]: value,
      },
    }));
  };

  const handleEventAttachmentChange = (shipmentId: string, file: File | null): void => {
    setEventDraftByShipment((prev) => ({
      ...prev,
      [shipmentId]: {
        eventType: prev[shipmentId]?.eventType || 'booked',
        location: prev[shipmentId]?.location || '',
        notes: prev[shipmentId]?.notes || '',
        actualArrival: prev[shipmentId]?.actualArrival || '',
        attachedFileName: file?.name || '',
        attachedFile: file,
      },
    }));
  };

  const handleAddTransitEvent = async (shipmentId: string): Promise<void> => {
    if (!canManage) {
      setDetailsErrorByShipment((prev) => ({
        ...prev,
        [shipmentId]: 'Guest users can only view shipment details.',
      }));
      return;
    }

    const draft = eventDraftByShipment[shipmentId];
    if (!draft?.eventType) {
      setDetailsErrorByShipment((prev) => ({
        ...prev,
        [shipmentId]: 'Please select an event type.',
      }));
      return;
    }

    const mappedStatus = getMappedStatus(draft.eventType);
    if (mappedStatus === 'completed' && !draft.actualArrival) {
      setExpandedShipmentId(shipmentId);
      setDetailsErrorByShipment((prev) => ({
        ...prev,
        [shipmentId]: 'Actual arrival is required when status is Completed.',
      }));

      window.setTimeout(() => {
        const field = document.getElementById(`actual-arrival-${shipmentId}`) as HTMLInputElement | null;
        field?.focus();
        field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }

    try {
      setEventSavingId(shipmentId);
      const noteParts = [getEventLabel(draft.eventType)];
      if (draft.notes) {
        noteParts.push(draft.notes);
      }
      if (draft.attachedFileName) {
        noteParts.push(`Attachment: ${draft.attachedFileName}`);
      }

      const formData = new FormData();
      formData.append('eventType', mappedStatus);
      formData.append('location', draft.location);
      formData.append('notes', noteParts.join(' - '));
      if (draft.actualArrival) {
        formData.append('actualArrival', new Date(draft.actualArrival).toISOString());
      }
      if (draft.attachedFile) {
        formData.append('attachment', draft.attachedFile);
      }

      await apiService.addBookingEvent(shipmentId, formData);

      const shipmentInList = shipments.find((row) => row.id === shipmentId);
      const shipmentMetadata = parseCommodityMetadata(shipmentInList?.commodity_description);
      const clientName =
        shipmentMetadata.Client || shipmentMetadata.Customer || shipmentInList?.shipper_name || 'Unknown Client';
      const waybill = shipmentInList?.waybill_number || 'N/A';
      const localNotification: ActivityNotification = {
        type: 'transit_event_updated',
        message: `Transit event updated (${getMappedStatus(draft.eventType)}) for WAYBILL ${waybill} - Client ${clientName}`,
        createdAt: new Date().toISOString(),
        shipmentId,
      };
      addActivityNotification(localNotification);

      const refreshed = (await apiService.getShipment(shipmentId)) as unknown as ShipmentDetailsResponse;
      setDetailsByShipment((prev) => ({ ...prev, [shipmentId]: refreshed }));
      await loadShipments();
      await loadShipmentSummary();
      setEventDraftByShipment((prev) => ({
        ...prev,
        [shipmentId]: {
          eventType: draft.eventType,
          location: '',
          notes: '',
          actualArrival: '',
          attachedFileName: '',
          attachedFile: null,
        },
      }));
      setDetailsErrorByShipment((prev) => ({ ...prev, [shipmentId]: '' }));
    } catch (err) {
      setDetailsErrorByShipment((prev) => ({
        ...prev,
        [shipmentId]: err instanceof Error ? err.message : 'Failed to add transit event',
      }));
    } finally {
      setEventSavingId(null);
    }
  };

  const handleDeleteTransitEvent = async (shipmentId: string, eventId: string): Promise<void> => {
    if (!isAdmin) {
      setDetailsErrorByShipment((prev) => ({
        ...prev,
        [shipmentId]: 'Only admin users can delete event logs.',
      }));
      return;
    }

    const shouldDelete = window.confirm('Delete this event log? This cannot be undone.');
    if (!shouldDelete) {
      return;
    }

    try {
      setEventDeletingId(eventId);
      await apiService.deleteBookingEvent(shipmentId, eventId);

      const refreshed = (await apiService.getShipment(shipmentId)) as unknown as ShipmentDetailsResponse;
      setDetailsByShipment((prev) => ({ ...prev, [shipmentId]: refreshed }));
      await loadShipments();
      await loadShipmentSummary();
      setDetailsErrorByShipment((prev) => ({ ...prev, [shipmentId]: '' }));
    } catch (err) {
      setDetailsErrorByShipment((prev) => ({
        ...prev,
        [shipmentId]: err instanceof Error ? err.message : 'Failed to delete transit event',
      }));
    } finally {
      setEventDeletingId(null);
    }
  };

  const handleFlowCardClick = (
    status: string,
    mode: '' | 'land' | 'sea' | 'air' = '',
    completionView: 'active' | 'completed' | 'all' = 'active'
  ): void => {
    setFilters({
      ...filters,
      status,
      mode,
      completionView,
    });
  };

  const handleNotificationViewDetails = (shipmentId: string): void => {
    setFilters({ status: '', mode: '', completionView: 'all' });
    if (expandedShipmentId !== shipmentId) {
      setExpandedShipmentId(null);
    }
    setIsNotificationMenuOpen(false);
    setPendingOpenShipmentId(shipmentId);
    void loadShipments(false);
  };

  const handleClearActivityNotification = (indexToRemove: number): void => {
    setActivityNotifications((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleClearAllActivityNotifications = (): void => {
    setActivityNotifications([]);
  };

  return (
    <div className="min-h-screen bg-brand-sand py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <img
              src="/NAME lgo.png"
              alt="Toplis Logistics Inc."
              className="h-48 mb-4 object-contain"
            />
            <p className="text-xs uppercase tracking-[0.2em] text-brand-red font-semibold mb-2">
              Toplis Logistics Operations
            </p>
            <h1 className="text-4xl text-brand-ink">
              Dashboard
            </h1>
            {canManage && (
              <Link
                to="/create-booking"
                className="inline-block mt-4 bg-brand-red hover:bg-brand-redDark text-white font-semibold px-4 py-2 rounded-lg"
              >
                Create Booking
              </Link>
            )}
          </div>
          <div className="flex gap-2 mt-2" ref={settingsMenuRef}>
            {canManage && (
              <Link
                to="/client-information"
                className="bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-4 py-2 rounded-lg"
              >
                Client Information
              </Link>
            )}

            {canManage && (
              <button
                type="button"
                onClick={() => {
                  setIsNotificationMenuOpen((prev) => !prev);
                  setIsSettingsMenuOpen(false);
                }}
                className="relative bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-3 py-2 rounded-lg"
                title="Notifications"
              >
                🌐
                {activityNotifications.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-brand-red text-white text-xs font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
                    {activityNotifications.length > 99 ? '99+' : activityNotifications.length}
                  </span>
                )}
              </button>
            )}

            {canManage && isNotificationMenuOpen && (
              <div className="absolute right-56 mt-12 w-72 bg-white border border-brand-amber/30 rounded-lg shadow-lg z-20 p-3">
                {isAdmin && (
                  <>
                    <p className="text-sm text-brand-charcoal font-semibold mb-1">Notification</p>
                    {lastNotificationAt && (
                      <p className="text-xs text-brand-charcoal/70 mb-2">
                        Updated {formatRelativeTime(lastNotificationAt)}
                      </p>
                    )}
                    {pendingApprovalCount > 0 ? (
                      <>
                        <p className="text-sm text-brand-charcoal/90 mb-2">
                          {pendingApprovalCount === 1
                            ? 'New user has created an account.'
                            : `${pendingApprovalCount} new users have created accounts.`}
                        </p>
                        <Link
                          to="/settings#pending-user-approvals"
                          onClick={() => setIsNotificationMenuOpen(false)}
                          className="inline-block text-sm bg-brand-red hover:bg-brand-redDark text-white font-semibold px-3 py-2 rounded"
                        >
                          Go to User Approval
                        </Link>
                      </>
                    ) : (
                      <p className="text-sm text-brand-charcoal/80 mb-2">No new user notifications.</p>
                    )}
                  </>
                )}

                <div className={isAdmin ? 'mt-3 pt-2 border-t border-brand-amber/20' : ''}>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm text-brand-charcoal font-semibold">Activity ({activityNotifications.length})</p>
                    <button
                      type="button"
                      onClick={handleClearAllActivityNotifications}
                      className="text-xs bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-2 py-1 rounded"
                      disabled={activityNotifications.length === 0}
                    >
                      Clear All
                    </button>
                  </div>
                  {activityNotifications.length === 0 ? (
                    <p className="text-sm text-brand-charcoal/80">No booking or transit notifications yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {activityNotifications.map((item, index) => (
                        <div key={`${item.createdAt}-${index}`} className="rounded border border-brand-amber/20 p-2 bg-brand-sand/40">
                          <p className="text-sm text-brand-charcoal">{item.message}</p>
                          <p className="text-xs text-brand-charcoal/70 mt-1">{formatRelativeTime(item.createdAt)}</p>
                          <div className="mt-2 flex items-center gap-2">
                            {item.shipmentId && (
                              <button
                                type="button"
                                onClick={() => handleNotificationViewDetails(item.shipmentId as string)}
                                className="text-xs bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-2 py-1 rounded"
                              >
                                View Details
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleClearActivityNotification(index)}
                              className="text-xs bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-2 py-1 rounded"
                              title="Clear notification"
                            >
                              ✅
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsSettingsMenuOpen((prev) => !prev);
                  setIsNotificationMenuOpen(false);
                }}
                className="bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-4 py-2 rounded-lg"
              >
                Settings ▾
              </button>

              {isSettingsMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white border border-brand-amber/30 rounded-lg shadow-lg z-20 py-1">
                  <Link
                    to="/settings"
                    onClick={() => setIsSettingsMenuOpen(false)}
                    className="block px-4 py-2 text-brand-charcoal hover:bg-brand-sand"
                  >
                    Change Password
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/settings#pending-user-approvals"
                      onClick={() => setIsSettingsMenuOpen(false)}
                      className="block px-4 py-2 text-brand-charcoal hover:bg-brand-sand"
                    >
                      User Approval
                    </Link>
                  )}
                  <div className="my-1 border-t border-brand-amber/30" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-brand-red hover:bg-red-50"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6 bg-white rounded-xl shadow p-4 border border-brand-amber/20">
          <div className="flex flex-wrap items-end gap-4">
            <p className="text-brand-charcoal font-bold">Filters</p>
            <div>
              <label className="block text-sm text-brand-charcoal font-semibold mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.currentTarget.value })
                }
                className="min-w-[13rem] px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
              >
                <option value="">All Status</option>
                <option value="created">Booked</option>
                <option value="picked_up">Picked Up</option>
                <option value="departed">In Transit</option>
                <option value="at_depot">to Warehouse</option>
                <option value="loaded">For Consolidation</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-brand-charcoal font-semibold mb-1">Mode</label>
              <select
                value={filters.mode}
                onChange={(e) =>
                  setFilters({ ...filters, mode: e.currentTarget.value })
                }
                className="min-w-[10rem] px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
              >
                <option value="">All Modes</option>
                <option value="sea">Sea</option>
                <option value="air">Air</option>
                <option value="land">Land</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-brand-charcoal font-semibold mb-1">Transactions</label>
              <select
                value={filters.completionView}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    completionView: e.currentTarget.value as 'active' | 'completed' | 'all',
                  })
                }
                className="min-w-[12rem] px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
              >
                <option value="active">Active Only</option>
                <option value="completed">Completed Only</option>
                <option value="all">All Transactions</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mb-6 bg-white rounded-xl shadow p-4 border border-brand-amber/20">
          <h3 className="font-bold mb-3 text-brand-charcoal uppercase tracking-wide">Shipment Flow</h3>

          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => handleFlowCardClick('created')}
                className="text-left rounded-lg border border-brand-amber/20 border-l-4 border-l-brand-red bg-brand-sand/60 px-3 py-2 hover:bg-brand-sand min-w-0"
              >
                <p className="text-sm font-semibold text-brand-ink">📖 Booked</p>
                <p className="text-base font-semibold text-brand-charcoal leading-tight">{shipmentSummary.booked}</p>
              </button>

              <button
                type="button"
                onClick={() => handleFlowCardClick('picked_up')}
                className="text-left rounded-lg border border-brand-amber/20 border-l-4 border-l-brand-red bg-brand-sand/60 px-3 py-2 hover:bg-brand-sand min-w-0"
              >
                <p className="text-sm font-semibold text-brand-ink">🚚 Picked Up</p>
                <p className="text-base font-semibold text-brand-charcoal leading-tight">{shipmentSummary.pickedUp}</p>
              </button>

              <button
                type="button"
                onClick={() => handleFlowCardClick('departed')}
                className="text-left rounded-lg border border-brand-amber/20 border-l-4 border-l-amber-500 bg-brand-sand/60 px-3 py-2 hover:bg-brand-sand min-w-0"
              >
                <p className="text-sm font-semibold text-brand-ink">🚚 In Transit</p>
                <p className="text-base font-semibold text-brand-charcoal leading-tight">{shipmentSummary.inTransit}</p>
              </button>

              <button
                type="button"
                onClick={() => handleFlowCardClick('at_depot')}
                className="text-left rounded-lg border border-brand-amber/20 border-l-4 border-l-amber-500 bg-brand-sand/60 px-3 py-2 hover:bg-brand-sand min-w-0"
              >
                <p className="text-sm font-semibold text-brand-ink">🏬 to Warehouse</p>
                <p className="text-base font-semibold text-brand-charcoal leading-tight">{shipmentSummary.toWarehouse}</p>
              </button>

              <button
                type="button"
                onClick={() => handleFlowCardClick('loaded')}
                className="text-left rounded-lg border border-brand-amber/20 border-l-4 border-l-brand-red bg-brand-sand/60 px-3 py-2 hover:bg-brand-sand min-w-0"
              >
                <p className="text-sm font-semibold text-brand-ink">📦 Consolidation</p>
                <p className="text-base font-semibold text-brand-charcoal leading-tight">{shipmentSummary.forConsolidation}</p>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              <button
                type="button"
                onClick={() => handleFlowCardClick('out_for_delivery', 'land')}
                className="text-left rounded-lg border border-brand-amber/20 border-l-4 border-l-brand-red bg-brand-sand/60 px-3 py-2 hover:bg-brand-sand min-w-0"
              >
                <p className="text-sm font-semibold text-brand-ink">🚚 Out for Delivery - LAND</p>
                <p className="text-base font-semibold text-brand-charcoal leading-tight">{shipmentSummary.outForDeliveryLand}</p>
              </button>

              <button
                type="button"
                onClick={() => handleFlowCardClick('out_for_delivery', 'sea')}
                className="text-left rounded-lg border border-brand-amber/20 border-l-4 border-l-brand-red bg-brand-sand/60 px-3 py-2 hover:bg-brand-sand min-w-0"
              >
                <p className="text-sm font-semibold text-brand-ink">🚢 Out for Delivery - SEA</p>
                <p className="text-base font-semibold text-brand-charcoal leading-tight">{shipmentSummary.outForDeliverySea}</p>
              </button>

              <button
                type="button"
                onClick={() => handleFlowCardClick('out_for_delivery', 'air')}
                className="text-left rounded-lg border border-brand-amber/20 border-l-4 border-l-brand-red bg-brand-sand/60 px-3 py-2 hover:bg-brand-sand min-w-0"
              >
                <p className="text-sm font-semibold text-brand-ink">✈️ Out for Delivery - AIR</p>
                <p className="text-base font-semibold text-brand-charcoal leading-tight">{shipmentSummary.outForDeliveryAir}</p>
              </button>

              <button
                type="button"
                onClick={() => handleFlowCardClick('delivered', '', 'all')}
                className="text-left rounded-lg border border-brand-amber/20 border-l-4 border-l-green-600 bg-brand-sand/60 px-3 py-2 hover:bg-brand-sand min-w-0"
              >
                <p className="text-sm font-semibold text-brand-ink">✅ Delivered</p>
                <p className="text-base font-semibold text-brand-charcoal leading-tight">{shipmentSummary.delivered}</p>
              </button>

              <button
                type="button"
                onClick={() => handleFlowCardClick('completed', '', 'all')}
                className="text-left rounded-lg border border-brand-amber/20 border-l-4 border-l-brand-ink bg-brand-sand/60 px-3 py-2 hover:bg-brand-sand min-w-0"
              >
                <p className="text-sm font-semibold text-brand-ink">🏁 Completed</p>
                <p className="text-base font-semibold text-brand-charcoal leading-tight">{shipmentSummary.completed}</p>
              </button>
            </div>
          </div>
        </div>

        {/* Shipment list */}
        {isLoading ? (
          <div className="text-center py-8 text-brand-charcoal">Loading...</div>
        ) : error ? (
          <div className="p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg">
            {error}
          </div>
        ) : shipments.length === 0 ? (
          <div className="text-center py-8 text-brand-charcoal/80">
            No shipments found
          </div>
        ) : (
          <div className="grid gap-4">
            {shipments.map((shipment: Shipment) => {
              const commodityMetadata = parseCommodityMetadata(shipment.commodity_description);
              const clientBusinessName = commodityMetadata.Customer || '-';
              const shipperContactNumber = commodityMetadata['Shipper Phone'] || '-';
              const consigneeContactNumber = commodityMetadata['Consignee Phone'] || '-';
              const commodity = commodityMetadata.Commodity || shipment.commodity_description || '-';
              const boxes = commodityMetadata['Items/Boxes/Cases'] || String(shipment.total_pieces || '-');

              return (
                <div
                  key={shipment.id}
                  id={`shipment-card-${shipment.id}`}
                  className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition border border-brand-amber/20"
                >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-lg font-bold text-brand-ink">
                      Client: {clientBusinessName}
                    </p>
                    <p className="text-sm text-brand-charcoal/90">
                      Waybill: <span className="font-semibold text-brand-ink">{shipment.waybill_number || '-'}</span>
                    </p>
                    <p className="text-sm text-brand-charcoal/90">
                      Commodity: <span className="font-semibold text-brand-ink">{commodity}</span>
                    </p>
                    <p className="text-sm text-brand-charcoal/90">
                      No. Boxes: <span className="font-semibold text-brand-ink">{boxes}</span>
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${getStatusBadgeClass(
                      shipment.current_status
                    )}`}
                  >
                    {getShipmentStatusLabel(shipment.current_status, shipment.mode)}
                  </span>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleToggleDetails(shipment.id)}
                    className="flex-1 bg-brand-red hover:bg-brand-redDark text-white font-bold py-2 px-4 rounded-lg"
                  >
                    {expandedShipmentId === shipment.id ? 'Hide Details' : 'View Details'}
                  </button>
                </div>

                {expandedShipmentId === shipment.id && (
                  <div className="mt-4 p-4 bg-brand-sand/60 border border-brand-amber/30 rounded-lg">
                    {detailsLoadingId === shipment.id ? (
                      <p className="text-brand-charcoal/80">Loading full details...</p>
                    ) : detailsErrorByShipment[shipment.id] ? (
                      <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
                        {detailsErrorByShipment[shipment.id]}
                      </div>
                    ) : detailsByShipment[shipment.id] ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <p><span className="font-semibold">Booking Reference:</span> {detailsByShipment[shipment.id].shipment.booking_ref}</p>
                          <p><span className="font-semibold">Client (from Name of Business):</span> {commodityMetadata.Customer || '-'}</p>
                          <p><span className="font-semibold">Waybill:</span> {detailsByShipment[shipment.id].shipment.waybill_number || '-'}</p>
                          <p><span className="font-semibold">Shipper:</span> {detailsByShipment[shipment.id].shipment.shipper_name}</p>
                          <p><span className="font-semibold">Consignee:</span> {detailsByShipment[shipment.id].shipment.consignee_name}</p>
                          <p><span className="font-semibold">Shipper Address:</span> {detailsByShipment[shipment.id].shipment.shipper_address}</p>
                          <p><span className="font-semibold">Consignee Address:</span> {detailsByShipment[shipment.id].shipment.consignee_address}</p>
                          <p><span className="font-semibold">Shipper Contact Number:</span> {shipperContactNumber}</p>
                          <p><span className="font-semibold">Consignee Contact Number:</span> {consigneeContactNumber}</p>
                          <p><span className="font-semibold">No. of Boxes:</span> {boxes}</p>
                          <p><span className="font-semibold">Weight:</span> {detailsByShipment[shipment.id].shipment.total_weight}</p>
                          <p><span className="font-semibold">Commodity:</span> {detailsByShipment[shipment.id].shipment.commodity_description || '-'}</p>
                          <p><span className="font-semibold">Estimated Arrival:</span> {detailsByShipment[shipment.id].shipment.estimated_arrival ? new Date(detailsByShipment[shipment.id].shipment.estimated_arrival).toLocaleString() : '-'}</p>
                          <p><span className="font-semibold">Actual Arrival:</span> {detailsByShipment[shipment.id].shipment.actual_arrival ? new Date(detailsByShipment[shipment.id].shipment.actual_arrival as string).toLocaleString() : '-'}</p>
                        </div>

                        <div className="mt-4">
                          <p className="font-semibold text-brand-ink mb-2">Add Transit Event</p>
                          {canManage ? (
                          <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <select
                              value={eventDraftByShipment[shipment.id]?.eventType || 'booked'}
                              onChange={(e) =>
                                handleEventDraftChange(shipment.id, 'eventType', e.currentTarget.value)
                              }
                              className="px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                            >
                              {transitEventOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              placeholder="Location"
                              value={eventDraftByShipment[shipment.id]?.location || ''}
                              onChange={(e) =>
                                handleEventDraftChange(shipment.id, 'location', e.currentTarget.value)
                              }
                              className="px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                            />
                            <input
                              type="text"
                              placeholder="Notes"
                              value={eventDraftByShipment[shipment.id]?.notes || ''}
                              onChange={(e) =>
                                handleEventDraftChange(shipment.id, 'notes', e.currentTarget.value)
                              }
                              className="px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                            />
                            {getMappedStatus(eventDraftByShipment[shipment.id]?.eventType || 'booked') === 'completed' && (
                              <div>
                                {(() => {
                                  const actualArrivalError = detailsErrorByShipment[shipment.id] || '';
                                  const hasActualArrivalError = /actual arrival/i.test(actualArrivalError);

                                  return (
                                    <>
                                      <input
                                        id={`actual-arrival-${shipment.id}`}
                                        type="datetime-local"
                                        value={eventDraftByShipment[shipment.id]?.actualArrival || ''}
                                        onChange={(e) => {
                                          handleEventDraftChange(shipment.id, 'actualArrival', e.currentTarget.value);
                                          if (hasActualArrivalError) {
                                            setDetailsErrorByShipment((prev) => ({ ...prev, [shipment.id]: '' }));
                                          }
                                        }}
                                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40 ${
                                          hasActualArrivalError ? 'border-red-400' : 'border-brand-amber/40'
                                        }`}
                                        required
                                        title="Actual arrival is required for Completed status"
                                      />
                                      {hasActualArrivalError ? (
                                        <p className="text-xs text-red-600 mt-1">{actualArrivalError}</p>
                                      ) : (
                                        <p className="text-xs text-brand-charcoal/70 mt-1">Required when status is Completed.</p>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.currentTarget.files?.[0] || null;
                                handleEventAttachmentChange(shipment.id, file);
                              }}
                              className="px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                            />
                          </div>
                          {eventDraftByShipment[shipment.id]?.attachedFileName && (
                            <p className="text-sm text-brand-charcoal/80 mt-2">
                              Attached file: {eventDraftByShipment[shipment.id].attachedFileName}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAddTransitEvent(shipment.id)}
                            disabled={eventSavingId === shipment.id}
                            className="mt-2 bg-brand-red hover:bg-brand-redDark disabled:bg-brand-charcoal/40 text-white font-semibold px-4 py-2 rounded-lg"
                          >
                            {eventSavingId === shipment.id ? 'Saving Event...' : 'Add Transit Event'}
                          </button>
                          </>
                          ) : (
                            <p className="text-sm text-brand-charcoal/80">Guest users can only view shipment events.</p>
                          )}
                        </div>

                        <div className="mt-4">
                          <p className="font-semibold text-brand-ink mb-2">
                            Events ({detailsByShipment[shipment.id].events.length})
                          </p>
                          {detailsByShipment[shipment.id].events.length === 0 ? (
                            <p className="text-sm text-brand-charcoal/80">No events yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {detailsByShipment[shipment.id].events.slice().reverse().map((event) => {
                                const attachmentUrl = event.attachment_url || extractAttachmentUrl(event.notes);
                                const attachmentName = event.attachment_name || extractAttachmentName(event.notes);
                                const resolvedAttachmentUrl = attachmentUrl
                                  ? resolveAttachmentUrl(attachmentUrl)
                                  : null;
                                const isAttachmentOpen = !!expandedAttachmentByEvent[event.id];
                                const isAttachmentEnlarged = !!enlargedAttachmentByEvent[event.id];

                                return (
                                  <div key={event.id} className="bg-white border border-brand-amber/20 rounded p-2 text-sm">
                                    <div className="flex items-start justify-between gap-2">
                                      <p><span className="font-semibold">Type:</span> {event.event_type}</p>
                                      {isAdmin && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteTransitEvent(shipment.id, event.id)}
                                          disabled={eventDeletingId === event.id}
                                          className="h-6 min-w-6 px-2 rounded bg-brand-red hover:bg-brand-redDark disabled:bg-brand-charcoal/40 text-white font-bold leading-none"
                                          aria-label="Delete event log"
                                          title="Delete event log"
                                        >
                                          {eventDeletingId === event.id ? '...' : 'X'}
                                        </button>
                                      )}
                                    </div>
                                    <p><span className="font-semibold">Location:</span> {event.location || '-'}</p>
                                    <p><span className="font-semibold">Notes:</span> {cleanEventNotes(event.notes)}</p>
                                    {resolvedAttachmentUrl && (
                                      <div className="mt-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedAttachmentByEvent((prev) => ({
                                              ...prev,
                                              [event.id]: !prev[event.id],
                                            }))
                                          }
                                          className="inline-block bg-brand-charcoal hover:bg-brand-ink text-white font-semibold px-3 py-1 rounded-lg"
                                        >
                                          {isAttachmentOpen ? 'Hide Attachment' : 'View Attachment'}
                                          {attachmentName ? ` (${attachmentName})` : ''}
                                        </button>
                                        {isAttachmentOpen && (
                                          <img
                                            src={resolvedAttachmentUrl}
                                            alt={attachmentName || 'Event attachment'}
                                            onClick={() =>
                                              setEnlargedAttachmentByEvent((prev) => ({
                                                ...prev,
                                                [event.id]: !prev[event.id],
                                              }))
                                            }
                                            className={`mt-2 rounded border border-brand-amber/20 cursor-zoom-in ${
                                              isAttachmentEnlarged ? 'max-h-[32rem]' : 'max-h-40'
                                            }`}
                                          />
                                        )}
                                        {isAttachmentOpen && (
                                          <p className="text-xs text-brand-charcoal/70 mt-1">
                                            Click image to {isAttachmentEnlarged ? 'reduce size' : 'enlarge'}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                    <p>
                                      <span className="font-semibold">Updated by:</span>{' '}
                                      {event.created_by_first_name || event.created_by_last_name
                                        ? `${event.created_by_first_name || ''} ${event.created_by_last_name || ''}`.trim()
                                        : event.created_by_email || 'Unknown user'}
                                    </p>
                                    <p><span className="font-semibold">Time:</span> {new Date(event.created_at).toLocaleString()}</p>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
