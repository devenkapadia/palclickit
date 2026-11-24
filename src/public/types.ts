export interface SiteData {
  settings: Record<string, string>;
  packages: { id: number; code: string; name: string; price: number; duration_hours: number; tagline: string | null; features: string[]; highlighted: boolean; cta_label: string | null }[];
  faqs: { id: number; question: string; answer: string }[];
  eventCards: { id: number; title: string; description: string | null; image_url: string | null }[];
  gallery: { categories: string[]; images: { id: number; title: string | null; category: string; url: string }[] };
  social: { id: number; kind: 'reel' | 'post' | 'video'; code: string | null; video_url: string | null; caption: string | null }[];
}
