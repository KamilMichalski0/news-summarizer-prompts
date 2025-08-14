#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Brak konfiguracji Supabase. Sprawdź zmienne SUPABASE_URL i SUPABASE_SERVICE_KEY w .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTables() {
    console.log('Tworzenie tabel w Supabase...\n');
    
    const queries = [
        // Enable UUID extension
        'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";',
        
        // User profiles table
        `CREATE TABLE IF NOT EXISTS profiles (
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
        );`,
        
        // User RSS feeds table
        `CREATE TABLE IF NOT EXISTS user_feeds (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            rss_url TEXT NOT NULL,
            custom_name TEXT NOT NULL,
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(user_id, rss_url)
        );`,
        
        // User reading history table
        `CREATE TABLE IF NOT EXISTS reading_history (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            article_url TEXT NOT NULL,
            read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            liked BOOLEAN DEFAULT false,
            UNIQUE(user_id, article_url)
        );`,
        
        // User summaries table
        `CREATE TABLE IF NOT EXISTS user_summaries (
            id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
            article_id TEXT NOT NULL,
            article_title TEXT,
            article_url TEXT,
            summary TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );`
    ];
    
    try {
        for (let i = 0; i < queries.length; i++) {
            const query = queries[i];
            console.log(`Wykonywanie zapytania ${i + 1}/${queries.length}...`);
            
            const { error } = await supabase.rpc('exec_sql', { sql: query });
            
            if (error) {
                console.error(`❌ Błąd wykonania zapytania ${i + 1}:`, error.message);
                // Try alternative approach
                console.log('Próba alternatywnego podejścia...');
                console.log(query);
            } else {
                console.log(`✅ Zapytanie ${i + 1} wykonane pomyślnie`);
            }
        }
        
        console.log('\n🎉 Proces zakończony!');
        console.log('\n📋 ALTERNATYWA - Ręczne wykonanie:');
        console.log('Jeśli powyższe nie zadziałało, skopiuj zawartość supabase-schema.sql');
        console.log('i uruchom w Supabase Dashboard > SQL Editor');
        
    } catch (err) {
        console.error('Ogólny błąd:', err.message);
        console.log('\n📋 RĘCZNE WYKONANIE:');
        console.log('1. Przejdź do: https://supabase.com/dashboard');
        console.log('2. Wybierz projekt');
        console.log('3. SQL Editor > New Query');
        console.log('4. Skopiuj zawartość z pliku supabase-schema.sql');
        console.log('5. Kliknij RUN');
    }
}

createTables();