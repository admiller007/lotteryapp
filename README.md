# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## 🔥 Firebase Debugging Tools

If Firebase data is not loading, use these diagnostic tools:

### Diagnostic Pages (Available on deployed app)

- **`/firebase-debug`** - Comprehensive Firebase diagnostics with real-time testing
- **`/client-env-check`** - Verify environment variables are in the client bundle
- **`/env-check`** - Server-side environment variable check

### Scripts

- **`scripts/verify-firebase-setup.ts`** - Local Firebase configuration verification
  ```bash
  tsx scripts/verify-firebase-setup.ts
  ```

- **`scripts/check-vercel-env.sh`** - Check Vercel environment variables
  ```bash
  ./scripts/check-vercel-env.sh
  ```

### Detailed Debugging Guide

See **`FIREBASE_DEBUG_GUIDE.md`** for comprehensive troubleshooting steps.

### Quick Fix for Vercel Deployment Issues

If Firebase is not working on Vercel:

1. Go to Vercel Dashboard → Settings → Environment Variables
2. Ensure all `NEXT_PUBLIC_FIREBASE_*` variables are set
3. Redeploy with **build cache disabled**:
   - Deployments → Click the deployment → Redeploy
   - **Uncheck** "Use existing build cache"
4. Visit `/firebase-debug` on your deployed app to verify

**Common Issue:** Environment variables must be set in Vercel **before** building. If set after deployment, they won't be in the bundle.
