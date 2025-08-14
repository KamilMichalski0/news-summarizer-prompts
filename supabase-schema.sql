-- News Summarizer Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{
        "language": "pl",
        "max_articles": 6,
        "auto_translate": true,
        "auto_summarize": true,
        "max_translation_length": 1000
    }'::jsonb,
    settings JSONB DEFAULT '{
        "theme": "light",
        "notifications": true
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User RSS feeds table
CREATE TABLE IF NOT EXISTS user_feeds (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    rss_url TEXT NOT NULL,
    custom_name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, rss_url)
);

-- User reading history table
CREATE TABLE IF NOT EXISTS reading_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    article_url TEXT NOT NULL,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    liked BOOLEAN DEFAULT false,
    UNIQUE(user_id, article_url)
);

-- User summaries table
CREATE TABLE IF NOT EXISTS user_summaries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    article_id TEXT NOT NULL, -- This could be URL or hash
    article_title TEXT,
    article_url TEXT,
    summary TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feeds_user_id ON user_feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feeds_active ON user_feeds(active);
CREATE INDEX IF NOT EXISTS idx_reading_history_user_id ON reading_history(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_history_read_at ON reading_history(read_at);
CREATE INDEX IF NOT EXISTS idx_user_summaries_user_id ON user_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_user_summaries_created_at ON user_summaries(created_at);

-- Row Level Security (RLS) policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_summaries ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile" ON profiles
    FOR DELETE USING (auth.uid() = user_id);

-- User feeds policies
CREATE POLICY "Users can view own feeds" ON user_feeds
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feeds" ON user_feeds
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feeds" ON user_feeds
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own feeds" ON user_feeds
    FOR DELETE USING (auth.uid() = user_id);

-- Reading history policies
CREATE POLICY "Users can view own reading history" ON reading_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reading history" ON reading_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reading history" ON reading_history
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reading history" ON reading_history
    FOR DELETE USING (auth.uid() = user_id);

-- User summaries policies
CREATE POLICY "Users can view own summaries" ON user_summaries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own summaries" ON user_summaries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own summaries" ON user_summaries
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own summaries" ON user_summaries
    FOR DELETE USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_feeds_updated_at 
    BEFORE UPDATE ON user_feeds 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile automatically on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, display_name)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Optional: Create some sample data functions (for testing)
CREATE OR REPLACE FUNCTION create_sample_user_data(user_email TEXT)
RETURNS VOID AS $$
DECLARE
    user_uuid UUID;
BEGIN
    -- Get user ID from email
    SELECT id INTO user_uuid FROM auth.users WHERE email = user_email;
    
    IF user_uuid IS NULL THEN
        RAISE EXCEPTION 'User with email % not found', user_email;
    END IF;
    
    -- Insert sample RSS feeds
    INSERT INTO user_feeds (user_id, rss_url, custom_name) VALUES
        (user_uuid, 'https://feeds.bbci.co.uk/news/rss.xml', 'BBC News'),
        (user_uuid, 'https://rss.cnn.com/rss/edition.rss', 'CNN'),
        (user_uuid, 'https://feeds.reuters.com/reuters/topNews', 'Reuters Top News')
    ON CONFLICT (user_id, rss_url) DO NOTHING;
    
    -- Insert sample reading history
    INSERT INTO reading_history (user_id, article_url, liked) VALUES
        (user_uuid, 'https://www.bbc.com/news/sample-1', true),
        (user_uuid, 'https://www.bbc.com/news/sample-2', false),
        (user_uuid, 'https://www.cnn.com/news/sample-1', true)
    ON CONFLICT (user_id, article_url) DO NOTHING;
    
END;
$$ LANGUAGE plpgsql;

-- Create a view for user statistics (optional)
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    p.user_id,
    p.display_name,
    p.email,
    COUNT(DISTINCT uf.id) as total_feeds,
    COUNT(DISTINCT rh.id) as articles_read,
    COUNT(DISTINCT us.id) as summaries_created,
    COUNT(DISTINCT CASE WHEN rh.liked = true THEN rh.id END) as liked_articles,
    p.created_at as user_since
FROM profiles p
LEFT JOIN user_feeds uf ON p.user_id = uf.user_id AND uf.active = true
LEFT JOIN reading_history rh ON p.user_id = rh.user_id
LEFT JOIN user_summaries us ON p.user_id = us.user_id
GROUP BY p.user_id, p.display_name, p.email, p.created_at;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Comments for documentation
COMMENT ON TABLE profiles IS 'User profiles extending Supabase auth.users';
COMMENT ON TABLE user_feeds IS 'RSS feeds configured by users';
COMMENT ON TABLE reading_history IS 'Articles read by users with timestamps';
COMMENT ON TABLE user_summaries IS 'AI-generated summaries saved by users';

COMMENT ON COLUMN profiles.preferences IS 'User preferences as JSON: language, max_articles, auto_translate, auto_summarize, etc.';
COMMENT ON COLUMN profiles.settings IS 'User settings as JSON: theme, notifications, etc.';
COMMENT ON COLUMN user_feeds.active IS 'Whether the RSS feed is currently active for the user';
COMMENT ON COLUMN reading_history.liked IS 'Whether the user liked/bookmarked the article';

-- Indexes for JSON columns (for better performance on JSONB queries)
CREATE INDEX IF NOT EXISTS idx_profiles_preferences ON profiles USING GIN (preferences);
CREATE INDEX IF NOT EXISTS idx_profiles_settings ON profiles USING GIN (settings);

COMMIT;