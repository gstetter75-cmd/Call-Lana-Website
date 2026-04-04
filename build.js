#!/usr/bin/env node
// ==========================================
// Call Lana Build Script — esbuild bundler
// Usage: node build.js [--watch]
// ==========================================

const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

// Define bundles: one per protected page
// Each bundle concatenates its page's JS files in load order
const bundles = {
  'dist/dashboard.bundle.js': [
    'js/impersonation.js',
    'js/modal.js',
    'js/error-handler.js',
    'js/logger.js',
    'js/supabase-init.js',
    'js/auth.js',
    'js/db/calls.js',
    'js/db/assistants.js',
    'js/db/profiles.js',
    'js/db/leads.js',
    'js/db/messaging.js',
    'js/db/customers.js',
    'js/db/tools.js',
    'js/db.js',
    'js/auth-guard.js',
    'js/pricing-data.js',
    'js/config.js',
    'js/dashboard-components.js',
    'js/dashboard.js',
    'js/dashboard-home-data.js',
    'js/dashboard-team.js',
    'js/dashboard-billing.js',
    'js/dashboard-integrations.js',
    'js/dashboard-payment.js',
    'js/onboarding.js',
    'js/notifications.js',
    'js/dashboard-extras.js',
    'js/dashboard-analytics.js',
    'js/dashboard-home-widgets.js',
    'js/appointments.js',
    'js/analytics-page.js',
    'js/realtime.js',
    'js/global-search.js',
    'js/keyboard-shortcuts.js',
    'js/invoices.js',
    'js/theme-toggle.js',
    'js/idle-timeout.js',
  ],
  'dist/admin.bundle.js': [
    'js/impersonation.js',
    'js/modal.js',
    'js/error-handler.js',
    'js/logger.js',
    'js/supabase-init.js',
    'js/auth.js',
    'js/db/calls.js',
    'js/db/assistants.js',
    'js/db/profiles.js',
    'js/db/leads.js',
    'js/db/messaging.js',
    'js/db/customers.js',
    'js/db/tools.js',
    'js/db.js',
    'js/auth-guard.js',
    'js/pricing-data.js',
    'js/config.js',
    'js/dashboard-components.js',
    'js/admin-analytics.js',
    'js/admin-overview.js',
    'js/admin-audit.js',
    'js/admin-pdf-export.js',
    'js/admin-health.js',
    'js/admin-extra.js',
    'js/global-search.js',
    'js/keyboard-shortcuts.js',
    'js/admin.js',
    'js/theme-toggle.js',
    'js/idle-timeout.js',
  ],
  'dist/sales.bundle.js': [
    'js/impersonation.js',
    'js/modal.js',
    'js/error-handler.js',
    'js/logger.js',
    'js/supabase-init.js',
    'js/auth.js',
    'js/db/calls.js',
    'js/db/assistants.js',
    'js/db/profiles.js',
    'js/db/leads.js',
    'js/db/messaging.js',
    'js/db/customers.js',
    'js/db/tools.js',
    'js/db.js',
    'js/auth-guard.js',
    'js/pricing-data.js',
    'js/config.js',
    'js/dashboard-components.js',
    'js/notifications.js',
    'js/global-search.js',
    'js/keyboard-shortcuts.js',
    'js/sales.js',
    'js/theme-toggle.js',
    'js/idle-timeout.js',
  ],
  'dist/settings.bundle.js': [
    'js/impersonation.js',
    'js/modal.js',
    'js/error-handler.js',
    'js/logger.js',
    'js/supabase-init.js',
    'js/auth.js',
    'js/db/calls.js',
    'js/db/assistants.js',
    'js/db/profiles.js',
    'js/db/leads.js',
    'js/db/messaging.js',
    'js/db/customers.js',
    'js/db/tools.js',
    'js/db.js',
    'js/auth-guard.js',
    'js/pricing-data.js',
    'js/config.js',
    'js/dashboard-components.js',
    'js/settings.js',
    'js/settings-extra.js',
    'js/theme-toggle.js',
    'js/idle-timeout.js',
  ],
};

// Create dist directory
if (!fs.existsSync('dist')) fs.mkdirSync('dist');

async function build() {
  const startTime = Date.now();
  let totalSize = 0;

  for (const [output, inputs] of Object.entries(bundles)) {
    // Filter to only existing files
    const existingInputs = inputs.filter(f => {
      if (fs.existsSync(f)) return true;
      console.warn(`  ⚠ Skipping missing file: ${f}`);
      return false;
    });

    // Concatenate files (since they use global scope, not modules)
    const combined = existingInputs.map(f => {
      return `// --- ${f} ---\n${fs.readFileSync(f, 'utf8')}`;
    }).join('\n\n');

    const tempFile = output.replace('.bundle.js', '.entry.js');
    fs.writeFileSync(tempFile, combined);

    try {
      const result = await esbuild.build({
        entryPoints: [tempFile],
        bundle: false, // already concatenated
        minify: true,
        sourcemap: true,
        outfile: output,
        target: ['es2020'],
        charset: 'utf8',
      });

      const size = fs.statSync(output).size;
      totalSize += size;
      console.log(`  ✓ ${output} (${(size / 1024).toFixed(1)} KB)`);
    } finally {
      // Clean up temp entry file
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  }

  console.log(`\n  Total: ${(totalSize / 1024).toFixed(1)} KB in ${Date.now() - startTime}ms`);
}

console.log('Building Call Lana bundles...\n');
build().then(() => {
  console.log('\n  Done! Bundles are in dist/');
  if (isWatch) {
    console.log('  Watching for changes...');
    // Simple watch: rebuild on any js/ change
    fs.watch('js', { recursive: true }, () => {
      console.log('\n  Rebuilding...');
      build().catch(console.error);
    });
  }
}).catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
