-- Pixel placement system for Pirate Pixel Yar
CREATE TABLE IF NOT EXISTS placed_pixels (
  id SERIAL PRIMARY KEY,
  player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  color TEXT NOT NULL,
  placed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(x, y) -- Only one pixel per coordinate
);

-- Remove expires_at column if it exists (migration from temporary to permanent pixels)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'placed_pixels' AND column_name = 'expires_at') THEN
        ALTER TABLE placed_pixels DROP COLUMN expires_at;
        RAISE NOTICE 'Removed expires_at column - pixels are now permanent';
    END IF;
END $$;

-- Enable RLS
ALTER TABLE placed_pixels ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Placed pixels are viewable by everyone" ON placed_pixels;
DROP POLICY IF EXISTS "Users can place their own pixels" ON placed_pixels;
DROP POLICY IF EXISTS "Users can manage their own pixels" ON placed_pixels;

-- Allow all authenticated users to read placed pixels
CREATE POLICY "Placed pixels are viewable by everyone" ON placed_pixels FOR SELECT USING (auth.role() = 'authenticated');

-- Allow users to place their own pixels
CREATE POLICY "Users can place their own pixels" ON placed_pixels FOR INSERT WITH CHECK (auth.uid() = player_id);

-- Allow users to update/delete their own pixels
CREATE POLICY "Users can manage their own pixels" ON placed_pixels FOR ALL USING (auth.uid() = player_id);

-- Create index for efficient spatial queries
CREATE INDEX IF NOT EXISTS placed_pixels_location_idx ON placed_pixels(x, y);
CREATE INDEX IF NOT EXISTS placed_pixels_player_idx ON placed_pixels(player_id);
CREATE INDEX IF NOT EXISTS placed_pixels_placed_at_idx ON placed_pixels(placed_at);