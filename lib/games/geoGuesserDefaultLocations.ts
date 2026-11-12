import type { GeoDifficulty, GeoLocation } from '@/lib/services/GeoGuesserService';

// The website's curated places (lib/trini-GeoGuesser/defaultLocations.ts), played when a level has no locations in Firestore.
export const DEFAULT_LOCATIONS: Record<GeoDifficulty, GeoLocation[]> = {
  easy: [
    {
      id: 'maracas-bay',
      name: 'Maracas Beach',
      info: 'World-famous crescent-shaped beach surrounded by the lush Northern Range rainforest, renowned for its big surf and iconic Richard’s Bake & Shark.',
      hint: 'Famous for Bake & Shark along the North Coast.',
      imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      coordinates: {
        lat: 10.7606,
        lng: -61.4395,
      },
    },
    {
      id: 'queens-park-savannah',
      name: "Queen's Park Savannah",
      info: 'The world’s largest traffic roundabout spanning 260 acres in Port of Spain, bordered by the Magnificent Seven colonial mansions, Emperor Valley Zoo, and the Botanical Gardens.',
      hint: 'The iconic circular park in the heart of the capital city.',
      imageUrl: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=1200&q=80',
      coordinates: {
        lat: 10.669,
        lng: -61.5173,
      },
    },
    {
      id: 'pigeon-point',
      name: 'Pigeon Point Heritage Park',
      info: 'Tobago’s signature white-sand coastal reserve, world-famous for its turquoise shallows, coconut palm groves, and picturesque thatched-roof jetty.',
      hint: 'Tobago’s most photographed beach with the iconic thatched jetty.',
      imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=1200&q=80',
      coordinates: {
        lat: 11.1607,
        lng: -60.8407,
      },
    },
    {
      id: 'pitch-lake',
      name: 'Pitch Lake, La Brea',
      info: 'The largest natural commercial asphalt deposit in the world covering over 100 acres, affectionately considered by locals as the Eighth Wonder of the World.',
      hint: 'A geological asphalt wonder located in southwestern Trinidad.',
      imageUrl: 'https://images.unsplash.com/photo-1518457607834-6e8d80c183c5?auto=format&fit=crop&w=1200&q=80',
      coordinates: {
        lat: 10.2372,
        lng: -61.6289,
      },
    },
    {
      id: 'temple-in-the-sea',
      name: 'Temple in the Sea, Waterloo',
      info: 'A testament to devotion built stone-by-stone into the Gulf of Paria by Siewdass Sadhu over 25 years after colonial authorities demolished his first structure.',
      hint: 'Built offshore into the Gulf of Paria at Waterloo.',
      imageUrl: 'https://images.unsplash.com/photo-1548625361-195f2d79d6c7?auto=format&fit=crop&w=1200&q=80',
      coordinates: {
        lat: 10.4735,
        lng: -61.4727,
      },
    },
  ],
  medium: [
    {
      id: 'mount-st-benedict',
      name: 'Mount Saint Benedict Abbey',
      info: 'Historic Benedictine monastery established in 1912 high in the Northern Range overlooking the Caroni Plains, celebrated for tranquility, Pax tea, and yogurt.',
      hint: 'Monastery nestled in the hills above St. Augustine and Tunapuna.',
      imageUrl: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&w=1200&q=80',
      coordinates: {
        lat: 10.6617,
        lng: -61.3976,
      },
    },
    {
      id: 'caroni-bird-sanctuary',
      name: 'Caroni Bird Sanctuary',
      info: 'Vast 12,000-acre estuarine mangrove swamp where thousands of vivid Scarlet Ibises — Trinidad’s national bird — roost each evening at dusk.',
      hint: 'Home to thousands of Scarlet Ibises in central Trinidad wetlands.',
      imageUrl: 'https://images.unsplash.com/photo-1444464666168-49d633b86797?auto=format&fit=crop&w=1200&q=80',
      coordinates: {
        lat: 10.5936,
        lng: -61.4589,
      },
    },
    {
      id: 'fort-george',
      name: 'Fort George, St. James',
      info: 'Built in 1804 by Governor Sir Thomas Hislop, this historic hilltop fortification provides breathtaking panoramic vistas across Port of Spain and the Gulf of Paria.',
      hint: 'Elevated historic lookout with cannons overlooking the Gulf of Paria.',
      imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
      coordinates: {
        lat: 10.6811,
        lng: -61.5367,
      },
    },
    {
      id: 'san-fernando-hill',
      name: 'San Fernando Hill',
      info: 'A prominent 192-meter limestone hill standing prominently above Trinidad’s southern capital, offering recreational trails and sweeping views across the southern plains.',
      hint: 'Iconic limestone hill rising over the industrial southern capital.',
      imageUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
      coordinates: {
        lat: 10.2798,
        lng: -61.4583,
      },
    },
    {
      id: 'asa-wright',
      name: 'Asa Wright Nature Centre',
      info: 'A world-famous nature reserve and bird sanctuary nestled high in the Arima Valley, home to hummingbirds, bellbirds, toucans, and the rare nocturnal oilbird.',
      hint: 'Premier bird sanctuary deep inside the Arima Valley rainforest.',
      imageUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
      coordinates: {
        lat: 10.7169,
        lng: -61.2989,
      },
    },
  ],
  hard: [
    {
      id: 'argyle-waterfall',
      name: 'Argyle Waterfall, Tobago',
      info: 'Tobago’s highest and most spectacular waterfall, tumbling 54 meters down three cascading tiers of deep mountain stone into cool natural swimming basins.',
      hint: 'Tobago’s highest multi-tiered waterfall on the windward coast.',
      imageUrl: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=1200&q=80',
      coordinates: {
        lat: 11.2536,
        lng: -60.5847,
      },
    },
    {
      id: 'gasparee-caves',
      name: 'Gasparee Caves',
      info: 'Dramatic subterranean cave system on Gaspar Grande Island featuring stalactites, stalagmites, and a crystal-clear blue tidal pool 100 feet below ground level.',
      hint: 'Underground limestone sea caves situated on an offshore island near Chaguaramas.',
      imageUrl: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1200&q=80',
      coordinates: {
        lat: 10.6672,
        lng: -61.6567,
      },
    },
    {
      id: 'toco-lighthouse',
      name: 'Toco Lighthouse (Galera Point)',
      info: 'Positioned at the remote northeastern tip of Trinidad where the turbulent Caribbean Sea meets the mighty Atlantic Ocean, constructed in 1897.',
      hint: 'Lighthouse at the northeastern extremity where two bodies of water meet.',
      imageUrl: 'https://images.unsplash.com/photo-1507034589631-9433cc6bc453?auto=format&fit=crop&w=1200&q=80',
      coordinates: {
        lat: 10.8358,
        lng: -60.9094,
      },
    },
    {
      id: 'avocat-waterfall',
      name: 'Avocat Waterfall (Blanchisseuse)',
      info: 'A stunning 50-foot waterfall tucked into the pristine rainforest of the Blanchisseuse valley, feeding directly into the emerald pools of the Marianne River.',
      hint: 'Secluded North Coast waterfall along the Blanchisseuse trail.',
      imageUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1200&q=80',
      coordinates: {
        lat: 10.7686,
        lng: -61.3094,
      },
    },
    {
      id: 'manzanilla-cocal',
      name: 'Manzanilla Beach & Cocal',
      info: 'A dramatic 17-mile stretch of wild Atlantic coastline fringed by tens of thousands of coconut palms planted after an 18th-century shipwreck.',
      hint: 'Long coconut-lined coastal highway and beach on Trinidad’s east coast.',
      imageUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
      coordinates: {
        lat: 10.4856,
        lng: -61.0369,
      },
    },
  ],
};
