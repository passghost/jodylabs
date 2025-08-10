-- Supabase updates for boat system and inventory persistence
-- Run these SQL commands in your Supabase SQL editor

-- Create player_boats table for boat ownership and upgrades
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

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_player_boats_user_id ON player_boats(user_id);

-- Create player_inventory table for persistent inventory storage
CREATE TABLE IF NOT EXISTS player_inventory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, item_name)
);

-- Create index for faster inventory lookups
CREATE INDEX IF NOT EXISTS idx_player_inventory_user_id ON player_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_player_inventory_item ON player_inventory(user_id, item_name);

-- Add boat-related columns to player_stats if they don't exist
ALTER TABLE player_stats 
ADD COLUMN IF NOT EXISTS boats_purchased INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS boat_upgrades_bought INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS treasures_found INTEGER DEFAULT 0;

-- Enable Row Level Security (RLS) for player_boats
ALTER TABLE player_boats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for player_boats
CREATE POLICY "Users can view their own boats" ON player_boats
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own boats" ON player_boats
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own boats" ON player_boats
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own boats" ON player_boats
    FOR DELETE USING (auth.uid() = user_id);

-- Enable Row Level Security (RLS) for player_inventory
ALTER TABLE player_inventory ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for player_inventory
CREATE POLICY "Users can view their own inventory" ON player_inventory
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own inventory" ON player_inventory
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inventory" ON player_inventory
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own inventory" ON player_inventory
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_player_boats_updated_at 
    BEFORE UPDATE ON player_boats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_inventory_updated_at 
    BEFORE UPDATE ON player_inventory 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default boat for existing users (optional)
INSERT INTO player_boats (user_id, boat_type, current_stats, upgrades)
SELECT 
    id as user_id,
    'sloop' as boat_type,
    '{"hull": 100, "maxHull": 100, "crew": 5, "maxCrew": 8, "speed": 1.0, "cannonDamage": 10, "cargoCapacity": 50}' as current_stats,
    '{}' as upgrades
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM player_boats);

-- Create view for boat statistics (optional, for admin purposes)
CREATE OR REPLACE VIEW boat_statistics AS
SELECT 
    boat_type,
    COUNT(*) as owners,
    AVG((current_stats->>'hull')::integer) as avg_hull,
    AVG((current_stats->>'crew')::integer) as avg_crew
FROM player_boats
GROUP BY boat_type;

-- Grant necessary permissions
GRANT ALL ON player_boats TO authenticated;
GRANT ALL ON player_inventory TO authenticated;
GRANT SELECT ON boat_statistics TO authenticated;

-- Create function to clean up old inventory records (optional maintenance)
CREATE OR REPLACE FUNCTION cleanup_empty_inventory()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM player_inventory WHERE quantity <= 0;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Example usage: SELECT cleanup_empty_inventory();

COMMENT ON TABLE player_boats IS 'Stores player boat ownership and upgrade information';
COMMENT ON TABLE player_inventory IS 'Stores persistent player inventory data';
COMMENT ON COLUMN player_boats.boat_type IS 'Type of boat owned (sloop, brigantine, frigate, galleon, dreadnought)';
COMMENT ON COLUMN player_boats.current_stats IS 'Current boat statistics including upgrades';
COMMENT ON COLUMN player_boats.upgrades IS 'Applied upgrades and their levels';
COMMENT ON COLUMN player_inventory.item_name IS 'Name of the inventory item';
COMMENT ON COLUMN player_inventory.quantity IS 'Quantity of the item owned';