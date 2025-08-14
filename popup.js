// --- STATE MANAGEMENT ---
let isRunning = false;
let currentMode = 'scrape';

// --- DEFAULT SETTINGS ---
const DEFAULT_SETTINGS = {
    // Unfollow Mode
    unfollowLimit: 40,
    // Delete Mode
    deleteLimit: 1000,
    // Universal Delays (used by unfollow, delete, undo reposts)
    minDelay: 5000,
    maxDelay: 10000,
    // Universal Scroll Delay
    scrollDelay: 3000,
};

// --- DOM ELEMENTS ---
const modeSelector = document.getElementById('modeSelector');
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const copyButton = document.getElementById('copyButton');
const exportButton = document.getElementById('exportButton');
const resultsArea = document.getElementById('results');
const statusDiv = document.getElementById('status');
const scrapeControls = document.getElementById('scrape-mode-controls');
const unfollowControls = document.getElementById('unfollow-mode-controls');
const deleteControls = document.getElementById('delete-mode-controls');
const undoRepostsControls = document.getElementById('undo-reposts-mode-controls');
// Settings Inputs
const settingsInputs = document.querySelectorAll('.settings-input');

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', initializePopup);
modeSelector.addEventListener('change', handleModeChange);
startButton.addEventListener('click', handleStart);
stopButton.addEventListener('click', handleStop);
copyButton.addEventListener('click', handleCopy);
exportButton.addEventListener('click', handleExport);
settingsInputs.forEach(input => input.addEventListener('input', saveSettings));

// --- INITIALIZATION ---
async function initializePopup() {
    await loadAndApplySettings();

    const { savedMode } = await chrome.storage.local.get('savedMode');
    if (savedMode) {
        modeSelector.value = savedMode;
        currentMode = savedMode;
    }
    updateUIVisibility();
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !tab.url.startsWith("https://x.com")) {
        startButton.disabled = true;
        statusDiv.textContent = 'Navigate to X.com to use this tool.';
        return;
    }

    if (currentMode === 'unfollow' && !tab.url.includes('/following')) {
        startButton.disabled = true;
    } else {
        startButton.disabled = false;
    }
}

// --- SETTINGS LOGIC ---
async function loadAndApplySettings() {
    const { userSettings } = await chrome.storage.local.get('userSettings');
    const settings = { ...DEFAULT_SETTINGS, ...userSettings };

    for (const key in settings) {
        const inputElement = document.getElementById(key);
        if (inputElement) {
            inputElement.value = settings[key];
        }
    }
}

function saveSettings() {
    const newSettings = {};
    settingsInputs.forEach(input => {
        if (input.id) {
            newSettings[input.id] = parseInt(input.value, 10) || 0;
        }
    });
    chrome.storage.local.set({ userSettings: newSettings });
}

async function getSettings() {
    const { userSettings } = await chrome.storage.local.get('userSettings');
    return { ...DEFAULT_SETTINGS, ...userSettings };
}

// --- UI LOGIC ---
function handleModeChange() {
    currentMode = modeSelector.value;
    chrome.storage.local.set({ savedMode: currentMode });
    updateUIVisibility();
    initializePopup(); // Re-check button states
}

function updateUIVisibility() {
    scrapeControls.classList.toggle('hidden', currentMode !== 'scrape');
    unfollowControls.classList.toggle('hidden', currentMode !== 'unfollow');
    deleteControls.classList.toggle('hidden', currentMode !== 'delete');
    undoRepostsControls.classList.toggle('hidden', currentMode !== 'undo_reposts');
    
    if (isRunning) {
        startButton.classList.add('hidden');
        stopButton.classList.remove('hidden');
    } else {
        startButton.classList.remove('hidden');
        stopButton.classList.add('hidden');
    }
}

function setRunningState(running) {
    isRunning = running;
    startButton.disabled = running;
    modeSelector.disabled = running;
    settingsInputs.forEach(input => input.disabled = running);
    updateUIVisibility();
}

// --- ACTION HANDLERS ---
async function handleStart() {
    setRunningState(true);
    statusDiv.textContent = 'Starting...';
    resultsArea.value = '';
    copyButton.classList.add('hidden');
    exportButton.classList.add('hidden');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const settings = await getSettings(); // Get current settings

    // Inject listener for live updates
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => { window.updatePopup = (message) => chrome.runtime.sendMessage(message); }
    });

    // Execute the main function based on mode
    let scriptToInject;
    if (currentMode === 'delete') scriptToInject = deleteRepliesAdvancedInjected;
    else if (currentMode === 'undo_reposts') scriptToInject = undoAllRepostsInjected;
    else scriptToInject = masterFunction;

    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scriptToInject,
        args: [currentMode, settings] // Pass mode AND settings
    });
}

function handleStop() {
    setRunningState(false);
    statusDiv.textContent = 'Stopping process...';
    chrome.tabs.reload(); 
}

function handleCopy() {
    navigator.clipboard.writeText(resultsArea.value)
        .then(() => {
            copyButton.textContent = 'Copied!';
            setTimeout(() => { copyButton.textContent = 'Copy to Clipboard'; }, 2000);
        });
}

function handleExport() {
    const blob = new Blob([resultsArea.value], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentMode}_export_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

// --- MESSAGE HANDLING from Content Script ---
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'UPDATE') {
        statusDiv.textContent = message.status;
    } else if (message.type === 'COMPLETE') {
        setRunningState(false);
        statusDiv.textContent = message.status;
        if (message.data && message.data.length > 0) {
            resultsArea.value = message.data;
            copyButton.classList.remove('hidden');
            exportButton.classList.remove('hidden');
        }
    } else if (message.type === 'ERROR') {
        setRunningState(false);
        statusDiv.textContent = `Error: ${message.error}`;
    }
});


// ===================================================================
// == INJECTED FUNCTIONS ==
// ===================================================================

function masterFunction(mode, settings) {
    const wait = (ms) => new Promise(res => setTimeout(res, ms));
    const getRandomDelay = () => Math.floor(Math.random() * (settings.maxDelay - settings.minDelay + 1)) + settings.minDelay;

    // --- SCRAPE MODE LOGIC ---
    async function scrapeUsers() {
        let collectedData = [];
        const processedLinks = new Set();
        while (true) {
            document.querySelectorAll('[data-testid="UserCell"]').forEach(cell => {
                const userLinkElement = cell.querySelector('a[href^="/"][role="link"]');
                if (!userLinkElement) return;
                const userHandle = userLinkElement.getAttribute('href');
                if (processedLinks.has(userHandle)) return;
                processedLinks.add(userHandle);
                const displayName = cell.querySelector('div[data-testid*="User-Name"] > div:first-child')?.innerText || 'N/A';
                collectedData.push({ handle: userHandle.substring(1), displayName: displayName.replace(/\n/g, ' ') });
            });
            window.updatePopup({ type: 'UPDATE', status: `Found ${collectedData.length} users...` });
            let lastHeight = document.body.scrollHeight;
            window.scrollTo(0, lastHeight);
            await wait(settings.scrollDelay);
            if (document.body.scrollHeight === lastHeight) break;
        }
        const header = '@dhiya_000,';
        const rows = collectedData.map(u => `@${u.handle},`);
        const csv = [header, ...rows].join('\n');
        window.updatePopup({ type: 'COMPLETE', status: `Scraping complete! Found ${collectedData.length} users.`, data: csv });
    }

    // --- UNFOLLOW MODE LOGIC ---
    async function unfollowNonFollowers() {
        let unfollowedCount = 0;
        while (unfollowedCount < settings.unfollowLimit) {
            let foundUserToUnfollow = false;
            const userCells = document.querySelectorAll('[data-testid="UserCell"]');
            for (const cell of userCells) {
                if (cell.innerText.includes('Follows you') || !cell.querySelector('[data-testid$="-unfollow"]')) continue;
                foundUserToUnfollow = true;
                cell.querySelector('[data-testid$="-unfollow"]').click();
                await wait(500);
                const confirmButton = document.querySelector('[data-testid="confirmationSheetConfirm"]');
                if (confirmButton) {
                    confirmButton.click();
                    unfollowedCount++;
                    window.updatePopup({ type: 'UPDATE', status: `Unfollowed ${unfollowedCount}/${settings.unfollowLimit} users...` });
                    await wait(getRandomDelay());
                }
                break;
            }
            if (!foundUserToUnfollow) {
                 let lastHeight = document.body.scrollHeight;
                 window.scrollTo(0, lastHeight);
                 await wait(settings.scrollDelay);
                 if(document.body.scrollHeight === lastHeight) break;
            }
        }
        window.updatePopup({ type: 'COMPLETE', status: `Process complete! Unfollowed ${unfollowedCount} users.`, data: `Unfollowed: ${unfollowedCount}` });
    }

    if (mode === 'scrape') scrapeUsers().catch(e => window.updatePopup({ type: 'ERROR', error: e.message }));
    else if (mode === 'unfollow') unfollowNonFollowers().catch(e => window.updatePopup({ type: 'ERROR', error: e.message }));
}

function deleteRepliesAdvancedInjected(mode, settings) {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const getRandomDelay = () => Math.floor(Math.random() * (settings.maxDelay - settings.minDelay + 1)) + settings.minDelay;
    
    async function deleteRepliesAdvanced() {
        window.updatePopup?.({ type: 'UPDATE', status: `Starting auto-delete of replies...` });
        let deletedCount = 0;
        while (deletedCount < settings.deleteLimit) {
            const tweetsToProcess = document.querySelectorAll('[data-testid="tweet"]:not([data-processed="true"])');
            if (tweetsToProcess.length === 0) {
                window.scrollTo(0, document.body.scrollHeight);
                await sleep(settings.scrollDelay);
                if (document.querySelectorAll('[data-testid="tweet"]:not([data-processed="true"])').length === 0) {
                    window.updatePopup?.({ type: 'COMPLETE', status: `No more replies found.`, data: `Deleted: ${deletedCount}` });
                    return;
                }
                continue;
            }
            for (const tweet of tweetsToProcess) {
                tweet.setAttribute('data-processed', 'true');
                if (deletedCount >= settings.deleteLimit) break;
                try {
                    tweet.querySelector('[data-testid="caret"]')?.click();
                    await sleep(500);
                    const menuItems = document.querySelectorAll('[role="menuitem"]');
                    const deleteOption = Array.from(menuItems).find(item => item.innerText.includes("Delete"));
                    if (!deleteOption) continue;
                    deleteOption.click();
                    await sleep(500);
                    document.querySelector('[data-testid="confirmationSheetConfirm"]')?.click();
                    deletedCount++;
                    window.updatePopup?.({ type: 'UPDATE', status: `Deleted ${deletedCount}/${settings.deleteLimit} replies...` });
                    await sleep(getRandomDelay());
                } catch (error) { /* Ignore errors and continue */ }
            }
        }
        window.updatePopup?.({ type: 'COMPLETE', status: `Script finished. Deleted ${deletedCount} replies.`, data: `Deleted: ${deletedCount}` });
    }
    deleteRepliesAdvanced().catch(e => window.updatePopup({ type: 'ERROR', error: e.message }));
}

function undoAllRepostsInjected(mode, settings) {
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const getRandomDelay = () => Math.floor(Math.random() * (settings.maxDelay - settings.minDelay + 1)) + settings.minDelay;

    (async () => {
        let undoneCount = 0;
        window.updatePopup?.({ type: 'UPDATE', status: 'Starting to undo reposts...' });
        mainLoop:
        while (true) {
            let foundActionableRepost = false;
            const allTweetsOnScreen = document.querySelectorAll('article[data-testid="tweet"]');
            for (const tweet of allTweetsOnScreen) {
                const socialContext = tweet.querySelector('span[data-testid="socialContext"]');
                if (socialContext && socialContext.textContent.includes('You reposted')) {
                    const undoButton = tweet.querySelector('[data-testid="unretweet"]');
                    if (undoButton) {
                        undoButton.click();
                        await wait(500);
                        const confirmButton = document.querySelector('[data-testid="unretweetConfirm"]');
                        if (confirmButton) {
                            confirmButton.click();
                            undoneCount++;
                            foundActionableRepost = true;
                            window.updatePopup?.({ type: 'UPDATE', status: `Undid ${undoneCount} repost(s)...` });
                            await wait(getRandomDelay());
                            break; 
                        }
                    }
                }
            }
            if (!foundActionableRepost) {
                const lastHeight = document.documentElement.scrollHeight;
                window.scrollTo(0, lastHeight);
                await wait(settings.scrollDelay);
                if (document.documentElement.scrollHeight === lastHeight) {
                    await wait(settings.scrollDelay * 2); // Wait a bit longer to be sure
                    if (document.documentElement.scrollHeight === lastHeight) break mainLoop;
                }
            }
        }
        window.updatePopup?.({ type: 'COMPLETE', status: `Finished! Undid ${undoneCount} reposts.`, data: `Total reposts undone: ${undoneCount}` });
    })().catch(e => window.updatePopup({ type: 'ERROR', error: e.message }));
}