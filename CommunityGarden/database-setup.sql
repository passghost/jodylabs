-- Community Garden Database Setup
-- Run these SQL commands in your Supabase SQL Editor

-- Create seeds table
CREATE TABLE seeds (
    id UUID PRIMARY KEY,
    thumbs TEXT[] NOT NULL,
    full_images TEXT[] NOT NULL,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'picked')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create plants table  
CREATE TABLE plants (
    id UUID PRIMARY KEY,
    seed_id UUID REFERENCES seeds(id),
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    planted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    waters BIGINT[] DEFAULT '{}'
);

-- Enable Row Level Security
ALTER TABLE seeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (anyone can read/write)
CREATE POLICY "Anyone can view seeds" ON seeds FOR SELECT USING (true);
CREATE POLICY "Anyone can insert seeds" ON seeds FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update seeds" ON seeds FOR UPDATE USING (true);

CREATE POLICY "Anyone can view plants" ON plants FOR SELECT USING (true);
CREATE POLICY "Anyone can insert plants" ON plants FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update plants" ON plants FOR UPDATE USING (true);

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE seeds;
ALTER PUBLICATION supabase_realtime ADD TABLE plants;

-- Storage policies for the Garden bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('Garden', 'Garden', true) ON CONFLICT DO NOTHING;

-- Allow anyone to upload to Garden bucket
CREATE POLICY "Anyone can upload to Garden bucket" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'Garden');

-- Allow anyone to view Garden bucket files
CREATE POLICY "Anyone can view Garden bucket files" ON storage.objects
FOR SELECT USING (bucket_id = 'Garden');