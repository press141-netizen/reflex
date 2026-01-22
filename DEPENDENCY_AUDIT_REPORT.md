# Dependency Audit Report
**Project:** Reflex - Designer's Reference Archive
**Date:** January 22, 2026
**Auditor:** Claude Code

---

## Executive Summary

This project uses a **minimal dependency approach** with no npm packages, relying on CDN-hosted libraries and serverless functions. While this reduces dependency management overhead, it introduces security and maintenance concerns that need to be addressed.

**Overall Risk Level:** 🟡 **MEDIUM**

### Key Findings:
- ✅ No npm dependencies = No npm supply chain attacks
- ⚠️ CDN dependencies lack Subresource Integrity (SRI) protection
- ⚠️ Unpinned React versions could lead to breaking changes
- ⚠️ Multiple security vulnerabilities in serverless functions
- ⚠️ Babel standalone has potential ReDoS vulnerability
- ✅ Using production builds for React

---

## 1. Frontend Dependencies Analysis

### 1.1 CDN-Hosted Libraries

| Library | Current Version | Latest Version | Status | Risk Level |
|---------|----------------|----------------|--------|------------|
| React | 18.x (unpinned) | 18.3.1 | ⚠️ Unpinned | Medium |
| React-DOM | 18.x (unpinned) | 18.3.1 | ⚠️ Unpinned | Medium |
| Babel Standalone | Latest (unpinned) | 7.26.10+ | ⚠️ CVE-2025-27789 | Medium |

**Location:** `/home/user/reflex/index.html:10-12`

```html
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
```

### 1.2 Security Issues

#### 🔴 **HIGH PRIORITY: Missing Subresource Integrity (SRI)**
**Impact:** CDN compromise could inject malicious code
**Recommendation:** Add SRI hashes to all CDN scripts

**Example Fix:**
```html
<script
  src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"
  integrity="sha384-[HASH]"
  crossorigin="anonymous">
</script>
```

#### 🟡 **MEDIUM PRIORITY: Unpinned Versions**
**Impact:** Automatic updates could introduce breaking changes
**Current:** `react@18` (matches any 18.x.x version)
**Recommendation:** Pin to specific versions like `react@18.3.1`

#### 🟡 **MEDIUM PRIORITY: Babel CVE-2025-27789**
**Impact:** ReDoS vulnerability in regex named capturing groups
**Severity:** CVSS 6.2 (Medium)
**Recommendation:** Pin to `@babel/standalone@7.26.10` or later

### 1.3 React 19 Server Components Vulnerabilities (Not Applicable)
**Status:** ✅ NOT AFFECTED
This project uses React 18, which is not affected by the critical React Server Components vulnerabilities (CVE-2025-55182, CVE-2025-55184, CVE-2025-55183) discovered in React 19.

---

## 2. Backend Dependencies Analysis

### 2.1 Serverless Functions Dependencies

**No npm dependencies detected.** The project uses:
- Node.js built-in modules (`https`, `Buffer`)
- Native `fetch` API (Vercel runtime)
- Environment variables for API keys

### 2.2 External Services
- **Anthropic Claude API** - claude-sonnet-4-20250514 model
- **Vercel KV Storage** (Redis)
- **Vercel Blob Storage**
- **unpkg CDN**

---

## 3. Security Vulnerabilities in Serverless Functions

### 3.1 api/analyze.js

#### 🟡 **MEDIUM: Insufficient Input Validation**
**Location:** `api/analyze.js:19`

```javascript
const { image, componentName, mimeType, imageWidth, imageHeight, context } = req.body;
```

**Issues:**
- No validation on `componentName` length (could cause injection in Figma code)
- No validation on `imageWidth`/`imageHeight` range (could cause performance issues)
- No validation on `context.note` and `context.tags` size

**Recommendation:**
```javascript
// Add validation
if (componentName && componentName.length > 100) {
  return res.status(400).json({ error: 'Component name too long' });
}
if (imageWidth && (imageWidth < 1 || imageWidth > 10000)) {
  return res.status(400).json({ error: 'Invalid image dimensions' });
}
```

#### 🟡 **MEDIUM: Injection Risk in Prompt Template**
**Location:** `api/analyze.js:144`

```javascript
main.name = "${componentName || 'Component'}";
```

User-provided `componentName` is directly embedded in generated code without sanitization.

**Recommendation:** Sanitize and escape special characters:
```javascript
const sanitizedName = (componentName || 'Component')
  .replace(/[^a-zA-Z0-9_\- ]/g, '')
  .slice(0, 50);
```

#### 🟢 **LOW: Open CORS Configuration**
**Location:** `api/analyze.js:6`

```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
```

**Impact:** Allows any website to call your API
**Recommendation:** Consider restricting to specific origins in production

#### 🟡 **MEDIUM: No Rate Limiting**
**Impact:** API abuse could lead to high Anthropic API costs
**Recommendation:** Implement rate limiting per IP or user

#### 🟡 **MEDIUM: Large Payload Risk**
**Configuration:** `maxDuration: 60` seconds, no explicit size limit
**Recommendation:** Add request size limits to prevent abuse

### 3.2 api/boards.js

#### 🔴 **HIGH: Potential NoSQL Injection**
**Location:** `api/boards.js:31-33`

```javascript
const { boardId = 'public' } = req.query;
const BOARD_KEY = boardId === 'public' ? 'reflex:main' : `reflex:${boardId}`;
```

User-controlled `boardId` is directly used to construct Redis keys without validation.

**Attack Vector:**
- Malicious boardId could access/modify unintended Redis keys
- Example: `boardId=../../sensitive:data` or `boardId=*` (pattern matching)

**Recommendation:**
```javascript
// Whitelist allowed characters
const sanitizedBoardId = boardId.replace(/[^a-zA-Z0-9_-]/g, '');
if (sanitizedBoardId !== boardId) {
  return res.status(400).json({ error: 'Invalid board ID' });
}
const BOARD_KEY = sanitizedBoardId === 'public' ? 'reflex:main' : `reflex:${sanitizedBoardId}`;
```

#### 🟡 **MEDIUM: No Data Size Validation**
**Location:** `api/boards.js:48-58`

```javascript
const newRef = { ...reference, id: Date.now() };
data.references.unshift(newRef);
```

**Issues:**
- No limit on `references` array size (could exhaust Redis memory)
- No validation on individual reference object size
- No limit on `customCategories` object size

**Recommendation:**
```javascript
// Add limits
if (data.references.length >= 10000) {
  return res.status(400).json({ error: 'Maximum references limit reached' });
}
if (JSON.stringify(reference).length > 1000000) { // 1MB
  return res.status(400).json({ error: 'Reference too large' });
}
```

#### 🟢 **LOW: Error Information Disclosure**
**Location:** `api/boards.js:95`

```javascript
return res.status(500).json({ error: e.message });
```

Exposing raw error messages could leak implementation details.

### 3.3 api/categories.js

#### 🔴 **HIGH: Same NoSQL Injection Risk**
Same `boardId` injection vulnerability as `api/boards.js:29-31`

#### 🟡 **MEDIUM: No Data Validation**
**Location:** `api/categories.js:34-40`

```javascript
const { customCategories } = req.body;
if (!customCategories) return res.status(400).json({ error: 'No categories' });
data.customCategories = customCategories;
```

**Issues:**
- No validation on object structure
- No size limits
- Could be used to inject arbitrary data

**Recommendation:**
```javascript
// Validate structure
if (typeof customCategories !== 'object' || Array.isArray(customCategories)) {
  return res.status(400).json({ error: 'Invalid categories format' });
}
if (JSON.stringify(customCategories).length > 100000) {
  return res.status(400).json({ error: 'Categories data too large' });
}
```

### 3.4 api/upload.js

#### 🟡 **MEDIUM: Insufficient Validation**
**Location:** `api/upload.js:24-27`

```javascript
const base64 = image.replace(/^data:image\/\w+;base64,/, '');
const buffer = Buffer.from(base64, 'base64');
const ext = contentType?.split('/')[1] || 'png';
```

**Issues:**
- No validation on base64 string length before Buffer creation
- No validation on file extension (could be arbitrary)
- No MIME type validation

**Recommendation:**
```javascript
// Add validation
const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
if (contentType && !allowedTypes.includes(contentType)) {
  return res.status(400).json({ error: 'Invalid image type' });
}

// Check size before Buffer creation
if (base64.length > 10 * 1024 * 1024 * 1.37) { // ~10MB in base64
  return res.status(400).json({ error: 'Image too large' });
}
```

#### 🟡 **MEDIUM: Path Traversal Risk**
**Location:** `api/upload.js:27`

```javascript
const filename = `reflex/${Date.now()}.${ext}`;
```

While currently safe, the `ext` variable should be validated to prevent potential path traversal.

### 3.5 netlify/functions/analyze.js

#### 🟡 **MEDIUM: Similar Issues as api/analyze.js**
- Same input validation issues
- Same injection risks
- Uses deprecated Node.js `https` module instead of `fetch`

**Additional Issue:**
**Location:** `netlify/functions/analyze.js:98`
```javascript
req.setTimeout(25000, () => { req.destroy(); reject(new Error('Timeout')); });
```

26-second function timeout with 25-second request timeout is very tight and could lead to race conditions.

---

## 4. Unnecessary Bloat Analysis

### 4.1 Code Duplication
**Issue:** Two separate `analyze.js` implementations
**Files:** `api/analyze.js` (Vercel) and `netlify/functions/analyze.js` (Netlify)

**Impact:**
- Duplicate maintenance burden
- Inconsistent behavior (different prompts, timeouts, error handling)
- Increased surface area for bugs

**Recommendation:**
- Choose one platform (Vercel or Netlify) and remove the other
- If multi-platform support is needed, extract shared logic into a common module

### 4.2 Babel Standalone Overhead
**Issue:** Loading entire Babel transpiler in browser
**Size:** ~2.8 MB (minified)

**Recommendation:**
- Pre-compile JSX with build tools (Vite, webpack)
- Use plain JavaScript or a lightweight alternative
- **Potential savings:** ~2.8 MB, faster page load, no runtime compilation

### 4.3 Google Fonts Loading
**Location:** `index.html:7-9`

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
```

**Current:** Loading 2 font families with multiple weights
**Recommendation:**
- Use `font-display: swap` (already done ✓)
- Consider self-hosting fonts to reduce external dependencies
- Load only weights actually used in the application

### 4.4 Unused Code in Prompts
**Location:** `api/analyze.js:57-160` (very long prompt)

The AI prompt is extremely long (103 lines) and includes template code that could be optimized.

**Recommendation:** Consider extracting reusable prompt templates.

---

## 5. API Usage and Cost Concerns

### 5.1 Anthropic API Usage
**Model:** claude-sonnet-4-20250514
**Max Tokens:** 8000 per request
**Timeout:** 60 seconds

**Concerns:**
1. No rate limiting = potential for API cost abuse
2. No caching of similar requests
3. Large images + long prompts = high token usage
4. No fallback if API quota exceeded

**Cost Estimation:**
- Sonnet 4 pricing: ~$3-15 per 1M input tokens, ~$15-75 per 1M output tokens
- With image + 8000 token responses, each request could cost $0.05-0.20
- Without rate limiting, abuse could cost hundreds/thousands

**Recommendations:**
1. Implement rate limiting (e.g., 10 requests/hour per IP)
2. Cache results for identical images
3. Add API usage monitoring/alerts
4. Consider daily spending caps

### 5.2 Vercel KV/Blob Storage
**Currently:** Unlimited write access via API endpoints

**Concerns:**
1. No authentication on `/api/boards` and `/api/categories`
2. Anyone can write unlimited data to your Redis
3. Anyone can upload images to your Blob storage
4. No cleanup/TTL on old data

**Recommendations:**
1. Add authentication (API keys, JWT tokens, etc.)
2. Implement rate limiting
3. Add TTL to Redis keys
4. Add cleanup jobs for old blob uploads

---

## 6. Recommendations Summary

### 🔴 **CRITICAL (Do First)**

1. **Add Input Validation to all API endpoints**
   - Sanitize `boardId` in boards.js and categories.js (NoSQL injection)
   - Validate all user inputs (size, format, content)
   - Add request size limits

2. **Add Authentication**
   - Protect write operations on boards/categories/upload APIs
   - Implement API key or session-based auth
   - Add rate limiting

3. **Add SRI Hashes to CDN Scripts**
   ```html
   <script src="..." integrity="sha384-..." crossorigin="anonymous"></script>
   ```

### 🟡 **HIGH PRIORITY (Do Soon)**

4. **Pin CDN Versions**
   - Change `react@18` to `react@18.3.1`
   - Pin Babel to `@babel/standalone@7.26.10`

5. **Implement Rate Limiting**
   - Limit Anthropic API calls per IP/user
   - Limit write operations to storage

6. **Add Monitoring and Alerts**
   - Track API usage and costs
   - Alert on unusual activity
   - Set spending caps

7. **Restrict CORS Origins**
   - Change from `*` to specific allowed domains

### 🟢 **MEDIUM PRIORITY (Nice to Have)**

8. **Remove Babel Standalone**
   - Pre-compile JSX with build tool
   - Save ~2.8 MB bundle size

9. **Consolidate Analyze Functions**
   - Choose Vercel OR Netlify
   - Remove duplicate code

10. **Add Error Handling**
    - Don't expose raw error messages
    - Add proper logging

11. **Optimize Font Loading**
    - Self-host fonts or reduce weights loaded

### 📚 **LOW PRIORITY (Future Improvements)**

12. **Add Testing**
    - Unit tests for validation logic
    - Integration tests for API endpoints

13. **Add Documentation**
    - API documentation
    - Security guidelines
    - Deployment procedures

14. **Consider Package Management**
    - Add package.json with locked versions
    - Use build tools for better optimization
    - Enable better development workflow

---

## 7. Alternative Architecture Suggestions

### Option 1: Add Build Step (Recommended)
**Benefits:**
- Remove Babel runtime overhead (~2.8 MB)
- Enable tree-shaking and optimization
- Better development experience with hot reload
- Easier testing and type safety

**Stack:** Vite + React + TypeScript

### Option 2: Keep Current Architecture but Harden
**Benefits:**
- Minimal changes to existing code
- No build step complexity
- Fast deployments

**Must Do:**
- Add all critical security fixes
- Implement authentication & rate limiting
- Add comprehensive input validation

### Option 3: Use Framework with Built-in Security
**Frameworks:** Next.js, Remix, Astro
**Benefits:**
- Built-in API routes with better security defaults
- Server-side rendering capabilities
- Better performance
- Built-in authentication patterns

---

## 8. Implementation Roadmap

### Week 1: Security Hardening
- [ ] Add input validation to all endpoints
- [ ] Implement authentication for write operations
- [ ] Add rate limiting
- [ ] Add SRI hashes to CDN scripts

### Week 2: Dependency Management
- [ ] Pin all CDN versions
- [ ] Update Babel to 7.26.10+
- [ ] Add monitoring/alerts for API usage

### Week 3: Optimization
- [ ] Remove duplicate analyze functions
- [ ] Optimize bundle size (consider removing Babel)
- [ ] Add caching for API responses

### Week 4: Documentation & Testing
- [ ] Document API endpoints
- [ ] Add security testing
- [ ] Create deployment runbook

---

## 9. Conclusion

This project takes an interesting approach with **zero npm dependencies**, which eliminates npm supply chain risks. However, the **lack of input validation, authentication, and rate limiting** poses significant security and cost risks.

**Priority Level:**
1. 🔴 **CRITICAL:** Fix NoSQL injection vulnerabilities and add input validation
2. 🟡 **HIGH:** Add authentication, rate limiting, and SRI hashes
3. 🟢 **MEDIUM:** Optimize bundle size and consolidate code

**Estimated Effort:**
- Critical fixes: 1-2 days
- High priority: 2-3 days
- Medium priority: 3-5 days
- **Total: ~1-2 weeks** for complete security hardening and optimization

The project is **functional but not production-ready** without addressing the critical security issues.

---

## References

- [React Security Best Practices 2026](https://www.glorywebs.com/blog/react-security-practices)
- [Snyk - 10 React Security Best Practices](https://snyk.io/blog/10-react-security-best-practices/)
- [React Server Components CVE-2025-55182](https://react.dev/blog/2025/12/03/critical-security-vulnerability-in-react-server-components)
- [Babel CVE-2025-27789](https://github.com/babel/babel/security/advisories/GHSA-67hx-6x53-jw92)
- [unpkg CDN Security Best Practices](https://edgeone.ai/blog/details/react-cdn)
- [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/)

---

**End of Report**
