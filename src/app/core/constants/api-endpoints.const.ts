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
 * - The dev mock (`src/app/mock/handlers`) matches routes against these same
 *   values, so the mock and the real API cannot drift apart.
 *
 * Contract: backend `docs/API-CONTRACT.md` / Swagger at `/swagger`.
 * Staff token only — customer-app routes (`/api/store/*`) are not used here.
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
    list: 'orders',
    stats: 'orders/stats',
    byId: (id: string) => `orders/${seg(id)}`,
    /** PATCH `{ status, note? }` — pending → processing → shipped → delivered | cancelled. */
    status: (id: string) => `orders/${seg(id)}/status`,
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
     * Item options for pickers, with per-warehouse balance (`?warehouseId=`).
     * Allowed for Items.View | Inventory.View | Invoices.View | Pos.Access.
     */
    lookup: 'items/lookup',
    byId: (id: string) => `items/${seg(id)}`,
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
    byId: (id: string) => `item-groups/${seg(id)}`,
  },

  carMakes: {
    list: 'car-makes',
    byId: (id: string) => `car-makes/${seg(id)}`,
  },

  carModels: {
    /** `?makeId=` to filter by make. */
    list: 'car-models',
    byId: (id: string) => `car-models/${seg(id)}`,
  },

  warehouses: {
    list: 'warehouses',
    /** Available to every signed-in staff member. */
    lookup: 'warehouses/lookup',
    byId: (id: string) => `warehouses/${seg(id)}`,
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
  /** Push notifications to customers of the mobile app. */
  notificationCampaigns: {
    list: 'notification-campaigns',
    byId: (id: string) => `notification-campaigns/${seg(id)}`,
    /** Recipient picker: `?search=&hasFcmToken=&sortBy=&pageIndex=&pageSize=`. */
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
} as const;

export type ApiEndpoints = typeof API_ENDPOINTS;
