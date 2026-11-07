// In-Memory cache for high-traffic public storefront website configurations

class WebsiteCacheService {
  constructor() {
    this.cache = new Map();
    this.defaultTtl = 5 * 60 * 1000; // 5 minutes
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  set(key, data, ttlMs = this.defaultTtl) {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttlMs,
    });
  }

  invalidate(key) {
    this.cache.delete(key);
  }

  clearAll() {
    this.cache.clear();
  }
}

export const websiteCache = new WebsiteCacheService();

