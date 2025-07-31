-- SQL for Supabase interaction tables
CREATE TABLE player_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id uuid REFERENCES pirates(id),
  target_id uuid REFERENCES pirates(id),
  interaction_type text CHECK (interaction_type IN ('combat', 'trade', 'chat')),
  status text CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  data jsonb,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE combat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id uuid REFERENCES pirates(id),
  player2_id uuid REFERENCES pirates(id),
  current_turn uuid REFERENCES pirates(id),
  turn_number int DEFAULT 1,
  player1_hp int DEFAULT 100,
  player2_hp int DEFAULT 100,
  combat_log jsonb DEFAULT '[]',
  status text CHECK (status IN ('active', 'completed')) DEFAULT 'active',
  winner_id uuid REFERENCES pirates(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE trade_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id uuid REFERENCES pirates(id),
  player2_id uuid REFERENCES pirates(id),
  player1_offer jsonb DEFAULT '{}',
  player2_offer jsonb DEFAULT '{}',
  player1_approved boolean DEFAULT false,
  player2_approved boolean DEFAULT false,
  status text CHECK (status IN ('negotiating', 'completed', 'cancelled')) DEFAULT 'negotiating',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_id uuid REFERENCES pirates(id),
  player2_id uuid REFERENCES pirates(id),
  messages jsonb DEFAULT '[]',
  status text CHECK (status IN ('active', 'closed')) DEFAULT 'active',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_interactions_initiator ON player_interactions(initiator_id);
CREATE INDEX idx_interactions_target ON player_interactions(target_id);
CREATE INDEX idx_interactions_status ON player_interactions(status);
CREATE INDEX idx_combat_players ON combat_sessions(player1_id, player2_id);
CREATE INDEX idx_trade_players ON trade_sessions(player1_id, player2_id);
CREATE INDEX idx_chat_players ON chat_sessions(player1_id, player2_id);