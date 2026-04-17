#!/usr/bin/env python3
"""
DIAGNOSE: Supabase Clip Loading Issue

Tests the Supabase database directly to understand why clips aren't showing.
Uses the credentials from .env file:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
"""

import os
import json
import sys

# Try to import supabase
try:
    from supabase import create_client
except ImportError:
    print("Installing supabase package...")
    os.system(f"{sys.executable} -m pip install supabase -q")
    from supabase import create_client

# Configuration
SUPABASE_URL = "https://elvigdrebascpzbmuecf.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdmlnZHJlYmFzY3B6Ym11ZWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyOTg0ODUsImV4cCI6MjA4OTg3NDQ4NX0.OXqaMqmUC3bqz0J05enMlhSTpqTb-9iQCVRf_DuiOOw"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsdmlnZHJlYmFzY3B6Ym11ZWNmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDI5ODQ4NSwiZXhwIjoyMDg5ODc0NDg1fQ.EV31-KT_aA90lVrAFguj4NcbtbdLicNYfItlkX5kyRc"

ADMIN_EMAIL = "jasongloger@googlemail.com"
ADMIN_PASSWORD = "QwErTer312"

def diagnose():
    print("=" * 60)
    print("BJJMAXXING CLIP LOADING DIAGNOSTIC")
    print("=" * 60)
    print()
    
    # Create admin client (service role - bypasses RLS)
    print("Connecting to Supabase with service role...")
    admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print("✓ Connected")
    print()
    
    # Step 1: Get admin user
    print("Step 1: Finding admin user...")
    try:
        users_result = admin.auth.admin.list_users()
        users = users_result.users if hasattr(users_result, 'users') else []
        admin_user = next((u for u in users if u.email == ADMIN_EMAIL), None)
        
        if not admin_user:
            print(f"❌ Admin user {ADMIN_EMAIL} not found!")
            return
        
        print(f"✓ Found admin user: {admin_user.id}")
        print(f"  Email: {admin_user.email}")
        print(f"  Confirmed: {admin_user.email_confirmed_at is not None}")
    except Exception as e:
        print(f"❌ Error getting users: {e}")
        return
    
    print()
    
    # Step 2: Check clip_archive table
    print("Step 2: Checking clip_archive table...")
    try:
        result = admin.table('clip_archive').select('*').limit(5).execute()
        clips = result.data
        
        if not clips:
            print("⚠️  No clips found in clip_archive table!")
        else:
            print(f"✓ Found {len(clips)} clips in archive")
            for clip in clips:
                print(f"  - {clip.get('title', 'N/A')} (ID: {clip.get('id', 'N/A')[:8]}...)")
                print(f"    Video URL: {clip.get('video_url', 'N/A')[:50]}...")
    except Exception as e:
        print(f"❌ Error querying clip_archive: {e}")
    
    print()
    
    # Step 3: Check clip_assignments
    print("Step 3: Checking clip_assignments table...")
    try:
        result = admin.table('clip_assignments').select('*').limit(10).execute()
        assignments = result.data
        
        if not assignments:
            print("⚠️  No clip_assignments found!")
            print("   This could be why clips aren't showing - they need to be assigned to nodes.")
        else:
            print(f"✓ Found {len(assignments)} clip_assignments")
            for a in assignments[:3]:
                print(f"  - Clip {a.get('clip_id', 'N/A')[:8]}... -> Node {a.get('node_id', 'N/A')[:8]}...")
    except Exception as e:
        print(f"❌ Error querying clip_assignments: {e}")
    
    print()
    
    # Step 4: Check user_profiles
    print("Step 4: Checking user_profiles...")
    try:
        result = admin.table('user_profiles').select('*').eq('id', admin_user.id).execute()
        profile = result.data[0] if result.data else None
        
        if not profile:
            print(f"⚠️  No profile found for admin user!")
        else:
            print(f"✓ Profile found")
            print(f"  Active gameplan: {profile.get('active_gameplan_id', 'None')}")
            print(f"  Primary archetype: {profile.get('primary_archetype', 'None')}")
    except Exception as e:
        print(f"❌ Error querying user_profiles: {e}")
    
    print()
    
    # Step 5: Check gameplans
    print("Step 5: Checking gameplans...")
    try:
        result = admin.table('gameplans').select('*').limit(5).execute()
        gameplans = result.data
        
        if not gameplans:
            print("⚠️  No gameplans found!")
        else:
            print(f"✓ Found {len(gameplans)} gameplans")
            for gp in gameplans:
                print(f"  - {gp.get('name', 'N/A')} (ID: {gp.get('id', 'N/A')[:8]}...)")
                unlock = gp.get('unlock_summary', {})
                print(f"    Current node: {unlock.get('currentNodeId', 'None')}")
    except Exception as e:
        print(f"❌ Error querying gameplans: {e}")
    
    print()
    print("=" * 60)
    print("DIAGNOSTIC SUMMARY")
    print("=" * 60)
    print()
    print("If clips exist but aren't showing, the issue is likely:")
    print()
    print("1. AUTH ISSUE: The start-queue API cannot identify the user")
    print("   - Cookie not being sent properly")
    print("   - Session not being recognized")
    print()
    print("2. ASSIGNMENT ISSUE: Clips exist but aren't assigned to nodes")
    print("   - Need to assign clips via /admin/video-upload or /admin/outlierdb")
    print()
    print("3. GAMEPLAN ISSUE: User has no active gameplan or current node")
    print("   - Need to select/activate a gameplan")
    print()
    print("To test auth, use the diagnose-clip-loading.spec.ts Playwright test.")

if __name__ == '__main__':
    diagnose()
