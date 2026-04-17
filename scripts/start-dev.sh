#!/bin/bash
cd /c/Users/jason/OneDrive/Desktop/BJJMAXXING
NEXT_PUBLIC_ADMIN_EMAILS="jasongloger@googlemail.com" \
NEXT_PUBLIC_ADMIN_PASSWORD="QwErTer312" \
npm run dev > /tmp/nextjs-dev.log 2>&1 &
echo "Next.js dev server started with PID: $!"
echo "Logs at: /tmp/nextjs-dev.log"
