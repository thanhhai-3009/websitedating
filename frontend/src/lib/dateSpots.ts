import { Music, Wine, Coffee, UtensilsCrossed, TreePine, Palette } from "lucide-react";

export const spots = [
  { id: 1, name: "Sunset Rooftop Lounge", category: "Bar & Lounge", icon: Wine, location: "Downtown, 5th Avenue", description: "A stunning rooftop bar with panoramic city views.", cost: "$$$", rating: 4.8, reviews: 234, image: "🌇", tags: ["Romantic","Scenic","Cocktails"], hours: "5 PM – 12 AM", liked: false },
  { id: 2, name: "The Cozy Bean Café", category: "Coffee & Café", icon: Coffee, location: "Midtown, Oak Street", description: "Warm, intimate café with artisan coffee.", cost: "$", rating: 4.6, reviews: 189, image: "☕", tags: ["Casual","Cozy","Coffee"], hours: "7 AM – 9 PM", liked: true },
  { id: 3, name: "Bella Italia Trattoria", category: "Restaurant", icon: UtensilsCrossed, location: "Little Italy, Vine Road", description: "Authentic Italian dining with candlelit tables.", cost: "$$", rating: 4.7, reviews: 312, image: "🍝", tags: ["Italian","Fine Dining","Live Music"], hours: "11 AM – 11 PM", liked: false },
  { id: 4, name: "Botanical Gardens Walk", category: "Outdoor", icon: TreePine, location: "Westside Park", description: "Beautiful botanical gardens with walking trails.", cost: "$", rating: 4.9, reviews: 567, image: "🌸", tags: ["Nature","Walking","Free-ish"], hours: "6 AM – 8 PM", liked: false },
  { id: 5, name: "Jazz & Blues Corner", category: "Entertainment", icon: Music, location: "Arts District", description: "Intimate jazz club with craft cocktails.", cost: "$$", rating: 4.5, reviews: 198, image: "🎷", tags: ["Music","Nightlife","Cocktails"], hours: "7 PM – 2 AM", liked: true },
  { id: 6, name: "Art & Sip Studio", category: "Activities", icon: Palette, location: "Creative Quarter", description: "Paint together while enjoying wine!", cost: "$$", rating: 4.7, reviews: 145, image: "🎨", tags: ["Creative","Fun","Wine"], hours: "10 AM – 10 PM", liked: false },
];

export function costToEstimate(cost: string) {
  switch (cost) {
    case "$": return { min: 100000, max: 200000 };
    case "$$": return { min: 300000, max: 600000 };
    case "$$$": return { min: 700000, max: 1500000 };
    default: return { min: 0, max: 0 };
  }
}
