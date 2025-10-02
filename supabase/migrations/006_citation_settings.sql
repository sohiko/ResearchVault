-- Citation settings table
CREATE TABLE citation_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_style TEXT NOT NULL DEFAULT 'APA',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE citation_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own citation settings" ON citation_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own citation settings" ON citation_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own citation settings" ON citation_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own citation settings" ON citation_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_citation_settings_user_id ON citation_settings(user_id);
