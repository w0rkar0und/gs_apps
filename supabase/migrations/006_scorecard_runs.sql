-- Scorecard run history — persists pipeline execution results
CREATE TABLE scorecard_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'no_files', 'error')),
  triggered_by TEXT NOT NULL DEFAULT 'scheduled' CHECK (triggered_by IN ('scheduled', 'manual', 'cron')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  files_processed INT,
  records_added INT,
  week INT,
  email_sent BOOLEAN,
  result JSONB,
  error TEXT
);

ALTER TABLE scorecard_runs ENABLE ROW LEVEL SECURITY;
-- All access via service role key (same pattern as sync_log)
