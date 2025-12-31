const targetSource = await window.app.getTargetSource()
window.app.setTargetSource(targetSource)

const homeMenu = document.getElementById('home')
const configurationMenu = document.getElementById('configuration')
const logsMenu = document.getElementById('logs')

const homeButton = document.getElementById('home-button')
const configurationButton = document.getElementById('configuration-button')
const logsButton = document.getElementById('logs-button')
const collapseButton = document.getElementById('collapse-button')

const content = document.getElementById('content')
const menu = document.getElementById('menu')
const contentTitle = document.getElementById('content-title-text')

const menus = [homeMenu, configurationMenu, logsMenu];
const buttons = [homeButton, configurationButton, logsButton]
const titles = ["", "Configuration", "Log"]

function activateMenu(activeMenu) {
    if (content.classList.contains('collapsed')) {
        content.classList.toggle('collapsed')
    }
    menus.forEach(menu => {
        menu.classList.toggle('menu-unselected', menu !== activeMenu)
    })
    contentTitle.innerText = titles[menus.indexOf(activeMenu)]
}

function activateButton(activeButton) {
    buttons.forEach(button => {
        button.classList.toggle('button-selected', button === activeButton)
    })
}

homeButton.addEventListener('click', () => {
    window.app.maximizeAppBar()
    activateButton(homeButton)
    activateMenu(homeMenu)
});

configurationButton.addEventListener('click', () => {
    window.app.maximizeAppBar()
    activateButton(configurationButton)
    activateMenu(configurationMenu)
});

logsButton.addEventListener('click', () => {
    window.app.maximizeAppBar()
    activateButton(logsButton)
    activateMenu(logsMenu)
});

collapseButton.addEventListener('click', () => {
    activateButton(null)
    content.classList.toggle('collapsed')
    window.app.minimizeAppBar()
})


// ---------- APP FUNCTIONING ----------

const statusText = document.getElementById('status-text')
const companionStatus = document.getElementById('companion-status')     
const companionStatusText = document.getElementById('companion-status-text')

const gCloudProjectIDInput = document.getElementById('google-cloud-project-id')
const googleAPIkeyInput = document.getElementById('google-api-key')
const elevenLabsAPIkeyInput = document.getElementById('elevenlabs-api-key')
const enableCompanionInput = document.getElementById('companion-enable')

async function initUserSettings() {
    const { GOOGLE_CLOUD_PROJECT, GOOGLE_API_KEY, ELEVENLABS_API_KEY } = await window.app.getUserSettings();

    gCloudProjectIDInput.value = (GOOGLE_CLOUD_PROJECT === "undefined") ? "" : GOOGLE_CLOUD_PROJECT
    googleAPIkeyInput.value = (GOOGLE_API_KEY === "undefined") ? "" : GOOGLE_API_KEY
    elevenLabsAPIkeyInput.value = (ELEVENLABS_API_KEY === "undefined") ? "" : ELEVENLABS_API_KEY
    
    checkConfig()
}

initUserSettings()

let browsingCompanionEnabled = false

function addLog(text, level, duration) {
    const now = new Date()
    const timestamp = now.toLocaleDateString('en-GB') + '  ' + now.toLocaleTimeString('en-GB', { hour12: false })

    const logDiv = document.createElement('div')
    logDiv.className = 'log'

    const timestampDiv = document.createElement('div')
    timestampDiv.className = 'log-timestamp'

    const timestampP = document.createElement('p')
    timestampP.textContent = timestamp

    const textDiv = document.createElement('div')
    textDiv.className = 'log-text'

    const textP = document.createElement('p')
    textP.textContent = text

    if (level === 'fail') {
        textP.classList.add('log-fail')
    } else if (level === 'success') {
        textP.classList.add('log-success')
    }

    const completionDiv = document.createElement('div')
    completionDiv.className = 'completion-time'

    const completionP = document.createElement('p')

    if (duration == null) {
        completionDiv.classList.add('exclude')
    } else {
        let formattedDuration = Number(duration).toFixed(2);
        let unit = "ms";

        if (duration > 1000) {
            formattedDuration = (duration / 1000).toFixed(2); 
            unit = "s"; 
        }
        completionP.innerHTML = `Completed in <span class="completion-time-text">${formattedDuration}</span> ${unit}`;
    }

    timestampDiv.appendChild(timestampP)
    textDiv.appendChild(textP)
    completionDiv.appendChild(completionP)

    logDiv.appendChild(timestampDiv)
    logDiv.appendChild(textDiv)
    logDiv.appendChild(completionDiv)

    logsMenu.appendChild(logDiv)
}


// ----- APP INPUT CONTROLS -----

function checkConfig() {
    if (gCloudProjectIDInput.value.trim() !== '' && elevenLabsAPIkeyInput.value.trim() !== '' && googleAPIkeyInput.value.trim() !== '') {
        enableCompanionInput.disabled = false
        if (!browsingCompanionEnabled) {
            statusText.innerText = "Companion is disabled"
        } else {
            statusText.innerText = "Companion is enabled"
        }
    } else {
        enableCompanionInput.checked = false
        companionStatus.classList.toggle('active', false)
        companionStatus.classList.toggle('animated-gradient', false)
        companionStatusText.innerText = "Inactive"
        enableCompanionInput.disabled = true
        statusText.innerText = "Companion is not configured"
    }
}

gCloudProjectIDInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault()
        checkConfig()
        window.app.configureSettings('GOOGLE_CLOUD_PROJECT', gCloudProjectIDInput.value.trim())
    }
})

gCloudProjectIDInput.addEventListener('blur', () => {
    checkConfig()
    window.app.configureSettings('GOOGLE_CLOUD_PROJECT', gCloudProjectIDInput.value.trim())
})

elevenLabsAPIkeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault()
        checkConfig()
        window.app.configureSettings('GOOGLE_API_KEY', googleAPIkeyInput.value.trim())
    }
})

googleAPIkeyInput.addEventListener('blur', () => {
    checkConfig()
    window.app.configureSettings('GOOGLE_API_KEY', googleAPIkeyInput.value.trim())
})

googleAPIkeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault()
        checkConfig()
        window.app.configureSettings('ELEVENLABS_API_KEY', elevenLabsAPIkeyInput.value.trim())
    }
})

elevenLabsAPIkeyInput.addEventListener('blur', () => {
    checkConfig()
    window.app.configureSettings('ELEVENLABS_API_KEY', elevenLabsAPIkeyInput.value.trim())
})

enableCompanionInput.addEventListener('change', async (e) => {
    
    if (e.target.checked) {
        browsingCompanionEnabled = true
        companionStatus.classList.toggle('active', true)
        companionStatusText.innerText = "Active"
        statusText.innerText = "Companion is enabled"

        window.app.startListening()

    } else {
        browsingCompanionEnabled = false
        companionStatus.classList.toggle('active', false)
        companionStatusText.innerText = "Inactive"
        statusText.innerText = "Companion is disabled"

        window.app.stopListening()
    }
})


// -----   -----

window.app.companionSpeak((buffer) => {
    const blob = new Blob([buffer], { type: 'audio/mpeg' })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.play()
})

window.app.setStatus((status) => {
    statusText.innerText = status
})

window.app.createLog((log) => {
    addLog(log.message, log.level, log.durationMs)
})


// -----   -----