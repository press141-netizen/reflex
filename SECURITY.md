# Security Policy

## Overview

This document outlines the security measures implemented in the Reflex project and provides guidance for maintaining a secure application.

## Implemented Security Measures

### ✅ 1. Input Validation

All API endpoints now include comprehensive input validation:

#### `/api/analyze.js`
- ✅ Component name: Max 100 characters, sanitized to prevent injection
- ✅ Image dimensions: Range 1-10000 pixels
- ✅ MIME type: Whitelist of allowed image types
- ✅ Context data: Size and format validation

#### `/api/boards.js`
- ✅ Board ID: Sanitized to prevent NoSQL injection (alphanumeric, hyphens, underscores only)
- ✅ Reference data: Size limit of 1MB per reference
- ✅ Total references: Maximum 10,000 references per board

#### `/api/categories.js`
- ✅ Board ID: Sanitized to prevent NoSQL injection
- ✅ Categories data: Size limit of 100KB
- ✅ Structure validation: Must be a valid object

#### `/api/upload.js`
- ✅ Content type: Whitelist of allowed image types
- ✅ File size: Maximum 10MB
- ✅ File extension: Validated against whitelist

### ✅ 2. Rate Limiting

**AI API Endpoint (`/api/analyze.js`):**
- **Limit:** 5 requests per hour per IP address
- **Purpose:** Prevent Anthropic API abuse and cost overruns
- **Headers:** Returns `X-RateLimit-*` and `Retry-After` headers

**Implementation:** In-memory rate limiter in `/api/_utils/rateLimit.js`

### ✅ 3. Dependency Security

**CDN Libraries (Updated in `index.html`):**
- ✅ React: Pinned to version 18.3.1
- ✅ React-DOM: Pinned to version 18.3.1
- ✅ Babel Standalone: Pinned to version 7.26.10 (fixes CVE-2025-27789)
- ✅ All scripts use `crossorigin="anonymous"` attribute

**Status:** Version pinning prevents automatic updates that could introduce breaking changes or vulnerabilities.

### ✅ 4. Error Handling

- ✅ Generic error messages returned to clients (no stack traces or internal details)
- ✅ Detailed errors logged server-side for debugging
- ✅ Prevents information disclosure through error messages

### ✅ 5. Injection Prevention

- ✅ Board IDs sanitized to prevent Redis key injection
- ✅ Component names sanitized before inclusion in generated code
- ✅ User inputs validated before processing

## 🔶 Recommended Additional Measures

### HIGH PRIORITY

#### 1. Add Authentication
**Status:** ⚠️ NOT IMPLEMENTED

Currently, all write operations are publicly accessible. Recommended solutions:

**Option A: API Key Authentication**
```javascript
// Example implementation
const apiKey = req.headers['x-api-key'];
if (apiKey !== process.env.API_SECRET_KEY) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

**Option B: Session-Based Authentication**
- Implement user sessions with cookies
- Add login/logout endpoints
- Protect write operations behind authentication

#### 2. Add Subresource Integrity (SRI) Hashes
**Status:** ⚠️ PARTIALLY IMPLEMENTED (versions pinned, hashes needed)

Generate SRI hashes and add to CDN scripts:

1. Visit https://www.srihash.org/
2. Enter CDN URLs:
   - `https://unpkg.com/react@18.3.1/umd/react.production.min.js`
   - `https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js`
   - `https://unpkg.com/@babel/standalone@7.26.10/babel.min.js`
3. Copy generated `integrity="sha384-..."` attributes
4. Add to script tags in `index.html`

**Example:**
```html
<script
  src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"
  integrity="sha384-[HASH_HERE]"
  crossorigin="anonymous">
</script>
```

#### 3. Restrict CORS Origins
**Status:** ⚠️ OPEN TO ALL ORIGINS

Update all API files to restrict CORS:

```javascript
// Instead of: res.setHeader('Access-Control-Allow-Origin', '*');
const allowedOrigins = [
  'https://yourdomain.com',
  'https://www.yourdomain.com'
];
const origin = req.headers.origin;
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin);
}
```

#### 4. Add Data TTL (Time To Live)
**Status:** ⚠️ NOT IMPLEMENTED

Implement automatic cleanup for old data:

```javascript
// In boards.js and categories.js
await redis(['SET', BOARD_KEY, JSON.stringify(data), 'EX', 60 * 60 * 24 * 30]); // 30 days
```

### MEDIUM PRIORITY

#### 5. Enhanced Rate Limiting
**Current:** In-memory (resets on server restart)
**Recommended:** Use Vercel KV or Redis for persistent rate limiting

#### 6. Request Size Limits
**Status:** ✅ IMPLEMENTED at application level
**Recommended:** Also configure at platform level (Vercel/Netlify)

#### 7. Content Security Policy (CSP)
Add CSP headers to `index.html`:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' https://unpkg.com;
               style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
               font-src https://fonts.gstatic.com;">
```

#### 8. API Usage Monitoring
Set up monitoring for:
- Anthropic API costs
- Rate limit violations
- Failed authentication attempts (once implemented)
- Unusual traffic patterns

## Vulnerability Disclosure

If you discover a security vulnerability, please email [your-email@example.com] instead of opening a public issue.

**Please include:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will respond within 48 hours and work with you to address the issue.

## Security Checklist for Deployment

Before deploying to production:

- [ ] Add authentication to write endpoints (`/api/boards`, `/api/categories`, `/api/upload`)
- [ ] Generate and add SRI hashes to CDN scripts
- [ ] Configure CORS to allow only your domain(s)
- [ ] Set up API usage monitoring and alerts
- [ ] Configure Anthropic API spending limits
- [ ] Add data TTL for Redis keys
- [ ] Test rate limiting functionality
- [ ] Review and update `.env` variables
- [ ] Ensure API keys are properly secured
- [ ] Set up error logging service (e.g., Sentry)

## Environment Variables Security

Required environment variables:
- `ANTHROPIC_API_KEY` - Keep secret, never commit to git
- `KV_REST_API_URL` - Vercel KV URL
- `KV_REST_API_TOKEN` - Vercel KV token (keep secret)
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob token (keep secret)

**Best practices:**
- Never commit `.env` files to version control
- Use different keys for development/staging/production
- Rotate keys periodically
- Use minimum required permissions for each key

## Dependency Management

### Current Dependencies (CDN)
- React 18.3.1
- React-DOM 18.3.1
- Babel Standalone 7.26.10

### Update Process
1. Check for security advisories monthly
2. Test updates in staging environment
3. Update SRI hashes after version changes
4. Document changes in changelog

### Known Vulnerabilities
- ✅ CVE-2025-27789 (Babel): Fixed by updating to 7.26.10
- ✅ React 19 Server Components CVEs: Not applicable (using React 18)

## API Endpoint Security Summary

| Endpoint | Auth | Rate Limit | Input Validation | CORS |
|----------|------|------------|------------------|------|
| `/api/analyze` | ❌ No | ✅ 5/hour | ✅ Yes | ⚠️ Open |
| `/api/boards` | ❌ No | ❌ No | ✅ Yes | ⚠️ Open |
| `/api/categories` | ❌ No | ❌ No | ✅ Yes | ⚠️ Open |
| `/api/upload` | ❌ No | ❌ No | ✅ Yes | ⚠️ Open |
| `/netlify/functions/analyze` | ❌ No | ❌ No | ✅ Yes | ⚠️ Open |

**Legend:**
- ✅ Implemented
- ❌ Not implemented (recommended)
- ⚠️ Needs configuration

## Incident Response Plan

If a security incident occurs:

1. **Immediate Actions:**
   - Disable affected endpoints if possible
   - Rotate compromised API keys
   - Review logs for unauthorized access

2. **Investigation:**
   - Determine scope of breach
   - Identify affected users/data
   - Document timeline of events

3. **Remediation:**
   - Apply security patches
   - Update access controls
   - Monitor for continued attacks

4. **Communication:**
   - Notify affected users
   - Disclose vulnerability responsibly
   - Update security documentation

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Vercel Security Best Practices](https://vercel.com/docs/security)
- [React Security Best Practices](https://www.glorywebs.com/blog/react-security-practices)
- [Anthropic API Security](https://docs.anthropic.com/claude/docs/security)

## Version History

- **v1.1.0** (2026-01-22): Implemented input validation, rate limiting, dependency pinning
- **v1.0.0** (Initial): Basic security measures

---

**Last Updated:** January 22, 2026
