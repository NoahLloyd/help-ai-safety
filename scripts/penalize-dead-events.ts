import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read our raw contexts
const contexts = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'community-contexts.json'), 'utf-8'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function downgradeDeadEvents() {
    let toDowngrade = [];

    for (const ctx of contexts) {
        if (!ctx.scraped_text) continue;
        const lower = ctx.scraped_text.toLowerCase();
        
        // If it explicitly says no upcoming events, and has no past events, it's totally dead.
        // Even if it has past events, if it currently has no upcoming events, it's inactive at the moment.
        // Based on user feedback, we penalize those heavily.
        if (lower.includes('no upcoming events') || lower.includes('no events scheduled')) {
            // Check if it's completely dead (no past events either)
            const explicitlyDead = !lower.includes('past events');
            
            toDowngrade.push({
                id: ctx.id,
                title: ctx.title,
                explicitlyDead
            });
        }
    }

    console.log(`Found ${toDowngrade.length} communities with no upcoming events. Downgrading health scores...`);

    let updated = 0;
    for (const comm of toDowngrade) {
        // Set health score drastically lower. 0.1 for just no upcoming events (maybe they had past ones), 0.05 for completely dead.
        const newScore = comm.explicitlyDead ? 0.05 : 0.1;
        
        const { error } = await supabase
            .from('resources')
            .update({ activity_score: newScore })
            .eq('id', comm.id);

        if (!error) {
            updated++;
            console.log(`[${newScore}] Downgraded: ${comm.title}`);
        } else {
            console.error(`Failed to downgrade ${comm.id}:`, error.message);
        }
    }

    console.log(`Successfully downgraded ${updated} inactive community profiles.`);
}

downgradeDeadEvents();
