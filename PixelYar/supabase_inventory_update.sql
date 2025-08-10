-- Enhanced Inventory System Update for PixelYar
-- Run this after the main supabase_updates.sql

-- 1. Create item_definitions table for the expanded inventory system
CREATE TABLE IF NOT EXISTS item_definitions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    icon VARCHAR(10) NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'Miscellaneous',
    stackable BOOLEAN DEFAULT true,
    max_stack INTEGER DEFAULT 50,
    base_value INTEGER DEFAULT 1,
    rarity VARCHAR(20) DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    craftable BOOLEAN DEFAULT false,
    tradeable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Insert all the new item definitions
INSERT INTO item_definitions (name, icon, description, category, stackable, max_stack, base_value, rarity, tradeable) VALUES
-- Currency & Valuables
('Gold Coins', '🪙', 'Shiny pirate currency', 'Currency', true, 999, 1, 'common', true),
('Pearls', '🦪', 'Precious ocean gems', 'Valuables', true, 50, 8, 'uncommon', true),
('Emeralds', '💎', 'Rare green gemstones', 'Valuables', true, 20, 25, 'rare', true),
('Rubies', '♦️', 'Blood-red precious stones', 'Valuables', true, 15, 35, 'rare', true),
('Ancient Coins', '🏺', 'Currency from lost civilizations', 'Valuables', true, 30, 15, 'uncommon', true),

-- Trade Goods
('Spices', '🌶️', 'Valuable trade goods from exotic lands', 'Trade Goods', true, 40, 5, 'common', true),
('Silk', '🧵', 'Luxury fabric from distant shores', 'Trade Goods', true, 30, 8, 'uncommon', true),
('Coffee Beans', '☕', 'Aromatic beans from tropical islands', 'Trade Goods', true, 35, 6, 'common', true),
('Tobacco Leaves', '🍃', 'Premium smoking leaves', 'Trade Goods', true, 25, 7, 'uncommon', true),
('Ivory', '🦷', 'Rare ivory from distant lands', 'Trade Goods', true, 10, 20, 'rare', true),
('Exotic Furs', '🦫', 'Luxurious pelts from northern seas', 'Trade Goods', true, 15, 12, 'uncommon', true),

-- Consumables & Supplies
('Rum Bottles', '🍺', 'Boosts crew morale and courage', 'Consumables', true, 60, 3, 'common', true),
('Medicine', '💊', 'Heals wounds and cures ailments', 'Consumables', true, 25, 10, 'uncommon', true),
('Hardtack', '🍞', 'Long-lasting ship biscuits', 'Consumables', true, 50, 2, 'common', true),
('Fresh Water', '💧', 'Essential for long voyages', 'Consumables', true, 40, 1, 'common', true),
('Salted Meat', '🥩', 'Preserved protein for the crew', 'Consumables', true, 30, 4, 'common', true),

-- Combat & Weapons
('Cannon Balls', '⚫', 'Essential ammunition for naval combat', 'Combat', true, 150, 2, 'common', true),
('Gunpowder', '💥', 'Explosive black powder', 'Combat', true, 30, 8, 'uncommon', true),
('Grapeshot', '🔘', 'Anti-personnel cannon ammunition', 'Combat', true, 50, 5, 'uncommon', true),
('Chain Shot', '⛓️', 'Specialized ammo for destroying sails', 'Combat', true, 40, 6, 'uncommon', true),
('Muskets', '🔫', 'Firearms for boarding actions', 'Combat', true, 10, 15, 'rare', true),
('Cutlasses', '⚔️', 'Sharp curved swords for close combat', 'Combat', true, 15, 12, 'uncommon', true),

-- Ship Materials
('Wooden Planks', '🪵', 'Oak planks for hull repairs', 'Materials', true, 80, 3, 'common', true),
('Rope', '🪢', 'Hemp rope for rigging and repairs', 'Materials', true, 50, 4, 'common', true),
('Canvas', '⛵', 'Sailcloth for repairing sails', 'Materials', true, 20, 8, 'uncommon', true),
('Iron Nails', '🔩', 'Essential fasteners for ship repairs', 'Materials', true, 100, 1, 'common', true),
('Tar', '🛢️', 'Waterproofing compound for hulls', 'Materials', true, 15, 6, 'common', true),
('Copper Sheets', '🟫', 'Metal plating for hull protection', 'Materials', true, 25, 10, 'uncommon', true),

-- Navigation & Tools
('Compass', '🧭', 'Magnetic navigation instrument', 'Navigation', false, 1, 50, 'rare', true),
('Spyglass', '🔭', 'Extends vision across the seas', 'Navigation', false, 1, 40, 'uncommon', true),
('Sextant', '📐', 'Celestial navigation tool', 'Navigation', false, 1, 75, 'rare', true),
('Treasure Maps', '🗺️', 'Charts leading to buried treasure', 'Navigation', true, 15, 20, 'rare', true),
('Sea Charts', '🗞️', 'Detailed maps of shipping routes', 'Navigation', true, 10, 15, 'uncommon', true),
('Astrolabe', '⭐', 'Ancient navigation instrument', 'Navigation', false, 1, 100, 'epic', true),

-- Magical & Special Items
('Lucky Charm', '🍀', 'Mystical protection against harm', 'Magical', false, 1, 200, 'epic', true),
('Cursed Medallion', '🏅', 'Brings misfortune to enemies', 'Magical', false, 1, 150, 'rare', true),
('Mermaid Scale', '🐠', 'Grants favor with sea creatures', 'Magical', true, 5, 80, 'rare', true),
('Kraken Ink', '🖤', 'Mysterious black substance', 'Magical', true, 8, 60, 'rare', true),
('Phoenix Feather', '🪶', 'Legendary item of rebirth', 'Magical', false, 1, 500, 'legendary', true),

-- Crew & Companions
('Parrot', '🦜', 'Colorful talking companion', 'Companions', false, 1, 100, 'uncommon', false),
('Ship Cat', '🐱', 'Keeps the ship free of rats', 'Companions', false, 1, 80, 'uncommon', false),
('Monkey', '🐒', 'Agile helper for rigging work', 'Companions', false, 1, 120, 'rare', false),

-- Ship Equipment
('Ship Bell', '🔔', 'Bronze bell for ship communications', 'Equipment', false, 1, 60, 'uncommon', true),
('Anchor', '⚓', 'Heavy iron anchor', 'Equipment', false, 1, 150, 'uncommon', true),
('Fishing Net', '🕸️', 'Large net for catching fish', 'Equipment', false, 1, 40, 'common', true),
('Lantern', '🏮', 'Oil lamp for night navigation', 'Equipment', true, 5, 15, 'common', true),
('Barrel', '🛢️', 'Storage container for supplies', 'Equipment', true, 10, 20, 'common', true),
('Hammock', '🛏️', 'Sleeping quarters for crew', 'Equipment', true, 20, 8, 'common', true),

-- Pixel Packs
('Red Pixel Pack', '🔴', 'Crimson paint for marking territory', 'Art Supplies', true, 50, 10, 'common', true),
('Blue Pixel Pack', '🔵', 'Ocean blue paint for sea charts', 'Art Supplies', true, 50, 10, 'common', true),
('Green Pixel Pack', '🟢', 'Forest green paint for islands', 'Art Supplies', true, 50, 10, 'common', true),
('Yellow Pixel Pack', '🟡', 'Golden paint for treasure marks', 'Art Supplies', true, 50, 10, 'common', true),
('Purple Pixel Pack', '🟣', 'Royal purple paint for prestige', 'Art Supplies', true, 50, 10, 'common', true),
('Black Pixel Pack', '⚫', 'Midnight black paint for warnings', 'Art Supplies', true, 50, 10, 'common', true),
('White Pixel Pack', '⚪', 'Pure white paint for peace flags', 'Art Supplies', true, 50, 10, 'common', true),

-- Rare & Legendary Items
('Golden Skull', '💀', 'Legendary pirate artifact', 'Legendary', false, 1, 1000, 'legendary', false),
('Davy Jones Locker Key', '🗝️', 'Opens the deepest treasures', 'Legendary', false, 1, 2000, 'legendary', false),
('Blackbeard''s Rum', '🍾', 'The finest rum ever distilled', 'Legendary', false, 1, 800, 'legendary', false),
('Siren''s Song', '🎵', 'Enchanted music box', 'Legendary', false, 1, 1500, 'legendary', false),
('Neptune''s Trident', '🔱', 'Weapon of the sea god', 'Legendary', false, 1, 5000, 'legendary', false)

ON CONFLICT (name) DO UPDATE SET
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    stackable = EXCLUDED.stackable,
    max_stack = EXCLUDED.max_stack,
    base_value = EXCLUDED.base_value,
    rarity = EXCLUDED.rarity,
    tradeable = EXCLUDED.tradeable;

-- 3. Update trading_stocks to include new items
INSERT INTO trading_stocks (island_id, item_name, stock_quantity, buy_price, sell_price)
SELECT island_id, item_name, stock_quantity, buy_price, sell_price
FROM (
    SELECT i.id as island_id, items.item_name, items.stock_quantity, items.buy_price, items.sell_price
    FROM islands i
    CROSS JOIN (VALUES
        -- Add new valuable trade items to all ports
        ('Coffee Beans', 15, 8, 5),
        ('Tobacco Leaves', 12, 10, 7),
        ('Hardtack', 30, 3, 2),
        ('Fresh Water', 25, 2, 1),
        ('Salted Meat', 20, 6, 4),
        ('Canvas', 8, 12, 8),
        ('Iron Nails', 40, 2, 1),
        ('Tar', 10, 8, 5),
        ('Grapeshot', 20, 7, 4),
        ('Chain Shot', 15, 9, 6),
        ('Sea Charts', 5, 20, 15),
        ('Lantern', 8, 18, 12),
        ('Barrel', 6, 25, 18),
        ('Hammock', 12, 12, 8),
        -- Add new pixel colors
        ('Black Pixel Pack', 15, 10, 6),
        ('White Pixel Pack', 15, 10, 6)
    ) AS items(item_name, stock_quantity, buy_price, sell_price)
) AS stock_data
WHERE NOT EXISTS (
    SELECT 1 FROM trading_stocks ts 
    WHERE ts.island_id = stock_data.island_id 
    AND ts.item_name = stock_data.item_name
);

-- 4. Add rare items to select ports only
INSERT INTO trading_stocks (island_id, item_name, stock_quantity, buy_price, sell_price)
SELECT island_id, item_name, stock_quantity, buy_price, sell_price
FROM (
    SELECT i.id as island_id, items.item_name, items.stock_quantity, items.buy_price, items.sell_price,
           ROW_NUMBER() OVER (PARTITION BY items.item_name ORDER BY RANDOM()) as rn
    FROM islands i
    CROSS JOIN (VALUES
        -- Rare items only at some ports
        ('Emeralds', 2, 40, 30),
        ('Rubies', 1, 60, 45),
        ('Ancient Coins', 5, 25, 18),
        ('Ivory', 3, 35, 25),
        ('Exotic Furs', 4, 20, 15),
        ('Muskets', 2, 25, 18),
        ('Copper Sheets', 6, 15, 10),
        ('Sextant', 1, 100, 75),
        ('Astrolabe', 1, 150, 120),
        ('Cursed Medallion', 1, 200, 150),
        ('Mermaid Scale', 2, 120, 90)
    ) AS items(item_name, stock_quantity, buy_price, sell_price)
) AS rare_stock_data
WHERE rare_stock_data.rn <= 3  -- Only add to 3 random ports per item
AND NOT EXISTS (
    SELECT 1 FROM trading_stocks ts 
    WHERE ts.island_id = rare_stock_data.island_id 
    AND ts.item_name = rare_stock_data.item_name
);

-- 5. Create crafting_recipes table
CREATE TABLE IF NOT EXISTS crafting_recipes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    result_item VARCHAR(100) NOT NULL,
    result_quantity INTEGER DEFAULT 1,
    ingredients JSONB NOT NULL,
    skill_required INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (result_item) REFERENCES item_definitions(name)
);

-- 6. Insert enhanced crafting recipes
INSERT INTO crafting_recipes (name, description, result_item, result_quantity, ingredients) VALUES
('Advanced Repair Kit', 'Superior ship repair materials', 'Medicine', 3, '{"Wooden Planks": 5, "Rope": 3, "Tar": 2}'),
('Explosive Ammunition', 'Powerful cannon ammunition', 'Grapeshot', 10, '{"Cannon Balls": 8, "Gunpowder": 3, "Iron Nails": 5}'),
('Navigation Bundle', 'Complete navigation package', 'Sea Charts', 3, '{"Compass": 1, "Spyglass": 1, "Treasure Maps": 2}'),
('Luxury Trade Package', 'High-value trade goods bundle', 'Gold Coins', 100, '{"Silk": 5, "Spices": 8, "Pearls": 3}'),
('Ship Upgrade Kit', 'Materials for major ship improvements', 'Copper Sheets', 5, '{"Wooden Planks": 15, "Iron Nails": 20, "Tar": 5, "Canvas": 3}'),
('Pirate Feast', 'Morale-boosting meal for the crew', 'Rum Bottles', 8, '{"Salted Meat": 6, "Hardtack": 10, "Fresh Water": 5}'),
('Combat Loadout', 'Complete weapons package', 'Cutlasses', 3, '{"Muskets": 2, "Gunpowder": 5, "Cannon Balls": 20}'),
('Explorer''s Kit', 'Everything needed for long voyages', 'Treasure Maps', 5, '{"Compass": 1, "Fresh Water": 10, "Hardtack": 15, "Lantern": 2}'),
('Artist''s Palette', 'Complete set of pixel paints', 'Red Pixel Pack', 10, '{"Blue Pixel Pack": 5, "Green Pixel Pack": 5, "Yellow Pixel Pack": 5}'),
('Merchant''s Fortune', 'Valuable trade goods collection', 'Gold Coins', 200, '{"Coffee Beans": 10, "Tobacco Leaves": 8, "Exotic Furs": 4, "Ivory": 2}'

ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    result_item = EXCLUDED.result_item,
    result_quantity = EXCLUDED.result_quantity,
    ingredients = EXCLUDED.ingredients;

-- 7. Create player_achievements table for inventory milestones
CREATE TABLE IF NOT EXISTS player_achievements (
    id BIGSERIAL PRIMARY KEY,
    player_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_name VARCHAR(100) NOT NULL,
    achievement_description TEXT,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(player_id, achievement_name)
);

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_item_definitions_category ON item_definitions(category);
CREATE INDEX IF NOT EXISTS idx_item_definitions_rarity ON item_definitions(rarity);
CREATE INDEX IF NOT EXISTS idx_trading_stocks_item ON trading_stocks(item_name);
CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON player_achievements(player_id);

-- 9. Create function to get item value
CREATE OR REPLACE FUNCTION get_item_value(item_name_param VARCHAR)
RETURNS INTEGER AS $$
DECLARE
    item_value INTEGER;
BEGIN
    SELECT base_value INTO item_value
    FROM item_definitions
    WHERE name = item_name_param;
    
    RETURN COALESCE(item_value, 1);
END;
$$ LANGUAGE plpgsql;

-- 10. Create function to calculate inventory total value
CREATE OR REPLACE FUNCTION calculate_inventory_value(inventory_data JSONB)
RETURNS INTEGER AS $$
DECLARE
    total_value INTEGER := 0;
    item_record RECORD;
BEGIN
    FOR item_record IN 
        SELECT key as item_name, value::INTEGER as quantity
        FROM jsonb_each_text(inventory_data)
    LOOP
        total_value := total_value + (get_item_value(item_record.item_name) * item_record.quantity);
    END LOOP;
    
    RETURN total_value;
END;
$$ LANGUAGE plpgsql;

-- 11. Grant permissions
GRANT SELECT ON item_definitions TO anon, authenticated;
GRANT SELECT ON crafting_recipes TO anon, authenticated;
GRANT ALL ON player_achievements TO authenticated;

-- 12. Final success message
DO $$
BEGIN
    RAISE NOTICE 'Enhanced inventory system setup complete!';
    RAISE NOTICE 'Added % item definitions with categories and rarity system.', (SELECT COUNT(*) FROM item_definitions);
    RAISE NOTICE 'Added % crafting recipes for advanced gameplay.', (SELECT COUNT(*) FROM crafting_recipes);
    RAISE NOTICE 'Enhanced trading stocks across all ports with new items.';
END $$;