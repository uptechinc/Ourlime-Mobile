import { Redirect, type Href } from 'expo-router';

/** The website's /games/triniGeoGuesser redirects to the game hub. */
export default function GamesTriniGeoGuesserRedirect() {
  return <Redirect href={'/triniGeoGuesser' as Href} />;
}
