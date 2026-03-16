-- Add full_name, email, and is_active to profiles

ALTER TABLE profiles ADD COLUMN full_name TEXT;
ALTER TABLE profiles ADD COLUMN email TEXT;
ALTER TABLE profiles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Update the profile auto-creation trigger to populate new fields
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_id, full_name, email, is_internal, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_id', NEW.email),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'email',
    COALESCE((NEW.raw_user_meta_data->>'is_internal')::boolean, true),
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;
