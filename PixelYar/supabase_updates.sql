-- Supabase Database Updates for PixelYar Game Enhancements
-- Run these SQL commands in your Supabase SQL editor

-- 1. Add new columns to pirates table for enhanced stats and inventory
DO $$ 
BEGIN
    -- Add columns only if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pirates' AND column_name = 'items') THEN
        ALTER TABLE pirates ADD COLUMN items JSONB DEFAULT '{}';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pirates' AND column_name = 'last_login') THEN
        ALTER TABLE pirates ADD COLUMN last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pirates' AND column_name = 'login_streak') THEN
        ALTER TABLE pirates ADD COLUMN login_streak INTEGER DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pirates' AND column_name = 'total_play_time') THEN
        ALTER TABLE pirates ADD COLUMN total_play_time INTEGER DEFAULT 0;
    END IF;
END $$;

-- 2. Create placed_pixels table for permanent pixel placement
CREATE TABLE IF NOT EXISTS placed_pixels (
    id BIGSERIAL PRIMARY KEY,
    player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    color VARCHAR(20) NOT NULL CHECK (color IN ('red', 'blue', 'green', 'yellow', 'purple')),
    placed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(x, y) -- Only one pixel per coordinate
);

-- Create index for faster pixel queries
CREATE INDEX IF NOT EXISTS idx_placed_pixels_position ON placed_pixels(x, y);
CREATE INDEX IF NOT EXISTS idx_placed_pixels_player ON placed_pixels(player_id);

-- 3. Create islands table for persistent world
CREATE TABLE IF NOT EXISTS islands (
    id SERIAL PRIMARY KEY,
    cx INTEGER NOT NULL,
    cy INTEGER NOT NULL,
    rx INTEGER NOT NULL,
    ry INTEGER NOT NULL,
    port_x INTEGER,
    port_y INTEGER,
    port_name VARCHAR(100),
    port_type VARCHAR(50) DEFAULT 'trading',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create trading_stocks table for port trading
CREATE TABLE IF NOT EXISTS trading_stocks (
    id SERIAL PRIMARY KEY,
    island_id INTEGER REFERENCES islands(id) ON DELETE CASCADE,
    item_name VARCHAR(100) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    buy_price INTEGER DEFAULT 10,
    sell_price INTEGER DEFAULT 5,
    last_restock TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(island_id, item_name)
);

-- Create index for trading queries
CREATE INDEX IF NOT EXISTS idx_trading_stocks_island ON trading_stocks(island_id);

-- 5. Create player_interactions table for combat/trade/chat
CREATE TABLE IF NOT EXISTS player_interactions (
    id BIGSERIAL PRIMARY KEY,
    initiator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    target_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('combat', 'trade', 'chat')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for interaction queries
CREATE INDEX IF NOT EXISTS idx_player_interactions_initiator ON player_interactions(initiator_id);
CREATE INDEX IF NOT EXISTS idx_player_interactions_target ON player_interactions(target_id);
CREATE INDEX IF NOT EXISTS idx_player_interactions_status ON player_interactions(status);

-- 6. Create combat_logs table for PvP tracking
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
    combat_type VARCHAR(20) DEFAULT 'cannon' CHECK (combat_type IN ('cannon', 'ramming', 'boarding')),
    location_x INTEGER,
    location_y INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for combat log queries
CREATE INDEX IF NOT EXISTS idx_combat_logs_attacker ON combat_logs(attacker_id);
CREATE INDEX IF NOT EXISTS idx_combat_logs_defender ON combat_logs(defender_id);
CREATE INDEX IF NOT EXISTS idx_combat_logs_date ON combat_logs(created_at);

-- 7. Insert sample islands if none exist
INSERT INTO islands (cx, cy, rx, ry, port_x, port_y, port_name, port_type)
SELECT * FROM (VALUES
    (500, 400, 35, 25, 535, 400, 'Port Royal', 'trading'),
    (1200, 800, 40, 30, 1240, 800, 'Tortuga Harbor', 'trading'),
    (2000, 600, 30, 35, 2030, 600, 'Nassau Trading Post', 'trading'),
    (800, 1200, 45, 20, 800, 1220, 'Blackwater Bay', 'trading'),
    (1600, 300, 25, 40, 1625, 300, 'Skull Island Port', 'trading'),
    (2800, 1000, 35, 35, 2835, 1000, 'Golden Cove', 'trading'),
    (3200, 1500, 30, 25, 3230, 1500, 'Windward Station', 'trading'),
    (3500, 800, 40, 30, 3540, 800, 'Crimson Harbor', 'trading')
) AS v(cx, cy, rx, ry, port_x, port_y, port_name, port_type)
WHERE NOT EXISTS (SELECT 1 FROM islands);

-- 8. Insert sample trading stocks for all islands
INSERT INTO trading_stocks (island_id, item_name, stock_quantity, buy_price, sell_price)
SELECT island_id, item_name, stock_quantity, buy_price, sell_price
FROM (
    SELECT i.id as island_id, items.item_name, items.stock_quantity, items.buy_price, items.sell_price
    FROM islands i
    CROSS JOIN (VALUES
        ('Rum Bottles', 20, 5, 3),
        ('Cannon Balls', 50, 2, 1),
        ('Wooden Planks', 30, 3, 2),
        ('Medicine', 15, 8, 5),
        ('Rope', 25, 4, 2),
        ('Spices', 10, 12, 8),
        ('Silk', 8, 15, 10),
        ('Red Pixel Pack', 15, 10, 6),
        ('Blue Pixel Pack', 15, 10, 6),
        ('Green Pixel Pack', 15, 10, 6),
        ('Yellow Pixel Pack', 15, 10, 6),
        ('Purple Pixel Pack', 15, 10, 6),
        ('Pearls', 5, 20, 15),
        ('Treasure Maps', 3, 25, 18),
        ('Lucky Charm', 2, 30, 20),
        ('Spyglass', 4, 18, 12)
    ) AS items(item_name, stock_quantity, buy_price, sell_price)
) AS stock_data
WHERE NOT EXISTS (
    SELECT 1 FROM trading_stocks ts 
    WHERE ts.island_id = stock_data.island_id 
    AND ts.item_name = stock_data.item_name
);

-- 9. Enable Row Level Security (RLS) for all tables
ALTER TABLE placed_pixels ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE combat_logs ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies for placed_pixels (drop existing first)
DROP POLICY IF EXISTS "Users can view all placed pixels" ON placed_pixels;
DROP POLICY IF EXISTS "Users can place their own pixels" ON placed_pixels;
DROP POLICY IF EXISTS "Users can delete their own pixels" ON placed_pixels;

CREATE POLICY "Users can view all placed pixels" ON placed_pixels
    FOR SELECT USING (true);

CREATE POLICY "Users can place their own pixels" ON placed_pixels
    FOR INSERT WITH CHECK (auth.uid() = player_id);

CREATE POLICY "Users can delete their own pixels" ON placed_pixels
    FOR DELETE USING (auth.uid() = player_id);

-- 11. Create RLS policies for player_interactions (drop existing first)
DROP POLICY IF EXISTS "Users can view their own interactions" ON player_interactions;
DROP POLICY IF EXISTS "Users can create interactions" ON player_interactions;
DROP POLICY IF EXISTS "Users can update their interactions" ON player_interactions;

CREATE POLICY "Users can view their own interactions" ON player_interactions
    FOR SELECT USING (auth.uid() = initiator_id OR auth.uid() = target_id);

CREATE POLICY "Users can create interactions" ON player_interactions
    FOR INSERT WITH CHECK (auth.uid() = initiator_id);

CREATE POLICY "Users can update their interactions" ON player_interactions
    FOR UPDATE USING (auth.uid() = initiator_id OR auth.uid() = target_id);

-- 12. Create RLS policies for combat_logs (drop existing first)
DROP POLICY IF EXISTS "Users can view their combat logs" ON combat_logs;
DROP POLICY IF EXISTS "System can insert combat logs" ON combat_logs;

CREATE POLICY "Users can view their combat logs" ON combat_logs
    FOR SELECT USING (auth.uid() = attacker_id OR auth.uid() = defender_id);

CREATE POLICY "System can insert combat logs" ON combat_logs
    FOR INSERT WITH CHECK (true);

-- 13. Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 14. Create triggers for automatic timestamp updates (drop existing first)
DROP TRIGGER IF EXISTS update_trading_stocks_updated_at ON trading_stocks;
DROP TRIGGER IF EXISTS update_player_interactions_updated_at ON player_interactions;

CREATE TRIGGER update_trading_stocks_updated_at 
    BEFORE UPDATE ON trading_stocks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_interactions_updated_at 
    BEFORE UPDATE ON player_interactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 15. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pirates_position ON pirates(x, y);
CREATE INDEX IF NOT EXISTS idx_pirates_last_login ON pirates(last_login);
CREATE INDEX IF NOT EXISTS idx_islands_position ON islands(cx, cy);

-- 16. Grant necessary permissions (adjust as needed for your setup)
-- These might need to be adjusted based on your Supabase configuration
GRANT SELECT ON islands TO anon, authenticated;
GRANT SELECT ON trading_stocks TO anon, authenticated;
GRANT UPDATE ON trading_stocks TO authenticated;
GRANT ALL ON placed_pixels TO authenticated;
GRANT ALL ON player_interactions TO authenticated;
GRANT ALL ON combat_logs TO authenticated;

-- 17. Create a view for active players (optional, for performance)
DROP VIEW IF EXISTS active_players;

CREATE VIEW active_players AS
SELECT 
    id,
    email,
    x,
    y,
    hull,
    crew,
    booty,
    color,
    items,
    last_login,
    login_streak
FROM pirates
WHERE last_login > NOW() - INTERVAL '1 hour'
ORDER BY last_login DESC;

-- 18. Create a function to clean up old interactions (optional)
CREATE OR REPLACE FUNCTION cleanup_old_interactions()
RETURNS void AS $$
BEGIN
    DELETE FROM player_interactions 
    WHERE created_at < NOW() - INTERVAL '1 day' 
    AND status IN ('completed', 'cancelled');
    
    DELETE FROM combat_logs 
    WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- 19. Create a function to update player stats (for the game to call)
CREATE OR REPLACE FUNCTION update_player_stats(
    player_uuid UUID,
    new_hull INTEGER DEFAULT NULL,
    new_crew INTEGER DEFAULT NULL,
    new_booty INTEGER DEFAULT NULL,
    new_items JSONB DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE pirates 
    SET 
        hull = COALESCE(new_hull, hull),
        crew = COALESCE(new_crew, crew),
        booty = COALESCE(new_booty, booty),
        items = COALESCE(new_items, items),
        last_login = NOW()
    WHERE id = player_uuid;
END;
$$ LANGUAGE plpgsql;

-- 20. Create a function to log combat events
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

-- 21. Create notification function for real-time updates (optional)
CREATE OR REPLACE FUNCTION notify_player_hit()
RETURNS TRIGGER AS $$
BEGIN
    -- Notify the player that they've been hit
    PERFORM pg_notify(
        'player_hit_' || NEW.defender_id::text,
        json_build_object(
            'attacker_id', NEW.attacker_id,
            'damage', NEW.damage_dealt,
            'new_hull', NEW.defender_hull_after
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for combat notifications (drop existing first)
DROP TRIGGER IF EXISTS notify_on_combat_log ON combat_logs;

CREATE TRIGGER notify_on_combat_log
    AFTER INSERT ON combat_logs
    FOR EACH ROW EXECUTE FUNCTION notify_player_hit();

-- 22. Final message
DO $$
BEGIN
    RAISE NOTICE 'PixelYar database setup complete! All tables, indexes, and functions have been created.';
    RAISE NOTICE 'Make sure to adjust RLS policies and permissions according to your security requirements.';
END $$;
-
- 22. Create player_stats table for comprehensive player tracking
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
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Enable RLS for player_stats
ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for player_stats
CREATE POLICY "Users can view their own stats" ON player_stats
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stats" ON player_stats
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats" ON player_stats
    FOR UPDATE USING (auth.uid() = user_id);

-- Create index and grant permissions
CREATE INDEX IF NOT EXISTS idx_player_stats_user_id ON player_stats(user_id);
GRANT ALL ON player_stats TO authenticated;

-- Create trigger for player_stats
CREATE TRIGGER update_player_stats_updated_at 
    BEFORE UPDATE ON player_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Initialize player_stats for existing users
INSERT INTO player_stats (user_id)
SELECT id as user_id
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM player_stats);

-- Additional message for player_stats
DO $
BEGIN
    RAISE NOTICE 'Player stats table has been added for comprehensive player tracking.';
    RAISE NOTICE 'This table is required for the boat system and advanced features.';
END $;