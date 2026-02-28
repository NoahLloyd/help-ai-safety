import { spawn } from 'child_process';
import * as path from 'path';

const scripts = [
    // 1. Event pipeline: gather from all sources → AI evaluate → promote/reject
    'scripts/sync-all-events.ts',

    // 2. Data scrubbing & pruning (cleans up any new dirty data safely)
    'scripts/standardize-countries.ts',
    'scripts/penalize-dead-events.ts'
];

async function runScript(scriptPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        console.log(`\n================================`);
        console.log(`▶ Running: ${scriptPath}`);
        console.log(`================================`);
        
        const child = spawn('npx', ['tsx', scriptPath], {
            cwd: process.cwd(),
            stdio: 'inherit',
            shell: true
        });

        child.on('close', (code) => {
            if (code !== 0) {
                console.error(`❌ Process exited with code ${code}`);
                reject(new Error(`Script ${scriptPath} failed`));
            } else {
                console.log(`✅ Success`);
                resolve();
            }
        });
    });
}

async function runAll() {
    console.log("🚀 Starting Data Synchronization & Sanitization Pipeline...");
    const startTime = Date.now();
    
    for (const script of scripts) {
        try {
            await runScript(script);
        } catch (err) {
            console.error("\n❌ Pipeline aborted due to error in script.");
            process.exit(1);
        }
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n🎉 Pipeline completed successfully in ${elapsed} seconds.`);
}

runAll();
