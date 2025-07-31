-- Islands and Trading Ports table
CREATE TABLE IF NOT EXISTS islands (
  id SERIAL PRIMARY KEY,
  cx INTEGER NOT NULL,
  cy INTEGER NOT NULL,
  rx INTEGER NOT NULL,
  ry INTEGER NOT NULL,
  port_x INTEGER NOT NULL,
  port_y INTEGER NOT NULL,
  port_name TEXT NOT NULL,
  port_type TEXT DEFAULT 'trading' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trading port stocks table
CREATE TABLE IF NOT EXISTS trading_stocks (
  id SERIAL PRIMARY KEY,
  island_id INTEGER REFERENCES islands(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  buy_price INTEGER NOT NULL,
  sell_price INTEGER NOT NULL,
  last_restock TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(island_id, item_name)
);

-- Enable RLS
ALTER TABLE islands ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading_stocks ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read islands and stocks
CREATE POLICY "Islands are viewable by everyone" ON islands FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Trading stocks are viewable by everyone" ON trading_stocks FOR SELECT USING (auth.role() = 'authenticated');

-- Allow system to manage islands and stocks (you might want to restrict this further)
CREATE POLICY "Islands can be managed by authenticated users" ON islands FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Trading stocks can be managed by authenticated users" ON trading_stocks FOR ALL USING (auth.role() = 'authenticated');

-- Function to restock trading ports periodically
CREATE OR REPLACE FUNCTION restock_trading_port(port_island_id INTEGER)
RETURNS VOID AS $$
BEGIN
  -- Update existing stocks or insert new ones
  INSERT INTO trading_stocks (island_id, item_name, stock_quantity, buy_price, sell_price, last_restock)
  VALUES 
    (port_island_id, 'Gold Coins', 1000, 1, 1, NOW()),
    (port_island_id, 'Rum Bottles', 20 + FLOOR(RANDOM() * 30), 3 + FLOOR(RANDOM() * 3), 2 + FLOOR(RANDOM() * 2), NOW()),
    (port_island_id, 'Cannon Balls', 50 + FLOOR(RANDOM() * 50), 2 + FLOOR(RANDOM() * 2), 1, NOW()),
    (port_island_id, 'Wooden Planks', 30 + FLOOR(RANDOM() * 20), 2 + FLOOR(RANDOM() * 2), 1, NOW()),
    (port_island_id, 'Rope', 15 + FLOOR(RANDOM() * 15), 3 + FLOOR(RANDOM() * 2), 2, NOW()),
    (port_island_id, 'Medicine', 10 + FLOOR(RANDOM() * 15), 8 + FLOOR(RANDOM() * 4), 6 + FLOOR(RANDOM() * 3), NOW()),
    (port_island_id, 'Spices', 5 + FLOOR(RANDOM() * 10), 4 + FLOOR(RANDOM() * 3), 3 + FLOOR(RANDOM() * 2), NOW()),
    (port_island_id, 'Silk', 3 + FLOOR(RANDOM() * 8), 5 + FLOOR(RANDOM() * 3), 4 + FLOOR(RANDOM() * 2), NOW()),
    (port_island_id, 'Pearls', 2 + FLOOR(RANDOM() * 5), 6 + FLOOR(RANDOM() * 4), 5 + FLOOR(RANDOM() * 3), NOW())
  ON CONFLICT (island_id, item_name) 
  DO UPDATE SET 
    stock_quantity = EXCLUDED.stock_quantity,
    buy_price = EXCLUDED.buy_price,
    sell_price = EXCLUDED.sell_price,
    last_restock = NOW();
END;
$$ LANGUAGE plpgsql;

-- Initialize some default islands if none exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM islands LIMIT 1) THEN
    -- Insert default islands
    INSERT INTO islands (cx, cy, rx, ry, port_x, port_y, port_name) VALUES
    (500, 400, 35, 30, 535, 400, 'Port Royal'),
    (1200, 800, 40, 35, 1240, 800, 'Tortuga Harbor'),
    (2000, 600, 30, 40, 2000, 640, 'Nassau Trading Post'),
    (800, 1200, 45, 25, 845, 1200, 'Blackwater Bay'),
    (1800, 1400, 35, 35, 1835, 1435, 'Skull Island Port'),
    (3000, 1000, 50, 30, 3050, 1000, 'Golden Cove'),
    (2500, 300, 25, 45, 2500, 345, 'Windward Station'),
    (600, 1800, 40, 40, 640, 1840, 'Crimson Harbor');
    
    -- Restock all ports
    PERFORM restock_trading_port(id) FROM islands;
  END IF;
END $$;