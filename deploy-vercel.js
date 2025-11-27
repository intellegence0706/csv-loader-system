#!/usr/bin/env node

/**
 * Vercel Deployment Helper Script
 * 
 * This script helps deploy the project to Vercel by providing
 * step-by-step instructions and checking prerequisites.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n🚀 Vercel Deployment Helper\n');
console.log('='.repeat(50));

// Check if vercel.json exists
const vercelConfigPath = path.join(__dirname, 'vercel.json');
if (fs.existsSync(vercelConfigPath)) {
    console.log('✅ vercel.json configuration found');
} else {
    console.log('❌ vercel.json not found');
    process.exit(1);
}

// Check if package.json exists
const packageJsonPath = path.join(__dirname, 'package.json');
if (fs.existsSync(packageJsonPath)) {
    console.log('✅ package.json found');
} else {
    console.log('❌ package.json not found');
    process.exit(1);
}

// Check if dist directory exists (previous build)
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    console.log('✅ Previous build found in dist/');
} else {
    console.log('ℹ️  No previous build found (will build during deployment)');
}

console.log('\n' + '='.repeat(50));
console.log('\n📋 Deployment Options:\n');

console.log('Option 1: Vercel Dashboard (Recommended)');
console.log('  1. Visit: https://vercel.com/new');
console.log('  2. Import your Git repository');
console.log('  3. Add environment variables:');
console.log('     - VITE_SUPABASE_URL');
console.log('     - VITE_SUPABASE_ANON_KEY');
console.log('  4. Click Deploy\n');

console.log('Option 2: Vercel CLI');
console.log('  Run these commands:');
console.log('  1. npm install -g vercel');
console.log('  2. vercel login');
console.log('  3. vercel');
console.log('  4. vercel env add VITE_SUPABASE_URL');
console.log('  5. vercel env add VITE_SUPABASE_ANON_KEY');
console.log('  6. vercel --prod\n');

console.log('Option 3: Git Integration (Continuous Deployment)');
console.log('  1. Push code to GitHub/GitLab/Bitbucket');
console.log('  2. Connect repository in Vercel Dashboard');
console.log('  3. Configure environment variables');
console.log('  4. Auto-deploy on every push\n');

console.log('='.repeat(50));
console.log('\n📚 For detailed instructions, see:');
console.log('  - DEPLOY_NOW.md (Quick start guide)');
console.log('  - DEPLOYMENT.md (Comprehensive guide)\n');

// Try to check if Vercel CLI is available
try {
    execSync('vercel --version', { stdio: 'pipe' });
    console.log('✅ Vercel CLI is installed');
    console.log('\nYou can deploy now by running: vercel\n');
} catch (error) {
    console.log('ℹ️  Vercel CLI not installed');
    console.log('   Install with: npm install -g vercel\n');
}

console.log('='.repeat(50) + '\n');

