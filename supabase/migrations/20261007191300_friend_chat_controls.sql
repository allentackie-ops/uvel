ALTER TABLE public.friend_chats
  ADD COLUMN IF NOT EXISTS hidden_a boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_b boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cleared_a_at timestamptz,
  ADD COLUMN IF NOT EXISTS cleared_b_at timestamptz;
