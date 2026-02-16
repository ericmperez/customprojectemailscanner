-- Track user online presence and daily connection time
CREATE TABLE IF NOT EXISTS user_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL,
  user_name TEXT DEFAULT '',
  user_image_url TEXT DEFAULT '',
  last_heartbeat TIMESTAMPTZ DEFAULT now(),
  today_date DATE DEFAULT CURRENT_DATE,
  seconds_today INTEGER DEFAULT 0,
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_presence_org ON user_presence(org_id);
