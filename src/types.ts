export interface ItineraryItem {
  date: string;
  dayOfWeek: string;
  category: "交通" | "住宿" | "活動" | "飲食" | string;
  time: string;
  location: string;
  originalName?: string;
  address?: string;
  phone?: string;
  website?: string;
  googleMaps?: string;
  cost?: string;
  description?: string;
  accommodationMeals?: string;
  heroImage?: string;
  roomType?: string;
}

export interface TripData {
  title: string;
  dateRange: string;
  travelers?: string;
  heroImage?: string;
  weatherWebsite?: string;
  weatherLat?: number;
  weatherLon?: number;
  items: ItineraryItem[];
}
