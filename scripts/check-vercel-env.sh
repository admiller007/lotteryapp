#!/bin/bash

# Vercel Environment Variables Checker
# This script helps you verify that Firebase env vars are set in Vercel

echo "🔍 Vercel Firebase Environment Variables Checker"
echo "=================================================="
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI is not installed"
    echo ""
    echo "To install:"
    echo "  npm install -g vercel"
    echo ""
    exit 1
fi

echo "✅ Vercel CLI found"
echo ""

# Check if logged in
if ! vercel whoami &> /dev/null; then
    echo "❌ Not logged in to Vercel"
    echo ""
    echo "To login:"
    echo "  vercel login"
    echo ""
    exit 1
fi

VERCEL_USER=$(vercel whoami 2>&1 | grep -v "Vercel CLI" | grep -v "NOTE:" | grep -v ">" | head -1)
echo "✅ Logged in as: $VERCEL_USER"
echo ""

# Required Firebase environment variables
REQUIRED_VARS=(
    "NEXT_PUBLIC_FIREBASE_API_KEY"
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
    "NEXT_PUBLIC_FIREBASE_APP_ID"
)

echo "📋 Checking Firebase Environment Variables..."
echo ""

# Get all environment variables
ENV_OUTPUT=$(vercel env ls 2>&1)

if echo "$ENV_OUTPUT" | grep -q "Error"; then
    echo "❌ Error accessing environment variables:"
    echo "$ENV_OUTPUT"
    exit 1
fi

# Check each required variable
MISSING_COUNT=0
FOUND_COUNT=0

for VAR in "${REQUIRED_VARS[@]}"; do
    if echo "$ENV_OUTPUT" | grep -q "$VAR"; then
        echo "✅ $VAR - Found"
        ((FOUND_COUNT++))
    else
        echo "❌ $VAR - MISSING"
        ((MISSING_COUNT++))
    fi
done

echo ""
echo "=================================================="
echo "Summary: $FOUND_COUNT found, $MISSING_COUNT missing"
echo "=================================================="
echo ""

if [ $MISSING_COUNT -gt 0 ]; then
    echo "❌ Some environment variables are missing!"
    echo ""
    echo "To add missing variables:"
    echo "  vercel env add <VARIABLE_NAME> production"
    echo ""
    echo "Then redeploy with:"
    echo "  vercel --prod --force"
    echo ""
    exit 1
else
    echo "✅ All required Firebase environment variables are configured!"
    echo ""
    echo "If Firebase still isn't working, try:"
    echo "  1. Force a rebuild: vercel --prod --force"
    echo "  2. Check /client-env-check on your deployed app"
    echo "  3. Verify Firebase project settings in Firebase Console"
    echo ""
fi
