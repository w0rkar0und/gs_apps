-- Enable RLS on sync_log (all access is via service role, so no user policies needed)
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;
