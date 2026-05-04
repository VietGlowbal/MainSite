import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { readFile } from 'fs/promises';
import { join } from 'path';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseRank(value: string): number | null {
  if (!value || value === '—' || value === '-') return null;
  const num = parseInt(value.replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? null : num;
}

export async function POST(request: Request) {
  // Simple auth check — require service role key in header
  const authHeader = request.headers.get('authorization');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!authHeader || !serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const csvPath = join(process.cwd(), 'public', 'Universities_Database - Sheet1.csv');
    const csvContent = await readFile(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter((line) => line.trim());

    // Skip the first header row (rank grouping row) and use the second row as headers
    // Row 0: ,,Rank,,,,... (grouping)
    // Row 1: Country,Name,Local Name,Type,...
    const dataLines = lines.slice(2); // skip both header rows

    const supabase = createAdminClient();
    let imported = 0;
    let errors = 0;

    for (const line of dataLines) {
      const cols = parseCSVLine(line);
      if (cols.length < 5 || !cols[0] || !cols[1]) continue;

      const record = {
        country: cols[0] || null,
        name: cols[1] || null,
        local_name: cols[2] || null,
        type: cols[3] || null,
        qs_rank: parseRank(cols[4]),
        the_rank: parseRank(cols[5]),
        arwu_rank: parseRank(cols[6]),
        national_rank: cols[7] || null,
        strengths: cols[8] || null,
        specific_insight: cols[9] || null,
        teaching_style: cols[10] || null,
        international_environment: cols[11] || null,
        gpa_range: cols[12] || null,
        english_requirement: cols[13] || null,
        standardized_test: cols[14] || null,
        special_test: cols[15] || null,
        admission_difficulty: cols[16] || null,
        accept_rate: cols[17] || null,
        application_deadline: cols[18] || null,
        scholarship: cols[19] || null,
        tuition_usd: cols[20] || null,
        living_cost_usd: cols[21] || null,
        housing: cols[22] || null,
        industry_connections: cols[23] || null,
        internship_coop: cols[24] || null,
        employability: cols[25] || null,
        best_for: cols[26] || null,
        weaknesses: cols[27] || null,
        notes: cols[28] || null,
      };

      if (!record.country || !record.name) continue;

      const { error } = await supabase.from('universities').upsert(record, {
        onConflict: 'name',
        ignoreDuplicates: true,
      });

      if (error) {
        console.error(`Error importing ${record.name}:`, error.message);
        errors++;
      } else {
        imported++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      errors,
      total: dataLines.length,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: 'Failed to import universities' },
      { status: 500 },
    );
  }
}
