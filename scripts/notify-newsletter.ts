#!/usr/bin/env tsx

/**
 * Script to notify newsletter subscribers about new content
 * 
 * Usage:
 *   npm run notify-newsletter -- --type guide --slug "uk-study-guide" --title "UK Study Guide" --url "https://glowbal.com/guides/uk-study-guide"
 *   npm run notify-newsletter -- --type news --slug "new-scholarships" --title "New Scholarships Available" --url "https://glowbal.com/news/new-scholarships"
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const notifySecret = process.env.NEWSLETTER_NOTIFY_SECRET || 'dev-secret';
const apiUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

interface Args {
  type: 'guide' | 'news';
  slug: string;
  title: string;
  url: string;
  excerpt?: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  const parsed: Partial<Args> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];
    
    if (key && value) {
      parsed[key as keyof Args] = value;
    }
  }

  if (!parsed.type || !parsed.slug || !parsed.title || !parsed.url) {
    console.error('Missing required arguments');
    console.log('Usage: npm run notify-newsletter -- --type <guide|news> --slug <slug> --title <title> --url <url> [--excerpt <excerpt>]');
    process.exit(1);
  }

  if (parsed.type !== 'guide' && parsed.type !== 'news') {
    console.error('Type must be either "guide" or "news"');
    process.exit(1);
  }

  return parsed as Args;
}

async function main() {
  const args = parseArgs();

  console.log('📧 Notifying newsletter subscribers...');
  console.log(`   Type: ${args.type}`);
  console.log(`   Slug: ${args.slug}`);
  console.log(`   Title: ${args.title}`);
  console.log(`   URL: ${args.url}`);

  try {
    const response = await fetch(`${apiUrl}/api/newsletter/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${notifySecret}`,
      },
      body: JSON.stringify({
        contentType: args.type,
        contentSlug: args.slug,
        contentTitle: args.title,
        contentUrl: args.url,
        contentExcerpt: args.excerpt,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('❌ Failed to send newsletter:', data.error);
      process.exit(1);
    }

    if (data.skipped) {
      console.log('⏭️  Newsletter already sent for this content');
    } else {
      console.log('✅ Newsletter sent successfully!');
      console.log(`   Total subscribers: ${data.totalSubscribers}`);
      console.log(`   Successfully sent: ${data.successCount}`);
      if (data.failedCount > 0) {
        console.log(`   Failed: ${data.failedCount}`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
