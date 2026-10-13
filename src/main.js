const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

let win;
const dataDir = () => app.getPath('userData');
const dbPath = () => path.join(dataDir(), 'recepcao-data.json');

function initialData() {
  return {
    version: 1,
    settings: { clinicName: 'Controle de Consulta' },
    users: [{ id: 'admin', username: 'admin', displayName: 'Administrador', role: 'admin', salt: '', passwordHash: '' }],
    patients: [], doctors: [], appointments: [], payments: [], audit: []
  };
}
function passwordHash(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
function ensureData() {
  fs.mkdirSync(dataDir(), { recursive: true });
  if (!fs.existsSync(dbPath())) {
    const data = initialData();
    const salt = crypto.randomBytes(16).toString('hex');
    data.users[0].salt = salt;
    data.users[0].passwordHash = passwordHash('admin', salt);
    fs.writeFileSync(dbPath(), JSON.stringify(data, null, 2), { mode: 0o600 });
  }
}
function readData() {
  ensureData();
  try { const data = JSON.parse(fs.readFileSync(dbPath(), 'utf8')); if (!data.settings) data.settings = {}; if (!data.settings.clinicName || ['Recepção Médica Pro', 'Clínica Favmed - Medicina Ocupacional', 'Clínica Favmed', 'Favmed'].includes(data.settings.clinicName)) { data.settings.clinicName = 'Controle de Consulta'; writeData(data); } return data; }
  catch { throw new Error('Não foi possível ler os dados locais. Restaure um backup válido.'); }
}
function writeData(data) {
  const tmp = dbPath() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, dbPath());
}
function audit(data, user, action, details = '') {
  data.audit.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user?.username || 'sistema', action, details: String(details).slice(0, 300) });
  data.audit = data.audit.slice(0, 5000);
}
function safeUser(u) { return { id: u.id, username: u.username, displayName: u.displayName, role: u.role }; }
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1080, minHeight: 700,
    backgroundColor: '#111315',
    icon: path.join(__dirname, '..', 'assets', 'app-icon.ico'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}
app.whenReady().then(() => { ensureData(); createWindow(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

let session = null;
const requireSession = () => { if (!session) throw new Error('Faça login para continuar.'); return session; };
const adminOnly = () => { const s = requireSession(); if (s.role !== 'admin') throw new Error('Ação permitida somente ao administrador.'); return s; };

ipcMain.handle('auth:login', (_e, { username, password }) => {
  const data = readData();
  const u = data.users.find(x => x.username.toLowerCase() === String(username || '').trim().toLowerCase());
  if (!u || passwordHash(String(password || ''), u.salt) !== u.passwordHash) {
    audit(data, null, 'LOGIN_FALHOU', `Usuário: ${String(username || '').slice(0,80)}`); writeData(data);
    throw new Error('Usuário ou senha inválidos.');
  }
  session = safeUser(u);
  audit(data, session, 'LOGIN', 'Sessão iniciada'); writeData(data);
  return session;
});
ipcMain.handle('auth:logout', () => { if (session) { const data = readData(); audit(data, session, 'LOGOUT'); writeData(data); } session = null; return true; });
ipcMain.handle('auth:me', () => session);

ipcMain.handle('data:get', () => {
  const s = requireSession(), d = readData();
  if (s.role === 'financeiro') return { settings: d.settings, users: [], patients: d.patients.map(p => ({ id: p.id, name: p.name })), doctors: [], appointments: [], payments: d.payments, audit: [] };
  return { settings: d.settings, users: s.role === 'admin' ? d.users.map(safeUser) : [], patients: d.patients, doctors: d.doctors, appointments: d.appointments, payments: s.role === 'admin' ? d.payments : [], audit: s.role === 'admin' ? d.audit : [] };
});
ipcMain.handle('data:save', (_e, { collection, record }) => {
  const s = requireSession();
  const allowed = ['patients', 'doctors', 'appointments', 'payments'];
  if (!allowed.includes(collection)) throw new Error('Coleção inválida.');
  if (collection === 'payments' && !['admin','financeiro'].includes(s.role)) throw new Error('Seu perfil não tem permissão para pagamentos.');
  if (s.role === 'financeiro' && collection !== 'payments') throw new Error('O perfil financeiro só pode alterar pagamentos.');
  const d = readData(), list = d[collection];
  const clean = sanitizeRecord(collection, record);
  if (!clean.id) clean.id = crypto.randomUUID();
  const idx = list.findIndex(x => x.id === clean.id);
  const action = idx >= 0 ? 'ATUALIZAR' : 'CRIAR';
  if (idx >= 0) list[idx] = { ...list[idx], ...clean, updatedAt: new Date().toISOString() };
  else list.unshift({ ...clean, createdAt: new Date().toISOString() });
  audit(d, s, `${action}_${collection.toUpperCase()}`, clean.name || clean.patientName || clean.title || clean.id);
  writeData(d); return { ok: true, record: clean };
});
function sanitizeRecord(collection, r) {
  if (!r || typeof r !== 'object') throw new Error('Registro inválido.');
  const out = {};
  const fields = {
    patients: ['id','name','cpf','birthDate','phone','email','address','notes','convenio','convenioNumber','convenioValidity','company','occupation','emergencyContact','bloodType','allergies','medications','medicalHistory'],
    doctors: ['id','name','specialty','phone','email','registration'],
    appointments: ['id','patientId','patientName','doctorId','doctorName','date','time','status','reason','notes','consultationRoom'],
    payments: ['id','patientId','patientName','appointmentId','date','amount','method','status','description']
  }[collection];
  for (const f of fields) if (f in r) out[f] = String(r[f] ?? '').slice(0, f === 'notes' || f === 'address' || f === 'reason' ? 2000 : 300);
  if (collection === 'patients' && !out.name?.trim()) throw new Error('Informe o nome do paciente.');
  if (collection === 'doctors' && !out.name?.trim()) throw new Error('Informe o nome do médico.');
  if (collection === 'appointments' && (!out.patientName || !out.date || !out.time)) throw new Error('Informe paciente, data e horário.');
  if (collection === 'payments' && (!out.patientName || !Number.isFinite(Number(out.amount)) || Number(out.amount) < 0)) throw new Error('Informe paciente e valor válido.');
  return out;
}
ipcMain.handle('data:delete', (_e, { collection, id }) => {
  const s = requireSession();
  if (!['patients','doctors','appointments','payments'].includes(collection)) throw new Error('Coleção inválida.');
  if (collection === 'payments' && !['admin','financeiro'].includes(s.role)) throw new Error('Seu perfil não tem permissão para pagamentos.');
  if (s.role === 'financeiro' && collection !== 'payments') throw new Error('O perfil financeiro só pode excluir pagamentos.');
  const d = readData(), old = d[collection].find(x => x.id === id);
  if (!old) return false;
  d[collection] = d[collection].filter(x => x.id !== id);
  audit(d, s, `EXCLUIR_${collection.toUpperCase()}`, old.name || old.patientName || id);
  writeData(d); return true;
});
ipcMain.handle('users:create', (_e, user) => {
  const s = adminOnly(), d = readData();
  const username = String(user.username || '').trim().toLowerCase();
  const password = String(user.password || '');
  const displayName = String(user.displayName || '').trim();
  const role = ['admin','recepcao','financeiro'].includes(user.role) ? user.role : 'recepcao';
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new Error('Usuário: use 3 a 30 caracteres (letras, números, ponto, hífen ou sublinhado).');
  if (password.length < 10) throw new Error('A senha deve ter pelo menos 10 caracteres.');
  if (!displayName) throw new Error('Informe o nome do usuário.');
  if (d.users.some(u => u.username === username)) throw new Error('Esse usuário já existe.');
  const salt = crypto.randomBytes(16).toString('hex');
  d.users.push({ id: crypto.randomUUID(), username, displayName, role, salt, passwordHash: passwordHash(password, salt) });
  audit(d, s, 'CRIAR_USUARIO', `${username} (${role})`); writeData(d); return true;
});
ipcMain.handle('users:password', (_e, { userId, password }) => {
  const s = adminOnly(), d = readData(), u = d.users.find(x => x.id === userId);
  if (!u) throw new Error('Usuário não encontrado.');
  if (String(password).length < 10) throw new Error('A senha deve ter pelo menos 10 caracteres.');
  u.salt = crypto.randomBytes(16).toString('hex'); u.passwordHash = passwordHash(String(password), u.salt);
  audit(d, s, 'ALTERAR_SENHA', u.username); writeData(d); return true;
});
ipcMain.handle('settings:save', (_e, settings) => {
  const s = adminOnly(), d = readData();
  d.settings.clinicName = String(settings.clinicName || 'Controle de Consulta').slice(0,120);
  audit(d, s, 'ALTERAR_CONFIGURACOES', d.settings.clinicName); writeData(d); return d.settings;
});
ipcMain.handle('backup:export', async () => {
  const s = adminOnly(), d = readData();
  const { canceled, filePath } = await dialog.showSaveDialog(win, { title: 'Salvar backup', defaultPath: `backup-recepcao-${new Date().toISOString().slice(0,10)}.json`, filters: [{ name: 'Backup JSON', extensions: ['json'] }] });
  if (canceled || !filePath) return { canceled: true };
  fs.writeFileSync(filePath, JSON.stringify({ ...d, exportedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
  audit(d, s, 'BACKUP_EXPORTADO', path.basename(filePath)); writeData(d); return { canceled: false, path: filePath };
});
ipcMain.handle('backup:import', async () => {
  const s = adminOnly();
  const { canceled, filePaths } = await dialog.showOpenDialog(win, { title: 'Restaurar backup', properties: ['openFile'], filters: [{ name: 'Backup JSON', extensions: ['json'] }] });
  if (canceled || !filePaths?.[0]) return { canceled: true };
  const incoming = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
  for (const k of ['patients','doctors','appointments','payments','users','audit']) if (!Array.isArray(incoming[k])) throw new Error('Backup inválido: seção ' + k + ' ausente.');
  const current = readData(); incoming.audit = current.audit || [];
  audit(incoming, s, 'BACKUP_RESTAURADO', path.basename(filePaths[0])); writeData(incoming);
  return { canceled: false };
});
