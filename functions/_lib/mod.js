// Shared rules for public posts: links are held back for review.
export const LINKY = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|ru|xyz|top|io|me|info|biz|link|click|site|online|shop)\b|t\.me\/|bit\.ly)/i;
export const clean = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);
