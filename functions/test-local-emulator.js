// Test script for generateBackgrounds on the local emulator
async function runTest() {
    const url = 'http://127.0.0.1:5001/mocklist-app/us-central1/generateBackgrounds';
    
    const payload = {
        model: 'gemini-3.1-flash-lite',
        marketingContext: {
            targetUser: 'Product managers and indie developers needing app store screenshots quickly',
            differentiation: 'One-click AI styling, multiple templates, offline-first localStorage',
            emotionalTone: 'Professional, highly efficient, sleek modern tech'
        },
        analyses: [
            {
                appType: 'ASO Screenshot Builder',
                screenPurpose: 'Main editor with template sidebar',
                keyUIText: ['MOCKLIST', 'Templates', 'Improve with AI', 'Export PNG'],
                primaryUserAction: 'selecting a template and editing text',
                userBenefit: 'create gorgeous marketing screenshots in 30 seconds',
                dominantColors: ['#1A1A2F', '#FFDE4D'],
                brandVibe: 'neubrutalist',
                textStyle: {
                    headlineColor: '#FFDE4D',
                    subheadlineColor: '#FFFFFF',
                    headlineWeight: '700',
                    subheadlineWeight: '400',
                    align: 'center',
                    textBackingBoxType: 'none',
                    headlineStrokeEnabled: true,
                    headlineStrokeColor: '#000000',
                    headlineStrokeWidth: 4,
                    headlineShadowEnabled: true,
                    headlineShadowColor: '#000000',
                    headlineShadowOffset: 6
                }
            },
            {
                appType: 'ASO Screenshot Builder',
                screenPurpose: 'Export dialog and file manager',
                keyUIText: ['Export Successful', 'Download all resolutions', 'Close'],
                primaryUserAction: 'downloading screenshots',
                userBenefit: 'get assets ready to upload to Apple and Google consoles',
                dominantColors: ['#1A1A2F', '#00FFCC'],
                brandVibe: 'sleek tech',
                textStyle: {
                    headlineColor: '#00FFCC',
                    subheadlineColor: '#FFFFFF',
                    headlineWeight: '600',
                    subheadlineWeight: '300',
                    align: 'center',
                    textBackingBoxType: 'unified',
                    textBackingBoxColor: '#1A1A2F'
                }
            }
        ]
    };
    
    console.log('Sending request to local emulator:', url);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        console.log('Response status:', response.status);
        const data = await response.json();
        console.log('Response body:');
        console.log(JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Test failed:', error);
    }
}

runTest();
