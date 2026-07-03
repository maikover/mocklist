const { GoogleAuth } = require('google-auth-library');

async function test() {
    const auth = new GoogleAuth({
        scopes: 'https://www.googleapis.com/auth/cloud-platform'
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse.token;

    const projectId = 'mocklist-app';
    const loc = 'us-central1';
    const model = 'gemini-2.5-flash';
    const endpoint = `https://${loc}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${loc}/publishers/google/models/${model}:generateContent`;

    const responseSchema = {
        type: "object",
        properties: {
            themeStrategy: { type: "string" },
            elementLayoutPlan: { type: "string" },
            plans: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        screenshotIndex: { type: "integer" },
                        archetype: { 
                            type: "string", 
                            enum: ["neubrutalist", "sleek-tech", "minimalist", "vibrant-playful"] 
                        },
                        textBackingBox: { type: "boolean" },
                        styleChanges: {
                            type: "object",
                            properties: {
                                backgroundColors: {
                                    type: "array",
                                    items: { type: "string" }
                                },
                                screenshotPositionPreset: { 
                                    type: "string", 
                                    enum: ["centered", "bleed-bottom", "bleed-top", "float-center", "tilt-left", "tilt-right", "float-bottom"] 
                                },
                                screenshotRotation: { type: "integer" }
                            },
                            required: ["backgroundColors", "screenshotPositionPreset"]
                        },
                        textChanges: {
                            type: "object",
                            properties: {
                                headline: { type: "string" },
                                subheadline: { type: "string" },
                                textAlign: { 
                                    type: "string", 
                                    enum: ["left", "center", "right"] 
                                },
                                headlineColor: { type: "string" },
                                subheadlineColor: { type: "string" }
                            },
                            required: ["headline", "subheadline", "textAlign"]
                        },
                        elementChanges: {
                            type: "object",
                            properties: {
                                addBadge: { type: "string" },
                                badgeColor: { type: "string" },
                                badgeTextColor: { type: "string" },
                                badgeX: { type: "integer" },
                                badgeY: { type: "integer" },
                                addIcon: { type: "string" },
                                iconColor: { type: "string" },
                                iconX: { type: "integer" },
                                iconY: { type: "integer" },
                                addShape: { type: "string" },
                                shapeColor: { type: "string" },
                                shapeX: { type: "integer" },
                                shapeY: { type: "integer" },
                                addDecorator: {
                                    type: "array",
                                    items: { type: "string" }
                                }
                            }
                        }
                    },
                    required: ["screenshotIndex", "archetype", "textBackingBox", "styleChanges", "textChanges", "elementChanges"]
                }
            }
        },
        required: ["themeStrategy", "elementLayoutPlan", "plans"]
    };

    console.log('Sending request to model with schema...');

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
                    { text: "Generate a storyboard plan for a 3-screenshot app. Archetype is neubrutalist. Background is red and yellow. Title 1: 'BOOST HABITS', Title 2: 'STAY SHARP', Title 3: 'TRACK DAILY'." }
                ]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 8192,
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        })
    });

    console.log(`Status: ${response.status}`);
    const text = await response.text();
    if (!response.ok) {
        console.log('Error:', text);
    } else {
        const json = JSON.parse(text);
        const modelOutput = json.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log('Model Response Content:');
        console.log(modelOutput);
    }
}

test().catch(console.error);
