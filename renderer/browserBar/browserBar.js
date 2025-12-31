let tabIndex = 0

function CreateTabElementUI() {
    const tab = document.createElement('div')
    tab.classList.add('tab')

    tab.dataset.index = tabIndex

    const tabName = document.createElement('div')
    tabName.classList.add('tab-name')
    const tabNameText = document.createElement('p')
    tabNameText.textContent = 'New Tab'
    tabName.appendChild(tabNameText)

    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.classList.add('close-tab-button')
    closeButton.setAttribute('aria-label', 'Close Tab')
    closeButton.setAttribute('title', 'Close Tab')

    const closeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    closeIcon.classList.add('browser-actions-icon', 'close-tab-icon')
    closeIcon.setAttribute('viewBox', '0 0 18 18')
    closeIcon.setAttribute('fill', 'none')
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', 'M0.707031 16.7072L8.70703 8.70715M16.707 0.707153L8.70703 8.70715M8.70703 8.70715L0.707031 0.707153M8.70703 8.70715L16.707 16.7072')
    path.setAttribute('stroke', 'black')
    path.setAttribute('stroke-width', '2')
    closeIcon.appendChild(path)
    closeButton.appendChild(closeIcon)
    
    tab.appendChild(tabName)
    tab.appendChild(closeButton)

    const tabsGroup = document.querySelector('.tabs-group')
    const addTabButton = document.querySelector('.add-tab-button');

    tabsGroup.insertBefore(tab, addTabButton);

    document.querySelectorAll('.tab').forEach((div) => { div.classList.toggle('inactive', div !== tab) })

    tab.addEventListener('click', (event) => {

        document.querySelectorAll('.tab').forEach((div) => { div.classList.toggle('inactive', div !== tab) })
        window.browser.changeTab(parseInt(tab.dataset.index))
        
    })

    closeButton.addEventListener('click', async (event) => {
        event.stopPropagation();
        const nextActiveTab = await window.browser.deleteTab(parseInt(tab.dataset.index))
        tab.remove()
        document.querySelectorAll('.tab').forEach((div) => { div.classList.toggle('inactive', parseInt(div.dataset.index) !== nextActiveTab) })
    });

    tabIndex++
}

function changeTabName(tabIndex, pageTitle) {
    document.querySelectorAll('.tab').forEach((div) => { 
        if (parseInt(div.dataset.index) == tabIndex) {
            div.firstElementChild.innerText = pageTitle
        }
    })
}

window.browser.onTabTitleChange((event, tabIndex, pageTitle) => {
    changeTabName(tabIndex, pageTitle)
});

document.getElementById('back-button').addEventListener('click', () => {
    window.browser.back()
})

document.getElementById('forward-button').addEventListener('click', () => {
    window.browser.forward()
})

document.getElementById('reload-button').addEventListener('click', () => {
    window.browser.reload()
})

document.getElementById('minimize-button').addEventListener('click', () => {
    window.browser.minimize()
})

document.getElementById('maximize-button').addEventListener('click', () => {
    window.browser.maximize()
})

document.getElementById('close-button').addEventListener('click', () => {
    window.browser.close()
})

document.getElementById('add-tab-button').addEventListener('click', () => {
    window.browser.createTab(tabIndex)
    CreateTabElementUI()
})

window.browser.createTab(tabIndex)
CreateTabElementUI()