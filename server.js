// server.js
// Minimal Excel → JSON API with progress persistence.
// Usage: npm install && npm start

const express = require('express');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const app = express();
const PORT = 3000;
const HOST = '127.0.0.1'; // Only this machine can reach the trainer

// --- Configuration ---
const DATA_DIR = path.join(__dirname, 'data');
const EXCEL_PATH = path.join(DATA_DIR, 'flashcards.xlsx'); // Put your workbook here
const PROGRESS_PATH = path.join(__dirname, 'progress.txt'); // JSON content, simple and human-readable

// --- Helpers ---
const readWorkbook = () => {
  if (!fs.existsSync(EXCEL_PATH)) throw new Error(`Missing Excel at ${EXCEL_PATH}`);
  return XLSX.readFile(EXCEL_PATH, { cellDates: false, cellNF: false, cellText: false });
};

// Progress is stored per sheet name, so only names from the workbook are
// accepted. This also rejects keys such as "__proto__", which would otherwise
// write to Object.prototype.
const isKnownSheet = (sheet) => {
  if (sheet in {}) return false;
  try { return readWorkbook().SheetNames.includes(sheet); } catch { return false; }
};

const sheetPairs = (ws) => {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
  return rows
    .filter(r => r && r.length >= 2 && String(r[0]).trim() && String(r[1]).trim())
    .map(r => ({ 
      de: String(r[0]).trim(), 
      en: String(r[1]).trim(),
      hint: r[2] ? String(r[2]).trim() : '' // Optional third column for hints
    }));
};

const loadProgress = () => {
  try { return JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8') || '{}'); } catch { return {}; }
};
const saveProgress = (obj) => fs.writeFileSync(PROGRESS_PATH, JSON.stringify(obj, null, 2), 'utf8');

// --- Middleware ---
app.use(express.json());

// Every API route that takes a sheet name must refer to a sheet in the workbook.
app.use('/api', (req, res, next) => {
  const sheet = req.query.sheet ?? req.body?.sheet;
  if (sheet && !isKnownSheet(String(sheet))) return res.status(404).json({ error: 'Sheet not found' });
  next();
});

// Serve the single HTML file from root
app.get('/', (_, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- API: list sheets + counts ---
app.get('/api/sheets', (_, res) => {
  try {
    const wb = readWorkbook();
    const sheets = wb.SheetNames.map(name => {
      const pairs = sheetPairs(wb.Sheets[name]);
      return { name, count: pairs.length };
    }).filter(s => s.count > 0);
    res.json({ sheets });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- API: get a set (pairs) by sheet name ---
app.get('/api/set', (req, res) => {
  try {
    const sheet = String(req.query.sheet || '');
    const wb = readWorkbook();
    if (!wb.SheetNames.includes(sheet)) return res.status(404).json({ error: 'Sheet not found' });
    const pairs = sheetPairs(wb.Sheets[sheet]);
    res.json({ sheet, pairs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- API: get and set progress (batch index) ---
app.get('/api/progress', (req, res) => {
  const sheet = String(req.query.sheet || '');
  const p = loadProgress();
  res.json({ sheet, batchIndex: Math.max(0, Number(p[sheet]?.batchIndex || 0)) });
});

app.post('/api/progress', (req, res) => {
  const { sheet, batchIndex } = req.body || {};
  if (!sheet || typeof batchIndex !== 'number') return res.status(400).json({ error: 'sheet and batchIndex required' });
  const p = loadProgress();
  if (!p[sheet]) p[sheet] = {};
  p[sheet].batchIndex = Math.max(0, Math.floor(batchIndex));
  saveProgress(p);
  res.json({ ok: true });
});

app.post('/api/reset', (req, res) => {
  const { sheet } = req.body || {};
  if (!sheet) return res.status(400).json({ error: 'sheet required' });
  const p = loadProgress();
  if (!p[sheet]) p[sheet] = {};
  p[sheet].batchIndex = 0;
  saveProgress(p);
  res.json({ ok: true });
});

// --- API: mistakes tracking ---
app.get('/api/mistakes', (req, res) => {
  const sheet = String(req.query.sheet || '');
  if (!sheet) return res.status(400).json({ error: 'sheet required' });
  const p = loadProgress();
  const mistakes = p[sheet]?.mistakes || {};
  // Convert to array of {de, en, correctCount}
  const mistakeArray = Object.keys(mistakes).map(key => {
    const [de, en] = key.split('|');
    return { de, en, correctCount: mistakes[key].correctCount };
  });
  res.json({ sheet, mistakes: mistakeArray });
});

app.post('/api/mistakes/add', (req, res) => {
  const { sheet, de, en } = req.body || {};
  if (!sheet || !de || !en) return res.status(400).json({ error: 'sheet, de, and en required' });
  const p = loadProgress();
  if (!p[sheet]) p[sheet] = {};
  if (!p[sheet].mistakes) p[sheet].mistakes = {};
  
  const key = `${de}|${en}`;
  // Only add if not already exists
  if (!p[sheet].mistakes[key]) {
    p[sheet].mistakes[key] = { correctCount: 0 };
  }
  
  saveProgress(p);
  res.json({ ok: true });
});

app.post('/api/mistakes/increment', (req, res) => {
  const { sheet, de, en } = req.body || {};
  if (!sheet || !de || !en) return res.status(400).json({ error: 'sheet, de, and en required' });
  const p = loadProgress();
  if (!p[sheet]) p[sheet] = {};
  if (!p[sheet].mistakes) p[sheet].mistakes = {};
  
  const key = `${de}|${en}`;
  if (p[sheet].mistakes[key]) {
    p[sheet].mistakes[key].correctCount++;
    
    // Remove if correctCount >= 5
    if (p[sheet].mistakes[key].correctCount >= 5) {
      delete p[sheet].mistakes[key];
    }
  }
  
  saveProgress(p);
  res.json({ ok: true });
});

app.delete('/api/mistakes', (req, res) => {
  const { sheet } = req.body || {};
  if (!sheet) return res.status(400).json({ error: 'sheet required' });
  const p = loadProgress();
  if (p[sheet] && p[sheet].mistakes) {
    p[sheet].mistakes = {};
    saveProgress(p);
  }
  res.json({ ok: true });
});

// --- API: exercise completion tracking ---
app.get('/api/exercise-completion', (req, res) => {
  const sheet = String(req.query.sheet || '');
  if (!sheet) return res.status(400).json({ error: 'sheet required' });
  const p = loadProgress();
  const exerciseCompletion = p[sheet]?.exerciseCompletion || {};
  res.json({ sheet, exerciseCompletion });
});

app.post('/api/exercise-completion', (req, res) => {
  const { sheet, exerciseId, correctWords } = req.body || {};
  if (!sheet || !exerciseId || !Array.isArray(correctWords)) {
    return res.status(400).json({ error: 'sheet, exerciseId, and correctWords array required' });
  }
  if (typeof exerciseId !== 'string' || !/^[\w-]+$/.test(exerciseId) || exerciseId in {}) {
    return res.status(400).json({ error: 'invalid exerciseId' });
  }
  
  const p = loadProgress();
  if (!p[sheet]) p[sheet] = {};
  if (!p[sheet].exerciseCompletion) p[sheet].exerciseCompletion = {};
  
  // Store globally per exercise (not per batch) - track individual words
  if (!p[sheet].exerciseCompletion[exerciseId]) {
    p[sheet].exerciseCompletion[exerciseId] = [];
  }
  
  // Merge new correct words with existing ones (avoid duplicates)
  const existingSet = new Set(p[sheet].exerciseCompletion[exerciseId]);
  correctWords.forEach(word => existingSet.add(word));
  p[sheet].exerciseCompletion[exerciseId] = Array.from(existingSet);
  
  saveProgress(p);
  res.json({ ok: true });
});

app.post('/api/reset-sheet-progress', (req, res) => {
  const { sheet } = req.body || {};
  if (!sheet) return res.status(400).json({ error: 'sheet required' });
  const p = loadProgress();
  if (p[sheet]) {
    // Reset everything except the sheet entry itself
    p[sheet] = {
      batchIndex: 0,
      mistakes: {},
      exerciseCompletion: {}
    };
    saveProgress(p);
  }
  res.json({ ok: true });
});

app.listen(PORT, HOST, () => {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`Word trainer running on http://localhost:${PORT}`);
  console.log(`Place your workbook at: ${EXCEL_PATH}`);
});