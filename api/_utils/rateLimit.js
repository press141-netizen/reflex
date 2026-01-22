// Simple in-memory rate limiter for serverless functions
// Note: In production, consider using Redis or a dedicated rate limiting service

const rateLimitStore = new Map();

// Lazy cleanup: clean expired entries during requests (no setInterval)
function cleanupExpiredEntries() {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
      cleanedCount++;
    }
  }

  // Prevent unbounded growth: if map exceeds 1000 entries, remove oldest
  if (rateLimitStore.size > 1000) {
    const sortedEntries = Array.from(rateLimitStore.entries())
      .sort((a, b) => a[1].resetTime - b[1].resetTime);

    const toRemove = sortedEntries.slice(0, rateLimitStore.size - 1000);
    toRemove.forEach(([key]) => rateLimitStore.delete(key));
  }

  return cleanedCount;
}

/**
 * Rate limit middleware for Vercel serverless functions
 * @param {Object} req - Request object
 * @param {Object} options - Rate limit options
 * @param {number} options.maxRequests - Maximum requests allowed
 * @param {number} options.windowMs - Time window in milliseconds
 * @returns {Object|null} - Returns error response object if rate limited, null if allowed
 */
export function checkRateLimit(req, options = {}) {
  const {
    maxRequests = 10,  // Default: 10 requests
    windowMs = 60 * 60 * 1000  // Default: 1 hour
  } = options;

  // Lazy cleanup: periodically clean expired entries (10% probability)
  if (Math.random() < 0.1) {
    cleanupExpiredEntries();
  }

  // Get client identifier (IP address)
  const identifier =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown';

  const now = Date.now();
  const key = `${identifier}`;

  // Get or create rate limit data for this identifier
  let rateLimitData = rateLimitStore.get(key);

  if (!rateLimitData || now > rateLimitData.resetTime) {
    // Create new rate limit window
    rateLimitData = {
      count: 0,
      resetTime: now + windowMs,
      firstRequestTime: now
    };
    rateLimitStore.set(key, rateLimitData);
  }

  // Increment request count
  rateLimitData.count++;

  // Check if rate limit exceeded
  if (rateLimitData.count > maxRequests) {
    const retryAfter = Math.ceil((rateLimitData.resetTime - now) / 1000);

    return {
      status: 429,
      headers: {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(rateLimitData.resetTime).toISOString()
      },
      body: {
        error: 'Too many requests',
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter
      }
    };
  }

  // Return null if rate limit not exceeded (request is allowed)
  return null;
}

/**
 * Get rate limit headers for response
 * @param {string} identifier - Client identifier (IP)
 * @param {number} maxRequests - Maximum requests allowed
 * @returns {Object} - Rate limit headers
 */
export function getRateLimitHeaders(identifier, maxRequests) {
  const rateLimitData = rateLimitStore.get(identifier);

  if (!rateLimitData) {
    return {
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': maxRequests.toString()
    };
  }

  const remaining = Math.max(0, maxRequests - rateLimitData.count);

  return {
    'X-RateLimit-Limit': maxRequests.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': new Date(rateLimitData.resetTime).toISOString()
  };
}
