export interface Product {
  id: string
  generic_name: string
  brand_name: string
  category: string
  formulation: string | null
  requires_prescription: number
  barcode: string | null
  updated_at: string | null
  default_expiry: string | null
  default_cost_price: number | null
  default_sale_price: number | null
  low_stock_threshold: number
  notify_threshold: number
}

export interface Batch {
  id: string
  branch_id: string
  product_id: string
  batch_number?: string | null
  quantity: number
  cost_price: number
  sale_price: number
  expiry_date: string
  sync_version: number
}

export interface Branch {
  id: string
  account_id: string
  name: string
  lat: number | null
  lng: number | null
  subscription_status: SubscriptionStatus
  subscription_tier: SubscriptionTier
  trial_ends_at: string | null
  payment_due_at: string | null
  grace_ends_at: string | null
  last_synced_at: string | null
  updated_at: string | null
}

export type OperatorRole = 'admin' | 'operator'

export interface Operator {
  id: string
  branch_id: string
  name: string
  pin_hash: string
  role: OperatorRole
  created_at: string
}

export interface Sale {
  id: string
  branch_id: string
  operator_id: string
  total: number
  discount: number
  tax: number
  tender: number
  change_due: number
  payment_method: string | null
  payment_ref: string | null
  created_at: string
  synced: number
  sync_error: string | null
}

export interface SaleItem {
  id: string
  sale_id: string
  batch_id: string
  quantity: number
  unit_price: number
}

export interface Receipt {
  id: string
  sale_id: string
  receipt_number: string
  created_at: string
}

export interface Shift {
  id: string
  branch_id: string
  operator_id: string
  opened_at: string
  closed_at: string | null
  expected_cash: number
  counted_cash: number | null
  synced: number
}

export interface SyncQueueItem {
  id: string
  table_name: string
  row_id: string
  operation: string
  payload: string
  created_at: string
  attempts: number
}

export interface Notification {
  id: string
  kind: string
  title: string
  body: string | null
  route: string | null
  action: string | null
  admin_only: number
  read: number
  created_at: string
}

export interface ActivityLogEntry {
  id: string
  branch_id: string
  operator_id: string
  actor: string
  action: string
  entity_type: string | null
  entity_id: string | null
  detail: string | null
  created_at: string
  synced: number
}

export interface AppSettings {
  key: string
  value: string
}

export interface DashboardStats {
  linked: boolean
  pendingCount: number
  lastSyncedAt: string | null
  isSyncing: boolean
}

export type SubscriptionStatus = 'active' | 'inactive' | 'trial' | 'past_due'

export type SubscriptionTier = 'free' | 'starter' | 'professional' | 'enterprise'
