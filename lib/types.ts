export type ReferralStatus = 'pending' | 'not_yet_eligible' | 'approved'

export interface Profile {
  id: string
  display_id: string
  full_name: string | null
  email: string | null
  is_internal: boolean
  is_admin: boolean
  is_active: boolean | null
  created_at: string
}

export interface Contractor {
  hr_code: string
  first_name: string
  last_name: string
  is_active: boolean
  last_worked_date: string | null
  synced_at: string
}

export interface Referral {
  id: string
  recruiter_id: string
  recruited_hr_code: string
  recruited_name: string
  start_date: string
  start_date_locked: boolean
  submitted_at: string
  status: ReferralStatus
  working_days_approved: number | null
  working_days_projected: number | null
  working_days_total: number | null
  last_checked_at: string | null
  last_check_snapshot: Record<string, unknown> | null
  approved_at: string | null
  approval_notes: string | null
  query_version: string | null
}

export interface ReferralCheck {
  id: string
  referral_id: string
  checked_at: string
  query_version: string
  start_date_filter: string
  working_days_approved: number
  working_days_projected: number
  working_days_total: number
  threshold_met: boolean
  start_date_discrepancy_flag: boolean
  check_detail: Record<string, unknown>
}

export interface SyncLogEntry {
  id: string
  ran_at: string
  status: 'success' | 'error'
  records_synced: number | null
  error_message: string | null
  triggered_by: 'scheduled' | 'manual'
}

export interface CheckResult {
  hr_code: string
  name: string
  outcome: 'approved' | 'not_yet_eligible' | 'skipped' | 'error'
  working_days_total?: number
  days_remaining?: number
  discrepancy?: boolean
  reason?: string
}

export interface ScorecardRun {
  id: string
  status: 'running' | 'success' | 'no_files' | 'error'
  triggered_by: 'scheduled' | 'manual' | 'cron'
  started_at: string
  completed_at: string | null
  files_processed: number | null
  records_added: number | null
  week: number | null
  email_sent: boolean | null
  result: Record<string, unknown> | null
  error: string | null
}

export interface ScorecardPrediction {
  site: string
  transporter_id: string
  week: number
  predicted_score: number | null
  predicted_status: string
}

export interface ScorecardSiteSummary {
  site: string
  records: number
  mean_score: number
  median_score: number
  poor: number
  fair: number
  great: number
  fantastic: number
  fantastic_plus: number
}

export interface ScorecardResult {
  id: string
  run_id: string
  calibration_offset: number
  week: number
  prediction_count: number
  mean_score: number | null
  median_score: number | null
  min_score: number | null
  max_score: number | null
  status_counts: Record<string, number> | null
  predictions: ScorecardPrediction[]
  site_summary: ScorecardSiteSummary[] | null
  created_at: string
}

export interface UserApp {
  id: string
  user_id: string
  app_slug: string
  permissions: Record<string, boolean> | null
  granted_at: string
  granted_by: string | null
}
