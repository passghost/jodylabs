# Supabase High Score Setup

## 1. Create Supabase Table

In your Supabase dashboard, run this SQL to create the high scores table:

```sql
CREATE TABLE battle_tits_scores (
  id BIGSERIAL PRIMARY KEY,
  player_name TEXT NOT NULL DEFAULT 'ANONYMOUS',
  score INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_battle_tits_scores_score ON battle_tits_scores(score DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE battle_tits_scores ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read scores
CREATE POLICY "Anyone can view high scores" ON battle_tits_scores
  FOR SELECT USING (true);

-- Create policy to allow anyone to insert scores
CREATE POLICY "Anyone can insert scores" ON battle_tits_scores
  FOR INSERT WITH CHECK (true);
```

## 2. Update Configuration

Edit `highscores.js` and replace these values with your actual Supabase credentials:

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

You can find these values in your Supabase project settings under "API".

## 3. Features

- **High Score Board**: Shows top 8 scores in real-time
- **Database Integration**: Stores scores in Supabase
- **Fallback System**: Uses localStorage if Supabase is unavailable
- **Name Input**: Players can enter their name for high scores
- **Auto-refresh**: Updates scores every 30 seconds
- **Responsive UI**: Fits perfectly in the existing game layout

## 4. Testing

The system will work with localStorage even without Supabase configured, so you can test it immediately. Once you add your Supabase credentials, it will automatically sync to the database.