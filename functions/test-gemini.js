const { GoogleAuth } = require('google-auth-library');

async function test() {
    const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    const accessToken = token.token;

    const projectId = 'mocklist-app';
    const locations = ['us-central1', 'global'];
    const models = ['gemini-3.1-flash-lite', 'gemini-1.5-flash'];

    for (const loc of locations) {
        for (const model of models) {
            const endpoint = `https://${loc === 'global' ? 'us-central1' : loc}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${loc}/publishers/google/models/${model}:generateContent`;
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        role: "user",
                        parts: [
                            { text: "Hello" }
                        ]
                    }]
                })
            });
            
            console.log(`${loc} / ${model}: ${response.status}`);
            if (!response.ok) {
                console.log(await response.text());
            }
        }
    }
}

test().catch(console.error);
