ALTER TABLE public.friend_messages
  ADD COLUMN IF NOT EXISTS reply_to uuid
  REFERENCES public.friend_messages(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS friend_messages_reply_to_idx
  ON public.friend_messages (reply_to)
  WHERE reply_to IS NOT NULL;
