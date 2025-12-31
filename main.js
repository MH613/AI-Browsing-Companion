const { app, BaseWindow, WebContentsView, BrowserWindow, ipcMain, screen, desktopCapturer, safeStorage } = require('electron')
const path = require('path')
const { GoogleGenAI } = require('@google/genai')
const { ElevenLabsClient } = require('@elevenlabs/elevenlabs-js')
const fs = require('fs')
const dotenv = require('dotenv');

dotenv.config();

let file;   // user settings

const GOOGLE_CLOUD_LOCATION = 'global'

let appBar, mainWindow, browserBar
let appBarMinimizedWidth = 72
let appBarMaximizedWidth = 330
let appBarHeight = 390
let browserBarHeight = 110
let browserTabs = new Map();
let activeTab

const browsingCompanionPrompt = `
You are a real-time browsing companion.

You can see a video of the user's browser, which provides visual context for their request.

Your task:
- If the user asks a factual question, find and provide the correct answer.
- If the user asks a reasoning or explanatory question, give a clear, logical explanation.
- Use the browser video only when it is relevant to the question.

Response rules:
- Use only as many words as necessary to be clear.
- Avoid unnecessary filler or repetition.

The user asks:
`;

const createWindow = () => {
    
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

    appBar = new BrowserWindow({
        x: 10,
        y: Math.round((screenHeight - appBarHeight) / 2),
        width: appBarMinimizedWidth,
        height: appBarHeight,
        transparent: true,
        backgroundColor: '#00000000',
        resizable: false,
        movable: false,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            preload: path.join(__dirname, 'preload', 'appPreload.js')
        }
    })
    appBar.loadFile('renderer/appBar/appBar.html')

    mainWindow = new BaseWindow({ frame: false, icon: path.join(__dirname, 'assets', 'images', 'icon.png'), })
    mainWindow.setMenu(null)
    mainWindow.setIcon(path.join(__dirname, 'assets', 'images', 'icon.png'))

    // Menu Buttons Column have a width of 72
    // Menu Buttons Column start at x = 10
    // Main Window should start at x = 10 + 72 + 20
    const menuColumnWidth = Math.min(screenWidth * 0.1, 72); 
    mainWindow.setBounds({ x: (menuColumnWidth + 30), y: 15, width: (screenWidth - 72 - 40), height: (screenHeight - 30) })
    const mainWindowSize = mainWindow.contentView.getBounds()

    browserBar = new WebContentsView({
        webPreferences: {
            preload: path.join(__dirname, 'preload', 'browserPreload.js')
        }
    })

    mainWindow.contentView.addChildView(browserBar)
    browserBar.webContents.loadFile('renderer/browserBar/browserBar.html')
    browserBar.setBounds({ x: 0, y: 0, width: mainWindowSize.width, height: browserBarHeight })

    activeTab = 0

    appBar.setParentWindow(mainWindow)
}


// ----- TAB FUNCTIONS -----

function createTab(key) {
    const tab = new WebContentsView()
    const mainWindowSize = mainWindow.contentView.getBounds()
    
    browserTabs.set(key, tab);
    
    mainWindow.contentView.addChildView(tab)
    tab.webContents.loadURL('https://www.google.com')
    tab.setBounds({ x: 0, y: browserBarHeight, width: mainWindowSize.width, height: mainWindowSize.height - browserBarHeight })
    
    tab.webContents.on('did-navigate', () => {
        browserBar.webContents.send('change-tab-title', key, tab.webContents.getTitle())
    })

    tab.webContents.on('did-navigate-in-page', () => {
        browserBar.webContents.send('change-tab-title', key, tab.webContents.getTitle())
    })

    activeTab = key
}

function changeTab(target) {
    activeTab = target
    mainWindow.contentView.addChildView(browserTabs.get(activeTab))   
}

function deleteTab(target) {
    if (browserTabs.size > 1) {
        
        browserTabs.delete(target)
        
        if (activeTab == target) {
            const keys = [...browserTabs.keys()]
            const nextTabKey = Math.max(...keys)
            activeTab = nextTabKey
            mainWindow.contentView.addChildView(browserTabs.get(activeTab));
        }        
    } else {
        mainWindow.close()
    }
}


// ----- BROWSER CONTROLS -----

ipcMain.on('browserBar-back', () => {
    browserTabs.get(activeTab).webContents.navigationHistory.canGoBack() && browserTabs.get(activeTab).webContents.navigationHistory.goBack()
})

ipcMain.on('browserBar-forward', () => {
    browserTabs.get(activeTab).webContents.navigationHistory.canGoForward() && browserTabs.get(activeTab).webContents.navigationHistory.goForward()
})

ipcMain.on('browserBar-reload', () => {
    browserTabs.get(activeTab).webContents.reload()
})

ipcMain.on('browserBar-minimize', () => {
    mainWindow.minimize()
})

ipcMain.on('browserBar-maximize', () => {
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})

ipcMain.on('browserBar-close', () => {
    mainWindow.close()
    saveUserData('GOOGLE_API_KEY', process.env.GOOGLE_API_KEY)
    saveUserData('GOOGLE_CLOUD_PROJECT', process.env.GOOGLE_CLOUD_PROJECT)
    saveUserData('ELEVENLABS_API_KEY', process.env.ELEVENLABS_API_KEY)
})


// ----- TAB CONTROLS -----

ipcMain.on('create-tab', (event, key) => {
    createTab(key)
})

ipcMain.on('change-tab', (event, key) => {
    changeTab(key)
})

ipcMain.handle('delete-tab', (event, key) => {
    deleteTab(key)
    return activeTab
})


// ----- APPBAR CONTROLS -----

ipcMain.on('minimize-appBar', () => {
    appBar.setBounds({ width: appBarMinimizedWidth })
})

ipcMain.on('maximize-appBar', () => {
    appBar.setBounds({ width: appBarMaximizedWidth })
})


// ----- APP FUNCTIONING -----

ipcMain.handle('get-source', async () => {
    const sources = await desktopCapturer.getSources({ types: ['window'] })
    const targetSource = sources.find(s => s.name === mainWindow.getTitle())
    return targetSource
})

ipcMain.handle('send-raw-video', async (_event, bufferData, userText) => {

    try {
        appBar.webContents.send('set-status-text', 'Thinking')

        const startGClientInitTime = process.hrtime.bigint()
        const gClient = new GoogleGenAI({ project: process.env.GOOGLE_CLOUD_PROJECT, location: GOOGLE_CLOUD_LOCATION })
        const endGClientInitTime = process.hrtime.bigint()
        appBar.webContents.send('create-log', {
            message: 'Google AI: Connection opened',
            level: 'success',
            durationMs: (Number(endGClientInitTime - startGClientInitTime) / 1e6)
        })

        const videoBuffer = Buffer.isBuffer(bufferData) ? bufferData : Buffer.from(bufferData)
        const base64VideoFile = videoBuffer.toString('base64');

        const prompt = browsingCompanionPrompt + userText

        const contents = [
            { inlineData: { mimeType: 'video/webm', data: base64VideoFile } },
            { text: prompt },
        ];
        
        const startGResponseTime = process.hrtime.bigint()
        const response = await gClient.models.generateContent({
            model: "gemini-2.5-flash",      
            contents: contents,
        });
        const endGResponseTime = process.hrtime.bigint()
        appBar.webContents.send('create-log', {
            message: ('Gemini: ' + response.text),
            level: 'info',
            durationMs: (Number(endGResponseTime - startGResponseTime) / 1e6)
        })

        const textToConvert = response.text

        const elClient = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })

        const startELAudioTime = process.hrtime.bigint()
        const audio = await elClient.textToSpeech.convert('pqHfZKP75CvOlQylNhV4', {
            text: textToConvert,
            voiceId: "pqHfZKP75CvOlQylNhV4",   
        })
        const endELAudioTime = process.hrtime.bigint()
        appBar.webContents.send('create-log', {
            message: 'ElevenLabs: Audio Recieved',
            level: 'info',
            durationMs: (Number(endELAudioTime - startELAudioTime) / 1e6)
        })

        const chunks = []
        for await (const chunk of audio) {
            chunks.push(Buffer.from(chunk))
        }

        appBar.webContents.send('companion-speaks', Buffer.concat(chunks))
        
    } catch (error) {
        console.error(error);
        appBar.webContents.send('set-status-text', 'Process Failed. Try Again')
        appBar.webContents.send('create-log', {
            message: error.message,
            level: 'fail',
            durationMs: null
        })
    }
})

ipcMain.on('stt_status', (event, status) => {
    appBar.webContents.send('set-status-text', status)
})

ipcMain.on('stt_log', (event, log) => {
    appBar.webContents.send('create-log', log)
})


// ----- PERSISTANT USER STORAGE -----

ipcMain.on('configure-settings', (event, key, value) => {
    process.env[key] = value

    if (key === "ELEVENLABS_API_KEY") {
        appBar.webContents.send('update-key', key, value)
    }
})

ipcMain.handle('get-user-settings', () => {
    return {
        GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
        GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
        ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY
    }
})

function loadUserData(key) {
    let storage = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {}

    try {
        const value = storage[key]

        if (!value) return

        if (safeStorage.isEncryptionAvailable() && value.type === 'Buffer' && Array.isArray(value.data)) {
            return safeStorage.decryptString(Buffer.from(value.data))
        }

        return value
    } catch {
        return 
    }
}

function saveUserData(key, plainValue) {
    let valueToStore = plainValue

    if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(plainValue)
        valueToStore = encrypted.toJSON()
    }

    let data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {}
    data[key] = valueToStore

    fs.writeFileSync(file, JSON.stringify(data, null, 2))
}


// -----    -----

app.whenReady().then(async () => {

    file = path.join(app.getPath('userData'), 'settings.json')
    process.env.GOOGLE_API_KEY = loadUserData('GOOGLE_API_KEY')
    process.env.GOOGLE_CLOUD_PROJECT = loadUserData('GOOGLE_CLOUD_PROJECT')
    process.env.ELEVENLABS_API_KEY = loadUserData('ELEVENLABS_API_KEY')
    process.env.GOOGLE_GENAI_USE_VERTEXAI = 'True'

    createWindow()

    appBar.webContents.send('update-key', 'ELEVENLABS_API_KEY', process.env.ELEVENLABS_API_KEY)

    mainWindow.on('resize', () => {
        const newBounds = mainWindow.contentView.getBounds()
        browserBar.setBounds({ x: 0, y: 0, width: newBounds.width, height: browserBarHeight })
        browserTabs.get(activeTab).setBounds({ x: 0, y: browserBarHeight, width: newBounds.width, height: newBounds.height - browserBarHeight })
    })

    app.on('activate', () => {
        if (BaseWindow.getAllWindows().length === 0) {
            createWindow()
        }
    })
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})


// -----    -----