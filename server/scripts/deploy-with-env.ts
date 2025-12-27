import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

// Configure path to .env file
const envPath = path.resolve(__dirname, '../.env');

// Read .env file
if (!fs.existsSync(envPath)) {
    console.error('Error: .env file not found at:', envPath);
    process.exit(1);
}

const envConfig = dotenv.parse(fs.readFileSync(envPath));

const envVars = Object.entries(envConfig)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');

if (!envVars) {
    console.log('No environment variables to upload.');
    process.exit(0);
}

// Upload secrets/config
// Strategy: Since we are using Genkit/Gen2 functions which rely on environment variables,
// but .env files are typically gitignored for security, we need a way to include them during deployment.
// This script temporarily un-ignores .env in .gitignore, runs the deploy, and then restores .gitignore.

console.log('Preparing to deploy configuration...');

// Create a temporary .env.deploy file (redundant if we use the gitignore strategy, but kept for backup)
const deployEnvPath = path.resolve(__dirname, '../.env.deploy');
const gitignorePath = path.resolve(__dirname, '../.gitignore');

// Main execution
let originalEnvContent = '';
let originalGitignoreContent = '';

try {
    console.log('Preparing to deploy configuration...');

    // 1. Read original .env content
    if (fs.existsSync(envPath)) {
        originalEnvContent = fs.readFileSync(envPath, 'utf-8');
    }

    // 2. Filter out reserved keys (PORT) and local-only keys
    const envLines = originalEnvContent.split('\n');
    const filteredLines = envLines.filter(line => {
        const trimmed = line.trim();
        // Skip empty lines or comments
        if (!trimmed || trimmed.startsWith('#')) return true;

        // Check key
        const [key] = trimmed.split('=');
        const forbiddenKeys = ['PORT', 'GOOGLE_APPLICATION_CREDENTIALS'];
        if (forbiddenKeys.includes(key.trim())) {
            console.log(`Skipping local-only key for deployment: ${key}`);
            return false;
        }
        return true;
    });

    const filteredEnvContent = filteredLines.join('\n');

    // 3. Write filtered content to .env
    fs.writeFileSync(envPath, filteredEnvContent);

    // 4. Modify .gitignore to allow .env
    console.log('Temporarily un-ignoring .env for deployment...');
    if (fs.existsSync(gitignorePath)) {
        originalGitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
        // Ensure !.env is present
        if (!originalGitignoreContent.includes('!.env')) {
            fs.writeFileSync(gitignorePath, originalGitignoreContent + '\n!.env');
        }
    } else {
        // If .gitignore doesn't exist, create it with !.env
        fs.writeFileSync(gitignorePath, '!.env\n');
    }

    console.log('Running build...');
    execSync('pnpm run build', { stdio: 'inherit' });

    console.log('Running deploy...');
    execSync('firebase deploy --only functions', { stdio: 'inherit' });

    console.log('Deployment successful!');

} catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
} finally {
    console.log('Cleaning up...');

    // Restore original .env
    if (originalEnvContent && fs.existsSync(envPath)) {
        console.log('Restoring .env...');
        fs.writeFileSync(envPath, originalEnvContent);
    }

    // Restore original .gitignore
    if (fs.existsSync(gitignorePath)) {
        // If we had original content, restore it. 
        // If we created it fresh, delete it? No, safer to just strip !.env
        if (originalGitignoreContent) {
            fs.writeFileSync(gitignorePath, originalGitignoreContent);
        } else {
            // Fallback cleanup if original was empty or we created it
            const current = fs.readFileSync(gitignorePath, 'utf-8');
            const restored = current.replace(/\n!.env/g, '').replace(/!.env/g, '');
            fs.writeFileSync(gitignorePath, restored);
        }
    }
}
