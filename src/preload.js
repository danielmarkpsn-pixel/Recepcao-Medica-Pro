const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('clinicAPI', {
  login: (credentials) => ipcRenderer.invoke('auth:login', credentials),
  logout: () => ipcRenderer.invoke('auth:logout'),
  me: () => ipcRenderer.invoke('auth:me'),
  getData: () => ipcRenderer.invoke('data:get'),
  save: (collection, record) => ipcRenderer.invoke('data:save', { collection, record }),
  remove: (collection, id) => ipcRenderer.invoke('data:delete', { collection, id }),
  createUser: (user) => ipcRenderer.invoke('users:create', user),
  changePassword: (userId, password) => ipcRenderer.invoke('users:password', { userId, password }),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  importBackup: () => ipcRenderer.invoke('backup:import')
});
