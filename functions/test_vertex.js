const { GoogleAuth } = require('google-auth-library');

async function test() {
    const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    
    const projectId = 'mocklist-app';
    const location = 'us-central1';
    
    // Firebase AI Logic endpoint
    const endpoint = `https://firebaseai.googleapis.com/v1beta1/projects/${projectId}/locations/${location}/publishers/google/gemini-3.1-flash-lite:generateContent`;
    
    console.log('Trying:', endpoint);
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [{ text: 'Hello' }]
                }]
            })
        });
        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Response:', text.substring(0, 500));
    } catch (e) {
        console.log('Error:', e.message);
    }
}

test().catch(console.error);
