import { test, expect } from '@playwright/test'

/**
 * FINAL TEST: Standing Videos sind korrekt
 */

test.describe('FINAL: Standing Videos Correct', () => {
  test('verify Standing has 29 unique videos', async ({ context, request }) => {
    test.setTimeout(60000);
    
    console.log('\n========================================');
    console.log('FINAL TEST: Standing Videos');
    console.log('========================================\n');
    
    // Get auth token
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name.includes('auth-token'));
    let token = '';
    if (authCookie) {
      try {
        const parsed = JSON.parse(authCookie.value);
        token = parsed.access_token || '';
      } catch {}
    }
    
    // Test Standing API
    console.log('1. Testing Standing API...');
    const standingResponse = await request.get('http://localhost:3000/api/node-clips?nodeId=technique-08d5e574', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    });
    const standingData = await standingResponse.json();
    const standingVideos = standingData.groups?.main_reference || [];
    
    console.log(`   ✅ Standing has ${standingVideos.length} videos`);
    
    // Test Half Guard API
    console.log('\n2. Testing Half Guard API...');
    const halfGuardResponse = await request.get('http://localhost:3000/api/node-clips?nodeId=technique-23f0717b', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    });
    const halfGuardData = await halfGuardResponse.json();
    const halfGuardVideos = halfGuardData.groups?.main_reference || [];
    
    console.log(`   ✅ Half Guard has ${halfGuardVideos.length} videos`);
    
    // Vergleiche
    console.log('\n3. Verification:');
    
    // 1. Standing hat 29 Videos
    const standingHas29 = standingVideos.length >= 29;
    console.log(`   Standing has 29+ videos: ${standingHas29 ? '✅' : '❌'}`);
    
    // 2. Videos sind verschieden
    const standingIds = new Set<string>(standingVideos.map((v: any) => v.id));
    const halfGuardIds = new Set<string>(halfGuardVideos.map((v: any) => v.id));
    
    let overlapCount = 0;
    standingIds.forEach((id: string) => {
      if (halfGuardIds.has(id)) overlapCount++;
    });
    
    const videosAreDifferent = overlapCount === 0;
    console.log(`   Videos are different: ${videosAreDifferent ? '✅' : '❌'}`);
    if (overlapCount > 0) {
      console.log(`   (Overlap: ${overlapCount} videos)`);
    }
    
    // 3. Erste Videos haben unterschiedliche Titel
    const standingFirst = standingVideos[0]?.title;
    const halfGuardFirst = halfGuardVideos[0]?.title;
    const firstTitlesDifferent = standingFirst !== halfGuardFirst;
    
    console.log(`   First titles different: ${firstTitlesDifferent ? '✅' : '❌'}`);
    console.log(`   - Standing first: "${standingFirst}"`);
    console.log(`   - Half Guard first: "${halfGuardFirst}"`);
    
    // Zusammenfassung
    console.log('\n========================================');
    if (standingHas29 && videosAreDifferent && firstTitlesDifferent) {
      console.log('✅✅✅ ALL CHECKS PASSED! ✅✅✅');
      console.log('Standing has 29 UNIQUE videos!');
    } else {
      console.log('❌ Some checks failed');
    }
    console.log('========================================');
    
    // Assertions
    expect(standingHas29).toBe(true);
    expect(videosAreDifferent).toBe(true);
    expect(firstTitlesDifferent).toBe(true);
  });
  
  test('verify Standing videos are Standing-related', async ({ context, request }) => {
    test.setTimeout(60000);
    
    console.log('\n========================================');
    console.log('TEST: Standing Videos Content');
    console.log('========================================\n');
    
    const cookies = await context.cookies();
    const authCookie = cookies.find(c => c.name.includes('auth-token'));
    let token = '';
    if (authCookie) {
      try {
        const parsed = JSON.parse(authCookie.value);
        token = parsed.access_token || '';
      } catch {}
    }
    
    const standingResponse = await request.get('http://localhost:3000/api/node-clips?nodeId=technique-08d5e574', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
    });
    const standingData = await standingResponse.json();
    const standingVideos = standingData.groups?.main_reference || [];
    
    console.log('First 5 Standing videos:');
    standingVideos.slice(0, 5).forEach((video: any, i: number) => {
      console.log(`  ${i + 1}. ${video.title}`);
    });
    
    // Prüfe dass kein Video "Half Guard" im Titel hat
    const hasHalfGuard = standingVideos.some((v: any) => 
      v.title?.toLowerCase().includes('half guard')
    );
    
    console.log('\nHas "Half Guard" in titles:', hasHalfGuard ? '❌' : '✅');
    
    expect(hasHalfGuard).toBe(false);
  });
});