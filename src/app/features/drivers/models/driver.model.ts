import { StatusView } from '../../../shared/models/status-tone.model';

/**
 * Delivery drivers (مناديب التوصيل). The admin confirms an order and assigns
 * a driver; the driver moves it processing → shipped → delivered from the
 * driver app. Contract: `GET/POST /api/drivers`, `GET/PUT/DELETE /api/drivers/:id`.
 */
export interface Driver {
  id: string;
  name: string;
  /** International form from the server, e.g. `+201012345678` — the driver's login. */
  phone: string;
  vehicleType: string;
  plateNumber: string;
  notes: string;
  isActive: boolean;
  /** Assigned orders not delivered / cancelled yet. */
  activeOrders: number;
  deliveredOrders: number;
  /** `null` = never signed in to the driver app. */
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DriverPayload {
  name: string;
  /** `01xxxxxxxxx` or `+201xxxxxxxxx`. */
  phone: string;
  vehicleType: string;
  plateNumber: string;
  notes: string;
  isActive: boolean;
  /** Required on create, ignored on update (use reset-password). */
  password?: string;
}

export interface DriverStats {
  total: number;
  active: number;
  suspended: number;
  /** Orders in `shipped`. */
  ordersOutForDelivery: number;
  /** Online orders in `processing` with no driver. */
  unassignedConfirmedOrders: number;
  openProblems: number;
}

/** Active drivers for pickers, least busy first (not paged). */
export interface DriverLookup {
  id: string;
  name: string;
  phone: string;
  activeOrders: number;
}

export type DriverStatus = 'active' | 'suspended';

export const DRIVER_STATUS_VIEW: Record<DriverStatus, StatusView> = {
  active: { label: 'نشط', tone: 'good', color: 'var(--gr)' },
  suspended: { label: 'موقوف', tone: 'danger', color: 'var(--re)' },
};

export const driverStatus = (d: Pick<Driver, 'isActive'>): DriverStatus => (d.isActive ? 'active' : 'suspended');

/** `orders.driverId` filter value for orders with no driver. */
export const NO_DRIVER = 'none';

/** Business-rule codes the drivers API answers with (409). */
export const DRIVER_ERROR_CODES = {
  phoneTaken: 'PHONE_TAKEN',
  /** Delete refused — the driver has orders; suspend instead. */
  hasOrders: 'DRIVER_HAS_ORDERS',
  /** Assigning a suspended driver. */
  inactive: 'DRIVER_INACTIVE',
} as const;

export const VEHICLE_TYPES: readonly string[] = ['موتوسيكل', 'سيارة', 'تروسيكل', 'عجلة'];
