const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleAuth } = require('google-auth-library');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// ============================================
// CORS Helper
// ============================================
function setCorsHeaders(res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');
}

// ============================================
// Helper: Get access token using Application Default Credentials (ADC) or GCP metadata server
// ============================================
async function getAccessToken() {
    try {
        const auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        const tokenResponse = await client.getAccessToken();
        return tokenResponse.token;
    } catch (err) {
        console.warn("Failed to get token via GoogleAuth, falling back to metadata server:", err.message);
        const url = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
        const response = await fetch(url, {
            headers: { 'Metadata-Flavor': 'Google' }
        });
        const data = await response.json();
        return data.access_token;
    }
}

// ============================================
// ENDPOINT 1: Analyze screenshots with Vision
// ============================================
exports.analyzeScreenshots = functions.https.onRequest({ timeoutSeconds: 300 }, async (req, res) => {
    setCorsHeaders(res);
    
    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { screenshots, model } = req.body;
        
        if (!screenshots || screenshots.length === 0) {
            return res.status(400).json({ error: 'No screenshots provided' });
        }
        
        // Get access token from metadata server
        const accessToken = await getAccessToken();
        const projectId = 'mocklist-app';
        const requestedModel = 'gemini-3.1-flash-lite';

        // User requested 'global' region for this model
        const aiLocation = 'global'; 
        // For Vertex AI, if location is global, the host is usually just aiplatform.googleapis.com or us-central1
        const host = aiLocation === 'global' ? 'aiplatform.googleapis.com' : `${aiLocation}-aiplatform.googleapis.com`;
        
        // Run all screenshot analyses in parallel
        const analysisPromises = screenshots.map(async (screenshot) => {
            const startTime = Date.now();
            try {
                // Strip data:image prefix if present
                const base64Data = (screenshot.base64 || screenshot).replace(/^data:image\/[a-z]+;base64,/, '');
                
                const promptText = `You are an expert mobile UX/UI analyst and ASO copywriter. Analyze this screenshot in detail.
                                Extract and return STRICTLY a JSON object with the following keys:
                                - appType: category of app (e.g., Finance Tracker, Habit Builder)
                                - screenPurpose: the specific action or screen (e.g., Analytics Dashboard, Onboarding, Payment)
                                - headline: A very short, punchy 3-4 word marketing headline for this screen in ${req.body.targetLanguage || 'the original language'}. MUST NOT BE NULL.
                                - subheadline: A slightly longer 5-8 word description supporting the headline in ${req.body.targetLanguage || 'the original language'}. MUST NOT BE NULL.
                                - dominantColors: An array of 2-3 dominant hex color codes found in the screenshot.
                                - brandVibe: a short description of the visual style (e.g., minimalist dark mode, vibrant playful, corporate blue)
                                - backgroundImagePrompt: A detailed, creative background generation prompt for Google's Imagen 3. The prompt must be designed to perfectly match the visual style, design language, color palette, and aesthetic themes of the analyzed screenshot. Guidelines:
                                  1. Identify the core design style of the app (e.g. flat, 3D, claymation, glassmorphism, neubrutalist, skeuomorphic, cyberpunk, corporate clean, organic/nature-based, neon, retro, etc.) and write a tailored aesthetic description.
                                  2. DO NOT mention cellphones, smartphones, screens, devices, or UI elements. The background must only contain abstract art, geometric shapes, or thematic elements (e.g. speech bubbles for chat apps, abstract floating credit cards for finance, abstract lenses/glass plates for photo editors, organic leaves for health apps, etc.) that complement the app's style.
                                  3. Focus on describing: (a) the overall visual style (e.g. flat vector graphic, 3D render with soft shadows, neubrutalist shapes with thick outlines, organic curves), (b) the composition (e.g. floating abstract shapes, layered sheets, light refractions, soft studio lighting or flat lighting as appropriate), and (c) the specific color palette of the screenshot (using hex codes or descriptive color names) to ensure brand cohesion.
                                  4. Include the following layout constraint at the end of the prompt: "The center vertical third of the image must be completely clean, flat, and empty (no shapes or overlays, just the background canvas) to allow content overlay. No characters, no human figures, no animals, no text."
                                - textStyle: A JSON object containing suggested styling for the overlay marketing text to achieve premium ASO aesthetics matching the app design:
                                    * headlineColor: Hex code for headline text (prefer clean white (#FFFFFF) or highly vibrant contrasting accent colors that pop; DO NOT suggest dull grays like #777777 or #3C3C3C unless they contrast heavily against a pure white background).
                                    * subheadlineColor: Hex code for subheadline text (prefer clean white (#FFFFFF) or a very light tint; DO NOT suggest dull gray/mid-tones like #777777 or #888888 as they lead to unreadable contrast on colored/image backgrounds).
                                    * headlineWeight: Font weight for headline ('400', '600', '700', '800').
                                    * subheadlineWeight: Font weight for subheadline ('300', '400', '600').
                                    * align: Text alignment ('left', 'center', 'right').
                                    * textBackingBoxType: Optional backing card for text readability ('unified', 'separated', 'headline-only', 'none'). Use 'none' unless contrast is poor or app has a card-based playful vibe.
                                    * textBackingBoxColor: Hex code of the backing card (usually white/black or app tint).
                                    * headlineStrokeEnabled: Boolean. Enable text outline for playful/comic/bold aesthetics.
                                    * headlineStrokeColor: Outline color hex code.
                                    * headlineStrokeWidth: Width in pixels (3 to 8).
                                    * headlineShadowEnabled: Boolean. Enable text drop shadow for separation/neubrutalism.
                                    * headlineShadowColor: Drop shadow color hex code.
                                    * headlineShadowOffset: Drop shadow offset in pixels (2 to 10).
                                    * subheadlineStrokeEnabled: Boolean. Enable text outline for subheadline to ensure legibility.
                                    * subheadlineStrokeColor: Subheadline outline color hex code (contrasting with subheadlineColor).
                                    * subheadlineStrokeWidth: Width in pixels (1 to 3, keeping it thinner than headline stroke to ensure subtitle legibility).
                                    * subheadlineShadowEnabled: Boolean. Enable text drop shadow for subheadline readability.
                                    * subheadlineShadowColor: Subheadline drop shadow color hex code.
                                    * subheadlineShadowOffset: Subheadline drop shadow offset in pixels (2 to 10).
                                     CRITICAL Contrast Guidelines: If the screenshot has complex abstract background shapes, a dark tone, or a mix of dark and light regions that might clash with overlay text, you MUST recommend legibility enhancers. For example, suggest 'headlineStrokeEnabled: true' or 'subheadlineStrokeEnabled: true' with a contrasting outline (e.g. black text with a 4px white outline, or white text with a 4px black outline), or recommend a clean 'textBackingBoxType' (like 'unified' or 'separated') with a highly contrasting backing color (e.g. white or black). Never allow black-on-black or dark-on-dark text combinations.
                                - screenshotPositionPreset: Suggested device layout preset to showcase this screen. Must be one of: 'centered', 'bleed-bottom', 'bleed-top', 'float-center', 'tilt-left', 'tilt-right', 'float-bottom'. DO NOT USE 'perspective'. Suggest a dynamic variation of layout presets for different screens.
                                - screenshotScale: Suggested scale percentage for the screenshot/device frame (e.g., an integer between 60 and 85, where standard centered is 70, bleed is 85, tilt is 68, float is 64).
                                Do not include any markdown formatting, only the raw JSON string.`;

                const endpoint = `https://${host}/v1/projects/${projectId}/locations/${aiLocation}/publishers/google/models/${requestedModel}:generateContent`;
                
                let response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        contents: [{
                            role: "user",
                            parts: [
                                { text: promptText },
                                { inlineData: { mimeType: "image/jpeg", data: base64Data } }
                            ]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 2048,
                            responseMimeType: 'application/json'
                        }
                    })
                });
                
                let usedModel = requestedModel;
                if (response.status === 404 && requestedModel !== 'gemini-2.5-flash') {
                    console.warn(`Model ${requestedModel} not found. Retrying Vision analysis with gemini-2.5-flash...`);
                    usedModel = 'gemini-2.5-flash';
                    const fallbackEndpoint = `https://${host}/v1/projects/${projectId}/locations/${aiLocation}/publishers/google/models/gemini-2.5-flash:generateContent`;
                    response = await fetch(fallbackEndpoint, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            contents: [{
                                role: "user",
                                parts: [
                                    { text: promptText },
                                    { inlineData: { mimeType: "image/jpeg", data: base64Data } }
                                ]
                            }],
                            generationConfig: {
                                temperature: 0.2,
                                maxOutputTokens: 8192
                            }
                        })
                    });
                }
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`Vertex AI error: ${response.status} - ${errorText}`);
                    return {};
                }
                
                const result = await response.json();
                const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
                
                if (!text) return {};
                
                let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
                
                // Try robust extraction
                const firstBrace = cleanText.indexOf('{');
                const lastBrace = cleanText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    cleanText = cleanText.substring(firstBrace, lastBrace + 1);
                }
                
                if (!cleanText) cleanText = "{}";
                const parsed = JSON.parse(cleanText);
                parsed.usedModel = usedModel;
                
                // Track details for auto-improvement and debugging
                parsed.debugMetadata = {
                    executionTimeMs: Date.now() - startTime,
                    prompt: promptText,
                    usage: result.usageMetadata || null,
                    status: response.status
                };
                
                return parsed;
            } catch (err) {
                console.error("Screenshot analysis failed:", err);
                return {}; // Fallback
            }
        });
        
        const analyses = await Promise.all(analysisPromises);
        
        return res.status(200).json({ success: true, analyses });
    } catch (error) {
        console.error('Error analyzing screenshots:', error);
        return res.status(500).json({ error: error.message });
    }
});

// ============================================
// ENDPOINT 2: Plan improvements
// ============================================
exports.generateBackgrounds = functions.https.onRequest({ timeoutSeconds: 300 }, async (req, res) => {
    setCorsHeaders(res);
    
    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { analyses, marketingContext, targetLanguage } = req.body;
        
        if (!analyses || analyses.length === 0) {
            return res.status(400).json({ error: 'No analyses provided' });
        }
        
        const accessToken = await getAccessToken();
        const projectId = 'mocklist-app';
        const aiLocation = 'us-central1';
        const host = `${aiLocation}-aiplatform.googleapis.com`;
        const requestedModel = 'imagen-3.0-generate-001';
        
        const endpoint = `https://${host}/v1/projects/${projectId}/locations/${aiLocation}/publishers/google/models/${requestedModel}:predict`;
        
        const plan = [];
        
        // Process each analysis to generate an image
        const generationPromises = analyses.map(async (analysis, index) => {
            const startTime = Date.now();
            try {
                const colors = analysis.dominantColors ? analysis.dominantColors.join(', ') : 'vibrant harmonious colors';
                const appType = analysis.appType || 'Mobile Application';
                const vibe = analysis.brandVibe || 'Premium, modern, rich aesthetics';
                
                let promptText = analysis.backgroundImagePrompt;
                
                if (!promptText) {
                    // Determine visual style, thematic elements, headers, and center-third rules dynamically based on appType and brandVibe (Fallback)
                    let promptHeader = "A premium, high-end digital art background with soft studio lighting.";
                    let visualStyle = "modern, clean, minimalist 3D claymation style with smooth gradients";
                    let thematicElements = "abstract geometric 3D shapes, soft flowing waves, clean gradient layers";
                    let centerThirdRule = "The center vertical third of the image must be completely clean, flat, and empty (just the smooth gradient background) to allow content overlay.";
                    
                    const appTypeLower = appType.toLowerCase();
                    const vibeLower = vibe.toLowerCase();
                    
                    if (vibeLower.includes('brutalist') || vibeLower.includes('neubrutalist')) {
                        promptHeader = "A bold, high-contrast neubrutalist flat 2D graphic design background.";
                        visualStyle = "clean, flat brutalist digital design with thick black outlines, grid lines, and high-contrast color blocks";
                        thematicElements = "minimalist flat geometric elements (stars, arrows, grid lines, sharp rectangles) with thick black borders and flat drop shadows";
                        centerThirdRule = "The center vertical third of the image must be completely clean, flat, and empty (just a solid flat background color or very clean grid lines) to allow content overlay. No smooth 3D gradients or studio lighting.";
                    } else if (appTypeLower.includes('photo') || appTypeLower.includes('camera') || appTypeLower.includes('editor') || appTypeLower.includes('design') || appTypeLower.includes('art')) {
                        promptHeader = "An ultra-premium, sleek abstract background with realistic glassmorphism and subtle lighting.";
                        visualStyle = "sleek, modern minimalist design with subtle light leaks, soft camera lens flares, and beautiful glass panel layering";
                        thematicElements = "floating translucent geometric glass sheets, elegant light refractions, soft pristine gradient backdrops, and modern thin metallic frames";
                        centerThirdRule = "The center vertical third of the image must be completely clean, flat, and empty (just the smooth gradient background) to allow content overlay.";
                    } else if (appTypeLower.includes('finance') || appTypeLower.includes('money') || appTypeLower.includes('tracker') || appTypeLower.includes('wallet') || appTypeLower.includes('budget')) {
                        promptHeader = "A sleek, modern premium tech digital art background with soft studio lighting.";
                        visualStyle = "sleek, modern premium tech design with high-end glassmorphism and soft studio lighting";
                        thematicElements = "sleek minimalist 3D geometric glassmorphism, elegant thin lines, floating abstract coins, translucent cards, and smooth modern gradients";
                        centerThirdRule = "The center vertical third of the image must be completely clean, flat, and empty (just the smooth gradient background) to allow content overlay.";
                    } else if (appTypeLower.includes('habit') || appTypeLower.includes('health') || appTypeLower.includes('fitness') || appTypeLower.includes('sport')) {
                        promptHeader = "A clean, energetic modern digital art background with dynamic lighting.";
                        visualStyle = "energetic, clean modern aesthetic with smooth organic shapes and dynamic lighting";
                        thematicElements = "clean organic 3D shapes, soft curves, floating checklist motifs, stylized trophy icons, and energetic flowing lines";
                        centerThirdRule = "The center vertical third of the image must be completely clean, flat, and empty (just the smooth gradient background) to allow content overlay.";
                    } else if (appTypeLower.includes('social') || appTypeLower.includes('chat') || appTypeLower.includes('connect') || appTypeLower.includes('talk')) {
                        promptHeader = "A warm, friendly digital art background with cozy studio lighting.";
                        visualStyle = "warm, friendly modern aesthetic with cozy studio lighting";
                        thematicElements = "floating speech bubbles, heart elements, stylized connection nodes, warm lighting, and smooth rounded shapes";
                        centerThirdRule = "The center vertical third of the image must be completely clean, flat, and empty (just the smooth gradient background) to allow content overlay.";
                    } else if (appTypeLower.includes('language') || appTypeLower.includes('learn') || appTypeLower.includes('education') || appTypeLower.includes('vocab')) {
                        promptHeader = "A vibrant, playful digital art background with soft studio lighting.";
                        visualStyle = "vibrant, playful, modern minimalist claymation style with smooth glossy textures";
                        thematicElements = "playful minimalist 3D shapes (spheres, rings, smooth wave curves), educational vector motifs, floating stylized stars, speech bubbles, and clean cartoon elements";
                        centerThirdRule = "The center vertical third of the image must be completely clean, flat, and empty (just the smooth gradient background) to allow content overlay.";
                    } else if (vibeLower.includes('minimalist') || vibeLower.includes('dark mode') || vibeLower.includes('clean')) {
                        promptHeader = "A pristine, minimalist digital art background with soft studio lighting.";
                        visualStyle = "pristine, minimalist, elegant abstract background with subtle shadows";
                        thematicElements = "smooth layered sheets, soft shadows, thin geometric lines, and clean gradient backdrops";
                        centerThirdRule = "The center vertical third of the image must be completely clean, flat, and empty (just the smooth gradient background) to allow content overlay.";
                    }
                    
                    promptText = `${promptHeader}
Visual style: ${visualStyle}.
Composition: features beautiful ${thematicElements} that convey a ${vibe} vibe.
Color palette: ${colors}.

CRITICAL RULES:
- ONLY abstract background art and thematic shapes. No characters, no human figures, no animals.
- No devices, no cellphones, no smartphones, no screens, no UI elements.
- No text, no letters, no words.
- ${centerThirdRule}`;
                }


                let response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        instances: [
                            {
                                prompt: promptText
                            }
                        ],
                        parameters: {
                            sampleCount: 1,
                            outputOptions: {
                                mimeType: "image/jpeg"
                            }
                        }
                    })
                });

                let usedModel = requestedModel;
                if (response.status === 429 || response.status === 404) {
                    console.warn(`Model ${requestedModel} failed with ${response.status}. Retrying with imagen-3.0-fast-generate-001...`);
                    usedModel = 'imagen-3.0-fast-generate-001';
                    const fallbackEndpoint = `https://${host}/v1/projects/${projectId}/locations/${aiLocation}/publishers/google/models/imagen-3.0-fast-generate-001:predict`;
                    response = await fetch(fallbackEndpoint, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            instances: [{ prompt: promptText }],
                            parameters: { sampleCount: 1 }
                        })
                    });
                }

                if (!response.ok) {
                    const errText = await response.text();
                    console.error('Image Generation Error:', errText);
                    throw new Error(`API returned ${response.status}`);
                }

                const data = await response.json();
                
                let base64Image = null;
                if (data.predictions && data.predictions.length > 0) {
                    // Handle Vertex AI Imagen response format
                    base64Image = data.predictions[0].bytesBase64Encoded || data.predictions[0].bytes;
                }
                
                if (!base64Image) {
                    throw new Error("No image generated");
                }

                plan.push({
                    screenshotIndex: analysis.screenshotIndex ?? index,
                    generatedImageBase64: base64Image,
                    headline: analysis.headline || '',
                    subheadline: analysis.subheadline || '',
                    textStyle: analysis.textStyle || null,
                    screenshotPositionPreset: analysis.screenshotPositionPreset || 'centered',
                    screenshotScale: analysis.screenshotScale || null,
                    usedModel: usedModel,
                    debugMetadata: {
                        executionTimeMs: Date.now() - startTime,
                        prompt: promptText,
                        status: response.status
                    }
                });

            } catch (err) {
                console.error(`Failed to generate image for index ${index}`, err);
            }
        });

        await Promise.all(generationPromises);

        // Sort plan back by original index
        plan.sort((a, b) => a.screenshotIndex - b.screenshotIndex);

        return res.status(200).json({
            success: true,
            plan: plan,
            chatLogs: {
                phase1: "Analyzed design capabilities.",
                phase2: "Generated premium full-canvas backgrounds."
            }
        });

    } catch (error) {
        console.error('generateBackgrounds error:', error);
        return res.status(500).json({ error: error.message });
    }
});

exports.applyChanges = functions.https.onRequest({ timeoutSeconds: 300 }, async (req, res) => {
    setCorsHeaders(res);
    
    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { projectId, changes } = req.body;
        
        if (!projectId) {
            return res.status(400).json({ error: 'No projectId provided' });
        }
        
        await db.collection('projects').doc(projectId).update({
            aiImprovements: changes,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error applying changes:', error);
        return res.status(500).json({ error: error.message });
    }
});

// ============================================
// ENDPOINT 4: Translate text
// ============================================
exports.translateText = functions.https.onRequest({ timeoutSeconds: 300 }, async (req, res) => {
    setCorsHeaders(res);
    
    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const { text, sourceLang, targetLangs, texts } = req.body;
        
        if ((!text && !texts) || !sourceLang || !targetLangs || targetLangs.length === 0) {
            return res.status(400).json({ error: 'Missing required fields: text or texts, sourceLang, or targetLangs' });
        }

        // Helper translation function using Google Translate's free web API
        const translateTextFree = async (txt, src, target) => {
            if (!txt || txt.trim() === '') return '';
            
            const normalizeLang = (lang) => {
                const lower = lang.toLowerCase();
                if (lower === 'zh-tw' || lower === 'zh-hk') return 'zh-TW';
                if (lower.startsWith('zh')) return 'zh-CN';
                if (lower === 'pt-br') return 'pt-BR';
                if (lower === 'en-gb') return 'en';
                return lower.split('-')[0];
            };

            const sl = normalizeLang(src);
            const tl = normalizeLang(target);

            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(txt)}`;
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`HTTP error ${response.status}`);
                }
                const data = await response.json();
                if (data && data[0]) {
                    return data[0]
                        .map(item => item[0])
                        .filter(Boolean)
                        .join('');
                }
                return txt;
            } catch (err) {
                console.error(`[Translation Error] Failed translating "${txt.substring(0, 20)}" to ${target}:`, err);
                return txt; // Fallback to original text on failure
            }
        };

        if (texts && Array.isArray(texts)) {
            const results = {};
            // Translate each text item in parallel
            await Promise.all(texts.map(async (item, index) => {
                results[index] = {};
                // Translate to each target language in parallel
                await Promise.all(targetLangs.map(async (lang) => {
                    results[index][lang] = await translateTextFree(item.text, sourceLang, lang);
                }));
            }));
            return res.status(200).json(results);
        } else {
            const results = {};
            // Translate the single text to all target languages in parallel
            await Promise.all(targetLangs.map(async (lang) => {
                results[lang] = await translateTextFree(text, sourceLang, lang);
            }));
            return res.status(200).json(results);
        }
    } catch (error) {
        console.error('Error translating text:', error);
        return res.status(500).json({ error: error.message });
    }
});