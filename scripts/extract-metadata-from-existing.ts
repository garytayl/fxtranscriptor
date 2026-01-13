/**
 * Batch extract metadata from existing transcripts
 * 
 * This script extracts [SERIES], [SPEAKER], and [SUMMARY] metadata from existing
 * transcripts and updates the database. Run this after adding the series/speaker
 * columns to extract metadata from sermons that already have transcripts.
 * 
 * Usage:
 *   npm run extract-metadata
 * 
 * Or directly:
 *   npx tsx scripts/extract-metadata-from-existing.ts
 */

// Load environment variables from .env.local
import dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { extractMetadata } from '../lib/extractMetadata';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function extractMetadataFromExisting() {
  console.log('🔍 Fetching sermons with transcripts...\n');

  // Get all sermons that have transcripts OR descriptions (metadata might be in either)
  const { data: sermons, error } = await supabase
    .from('sermons')
    .select('id, title, transcript, description, series, speaker')
    .or('transcript.not.is.null,description.not.is.null');

  if (error) {
    console.error('❌ Error fetching sermons:', error);
    process.exit(1);
  }

  if (!sermons || sermons.length === 0) {
    console.log('✅ No sermons with transcripts found.');
    return;
  }

  console.log(`📚 Found ${sermons.length} sermons with transcripts\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const sermon of sermons) {
    try {
      // Extract metadata from both transcript and description (metadata might be in either)
      const transcriptMetadata = extractMetadata(sermon.transcript);
      const descriptionMetadata = extractMetadata(sermon.description);
      
      // Combine metadata (description takes precedence if both exist)
      const metadata = {
        series: descriptionMetadata.series || transcriptMetadata.series || null,
        speaker: descriptionMetadata.speaker || transcriptMetadata.speaker || null,
        summary: descriptionMetadata.summary || transcriptMetadata.summary || null,
      };

      // Debug: Show what we found
      if (metadata.series || metadata.speaker) {
        console.log(`\n🔍 Checking "${sermon.title.substring(0, 50)}..."`);
        if (transcriptMetadata.series || transcriptMetadata.speaker) {
          console.log(`   Found in transcript: ${transcriptMetadata.series ? `Series: ${transcriptMetadata.series}` : ''} ${transcriptMetadata.speaker ? `Speaker: ${transcriptMetadata.speaker}` : ''}`);
        }
        if (descriptionMetadata.series || descriptionMetadata.speaker) {
          console.log(`   Found in description: ${descriptionMetadata.series ? `Series: ${descriptionMetadata.series}` : ''} ${descriptionMetadata.speaker ? `Speaker: ${descriptionMetadata.speaker}` : ''}`);
        }
      }

      // Check if we need to update (only if metadata was found and differs from current)
      const needsUpdate = 
        (metadata.series && metadata.series !== sermon.series) ||
        (metadata.speaker && metadata.speaker !== sermon.speaker);

      if (!needsUpdate) {
        if (metadata.series || metadata.speaker) {
          console.log(`⏭️  Skipping "${sermon.title.substring(0, 50)}..." - already has metadata`);
        } else {
          // Show a sample of the text to help debug
          const sampleText = (sermon.description || sermon.transcript || '').substring(0, 200);
          if (sampleText.includes('[SERIES]') || sampleText.includes('[SPEAKER]')) {
            console.log(`⚠️  "${sermon.title.substring(0, 50)}..." - Found tags but couldn't parse. Sample: ${sampleText}`);
          } else {
            console.log(`⏭️  Skipping "${sermon.title.substring(0, 50)}..." - no metadata tags found`);
          }
        }
        skipped++;
        continue;
      }

      // Update sermon with extracted metadata
      const { error: updateError } = await supabase
        .from('sermons')
        .update({
          series: metadata.series || sermon.series, // Preserve existing if no new metadata
          speaker: metadata.speaker || sermon.speaker,
        })
        .eq('id', sermon.id);

      if (updateError) {
        console.error(`❌ Error updating "${sermon.title.substring(0, 50)}...":`, updateError.message);
        errors++;
        continue;
      }

      const updates = [];
      if (metadata.series) updates.push(`Series: ${metadata.series}`);
      if (metadata.speaker) updates.push(`Speaker: ${metadata.speaker}`);

      console.log(`✅ Updated "${sermon.title.substring(0, 50)}..." - ${updates.join(', ')}`);
      updated++;
    } catch (error) {
      console.error(`❌ Error processing "${sermon.title.substring(0, 50)}...":`, error);
      errors++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`   📚 Total: ${sermons.length}\n`);

  if (updated > 0) {
    console.log('🎉 Metadata extraction complete! Sermons should now be organized into series.');
  }
}

extractMetadataFromExisting()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
