import { NextRequest, NextResponse } from 'next/server';

/**
 * City Images API route
 * 
 * Fetches multiple distinct photos of a city from Wikipedia/Wikimedia Commons.
 * No API key required — uses the same source as our university imagery.
 * 
 * Returns multiple distinct photos (typically 3-5) suitable for a gallery view.
 * 
 * Usage: GET /api/city-images?city=Cambridge&country=United+Kingdom
 * 
 * FUTURE: To swap to Google Places Photos API later, uncomment the Google
 * implementation below and add GOOGLE_PLACES_API_KEY to your .env
 */

interface WikimediaImage {
  url: string;
  title: string;
  width: number;
  height: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const city = searchParams.get('city');
  const country = searchParams.get('country');

  if (!city) {
    return NextResponse.json(
      { success: false, error: 'Missing required parameter: city' },
      { status: 400 }
    );
  }

  try {
    // Build search query — prefer "City, Country" format for better results
    const query = country ? `${city}, ${country}` : city;

    // Step 1: Search Wikipedia for the city article
    const searchUrl = new URL('https://en.wikipedia.org/w/api.php');
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('list', 'search');
    searchUrl.searchParams.set('srsearch', query);
    searchUrl.searchParams.set('srlimit', '1');
    searchUrl.searchParams.set('origin', '*');

    const searchResponse = await fetch(searchUrl.toString());
    const searchData = await searchResponse.json();

    if (!searchData.query?.search?.length) {
      return NextResponse.json({
        success: false,
        message: 'City not found on Wikipedia',
        images: [],
      });
    }

    const pageTitle = searchData.query.search[0].title;

    // Step 2: Get images from the Wikipedia page
    const imagesUrl = new URL('https://en.wikipedia.org/w/api.php');
    imagesUrl.searchParams.set('action', 'query');
    imagesUrl.searchParams.set('format', 'json');
    imagesUrl.searchParams.set('titles', pageTitle);
    imagesUrl.searchParams.set('prop', 'images');
    imagesUrl.searchParams.set('imlimit', '50'); // Get more to filter from
    imagesUrl.searchParams.set('origin', '*');

    const imagesResponse = await fetch(imagesUrl.toString());
    const imagesData = await imagesResponse.json();

    const pages = imagesData.query?.pages;
    if (!pages) {
      return NextResponse.json({
        success: false,
        message: 'No images found',
        images: [],
      });
    }

    const page = Object.values(pages)[0] as any;
    const imageFiles = page.images || [];

    // Filter for likely city/landscape photos (exclude logos, flags, maps, icons)
    const photoFiles = imageFiles.filter((img: any) => {
      const title = img.title.toLowerCase();
      return (
        (title.includes('.jpg') || title.includes('.jpeg') || title.includes('.png')) &&
        !title.includes('logo') &&
        !title.includes('flag') &&
        !title.includes('coat') &&
        !title.includes('map') &&
        !title.includes('icon') &&
        !title.includes('seal') &&
        !title.includes('emblem')
      );
    });

    // Step 3: Get image URLs for the filtered photos (limit to 5)
    const imagePromises = photoFiles.slice(0, 5).map(async (img: any) => {
      const infoUrl = new URL('https://en.wikipedia.org/w/api.php');
      infoUrl.searchParams.set('action', 'query');
      infoUrl.searchParams.set('format', 'json');
      infoUrl.searchParams.set('titles', img.title);
      infoUrl.searchParams.set('prop', 'imageinfo');
      infoUrl.searchParams.set('iiprop', 'url|size');
      infoUrl.searchParams.set('origin', '*');

      const infoResponse = await fetch(infoUrl.toString());
      const infoData = await infoResponse.json();

      const infoPages = infoData.query?.pages;
      if (!infoPages) return null;

      const infoPage = Object.values(infoPages)[0] as any;
      const imageInfo = infoPage.imageinfo?.[0];

      if (!imageInfo) return null;

      return {
        url: imageInfo.url,
        title: img.title.replace('File:', ''),
        width: imageInfo.width,
        height: imageInfo.height,
      };
    });

    const images = (await Promise.all(imagePromises)).filter(
      (img): img is WikimediaImage => img !== null
    );

    return NextResponse.json({
      success: true,
      city: pageTitle,
      images,
      count: images.length,
    });
  } catch (error) {
    console.error('City images API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch city images',
        images: [],
      },
      { status: 500 }
    );
  }
}

/* ─────────────────────────────────────────────────────────────────────────
   GOOGLE PLACES PHOTOS IMPLEMENTATION (for future use)
   ────────────────────────────────────────────────────────────────────────
   
   To swap to Google Places Photos API:
   
   1. Add GOOGLE_PLACES_API_KEY to your .env
   2. Replace the Wikipedia implementation above with this code:
   
   ```typescript
   export async function GET(request: NextRequest) {
     const apiKey = process.env.GOOGLE_PLACES_API_KEY;
     
     if (!apiKey) {
       return NextResponse.json({
         success: false,
         error: 'Google Places API key not configured',
         images: [],
       }, { status: 500 });
     }
     
     const searchParams = request.nextUrl.searchParams;
     const city = searchParams.get('city');
     const country = searchParams.get('country');
     
     if (!city) {
       return NextResponse.json({
         success: false,
         error: 'Missing required parameter: city',
       }, { status: 400 });
     }
     
     try {
       // Step 1: Text Search to find the place_id
       const query = country ? `${city}, ${country}` : city;
       const searchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
       searchUrl.searchParams.set('query', query);
       searchUrl.searchParams.set('type', 'locality');
       searchUrl.searchParams.set('key', apiKey);
       
       const searchResponse = await fetch(searchUrl.toString());
       const searchData = await searchResponse.json();
       
       if (searchData.status !== 'OK' || !searchData.results?.length) {
         return NextResponse.json({
           success: false,
           message: 'City not found',
           images: [],
         });
       }
       
       const place = searchData.results[0];
       
       // Step 2: Place Details to get photos
       const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
       detailsUrl.searchParams.set('place_id', place.place_id);
       detailsUrl.searchParams.set('fields', 'name,photos');
       detailsUrl.searchParams.set('key', apiKey);
       
       const detailsResponse = await fetch(detailsUrl.toString());
       const detailsData = await detailsResponse.json();
       
       if (detailsData.status !== 'OK') {
         return NextResponse.json({
           success: false,
           message: 'Could not fetch place details',
           images: [],
         });
       }
       
       const photos = detailsData.result.photos || [];
       
       // Step 3: Build photo URLs (limit to 5)
       const images = photos.slice(0, 5).map((photo: any) => ({
         url: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${photo.photo_reference}&key=${apiKey}`,
         width: photo.width,
         height: photo.height,
       }));
       
       return NextResponse.json({
         success: true,
         city: detailsData.result.name,
         images,
         count: images.length,
       });
     } catch (error) {
       console.error('Google Places Photos API error:', error);
       return NextResponse.json({
         success: false,
         error: 'Failed to fetch city images',
         images: [],
       }, { status: 500 });
     }
   }
   ```
───────────────────────────────────────────────────────────────────────── */
