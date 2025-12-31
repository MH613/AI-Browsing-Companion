const { contextBridge, ipcRenderer } = require('electron')
const { Scribe, AudioFormat, CommitStrategy, RealtimeEvents } = require('@elevenlabs/client')

let connection;
let targetSource;
let mediaRecorder
const recordedChunks = []

let conversationStarted = false
let conversationText = ''

let startELConnectionTime, endELConnectionTime, startELListeningTime, endELListeningTime

ipcRenderer.on('update-key', (event, key, value) => {
    if (key === "ELEVENLABS_API_KEY") {
        ELEVENLABS_API_KEY = value
    }
})

contextBridge.exposeInMainWorld('app', {

    configureSettings: (key, value) => ipcRenderer.send('configure-settings', key, value),
    getUserSettings: () => ipcRenderer.invoke('get-user-settings'),

    minimizeAppBar: () => ipcRenderer.send('minimize-appBar'),
    maximizeAppBar: () => ipcRenderer.send('maximize-appBar'),

    getTargetSource: () => ipcRenderer.invoke('get-source'),
    setTargetSource: (source) => targetSource = source,

    companionSpeak: (callback) => {
        ipcRenderer.on('companion-speaks', (event, buffer) => { 
            callback(buffer);  
        });
    },

    setStatus: (callback) => {
        ipcRenderer.on('set-status-text', (event, status) => {
            callback(status)
        })
    },

    createLog: (callback) => {
        ipcRenderer.on('create-log', (event, log) => {
            callback(log)
        })
    },

    startListening,
    stopListening,
})


async function startListening() {
    if (connection) {
        console.warn("Already connected");
        return;
    }

    startELConnectionTime = performance.now();
    const response = await fetch(
        "https://api.elevenlabs.io/v1/single-use-token/realtime_scribe",
        {
            method: "POST",
            headers: {
                "xi-api-key": ELEVENLABS_API_KEY,
            },
        }
    );
    const token = (await response.json()).token;

    connection = Scribe.connect({
        token,
        modelId: "scribe_v2_realtime",
        microphone: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
        },
        languageCode: "en",
        audioFormat: AudioFormat.PCM_16000,
        commitStrategy: CommitStrategy.VAD,
        vadSilenceThresholdSecs: 1.5,
        vadThreshold: 0.4,
        minSpeechDurationMs: 100,
        minSilenceDurationMs: 100,
        includeTimestamps: false,
    });

    connection.on(RealtimeEvents.SESSION_STARTED, () => {
        ipcRenderer.send('stt_status', 'ElevenLabs: Session started')
    });

    connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, async (data) => {
        ipcRenderer.send('stt_status', data.text)

        startELListeningTime = performance.now();
        if (!conversationStarted) {
            conversationStarted = true
            conversationText = ''
            await startWatching()
            ipcRenderer.send('stt_status', 'Listening')
        }
    });
        
    connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (data) => {
        endELListeningTime = performance.now();
        ipcRenderer.send('stt_log', {
            message: ('User: ' + data.text),
            level: 'info',
            durationMs: endELListeningTime - startELListeningTime
        })

        conversationText = data.text;
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {    
            mediaRecorder.stop()
            mediaRecorder.stream.getTracks().forEach(track => track.stop())
            conversationStarted = false
        }
    });
    
    connection.on(RealtimeEvents.ERROR, (error) => {
        ipcRenderer.send('stt_log', {
            message: error,
            level: 'fail',
            durationMs: null
        })
        connection = null
        conversationStarted = false
    });
        
    connection.on(RealtimeEvents.OPEN, () => {
        endELConnectionTime = performance.now();
        ipcRenderer.send('stt_status', 'ElevenLabs: Connection opened')
        ipcRenderer.send('stt_log', {
            message: 'ElevenLabs: Connection opened',
            level: 'success',
            durationMs: endELConnectionTime - startELConnectionTime
        })
    });
        
    connection.on(RealtimeEvents.CLOSE, () => {
        ipcRenderer.send('stt_status', 'ElevenLabs: Connection closed')
        ipcRenderer.send('stt_log', {
            message: 'ElevenLabs: Connection closed',
            level: 'success',
            durationMs: null
        })

        connection = null
        conversationStarted = false
    });
}

function stopListening() {
    if (connection) {
        connection.close()
    }
    connection = null
    conversationStarted = false
}

async function startWatching() {
    if (!targetSource) {
        return
    }

    recordedChunks.length = 0

    const constraints = {
        audio: false,
        video: {
            mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: targetSource.id
            }
        }
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    const options = { mimeType: 'video/webm; codecs=vp9' }
    mediaRecorder = new MediaRecorder(stream, options)

    mediaRecorder.ondataavailable = handleDataAvailable
    mediaRecorder.onstop = handleStop

    mediaRecorder.start()
}

function handleDataAvailable(e) {
    if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data)
    }
}

async function handleStop(e) {
    const blob = new Blob(recordedChunks, {
        type: 'video/webm; codecs=vp9'
    })

    const arrayBuffer = await blob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await ipcRenderer.invoke('send-raw-video', buffer, conversationText)

    mediaRecorder = null
}