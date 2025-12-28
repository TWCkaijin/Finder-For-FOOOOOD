
export interface Restaurant {
  id: string;
  name: string;
  address: string;
  rating: number;
  priceLevel: string; // "$ (平價)", "$$ (稍貴)", "$$$ (昂貴)", "~ (天價)", "- (無資訊)"
  tags: string[];
  description: string;
  recommendedDishes: string[]; // New field for menu recommendations
  distance?: string; // e.g. "500m"
  isOpen?: boolean;
  lat?: number;
  lng?: number;
}

export type SearchMode = 'list' | 'random';
export type Language = 'zh-TW' | 'en' | 'ja';

export interface RestaurantRating {
  restaurantId: string;
  name: string;
  rating: number; // 1-5
  comment?: string;
  timestamp: number;
}

export interface UserPreferences {
  language?: Language;
  defaultModel?: string;
  blacklist?: string[];
  ratings?: { [restaurantId: string]: RestaurantRating };
  pendingReviews?: { id: string; name: string; timestamp: number }[];
  devMode?: boolean;
}

export interface SearchParams {
  location: string;
  keywords: string;
  mode: SearchMode;
  radius: string;
  model: string; // New: Selected Gemini Model
  language: Language; // New: Selected Language
  userLat?: number;
  userLng?: number;
  excludedNames?: string[];
}

export interface AppState {
  view: 'input' | 'result' | 'settings';
  lastView?: 'input' | 'result';
  loading: boolean;
  loadingMessage: string;
  loadingError: string | null; // New: Specific error state for the overlay
  error: string | null;
  params: SearchParams;
  allRestaurants: Restaurant[];
  shownRestaurantIds: Set<string>;
  displayedRestaurants: Restaurant[];
  isBackgroundFetching: boolean;
  isDeveloperMode: boolean;
  streamOutput: string;
  isFinishing?: boolean;
  pendingResults?: Restaurant[];
  isLogoutTransition?: boolean;
  language?: Language;
}
