import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { toast } from 'sonner-native';
import AdminDialog from './AdminDialog';
import AdminReviewCard, { AdminReasonField } from './AdminReviewCard';
import AdminScreen, { type AdminScreenState } from './AdminScreen';
import AdminToolbar from './AdminToolbar';
import { courierAreasText } from '@/components/market/couriers/CourierCard';
import { readSingleFilter, type FilterGroup, type FilterValues } from '@/components/ui/FilterSheet';
import { space, type AdminToneName } from '@/lib/admin/adminTokens';
import { courierService } from '@/lib/services/CourierService';
import { COURIER_SPEED_LABELS, COURIER_STATUS_LABELS, COURIER_VEHICLE_LABELS, type Courier, type CourierStatus } from '@/lib/types/couriers';

type CourierFilter = CourierStatus | 'all';
type CourierDecision = Exclude<CourierStatus, 'pending'>;
type DeclineTarget = { courier: Courier; status: Exclude<CourierDecision, 'approved'> };

const FILTERS: { value: CourierFilter; label: string }[] = [
  { value: 'pending', label: 'Waiting' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Not approved' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'all', label: 'All' },
];

const statusTone = (status: CourierStatus): AdminToneName => {
  if (status === 'approved') return 'positive';
  if (status === 'pending') return 'pending';
  return 'danger';
};

const isCourierFilter = (value: string | undefined): value is CourierFilter => FILTERS.some((option) => option.value === value);

/** The website's /profile/admin/couriers: approve courier registrations, decline them with a reason, or suspend. */
export default function AdminCouriersWorkspace() {
  const [filter, setFilter] = useState<CourierFilter>('pending');
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [loading, setLoading] = useState(true);
  // Switching the status filter reloads only the list; the toolbar stays mounted (first load uses `loading`).
  const [listLoading, setListLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCourierId, setActiveCourierId] = useState<string | null>(null);
  // A refused approval is shown on its own card; a refused decline/suspend inside its dialog. The page-level error is only for loading.
  const [decisionErrors, setDecisionErrors] = useState<{ [courierId: string]: string }>({});
  const [declineTarget, setDeclineTarget] = useState<DeclineTarget | null>(null);
  const [reason, setReason] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Only the newest request may fill the list, so a slow answer for the previous filter can't replace the current one.
  const requestId = useRef(0);
  const loadCouriers = useCallback(async () => {
    const currentRequest = ++requestId.current;
    try {
      const nextCouriers = await courierService.fetchModerationCouriers(filter === 'all' ? undefined : filter);
      if (currentRequest !== requestId.current) return;
      setCouriers(nextCouriers);
      setError(null);
    } catch (loadError: unknown) {
      if (currentRequest !== requestId.current) return;
      console.error('[AdminCouriersWorkspace.loadCouriers] Error:', loadError instanceof Error ? loadError.message : loadError);
      setError(loadError instanceof Error ? loadError.message : 'Could not load courier services.');
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setListLoading(false);
        setRefreshing(false);
      }
    }
  }, [filter]);

  const hasLoaded = useRef(false);
  useEffect(() => {
    if (hasLoaded.current) setListLoading(true);
    hasLoaded.current = true;
    void loadCouriers();
  }, [loadCouriers]);

  // In-flight guard: one decision at a time across the whole list.
  const activeRef = useRef(false);
  const handleDecision = async (courier: Courier, status: CourierDecision, decisionReason: string): Promise<boolean> => {
    const trimmedReason = decisionReason.trim();
    if (status !== 'approved' && !trimmedReason) return false;
    if (activeRef.current) return false;
    activeRef.current = true;
    setActiveCourierId(courier.id);
    setDecisionErrors((current) => ({ ...current, [courier.id]: '' }));
    try {
      const updatedCourier = await courierService.updateCourierStatus(courier.id, status, trimmedReason || undefined);
      setCouriers((current) => (filter === 'all'
        ? current.map((entry) => (entry.id === courier.id ? updatedCourier : entry))
        : current.filter((entry) => entry.id !== courier.id)));
      toast.success(status === 'approved' ? `${courier.businessName} approved.` : status === 'suspended' ? `${courier.businessName} suspended.` : `${courier.businessName} declined.`);
      return true;
    } catch (decisionError: unknown) {
      console.error('[AdminCouriersWorkspace.handleDecision] Error:', decisionError instanceof Error ? decisionError.message : decisionError);
      const message = decisionError instanceof Error ? decisionError.message : 'Could not save the decision.';
      if (status === 'approved') setDecisionErrors((current) => ({ ...current, [courier.id]: message }));
      else setDialogError(message);
      return false;
    } finally {
      activeRef.current = false;
      setActiveCourierId(null);
    }
  };

  const openDecline = (courier: Courier, status: DeclineTarget['status']) => {
    setDeclineTarget({ courier, status });
    setReason('');
    setDialogError(null);
  };

  const handleConfirmDecline = async () => {
    if (!declineTarget) return;
    const saved = await handleDecision(declineTarget.courier, declineTarget.status, reason);
    if (saved) setDeclineTarget(null);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    void loadCouriers();
  };

  const filterGroups: FilterGroup[] = [
    { key: 'status', label: 'Status', options: FILTERS.map((option) => ({ value: option.value, label: option.label })), value: filter, defaultValue: 'pending' },
  ];
  const handleApplyFilters = (values: FilterValues) => {
    const next = readSingleFilter(values, 'status');
    setFilter(isCourierFilter(next) ? next : 'pending');
  };
  const filterLabel = FILTERS.find((option) => option.value === filter)?.label ?? 'Waiting';

  const screenState: AdminScreenState = loading || listLoading
    ? { kind: 'loading', variant: 'list' }
    : error
      ? { kind: 'error', message: error }
      : couriers.length
        ? { kind: 'ready' }
        : {
          kind: 'empty',
          icon: 'truck',
          title: filter === 'pending' ? 'No courier services are waiting for review.' : 'No courier services here.',
          description: filter === 'pending' ? 'New registrations appear here before they are listed.' : `Nothing has the status "${filterLabel}".`,
        };

  const isDeclineBusy = Boolean(declineTarget && activeCourierId === declineTarget.courier.id);
  const declineIsSuspend = declineTarget?.status === 'suspended';

  return (
    <AdminScreen
      title="Courier services"
      subtitle="Review registrations before they are listed"
      state={screenState}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      toolbar={(
        <AdminToolbar
          filters={{ groups: filterGroups, onApply: handleApplyFilters, title: 'Filter couriers' }}
          resultSummary={loading || listLoading || error ? `${filterLabel}` : `${filterLabel} · ${couriers.length}`}
        />
      )}
    >
      <View style={{ gap: space.md }}>
        {couriers.map((courier) => {
          const isBusy = activeCourierId === courier.id;
          const canDecline = courier.status === 'pending' || courier.status === 'approved';
          return (
            <AdminReviewCard
              key={courier.id}
              title={courier.businessName}
              subtitle={`${courier.contactName}${courier.startingPrice !== undefined ? ` · From $${courier.startingPrice.toFixed(2)} TTD` : ''}`}
              status={{ label: COURIER_STATUS_LABELS[courier.status], tone: statusTone(courier.status) }}
              leading={courier.ownerId ? { kind: 'avatar', name: courier.contactName || courier.businessName, userId: courier.ownerId } : { kind: 'icon', name: 'truck', tone: statusTone(courier.status) }}
              details={[
                { label: 'About', value: courier.description },
                { label: 'Areas', value: courierAreasText(courier) },
                { label: 'Vehicles', value: courier.vehicles.map((vehicle) => COURIER_VEHICLE_LABELS[vehicle]).join(', ') },
                { label: 'Options', value: courier.speeds.map((speed) => COURIER_SPEED_LABELS[speed]).join(', ') },
                { label: 'Contact', value: [courier.phone, courier.whatsapp ? `WhatsApp ${courier.whatsapp}` : '', courier.email ?? ''].filter(Boolean).join(' · ') },
                { label: 'Reason', value: courier.rejectionReason && courier.status !== 'approved' ? courier.rejectionReason : '' },
              ]}
              inlineAction={courier.status !== 'approved'
                ? { key: 'approve', label: 'Approve', icon: 'check', tone: 'positive', busy: isBusy && !declineTarget, disabled: Boolean(activeCourierId), onPress: () => void handleDecision(courier, 'approved', '') }
                : undefined}
              overflowActions={canDecline
                ? [courier.status === 'approved'
                  ? { key: 'suspend', label: 'Suspend…', icon: 'slash', tone: 'danger', disabled: Boolean(activeCourierId), onPress: () => openDecline(courier, 'suspended') }
                  : { key: 'decline', label: 'Decline…', icon: 'x', tone: 'danger', disabled: Boolean(activeCourierId), onPress: () => openDecline(courier, 'rejected') }]
                : undefined}
              error={decisionErrors[courier.id] || undefined}
            />
          );
        })}
      </View>

      <AdminDialog
        visible={Boolean(declineTarget)}
        title={declineIsSuspend ? `Suspend ${declineTarget?.courier.businessName ?? ''}?` : `Decline ${declineTarget?.courier.businessName ?? ''}?`}
        description={declineIsSuspend ? 'The courier service is taken off the market until it is approved again.' : 'The registration is not listed. The reason is kept on the registration.'}
        confirmLabel={declineIsSuspend ? 'Suspend' : 'Decline'}
        tone="danger"
        busy={isDeclineBusy}
        confirmDisabled={!reason.trim()}
        onConfirm={() => void handleConfirmDecline()}
        onClose={() => {
          if (!isDeclineBusy) setDeclineTarget(null);
        }}
      >
        <AdminReasonField
          label={declineIsSuspend ? 'Suspension reason (required)' : 'Reason for declining (required)'}
          value={reason}
          onChangeText={(next) => {
            setReason(next);
            if (dialogError) setDialogError(null);
          }}
          editable={!isDeclineBusy}
          placeholder={declineIsSuspend ? 'Suspension reason' : 'Reason for declining'}
          error={dialogError}
        />
      </AdminDialog>
    </AdminScreen>
  );
}
