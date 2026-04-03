-- Scorecard prediction results — one row per run per calibration offset
CREATE TABLE scorecard_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES scorecard_runs(id) ON DELETE CASCADE,
  calibration_offset FLOAT NOT NULL,
  week INT NOT NULL,
  prediction_count INT NOT NULL,
  mean_score FLOAT,
  median_score FLOAT,
  min_score FLOAT,
  max_score FLOAT,
  status_counts JSONB,
  predictions JSONB NOT NULL,
  site_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE scorecard_results ENABLE ROW LEVEL SECURITY;
-- All access via service role key
