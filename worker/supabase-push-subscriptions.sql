-- Run this in Supabase SQL Editor to enable push notification subscriptions storage.
-- Used by the Railway worker (POST /push/subscribe and /push/send).

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(endpoint)
);

-- Optional: allow cleanup of stale subscriptions by endpoint
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_created_at ON push_subscriptions(created_at);
