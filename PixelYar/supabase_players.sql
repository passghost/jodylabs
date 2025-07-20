-- SQL for Supabase table
CREATE TABLE players (
  id uuid PRIMARY KEY,
  email text,
  x int,
  y int,
  hull int,
  crew int,
  items jsonb,
  booty int,
  color text
);
CREATE UNIQUE INDEX ON players(email);
