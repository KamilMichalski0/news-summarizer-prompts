const { createClient } = require('@supabase/supabase-js');
const config = require('./env');
const logger = require('./logger');

// Regular client for data operations (using ANON_KEY)
const supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

// Admin client for schema operations (using SERVICE_KEY)
const supabaseAdmin = config.SUPABASE_SERVICE_KEY 
    ? createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
    : null;

// SQL schema for creating all required tables
const CREATE_TABLES_SQL = `
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
    article_id TEXT NOT NULL,
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

-- Enable Row Level Security (RLS) 
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can view own profile'
    ) THEN
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view own profile" ON profiles
            FOR SELECT USING (auth.uid() = user_id);

        CREATE POLICY "Users can insert own profile" ON profiles
            FOR INSERT WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "Users can update own profile" ON profiles
            FOR UPDATE USING (auth.uid() = user_id);

        CREATE POLICY "Users can delete own profile" ON profiles
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'user_feeds' AND policyname = 'Users can view own feeds'
    ) THEN
        ALTER TABLE user_feeds ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view own feeds" ON user_feeds
            FOR SELECT USING (auth.uid() = user_id);

        CREATE POLICY "Users can insert own feeds" ON user_feeds
            FOR INSERT WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "Users can update own feeds" ON user_feeds
            FOR UPDATE USING (auth.uid() = user_id);

        CREATE POLICY "Users can delete own feeds" ON user_feeds
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'reading_history' AND policyname = 'Users can view own reading history'
    ) THEN
        ALTER TABLE reading_history ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view own reading history" ON reading_history
            FOR SELECT USING (auth.uid() = user_id);

        CREATE POLICY "Users can insert own reading history" ON reading_history
            FOR INSERT WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "Users can update own reading history" ON reading_history
            FOR UPDATE USING (auth.uid() = user_id);

        CREATE POLICY "Users can delete own reading history" ON reading_history
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'user_summaries' AND policyname = 'Users can view own summaries'
    ) THEN
        ALTER TABLE user_summaries ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view own summaries" ON user_summaries
            FOR SELECT USING (auth.uid() = user_id);

        CREATE POLICY "Users can insert own summaries" ON user_summaries
            FOR INSERT WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "Users can update own summaries" ON user_summaries
            FOR UPDATE USING (auth.uid() = user_id);

        CREATE POLICY "Users can delete own summaries" ON user_summaries
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Function to automatically create profile on user signup
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

-- Create trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
    ) THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
END $$;
`;

async function checkTableExists(tableName) {
    try {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);
            
        return !error;
    } catch (error) {
        return false;
    }
}

async function initializeDatabase() {
    try {
        logger.info('Checking database initialization...');
        
        // Check if admin client is available
        if (!supabaseAdmin) {
            logger.warn('SUPABASE_SERVICE_KEY not configured - cannot automatically create tables');
            logger.info('Add SUPABASE_SERVICE_KEY to .env for automatic database initialization');
            logger.info('Alternatively, create tables manually using Supabase Dashboard');
            return false;
        }
        
        // Check if core tables exist
        const requiredTables = ['profiles', 'user_feeds', 'reading_history', 'user_summaries'];
        const tableChecks = await Promise.all(
            requiredTables.map(table => checkTableExists(table))
        );
        
        const missingTables = requiredTables.filter((table, index) => !tableChecks[index]);
        
        if (missingTables.length === 0) {
            logger.info('Database already initialized - all tables exist');
            return true;
        }
        
        logger.warn('Missing database tables', { missingTables });
        logger.info('Initializing database schema using SERVICE_KEY...');
        
        try {
            // Execute the complete schema using the admin client
            const { data, error } = await supabaseAdmin
                .rpc('exec', { sql: CREATE_TABLES_SQL });
            
            if (error) {
                // If RPC doesn't work, try SQL Editor approach
                logger.warn('Admin RPC failed, trying alternative approaches', { 
                    error: error.message 
                });
                throw error;
            }
            
            logger.info('Database schema initialized successfully using SERVICE_KEY');
            
            // Verify tables were created
            const verificationChecks = await Promise.all(
                requiredTables.map(table => checkTableExists(table))
            );
            
            const stillMissing = requiredTables.filter((table, index) => !verificationChecks[index]);
            
            if (stillMissing.length > 0) {
                logger.warn('Some tables still missing after initialization', { stillMissing });
                return false;
            }
            
            return true;
            
        } catch (adminError) {
            logger.error('Admin schema creation failed', { 
                error: adminError.message 
            });
            logger.info('Please create tables manually using Supabase Dashboard SQL Editor:');
            logger.info('1. Go to https://supabase.com/dashboard');
            logger.info('2. Select your project');
            logger.info('3. SQL Editor > New Query');
            logger.info('4. Copy/paste content from supabase-schema.sql');
            logger.info('5. Click RUN');
            return false;
        }
        
    } catch (error) {
        logger.error('Database initialization failed', {
            error: error.message,
            stack: error.stack
        });
        
        logger.info('Fallback: Application will continue with empty data for missing tables');
        logger.info('For full functionality, create tables manually using Supabase Dashboard');
        return false;
    }
}

module.exports = {
    supabase,
    initializeDatabase,
    checkTableExists
};