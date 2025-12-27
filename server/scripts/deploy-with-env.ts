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
fs.copyFileSync(envPath, deployEnvPath);

try {
    console.log('Temporarily un-ignoring .env for deployment...');

    // We modify .gitignore to explicitly include .env (using !.env)
    // This forces Firebase Deploy to upload the .env file with the function code.
    const serverGitignorePath = path.resolve(__dirname, '../.gitignore');
    let originalContent = '';

    if (fs.existsSync(serverGitignorePath)) {
        originalContent = fs.readFileSync(serverGitignorePath, 'utf8');
        if (!originalContent.includes('!.env')) {
            fs.appendFileSync(serverGitignorePath, '\n!.env\n');
        }
    } else {
        fs.writeFileSync(serverGitignorePath, '!.env\n');
    }

    console.log('Running build...');
    execSync('pnpm run build', { stdio: 'inherit' });

    console.log('Running deploy...');
    execSync('firebase deploy --only functions', { stdio: 'inherit' });

} catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
} finally {
    // Restore .gitignore to original state to ensure .env remains ignored
    const serverGitignorePath = path.resolve(__dirname, '../.gitignore');
    if (fs.existsSync(deployEnvPath)) fs.unlinkSync(deployEnvPath);

    try {
        const currentContent = fs.readFileSync(serverGitignorePath, 'utf8');
        if (currentContent.includes('!.env')) {
            const newContent = currentContent.replace(/\n!.env\n/g, '').replace(/!.env\n/g, '').replace(/\n!.env/g, '');
            fs.writeFileSync(serverGitignorePath, newContent || originalContent);
        }
    } catch (e) {
        console.error("Failed to restore .gitignore", e);
    }

    console.log('Cleaned up.');
}
