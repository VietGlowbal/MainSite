import { NextRequest, NextResponse } from 'next/server';

/**
 * Google Reviews API route
 * 
 * Fetches reviews for a university using Google Places API.
 * 
 * Flow:
 *   1. Text Search to find the place_id for the university
 *   2. Place Details to get reviews
 * 
 * Activates when GOOGLE_PLACES_API_KEY is set; falls back gracefully otherwise.
 * 
 * Usage: GET /api/google-reviews?name=Harvard+University&location=Cambridge,+MA
 */

interface PlaceSearchResult {
  place_id: string;
  name: string;
  formatted_address: string;
}

interface PlaceReview {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  relative_time_description: string;
  profile_photo_url?: string;
}

interface PlaceDetailsResult {
  name: string;
  rating?: number;
  user_ratings_total?: number;
  reviews?: PlaceReview[];
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  // Graceful fallback when API key is not configured
  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        message: 'Google Places API key not configured',
        reviews: [],
        fallback: true,
      },
      { status: 200 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const name = searchParams.get('name');
  const location = searchParams.get('location');

  if (!name) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameter: name' },
      { status: 400 }
    );
  }

  try {
    // Step 1: Text Search to find the place_id
    const query = location ? `${name} ${location}` : name;
    const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
    searchUrl.searchParams.set('query', query);
    searchUrl.searchParams.set('type', 'university');
    searchUrl.searchParams.set('key', apiKey);

    const searchResponse = await fetch(searchUrl.toString());
    const searchData = await searchResponse.json();

    if (searchData.status !== 'OK' || !searchData.results?.length) {
      return NextResponse.json(
        {
          success: false,
          message: 'University not found in Google Places',
          reviews: [],
          fallback: true,
        },
        { status: 200 }
      );
    }

    const place: PlaceSearchResult = searchData.results[0];

    // Step 2: Place Details to get reviews
    const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    detailsUrl.searchParams.set('place_id', place.place_id);
    detailsUrl.searchParams.set('fields', 'name,rating,user_ratings_total,reviews');
    detailsUrl.searchParams.set('key', apiKey);

    const detailsResponse = await fetch(detailsUrl.toString());
    const detailsData = await detailsResponse.json();

    if (detailsData.status !== 'OK') {
      return NextResponse.json(
        {
          success: false,
          message: 'Could not fetch place details',
          reviews: [],
          fallback: true,
        },
        { status: 200 }
      );
    }

    const details: PlaceDetailsResult = detailsData.result;

    return NextResponse.json({
      success: true,
      place_id: place.place_id,
      name: details.name,
      rating: details.rating,
      total_ratings: details.user_ratings_total,
      reviews: details.reviews || [],
      fallback: false,
    });
  } catch (error) {
    console.error('Google Places API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch reviews',
        reviews: [],
        fallback: true,
      },
      { status: 200 }
    );
  }
}
