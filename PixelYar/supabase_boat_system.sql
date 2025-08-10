-- Clean Supabase setup for boat system
-- Run these SQL commands in your Supabase SQL editor

-- 1. Create player_stats table
CREATE TABLE IF NOT EXISTS player_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    combat_wins INTEGER DEFAULT 0,
    combat_losses INTEGER DEFAULT 0,
    distance_traveled FLOAT DEFAULT 0,
    items_crafted INTEGER DEFAULT 0,
    gold_earned INTEGER DEFAULT 0,
    login_streak INTEGER DEFAULT 1,
    play_time INTEGER DEFAULT 0,
    boats_purchased INTEGER DEFAULT 0,
    boat_upgrades_bought INTEGER DEFAULT 0,
    treasures_found INTEGER DEFAULT 0,
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 2. Create player_boats table
CREATE TABLE IF NOT EXISTS player_boats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    boat_type TEXT NOT NULL DEFAULT 'sloop',
    current_stats JSONB NOT NULL DEFAULT '{}',
    upgrades JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 3. Create player_inventory table
CREATE TABLE IF NOT EXISTS player_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_name)
);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_player_stats_user_id ON player_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_player_boats_user_id ON player_boats(user_id);
CREATE INDEX IF NOT EXISTS idx_player_inventory_user_id ON player_inventory(user_id);

-- 5. Enable RLS
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_boats ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_inventory ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies
CREATE POLICY "Users can manage their own stats" ON player_stats
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own boats" ON player_boats
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own inventory" ON player_inventory
    FOR ALL USING (auth.uid() = user_id);

-- 7. Grant permissions
GRANT ALL ON player_stats TO authenticated;
GRANT ALL ON player_boats TO authenticated;
GRANT ALL ON player_inventory TO authenticated;

-- 8. Create update function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 9. Create triggers
CREATE TRIGGER update_player_stats_updated_at 
    BEFORE UPDATE ON player_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_boats_updated_at 
    BEFORE UPDATE ON player_boats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_inventory_updated_at 
    BEFORE UPDATE ON player_inventory 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. Initialize data for existing users
INSERT INTO player_stats (user_id)
SELECT id as user_id
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM player_stats);

INSERT INTO player_boats (user_id, boat_type, current_stats, upgrades)
SELECT 
    id as user_id,
    'sloop' as boat_type,
    '{"hull": 100, "maxHull": 100, "crew": 5, "maxCrew": 8, "speed": 1.0, "cannonDamage": 10, "cargoCapacity": 50}' as current_stats,
    '{}' as upgrades
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM player_boats);