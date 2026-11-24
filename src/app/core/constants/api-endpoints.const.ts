/**
 * API endpoint registry — the single source of truth for every backend route
 * the dashboard calls.
 *
 * Conventions
 * ───────────
 * - Paths are RELATIVE to `environment.apiUrl` (which already ends in `/api`);
 *   `ApiService` prefixes it. Never hard-code a host or `/api` here.
 * - Groups mirror the backend controllers (`/api/<resource>`), in sidebar
 *   order. Keys: `list` (collection: GET list / POST create), `byId`
 *   (GET / PUT / DELETE one), `lookup` (lightweight options for selects),
 *   `stats` (counters), then sub-resources and actions.
 * - Every dynamic segment goes through `seg()` (URL-encoding).
 *
 * Contract: backend `docs/API-CONTRACT.md` / Swagger at `/swagger`.
 * Staff token — customer-app routes (`/api/store/*`) are not used here, except
 * the public car catalogue (`storeCars`), which every staff member may read.
 */

/** URL-encodes one path segment (ids are GUIDs today, but never trust that). */
const seg = (value: string | number): string => encodeURIComponent(String(value));

export const API_ENDPOINTS = {
  // ─────────────────────────────── Auth ───────────────────────────────
  auth: {
    login: 'auth/login',
    /** Rotates the pair: every call returns a NEW refresh token and revokes the old one. */
    refresh: 'auth/refresh-token',
    /** Sent without the Bearer header; the refresh token in the body identifies the session. */
    logout: 'auth/logout',
    /** Authoritative user + role + permissions for the current session. */
    me: 'auth/me',
  },

  // ───────────────────────────── Overview ─────────────────────────────
  dashboard: {
    /** `?range=7d|30d|90d` — periods/buckets computed in Cairo time. */
    overview: 'dashboard/overview',
  },

  reports: {
    /** `?range=7d|30d|90d|12m`. */
    overview: 'reports/overview',
    /** Paged product performance; `?range=&groupId=`. */
    products: 'reports/products',
  },

  // ────────────────────────────── Sales ───────────────────────────────
  orders: {
    /**
     * Paged `OrderSummary`. Filters: `status`, `channel`, `payment`, `period`,
     * `driverId`, `deliveryType` (standard | express | scheduled) and
     * `scheduledDate` (YYYY-MM-DD — scheduled orders booked for that day).
     */
    list: 'orders',
    stats: 'orders/stats',
    byId: (id: string) => `orders/${seg(id)}`,
    /** PATCH `{ status, note? }` — pending → processing → shipped → delivered | cancelled. */
    status: (id: string) => `orders/${seg(id)}/status`,
    /**
     * PATCH `{ driverId }` (`null` unassigns) → the updated order. Only from
     * processing / shipped. Notifies the new driver (and the previous one).
     */
    driver: (id: string) => `orders/${seg(id)}/driver`,
  },

  /** Customer "find this part from a photo" requests (mobile app). */
  partRequests: {
    list: 'part-requests',
    byId: (id: string) => `part-requests/${seg(id)}`,
    /** Token-protected — fetch as a blob, render via `URL.createObjectURL`. */
    image: (id: string, imageId: string) => `part-requests/${seg(id)}/images/${seg(imageId)}`,
    /** POST `{ price, notes?, validDays? }`. */
    quote: (id: string) => `part-requests/${seg(id)}/quote`,
    /** POST `{ reason }`. */
    reject: (id: string) => `part-requests/${seg(id)}/reject`,
  },

  /** Sales / purchase invoices, returns, quotations, transfers, goods issue / receipt. */
  documents: {
    list: 'documents',
    stats: 'documents/stats',
    byId: (id: string) => `documents/${seg(id)}`,
    post: (id: string) => `documents/${seg(id)}/post`,
    complete: (id: string) => `documents/${seg(id)}/complete`,
    cancel: (id: string) => `documents/${seg(id)}/cancel`,
    /** POST `{ to }` — e.g. quotation → sales invoice. */
    convert: (id: string) => `documents/${seg(id)}/convert`,
  },

  pos: {
    settings: 'pos/settings',
  },

  // ───────────────────────────── Inventory ────────────────────────────
  items: {
    list: 'items',
    /**
     * Every active item (not paged) for pickers and POS, with per-warehouse
     * balance (`?warehouseId=`) and car filters (`&makeId=&modelId=&year=`).
     * Allowed for Items.View | Inventory.View | Invoices.View | Pos.Access.
     */
    lookup: 'items/lookup',
    byId: (id: string) => `items/${seg(id)}`,
    /** PATCH `{ posPrice }` (`null` = sell at the sale price) → the updated item. App price untouched. */
    posPrice: (itemId: string) => `items/${seg(itemId)}/pos-price`,
    /** Mobile-store data: GET / PUT `{ isPublished, isFastDelivery, priceTiers }`. */
    store: (itemId: string) => `items/${seg(itemId)}/store`,
    /** Car compatibility: GET / PUT `[{ modelId, yearFrom?, yearTo? }]` (replaces all). */
    fitments: (itemId: string) => `items/${seg(itemId)}/fitments`,
    /** GET list / POST multipart (`file`, one image per request). */
    images: (itemId: string) => `items/${seg(itemId)}/images`,
    image: (itemId: string, imageId: string) => `items/${seg(itemId)}/images/${seg(imageId)}`,
    /** PUT `["imgId1", "imgId2", …]` — every id, in the new order. */
    imagesOrder: (itemId: string) => `items/${seg(itemId)}/images/order`,
    imagePrimary: (itemId: string, imageId: string) => `items/${seg(itemId)}/images/${seg(imageId)}/primary`,
    /** Customer reviews + summary (paged; filters: rating, min/maxRating, visibility, hasComment, from/to). */
    reviews: (itemId: string) => `items/${seg(itemId)}/reviews`,
    /** PUT `{ isHidden, reason? }` — hidden reviews leave the app and the average. */
    reviewVisibility: (itemId: string, reviewId: string) => `items/${seg(itemId)}/reviews/${seg(reviewId)}/visibility`,
  },

  itemGroups: {
    list: 'item-groups',
    lookup: 'item-groups/lookup',
    /** Nested nodes with `children` + `totalItemsCount` (roll-up). */
    tree: 'item-groups/tree',
    byId: (id: string) => `item-groups/${seg(id)}`,
    /** POST multipart (`file`) to upload/replace · DELETE to remove. One image per group. */
    image: (id: string) => `item-groups/${seg(id)}/image`,
  },

  carMakes: {
    list: 'car-makes',
    /** DELETE also removes the make's logo file. */
    byId: (id: string) => `car-makes/${seg(id)}`,
    /**
     * POST multipart (`file`: JPG / PNG / WEBP ≤ 5 MB) uploads / replaces the
     * logo · DELETE removes it. Both → the full make (new `logoUrl` / `null`).
     */
    logo: (id: string) => `car-makes/${seg(id)}/logo`,
  },

  /**
   * Public car catalogue (no token needed, active makes / models only) — the
   * make → model → year filters, usable by a cashier without Items.View.
   */
  storeCars: {
    makes: 'store/car-makes',
    models: (makeId: string) => `store/car-makes/${seg(makeId)}/models`,
    /** Newest first. */
    years: (modelId: string) => `store/car-models/${seg(modelId)}/years`,
  },

  carModels: {
    /** `?makeId=` to filter by make. */
    list: 'car-models',
    /** DELETE also removes the model's photo file. */
    byId: (id: string) => `car-models/${seg(id)}`,
    /**
     * POST multipart (`file`: JPG / PNG / WEBP ≤ 5 MB) uploads / replaces the
     * car photo · DELETE removes it. Both → the full model (new `imageUrl` / `null`).
     */
    image: (id: string) => `car-models/${seg(id)}/image`,
  },

  warehouses: {
    list: 'warehouses',
    /** Available to every signed-in staff member. */
    lookup: 'warehouses/lookup',
    byId: (id: string) => `warehouses/${seg(id)}`,
    /**
     * Warehouse manager's review queue: paged `DocumentSummary` of this
     * warehouse's purchase invoices still `pending-review` (rows leave once
     * activated or cancelled). `?pageIndex=&pageSize=&search=&sortBy=&sortDir=`.
     * Warehouses.View — activate / cancel go through `documents.post` / `documents.cancel`.
     */
    purchaseInvoices: (id: string) => `warehouses/${seg(id)}/purchase-invoices`,
  },

  stock: {
    list: 'stock',
    summary: 'stock/summary',
    item: (itemId: string) => `stock/items/${seg(itemId)}`,
  },

  // ───────────────────────────── Finance ──────────────────────────────
  /** Customers and suppliers. */
  parties: {
    list: 'parties',
    lookup: 'parties/lookup',
    balances: 'parties/balances',
    balancesSummary: 'parties/balances/summary',
    byId: (id: string) => `parties/${seg(id)}`,
    statement: (id: string) => `parties/${seg(id)}/statement`,
    statementDetailed: (id: string) => `parties/${seg(id)}/statement/detailed`,
  },

  /** Journal, receipt and payment vouchers. */
  vouchers: {
    list: 'vouchers',
    stats: 'vouchers/stats',
    byId: (id: string) => `vouchers/${seg(id)}`,
    post: (id: string) => `vouchers/${seg(id)}/post`,
    cancel: (id: string) => `vouchers/${seg(id)}/cancel`,
  },

  /** Online-store payments. Confirm / refund also push a notification to the customer. */
  payments: {
    list: 'payments',
    stats: 'payments/stats',
    byId: (id: string) => `payments/${seg(id)}`,
    confirm: (id: string) => `payments/${seg(id)}/confirm`,
    fail: (id: string) => `payments/${seg(id)}/fail`,
    retry: (id: string) => `payments/${seg(id)}/retry`,
    refund: (id: string) => `payments/${seg(id)}/refund`,
    settle: (id: string) => `payments/${seg(id)}/settle`,
  },

  /** Chart of accounts. */
  accounts: {
    /** Whole chart, flat, ordered by code (small enough to send at once). */
    list: 'accounts',
    lookup: 'accounts/lookup',
    /** `?asOf=YYYY-MM-DD` — verifies every posting is balanced. */
    trialBalance: 'accounts/trial-balance',
    byId: (id: string) => `accounts/${seg(id)}`,
  },

  costCenters: {
    list: 'cost-centers',
    lookup: 'cost-centers/lookup',
    byId: (id: string) => `cost-centers/${seg(id)}`,
  },

  // ─────────────────────────── Mobile app ─────────────────────────────
  /**
   * Customers who signed up from the mobile app (Customers.View). New sign-ups
   * are `pending` until approved; `blocked` signs the customer out at once.
   */
  appCustomers: {
    /** `?status=pending|active|blocked&search=&sortBy=&sortDir=&includeUnverified=&pageIndex=&pageSize=`. */
    list: 'app-customers',
    /** `{ total, pending, active, blocked }` — status tabs and the sidebar badge. */
    stats: 'app-customers/stats',
    byId: (id: string) => `app-customers/${seg(id)}`,
    /** POST `{ status: 'active' | 'blocked' }` → the updated customer. Idempotent. */
    status: (id: string) => `app-customers/${seg(id)}/status`,
  },

  /** Push notifications to customers of the mobile app. */
  notificationCampaigns: {
    list: 'notification-campaigns',
    byId: (id: string) => `notification-campaigns/${seg(id)}`,
    /** Recipient picker: `?search=&status=&hasFcmToken=&sortBy=&pageIndex=&pageSize=`. */
    customers: 'notification-campaigns/customers',
  },

  // ───────────────────────────── Admin ────────────────────────────────
  users: {
    list: 'users',
    stats: 'users/stats',
    byId: (id: string) => `users/${seg(id)}`,
    /** POST `{ isActive }`. */
    status: (id: string) => `users/${seg(id)}/status`,
    /** POST `{ password }`. */
    resetPassword: (id: string) => `users/${seg(id)}/reset-password`,
  },

  settings: {
    /** Company + numbering settings — readable by every signed-in staff member. */
    root: 'settings',
  },

  deliveryZones: {
    list: 'delivery-zones',
    byId: (id: string) => `delivery-zones/${seg(id)}`,
  },

  /** Express / scheduled delivery options of the mobile app (Settings.Manage). */
  deliverySettings: {
    /** GET / PUT — one record, saved whole. */
    root: 'delivery-settings',
    /** The bookable hour slots exactly as the customer sees them now. */
    slots: 'delivery-settings/slots',
  },

  /** Delivery drivers (the driver app's accounts). Read: Orders.View | Users.Manage · write: Users.Manage. */
  drivers: {
    list: 'drivers',
    /** Counters for the drivers screen and the sidebar badge (open problems). */
    stats: 'drivers/stats',
    /** Active drivers for pickers, least busy first — a plain array, not paged. */
    lookup: 'drivers/lookup',
    byId: (id: string) => `drivers/${seg(id)}`,
    /** POST `{ isActive }` — suspending signs the driver out at once. */
    status: (id: string) => `drivers/${seg(id)}/status`,
    /** POST `{ password }` — signs the driver out of every device. */
    resetPassword: (id: string) => `drivers/${seg(id)}/reset-password`,
  },

  /** Delivery problems reported from the driver app (Orders.View). */
  orderProblems: {
    /** `?status=open|resolved&driverId=&search=&pageIndex=&pageSize=`. */
    list: 'order-problems',
    /** POST `{ resolution }` — pushed to the driver. */
    resolve: (id: string) => `order-problems/${seg(id)}/resolve`,
  },
} as const;

export type ApiEndpoints = typeof API_ENDPOINTS;
