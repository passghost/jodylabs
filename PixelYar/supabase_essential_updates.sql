-- Essential Supabase Updates for PixelYar Game
-- Run these if you're getting errors with the full update script

-- 1. Update pirates table structure
DO $$ 
BEGIN
    -- Add columns only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pirates' AND column_name = 'items') THEN
        ALTER TABLE pirates ADD COLUMN items JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pirates' AND column_name = 'last_login') THEN
        ALTER TABLE pirates ADD COLUMN last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- 2. Create placed_pixels table if it doesn't exist
CREATE TABLE IF NOT EXISTS placed_pixels (
    id BIGSERIAL PRIMARY KEY,
    player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    color VARCHAR(20) NOT NULL CHECK (color IN ('red', 'blue', 'green', 'yellow', 'purple')),
    placed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(x, y)
);

-- 3. Create combat_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS combat_logs (
    id BIGSERIAL PRIMARY KEY,
    attacker_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    defender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    damage_dealt INTEGER NOT NULL,
    attacker_hull_before INTEGER,
    attacker_hull_after INTEGER,
    defender_hull_before INTEGER,
    defender_hull_after INTEGER,
    winner_id UUID REFERENCES auth.users(id),
    combat_type VARCHAR(20) DEFAULT 'cannon',
    location_x INTEGER,
    location_y INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create essential functions
CREATE OR REPLACE FUNCTION log_combat_event(
    attacker_uuid UUID,
    defender_uuid UUID,
    damage INTEGER,
    attacker_hull_before INTEGER,
    attacker_hull_after INTEGER,
    defender_hull_before INTEGER,
    defender_hull_after INTEGER,
    winner_uuid UUID DEFAULT NULL,
    combat_type_param VARCHAR(20) DEFAULT 'cannon',
    location_x_param INTEGER DEFAULT NULL,
    location_y_param INTEGER DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    log_id BIGINT;
BEGIN
    INSERT INTO combat_logs (
        attacker_id, defender_id, damage_dealt,
        attacker_hull_before, attacker_hull_after,
        defender_hull_before, defender_hull_after,
        winner_id, combat_type, location_x, location_y
    ) VALUES (
        attacker_uuid, defender_uuid, damage,
        attacker_hull_before, attacker_hull_after,
        defender_hull_before, defender_hull_after,
        winner_uuid, combat_type_param, location_x_param, location_y_param
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Enable RLS and create basic policies
ALTER TABLE placed_pixels ENABLE ROW LEVEL SECURITY;
ALTER TABLE combat_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can view all placed pixels" ON placed_pixels;
DROP POLICY IF EXISTS "Users can place their own pixels" ON placed_pixels;
DROP POLICY IF EXISTS "Users can view their combat logs" ON combat_logs;
DROP POLICY IF EXISTS "System can insert combat logs" ON combat_logs;

-- Create new policies
CREATE POLICY "Users can view all placed pixels" ON placed_pixels
    FOR SELECT USING (true);

CREATE POLICY "Users can place their own pixels" ON placed_pixels
    FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can view their combat logs" ON combat_logs
    FOR SELECT USING (auth.uid() = attacker_id OR auth.uid() = defender_id);

CREATE POLICY "System can insert combat logs" ON combat_logs
    FOR INSERT WITH CHECK (true);

-- 6. Create essential indexes
CREATE INDEX IF NOT EXISTS idx_placed_pixels_position ON placed_pixels(x, y);
CREATE INDEX IF NOT EXISTS idx_combat_logs_attacker ON combat_logs(attacker_id);
CREATE INDEX IF NOT EXISTS idx_combat_logs_defender ON combat_logs(defender_id);

-- 7. Grant permissions
GRANT ALL ON placed_pixels TO authenticated;
GRANT ALL ON combat_logs TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Essential PixelYar database updates completed successfully!';
    RAISE NOTICE 'PvP combat, pixel placement, and core features should now work.';
END $$;