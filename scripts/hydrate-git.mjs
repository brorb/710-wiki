import { execSync } from 'child_process';
import fs from 'fs';

const isCI = process.env.RAILWAY_ENVIRONMENT || process.env.CI || process.env.VERCEL || process.env.CF_PAGES;

if (!isCI) {
  console.log('Skipping git hydration (only runs in CI environments)...');
  process.exit(0);
}

console.log('Hydrating Git history for accurate lastmod dates...');

try {
  execSync(`git config --global --add safe.directory "*"`);
} catch (e) {}

if (!fs.existsSync('.git')) {
  console.log('.git directory missing. Initializing new git repo...');
  execSync('git init');
}

try {
  execSync('git remote set-url origin https://github.com/brorb/710-wiki.git');
} catch (e) {
  try {
      execSync('git remote add origin https://github.com/brorb/710-wiki.git');
  } catch (err) {}
}

const branch = process.env.RAILWAY_GIT_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || process.env.CF_PAGES_BRANCH || 'main';

console.log(`Fetching full history from origin for branch: ${branch}...`);
try {
  execSync(`git fetch origin ${branch} --unshallow`, { stdio: 'ignore' });
} catch (e) {
  try {
    execSync(`git fetch origin ${branch}`, { stdio: 'ignore' });
  } catch (err) {
    console.log('Git fetch failed, continuing anyway...');
  }
}

try {
  execSync('git reset --mixed FETCH_HEAD', { stdio: 'ignore' });
} catch (e) {}

console.log('Git hydration complete!');
