import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeLocations() {
    const { data, error } = await supabase
        .from('resources')
        .select('id, title, location')
        .not('location', 'is', null);

    if (error) {
        console.error("Error fetching data:", error);
        return;
    }

    const countries = new Map<string, number>();
    
    for (const item of data) {
        if (!item.location) continue;
        const parts = item.location.split(',');
        let country = parts[parts.length - 1].trim();
        countries.set(country, (countries.get(country) || 0) + 1);
    }

    const sortedCountries = Array.from(countries.entries()).sort((a, b) => b[1] - a[1]);
    
    console.log("Unique Countries/Suffixes in Locations:");
    for (const [country, count] of sortedCountries) {
        console.log(`${country}: ${count}`);
    }
}

analyzeLocations();
