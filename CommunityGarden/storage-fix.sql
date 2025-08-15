-- Storage policies for the Garden bucket
-- Run this if you're getting "row-level security policy" errors

-- Make sure the Garden bucket exists and is public
INSERT INTO storage.buckets (id, name, public) VALUES ('Garden', 'Garden', true) ON CONFLICT DO NOTHING;

-- Allow anyone to upload to Garden bucket
CREATE POLICY "Anyone can upload to Garden bucket" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'Garden');

-- Allow anyone to view Garden bucket files
CREATE POLICY "Anyone can view Garden bucket files" ON storage.objects
FOR SELECT USING (bucket_id = 'Garden');