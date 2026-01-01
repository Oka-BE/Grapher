const { app, BrowserWindow } = require('electron')
const path = require('path')

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
  })

  // win.loadURL("http://localhost:5173/")
  win.loadFile(path.join(__dirname, '../../dist/index.html'))
  // win.webContents.openDevTools()
}

app.whenReady().then(() => {
  createWindow()
})