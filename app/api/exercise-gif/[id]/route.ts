import { NextResponse } from 'next/server';

const BASE_URL = 'https://exercisedb.p.rapidapi.com';
const API_HOST = 'exercisedb.p.rapidapi.com';

/**
 * Streams a real exercise GIF from ExerciseDB (RapidAPI) through our own
 * server, keyed by their exercise id. The API key stays server-only — never
 * shipped to the browser — which is also what keeps this within their
 * terms: exercises are displayed live, in-app, never bulk-downloaded and
 * re-hosted as our own asset library.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const apiKey = process.env.EXERCISEDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Exercise GIFs are not configured.' }, { status: 503 });
  }

  const upstream = await fetch(
    `${BASE_URL}/image?exerciseId=${encodeURIComponent(params.id)}&resolution=360`,
    {
      headers: { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': API_HOST },
      next: { revalidate: 3600 },
    },
  );

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: 'GIF not found.' }, { status: 404 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'image/gif',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
