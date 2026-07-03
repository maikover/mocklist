// AI Improve Feature - Firebase Version
// Uses Firebase Cloud Functions for AI analysis (Gemini) and planning (MiniMax M2.7)

/**
 * Available Gemini models for Firebase AI Logic
 * Source: https://firebase.google.com/docs/ai-logic/models
 */
const GEMINI_MODELS = [
    { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', description: 'Fastest, cheapest for high-volume tasks' },
    { id: 'gemini-3-flash', name: 'Gemini 3 Flash', description: 'Balanced speed and excellent layout planning' },
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro (high)', description: 'Best quality with deep reasoning (higher latency)' },
    { id: 'gemini-3.1-pro-low', name: 'Gemini 3.1 Pro (low)', description: 'Best quality with fast reasoning setting' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Stable, legacy flash model' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Stable, legacy pro model' }
];

// State for AI settings (persisted with app state)
let aiSettings = {
    selectedModel: 'gemini-2.5-flash', // Default model
};

// Store last AI responses for metadata export
let lastAIAnalysis = null;
let lastAIPlan = null;
let lastAIChatLogs = null;

// Load AI settings from state if available
if (typeof state !== 'undefined' && state.aiSettings) {
    aiSettings = { ...aiSettings, ...state.aiSettings };
}

// Save AI settings when changed
function saveAISettings() {
    if (typeof state !== 'undefined') {
        state.aiSettings = aiSettings;
        saveState();
    }
}

// Helper to convert hex to RGB for luminance contrast calculations
function hexToRgbLocal(hex) {
    if (!hex) return null;
    const cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
        const r = parseInt(cleanHex[0] + cleanHex[0], 16);
        const g = parseInt(cleanHex[1] + cleanHex[1], 16);
        const b = parseInt(cleanHex[2] + cleanHex[2], 16);
        return { r, g, b };
    } else if (cleanHex.length === 6) {
        const r = parseInt(cleanHex.slice(0, 2), 16);
        const g = parseInt(cleanHex.slice(2, 4), 16);
        const b = parseInt(cleanHex.slice(4, 6), 16);
        return { r, g, b };
    }
    return null;
}

/**
 * Main entry point - shows "Improve with AI" button when screenshots exist
 */
function setupImproveWithAI() {
    window._aiDebug = true;
    try {
        const btn = document.getElementById('ai-improve-btn');
        if (!btn) {
            console.error('[AI] #ai-improve-btn not found');
            return;
        }
        console.log('[AI] Button found, attaching listener...');
        btn.addEventListener('click', startAIImprove);
    } catch(e) {
        console.error('[AI] setupImproveWithAI error:', e);
    }
}

function setAIButtonLoading(loading) {
    const btn = document.getElementById('ai-improve-btn');
    if (!btn) return;
    const spinner = btn.querySelector('.ai-spinner');
    const btnText = btn.querySelector('.ai-btn-text');
    if (spinner) spinner.style.display = loading ? 'inline-flex' : 'none';
    if (btnText) btnText.style.display = loading ? 'none' : 'inline-flex';
    btn.disabled = loading;
}

function updateImproveButtonVisibility() {
    const btn = document.getElementById('ai-improve-btn');
    if (btn) {
        btn.style.display = typeof state !== 'undefined' && state.screenshots.length > 0 ? '' : 'none';
    }
}

async function startAIImprove() {
    console.log('[AI] startAIImprove triggered');
    if (typeof state === 'undefined' || !state.screenshots || state.screenshots.length === 0) {
        console.warn('[AI] Cannot start AI improvement: state.screenshots is empty or undefined.');
        alert('Por favor, agrega al menos una captura de pantalla antes de usar la optimización de IA.');
        setAIButtonLoading(false);
        return;
    }
    
    setAIButtonLoading(true);
    
    // Show marketing input modal first
    showAIImproveModal();
}

async function runASOPipeline() {
    try {
        // Phase 1: Analyze all screenshots via Firebase
        updateImprovePhase(1, 'Analyzing screenshots...');
        const screenshotsData = await collectScreenshotsData();
        
        if (screenshotsData.length === 0) {
            throw new Error('No screenshots with images to analyze');
        }
        
        const globalModel = localStorage.getItem('aiModel') || 'gemini-3.1-flash-lite';
        
        // Helper to convert language code to human readable name
        const getLanguageName = (code) => {
            const names = {
                'en': 'English', 'en-gb': 'English', 'de': 'German', 'fr': 'French',
                'es': 'Spanish', 'it': 'Italian', 'pt': 'Portuguese', 'pt-br': 'Portuguese',
                'nl': 'Dutch', 'ru': 'Russian', 'ja': 'Japanese', 'ko': 'Korean',
                'zh': 'Chinese', 'zh-tw': 'Chinese', 'ar': 'Arabic', 'hi': 'Hindi',
                'tr': 'Turkish', 'pl': 'Polish', 'sv': 'Swedish', 'da': 'Danish',
                'no': 'Norwegian', 'fi': 'Finnish', 'th': 'Thai', 'vi': 'Vietnamese',
                'id': 'Indonesian', 'uk': 'Ukrainian'
            };
            return names[code.toLowerCase()] || code;
        };
        const currentLang = typeof state !== 'undefined' ? (state.currentLanguage || 'en') : 'en';
        const targetLang = getLanguageName(currentLang);

        // Call Firebase function for analysis using fixed gemini-3.1-flash-lite
        const analysis = await callFirebaseFunction('analyzeScreenshots', {
            screenshots: screenshotsData,
            targetLanguage: targetLang
        });

        // Log the models used for screenshot analysis
        if (analysis.analyses && analysis.analyses.length > 0) {
            console.log('%c[AI] Vision Model Used for analysis:', 'color: #00bcd4; font-weight: bold;');
            analysis.analyses.forEach((a, idx) => {
                const time = a.debugMetadata?.executionTimeMs ? `${a.debugMetadata.executionTimeMs}ms` : 'N/A';
                console.log(`- Screenshot ${idx + 1} (${a.screenPurpose || 'Screenshot'}): ${a.usedModel || 'gemini-3.1-flash-lite'} [Time: ${time}]`);
            });
        }

        // Phase 2: Generating full-canvas backgrounds using Gemini 3.1 Flash Image
        updateImprovePhase(2, 'Generating premium backgrounds via AI...');
        const result = await callFirebaseFunction('generateBackgrounds', {
            analyses: analysis.analyses,
            marketingContext: activeMarketingContext,
            targetLanguage: targetLang
        });

        // Log the models used for image generation
        if (result.plan && result.plan.length > 0) {
            console.log('%c[AI] Image Model Used for background generation:', 'color: #00bcd4; font-weight: bold;');
            result.plan.forEach((p, idx) => {
                const time = p.debugMetadata?.executionTimeMs ? `${p.debugMetadata.executionTimeMs}ms` : 'N/A';
                console.log(`- Screenshot ${idx + 1}: ${p.usedModel || 'imagen-3.0-generate-001'} [Time: ${time}]`);
            });
        }

        // Store AI responses for metadata export
        lastAIAnalysis = analysis;
        lastAIPlan = result.plan || [];
        lastAIChatLogs = result.chatLogs || {};

        // Print logs
        const logs = result.chatLogs || {};

        console.group('%c🤖 [AI ASO BACKGROUND GENERATOR]', 'background: #6200ee; color: #fff; padding: 6px 12px; border-radius: 4px; font-weight: bold; font-size: 14px;');
        console.log('%c[PHASE 1: AESTHETIC AUDIT]', 'color: #ff9800; font-weight: bold; font-size: 12px; margin-top: 12px;');
        console.log(logs.phase1 || 'Done.');
        console.log('%c[PHASE 2: FULL CANVAS GENERATION]', 'color: #4caf50; font-weight: bold; font-size: 12px; margin-top: 12px;');
        console.log(logs.phase2 || 'Done.');
        console.groupEnd();

        // Phase 3: Apply changes
        updateImprovePhase(3, 'Applying backgrounds and device positioning...');
        const plansArray = result.plan || [];
        await applyImprovements(plansArray, currentLang);

        if (typeof updateScreenshotList === 'function') updateScreenshotList();
        if (typeof updateCanvas === 'function') updateCanvas();

        updateImprovePhase(3, 'Done!', true);
        setTimeout(() => {
            closeAIImproveModal();
            if (typeof syncUIWithState === 'function') syncUIWithState();
            if (typeof updateCanvas === 'function') updateCanvas();
            if (typeof updateScreenshotList === 'function') updateScreenshotList();
        }, 1500);
    } catch (err) {
        console.error('AI Improve failed:', err);
        if (typeof showToast === 'function') {
            showToast('AI Improve failed: ' + err.message, 'error');
        } else {
            alert('AI Improve failed: ' + err.message);
        }
        closeAIImproveModal();
    } finally {
        setAIButtonLoading(false);
    }
}

/**
 * Collect screenshot data as base64 for Firebase function
 */
async function collectScreenshotsData() {
    const screenshots = state.screenshots;
    const data = [];
    
    for (let i = 0; i < screenshots.length; i++) {
        const ss = screenshots[i];
        const img = ss.localizedImages?.[state.currentLanguage]?.image || ss.image;
        if (img && img.src) {
            try {
                const base64 = await imageToBase64(img.src);
                data.push({
                    index: i,
                    name: ss.name,
                    base64: base64
                });
            } catch (e) {
                console.warn('Failed to convert image for screenshot', i, e);
            }
        }
    }
    
    return data;
}

/**
 * Convert image URL to base64
 */
async function imageToBase64(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            // Downscale image if width or height exceeds 1024px
            const MAX_DIM = 1024;
            let width = img.width;
            let height = img.height;
            
            if (width > MAX_DIM || height > MAX_DIM) {
                if (width > height) {
                    height = Math.round((height * MAX_DIM) / width);
                    width = MAX_DIM;
                } else {
                    width = Math.round((width * MAX_DIM) / height);
                    height = MAX_DIM;
                }
            }
            
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            try {
                // Compress as JPEG at 0.75 quality for massive size reduction
                const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
                // Remove data:image/jpeg;base64, prefix
                const base64 = dataUrl.split(',')[1];
                resolve(base64);
            } catch (e) {
                reject(e);
            }
        };
        img.onerror = reject;
        img.src = url;
    });
}

/**
 * Call Firebase Cloud Function via HTTP REST API
 */
async function callFirebaseFunction(functionName, data) {
    try {
        let url = `https://us-central1-mocklist-app.cloudfunctions.net/${functionName}`;
        
        // Dynamically detect local development environments to route to the Firebase Emulator
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            url = `http://127.0.0.1:5001/mocklist-app/us-central1/${functionName}`;
            console.log(`[AI] Dev Environment: Redirecting ${functionName} to local emulator...`);
        }
        
        console.log(`[AI] Calling ${functionName}...`);
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            mode: 'cors'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        const result = await response.json();
        console.log(`[AI] ${functionName} result:`, result.success ? 'OK' : 'FAILED');
        return result;
    } catch (err) {
        console.error(`Firebase function ${functionName} error:`, err);
        throw new Error(`Firebase error: ${err.message}`);
    }
}

// ===== PHASE 1: ANALYZE (handled by Firebase) =====
// The Firebase function analyzeScreenshots handles vision analysis
// We just need to collect and send the screenshots

// ===== PHASE 2: PLAN (handled by Firebase) =====
// The Firebase function planImprovements handles planning with MiniMax M2.7

async function applyImprovements(plans, targetLang = 'en') {
    const total = plans.length;
    console.log('[AI] applyImprovements called with', total, 'plans');
    
    // Curated layout templates to ensure perfect visual balance (alternating top and bottom text presets)
    const CURATED_LAYOUTS = [
        { presetName: 'float-center', scale: 64, textPosition: 'top', textOffsetY: 12, align: 'center' },
        { presetName: 'tilt-left', scale: 68, textPosition: 'top', textOffsetY: 12, align: 'center' },
        { presetName: 'tilt-right', scale: 68, textPosition: 'top', textOffsetY: 12, align: 'center' },
        { presetName: 'float-bottom', scale: 64, textPosition: 'top', textOffsetY: 12, align: 'center' },
        { presetName: 'bleed-bottom', scale: 85, textPosition: 'top', textOffsetY: 10, align: 'center' },
        { presetName: 'bleed-top', scale: 85, textPosition: 'bottom', textOffsetY: 10, align: 'center' },
        
        // Curated presets with text in the bottom area (phone elements shifted appropriately)
        { presetName: 'centered', scale: 70, textPosition: 'bottom', textOffsetY: 12, align: 'center' },
        { presetName: 'bleed-top', scale: 85, textPosition: 'bottom', textOffsetY: 12, align: 'center' },
        { presetName: 'float-center', scale: 64, textPosition: 'bottom', textOffsetY: 12, align: 'center' },
        { presetName: 'tilt-left', scale: 68, textPosition: 'bottom', textOffsetY: 12, align: 'center' },
        { presetName: 'tilt-right', scale: 68, textPosition: 'bottom', textOffsetY: 12, align: 'center' }
    ];

    // Shuffle layout array using Fisher-Yates to randomize, ensuring variety
    const shuffledLayouts = [...CURATED_LAYOUTS];
    for (let j = shuffledLayouts.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [shuffledLayouts[j], shuffledLayouts[k]] = [shuffledLayouts[k], shuffledLayouts[j]];
    }
    
    for (let i = 0; i < plans.length; i++) {
        const plan = plans[i];
        
        console.log('[AI] Processing plan', i);
        // AI sometimes omits screenshotIndex — fall back to array position
        const screenshotIndex = plan.screenshotIndex ?? i;
        const screenshot = state.screenshots[screenshotIndex];
        if (!screenshot) {
            console.warn('[AI] No screenshot found at index', plan.screenshotIndex);
            continue;
        }
        
        updateImproveProgress(i + 1, total);
        
        if (plan.generatedImageBase64) {
            try {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                
                // Add prefix if missing
                let base64str = plan.generatedImageBase64;
                if (!base64str.startsWith('data:image')) {
                    base64str = 'data:image/jpeg;base64,' + base64str;
                }
                
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = base64str;
                });
                
                if (!screenshot.background) screenshot.background = JSON.parse(JSON.stringify(state.defaults.background));
                screenshot.background.type = 'image';
                screenshot.background.image = img;
                screenshot.background.imageFit = 'cover';
                screenshot.background.imageBlur = 0;
                screenshot.background.overlayOpacity = 0;
                
                // Apply AI generated copy if available
                if (!screenshot.text) screenshot.text = JSON.parse(JSON.stringify(state.defaults.text));
                
                if (plan.headline) {
                    screenshot.text.headlineEnabled = true;
                    if (!screenshot.text.headlines) screenshot.text.headlines = {};
                    screenshot.text.headlines[targetLang] = plan.headline;
                    screenshot.text.currentHeadlineLang = targetLang;
                    screenshot.text.currentLayoutLang = targetLang;
                    
                    if (!screenshot.text.headlineLanguages) screenshot.text.headlineLanguages = [];
                    if (!screenshot.text.headlineLanguages.includes(targetLang)) {
                        screenshot.text.headlineLanguages.push(targetLang);
                    }
                }
                if (plan.subheadline) {
                    screenshot.text.subheadlineEnabled = true;
                    if (!screenshot.text.subheadlines) screenshot.text.subheadlines = {};
                    screenshot.text.subheadlines[targetLang] = plan.subheadline;
                    screenshot.text.currentSubheadlineLang = targetLang;
                    
                    if (!screenshot.text.subheadlineLanguages) screenshot.text.subheadlineLanguages = [];
                    if (!screenshot.text.subheadlineLanguages.includes(targetLang)) {
                        screenshot.text.subheadlineLanguages.push(targetLang);
                    }
                }

                // Apply AI text styling
                if (plan.textStyle) {
                    const style = plan.textStyle;
                    if (style.headlineColor) screenshot.text.headlineColor = style.headlineColor;
                    if (style.subheadlineColor) screenshot.text.subheadlineColor = style.subheadlineColor;
                    if (style.headlineWeight) screenshot.text.headlineWeight = style.headlineWeight;
                    if (style.subheadlineWeight) screenshot.text.subheadlineWeight = style.subheadlineWeight;
                    
                    if (style.textBackingBoxType) {
                        screenshot.text.textBackingBoxType = style.textBackingBoxType;
                        screenshot.text.textBackingBox = style.textBackingBoxType !== 'none';
                    }
                    if (style.textBackingBoxColor) screenshot.text.textBackingBoxColor = style.textBackingBoxColor;
                    
                    // Automatically enable stroke for both headline and subheadline to guarantee contrast on complex background shapes
                    screenshot.text.headlineStrokeEnabled = true;
                    screenshot.text.subheadlineStrokeEnabled = true;

                    // Automatically compute contrasting stroke color for headline based on luminance
                    const headColor = style.headlineColor || '#ffffff';
                    const headRgb = hexToRgbLocal(headColor) || { r: 255, g: 255, b: 255 };
                    const headLuminance = (headRgb.r * 0.299 + headRgb.g * 0.587 + headRgb.b * 0.114);
                    screenshot.text.headlineStrokeColor = headLuminance < 128 ? '#FFFFFF' : '#000000';
                    screenshot.text.headlineStrokeWidth = parseInt(style.headlineStrokeWidth, 10) || 4;

                    // Automatically compute contrasting stroke color for subheadline based on luminance
                    const subColor = style.subheadlineColor || '#ffffff';
                    const subRgb = hexToRgbLocal(subColor) || { r: 255, g: 255, b: 255 };
                    const subLuminance = (subRgb.r * 0.299 + subRgb.g * 0.587 + subRgb.b * 0.114);
                    screenshot.text.subheadlineStrokeColor = subLuminance < 128 ? '#FFFFFF' : '#000000';
                    screenshot.text.subheadlineStrokeWidth = parseInt(style.subheadlineStrokeWidth, 10) || 2;
                    
                    if (style.hasOwnProperty('headlineShadowEnabled')) {
                        screenshot.text.headlineShadowEnabled = !!style.headlineShadowEnabled;
                    }
                    if (style.headlineShadowColor) screenshot.text.headlineShadowColor = style.headlineShadowColor;
                    if (style.headlineShadowOffset) screenshot.text.headlineShadowOffset = parseInt(style.headlineShadowOffset, 10);

                    if (style.hasOwnProperty('subheadlineShadowEnabled')) {
                        screenshot.text.subheadlineShadowEnabled = !!style.subheadlineShadowEnabled;
                    }
                    if (style.subheadlineShadowColor) screenshot.text.subheadlineShadowColor = style.subheadlineShadowColor;
                    if (style.subheadlineShadowOffset) screenshot.text.subheadlineShadowOffset = parseInt(style.subheadlineShadowOffset, 10);
                    
                    console.log('[AI] Applied custom marketing text styles to screenshot', screenshotIndex, style);
                }
                
                if (screenshot.background) {
                    screenshot.background.pattern = false;
                    screenshot.background.noise = false;
                }
                
                // Clear extra decorations
                screenshot.elements = [];
                console.log('[AI] Successfully applied generated background to screenshot', screenshotIndex);
            } catch (e) {
                console.error('[AI] Failed to load generated image for screenshot', screenshotIndex, e);
            }
        }
        
        // Select layout config sequentially from the shuffled array
        const layout = shuffledLayouts[i % shuffledLayouts.length];
        const presetName = layout.presetName;
        
        if (!screenshot.screenshot) screenshot.screenshot = JSON.parse(JSON.stringify(state.defaults.screenshot));
        
        const presets = {
            'centered': { scale: 70, x: 50, y: 65, rotation: 0, perspective: 0 },
            'bleed-bottom': { scale: 85, x: 50, y: 110, rotation: 0, perspective: 0 },
            'bleed-top': { scale: 85, x: 50, y: -10, rotation: 0, perspective: 0 },
            'float-center': { scale: 64, x: 50, y: 64, rotation: 0, perspective: 0 },
            'tilt-left': { scale: 68, x: 50, y: 65, rotation: -8, perspective: 0 },
            'tilt-right': { scale: 68, x: 50, y: 65, rotation: 8, perspective: 0 },
            'perspective': { scale: 68, x: 50, y: 65, rotation: 0, perspective: 15 },
            'float-bottom': { scale: 64, x: 50, y: 72, rotation: 0, perspective: 0 }
        };
        const p = presets[presetName];
        if (p) {
            screenshot.screenshot.scale = layout.scale;
            screenshot.screenshot.x = p.x;
            let targetY = p.y;
            // Symmetrically shift phone mockup up if text is at the bottom
            if (layout.textPosition === 'bottom') {
                if (presetName === 'centered') targetY = 35;
                else if (presetName === 'float-center') targetY = 36;
                else if (presetName === 'tilt-left') targetY = 35;
                else if (presetName === 'tilt-right') targetY = 35;
            }
            screenshot.screenshot.y = targetY;
            screenshot.screenshot.rotation = p.rotation;
            screenshot.screenshot.perspective = p.perspective;
            
            // Tilt in 3D mode too
            if (!screenshot.screenshot.rotation3D) {
                screenshot.screenshot.rotation3D = { x: 0, y: 0, z: 0 };
            }
            screenshot.screenshot.rotation3D.z = p.rotation;
            
            // Sync plan/metadata values for export
            plan.screenshotPositionPreset = presetName;
            plan.screenshotScale = layout.scale;
            
            console.log('[AI] Applied curated layout preset:', presetName, 'scale:', layout.scale);
        }

        // Apply curated text layout config (Position, Offset, Alignment)
        if (!screenshot.text) screenshot.text = JSON.parse(JSON.stringify(state.defaults.text));
        screenshot.text.position = layout.textPosition;
        screenshot.text.offsetY = layout.textOffsetY;
        screenshot.text.align = layout.align;
        
        // Sync language specific layout settings if any
        if (screenshot.text.languageSettings && screenshot.text.languageSettings[targetLang]) {
            screenshot.text.languageSettings[targetLang].position = layout.textPosition;
            screenshot.text.languageSettings[targetLang].offsetY = layout.textOffsetY;
        } else if (screenshot.text.languageSettings) {
            screenshot.text.languageSettings[targetLang] = {
                headlineSize: 100,
                subheadlineSize: 50,
                position: layout.textPosition,
                offsetY: layout.textOffsetY,
                lineHeight: 110
            };
        }
        
        // Small delay to show progress
        await new Promise(r => setTimeout(r, 300));
    }
}

let activeMarketingContext = '';

function showAIImproveModal() {
    console.log('[AI] Opening AI Improve Modal directly to progress...');
    
    const overlay = document.createElement('div');
    overlay.id = 'ai-improve-modal';
    overlay.className = 'modal-overlay visible';
    overlay.style.display = 'flex';
    
    overlay.innerHTML = `
        <div class="modal ai-improve-modal" style="display: block; max-width: 480px; width: 90%; text-align: left;">
            <div class="ai-improve-content" id="ai-improve-progress-content" style="display: block; width: 100%;">
                <h3>ASO Screenshot Generation</h3>
                <div class="ai-improve-phases">
                    <div class="phase phase-1 active">
                        <div class="phase-icon"><div class="ai-spinner"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg></div></div>
                        <div class="phase-text">Analyzing App & Screenshots...</div>
                    </div>
                    <div class="phase phase-2">
                        <div class="phase-icon"></div>
                        <div class="phase-text">Generating App Store Backgrounds...</div>
                    </div>
                    <div class="phase phase-3">
                        <div class="phase-icon"></div>
                        <div class="phase-text">Applying Premium Layouts...</div>
                    </div>
                </div>
                <div class="ai-improve-progress">
                    <div class="progress-bar-container" style="background: rgba(255,255,255,0.1); border-radius: 4px; height: 6px; overflow: hidden; margin-top: 15px;">
                        <div id="ai-improve-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); transition: width 0.3s ease;"></div>
                    </div>
                    <div id="ai-improve-progress-text" style="font-size: 11px; color: #888; text-align: center; margin-top: 8px;">Preparing...</div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Auto-start pipeline since we no longer require manual input context
    activeMarketingContext = ''; // AI will deduce it from images
    runASOPipeline();
}

function closeAIImproveModal() {
    const overlay = document.getElementById('ai-improve-modal');
    if (overlay) {
        overlay.remove();
    }
    setAIButtonLoading(false);
}

function updateImprovePhase(phaseNum, text, isDone = false) {
    console.log(`[AI] Phase ${phaseNum}: ${text}`);
    const phases = document.querySelectorAll('.phase');
    phases.forEach((p, idx) => {
        const pNum = idx + 1;
        const icon = p.querySelector('.phase-icon');
        const textEl = p.querySelector('.phase-text');
        
        if (pNum < phaseNum || (pNum === phaseNum && isDone)) {
            p.className = 'phase phase-' + pNum + ' done';
            icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
            if (pNum === phaseNum) textEl.textContent = text;
        } else if (pNum === phaseNum) {
            p.className = 'phase phase-' + pNum + ' active';
            icon.innerHTML = '<div class="ai-spinner"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg></div>';
            textEl.textContent = text;
        } else {
            p.className = 'phase phase-' + pNum;
            icon.innerHTML = '';
        }
    });
}

function updateImproveProgress(current, total) {
    const pct = Math.round((current / total) * 100);
    const bar = document.getElementById('ai-improve-progress-bar');
    const text = document.getElementById('ai-improve-progress-text');
    if (bar) bar.style.width = pct + '%';
    if (text) text.textContent = `Processing screenshot ${current} of ${total}...`;
}

