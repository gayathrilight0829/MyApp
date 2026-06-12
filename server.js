const express = require('express');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'stellar_secret_key_98fd-b4d858eb9c00';

// Database Directories Setup
const DB_DIR = path.join(__dirname, 'db');
const UPLOADS_DIR = path.join(DB_DIR, 'uploads');
const DATA_FILE = path.join(DB_DIR, 'data.json');

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR);
}
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

// Default Starting Database Structure
const DEFAULT_DB = {
    progress: { dsa: 15, ai: 10, apti: 20, systemdesign: 5, tech: 25, core: 30 },
    logs: [ ],
    events: [ ],
    resources: [],
    todos: [],
    mockTests: [],
    files: [] // Holds files metadata on server
};

function getOffsetDateString(daysOffset) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split("T")[0];
}

// Database Helpers
function readDatabase() {
    if (!fs.existsSync(DATA_FILE)) {
        writeDatabase(DEFAULT_DB);
        return DEFAULT_DB;
    }
    try {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (e) {
        console.error("Database reading error, returning default structure", e);
        return DEFAULT_DB;
    }
}

function writeDatabase(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 4), 'utf8');
        return true;
    } catch (e) {
        console.error("Database writing error", e);
        return false;
    }
}

// Middleware Configuration
app.use(cors());
app.use(express.json());

// Serve static frontend assets
app.use(express.static(path.join(__dirname)));

// Multer Storage Configuration for File Vault uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB Upload limit
});

// Authentication Token Validator Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication token missing or invalid' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Session token has expired or is invalid' });
        }
        req.user = user;
        next();
    });
}

// --------------------------------------------------------------------------
// REST API ENDPOINTS
// --------------------------------------------------------------------------

// User Authentication
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (username === 'gayathrilight' && password === 'mukesh') {
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '30d' }); // 30 days session
        return res.json({ token });
    }

    return res.status(401).json({ error: 'Incorrect Study Space ID or Access Phrase' });
});

// Get User State Database
app.get('/api/userdata', authenticateToken, (req, res) => {
    const db = readDatabase();
    res.json(db);
});

// Update/Sync Full Database state
app.post('/api/sync', authenticateToken, (req, res) => {
    const db = readDatabase();
    const updatedState = req.body;

    // Merge incoming state details safely, preserving uploaded files database
    db.progress = updatedState.progress || db.progress;
    db.logs = updatedState.logs || db.logs;
    db.events = updatedState.events || db.events;
    db.resources = updatedState.resources || db.resources;
    db.todos = updatedState.todos || db.todos;
    db.mockTests = updatedState.mockTests || db.mockTests;

    if (writeDatabase(db)) {
        return res.json({ success: true, message: 'Sync complete' });
    }
    return res.status(500).json({ error: 'Failed to write synced state to server database' });
});

// File Management Endpoints

// 1. Upload File
app.post('/api/files/upload', authenticateToken, upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const db = readDatabase();
    if (!db.files) db.files = [];

    const fileMeta = {
        id: Date.now() + "_" + Math.floor(Math.random() * 1000),
        name: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        type: req.file.mimetype || 'application/octet-stream',
        uploadedAt: new Date().toISOString().split("T")[0]
    };

    db.files.push(fileMeta);
    writeDatabase(db);

    res.json({ success: true, file: fileMeta });
});

// 2. Download File
app.get('/api/files/download/:id', (req, res) => {
    // Note: We bypass token check on simple link downloads for anchor tags, 
    // but check file presence via metadata
    const db = readDatabase();
    const file = db.files.find(f => f.id === req.params.id);

    if (!file) {
        return res.status(404).send('Document not found in vault registry');
    }

    const filePath = path.join(UPLOADS_DIR, file.filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Document file missing from server storage');
    }

    res.download(filePath, file.name);
});

// 3. Delete File
app.delete('/api/files/:id', authenticateToken, (req, res) => {
    const db = readDatabase();
    const fileIndex = db.files.findIndex(f => f.id === req.params.id);

    if (fileIndex === -1) {
        return res.status(404).json({ error: 'Document not found' });
    }

    const file = db.files[fileIndex];
    const filePath = path.join(UPLOADS_DIR, file.filename);

    // Delete file from disk
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (e) {
            console.error("Failed to delete physical file from disk", e);
        }
    }

    // Delete metadata
    db.files.splice(fileIndex, 1);
    writeDatabase(db);

    res.json({ success: true, message: 'File deleted successfully' });
});

// Catch-all route to serve SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`StellarStudy premium backend listening at http://localhost:${PORT}`);
});
