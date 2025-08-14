#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Brak konfiguracji Supabase. Sprawdź zmienne SUPABASE_URL i SUPABASE_ANON_KEY w .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndCreateTables() {
    console.log('Sprawdzanie tabel w bazie danych...');
    
    try {
        // Sprawdź czy tabele istnieją
        const tables = ['profiles', 'user_feeds', 'reading_history', 'user_summaries'];
        
        for (const table of tables) {
            console.log(`Sprawdzanie tabeli: ${table}`);
            
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .limit(1);
                
            if (error) {
                console.error(`❌ Tabela ${table} nie istnieje:`, error.message);
            } else {
                console.log(`✅ Tabela ${table} istnieje`);
            }
        }
        
        console.log('\n📋 INSTRUKCJE:');
        console.log('1. Przejdź do Supabase Dashboard: https://supabase.com/dashboard');
        console.log('2. Wybierz swój projekt');
        console.log('3. Przejdź do "SQL Editor"');
        console.log('4. Skopiuj i uruchom zawartość pliku: supabase-schema.sql');
        console.log('5. Kliknij "Run" aby utworzyć tabele');
        
    } catch (err) {
        console.error('Błąd połączenia z Supabase:', err.message);
    }
}

checkAndCreateTables();