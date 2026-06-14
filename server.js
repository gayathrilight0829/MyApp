require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'stellar_secret_key_98fd-b4d858eb9c00';

// Database Directories Setup (Fallback filesystem database)
const DB_DIR = path.join(__dirname, 'db');
const UPLOADS_DIR = path.join(DB_DIR, 'uploads');
const DATA_FILE = path.join(DB_DIR, 'data.json');

if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR);
}
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

// --------------------------------------------------------------------------
// MONGODB CONNECTION SETUP
// --------------------------------------------------------------------------
const MONGODB_URI = process.env.MONGODB_URI;
const isMongoConfigured = !!(MONGODB_URI && !MONGODB_URI.includes('<username>'));
let mongoConnected = false;

if (!isMongoConfigured) {
    console.warn("WARNING: MONGODB_URI is not configured in .env or contains placeholder credentials.");
    console.warn("Falling back to local db/data.json file database.");
} else {
    mongoose.connect(MONGODB_URI)
        .then(() => {
            console.log("MongoDB Atlas database connected successfully.");
            mongoConnected = true;
        })
        .catch(err => {
            console.error("MongoDB Atlas connection error:", err.message);
            console.warn("WARNING: MongoDB configuration failed. Database fallback is disabled for safety.");
        });
}

// Mongoose Database Schema & Model
const studyStateSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    progress: {
        dsa: { type: Number, default: 0 },
        ai: { type: Number, default: 0 },
        apti: { type: Number, default: 0 },
        systemdesign: { type: Number, default: 0 },
        tech: { type: Number, default: 0 },
        core: { type: Number, default: 0 }
    },
    logs: { type: Array, default: [] },
    events: { type: Array, default: [] },
    resources: { type: Array, default: [] },
    todos: { type: Array, default: [] },
    mockTests: { type: Array, default: [] },
    files: { type: Array, default: [] }
});

const StudyState = mongoose.model('StudyState', studyStateSchema);

// Default Starting Database Structure
const DEFAULT_DB = {
    progress: {},
    logs: [],
    events: [],
    resources: [],
    todos: [],
    mockTests: [],
    files: []
};

function getOffsetDateString(daysOffset) {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split("T")[0];
}

// --------------------------------------------------------------------------
// DATABASE PORTABILITY HELPERS
// --------------------------------------------------------------------------

async function ensureDbReady() {
    if (!isMongoConfigured) {
        return false;
    }
    if (mongoose.connection.readyState === 1) {
        return true;
    }
    if (mongoose.connection.readyState === 2) {
        try {
            await new Promise((resolve) => {
                const onConnected = () => {
                    cleanup();
                    resolve();
                };
                const onError = () => {
                    cleanup();
                    resolve();
                };
                const timer = setTimeout(() => {
                    cleanup();
                    resolve();
                }, 5000); // Wait up to 5 seconds for connection

                function cleanup() {
                    clearTimeout(timer);
                    mongoose.connection.removeListener('connected', onConnected);
                    mongoose.connection.removeListener('error', onError);
                }

                mongoose.connection.once('connected', onConnected);
                mongoose.connection.once('error', onError);
            });
            return mongoose.connection.readyState === 1;
        } catch (e) {
            return false;
        }
    }
    return false;
}

// Read local file fallback
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

// Write local file fallback atomically
function writeDatabase(data) {
    try {
        const tempFile = DATA_FILE + '.tmp';
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 4), 'utf8');
        fs.renameSync(tempFile, DATA_FILE);
        return true;
    } catch (e) {
        console.error("Database writing error", e);
        return false;
    }
}

// Unified Async read state helper
async function getUserState(username) {
    if (isMongoConfigured) {
        const isReady = await ensureDbReady();
        if (!isReady) {
            throw new Error("MongoDB database is not available.");
        }
        let doc = await StudyState.findOne({ username });
        if (!doc) {
            doc = new StudyState({ username, ...DEFAULT_DB });
            await doc.save();
        }
        return doc;
    }
    return readDatabase();
}

// Unified Async write state helper
async function saveUserState(username, updatedFields) {
    if (isMongoConfigured) {
        const isReady = await ensureDbReady();
        if (!isReady) {
            throw new Error("MongoDB database is not available.");
        }
        const doc = await StudyState.findOneAndUpdate(
            { username },
            { $set: updatedFields },
            { new: true, upsert: true }
        );
        return doc;
    }
    const db = readDatabase();
    Object.assign(db, updatedFields);
    writeDatabase(db);
    return db;
}

// --------------------------------------------------------------------------
// MIDDLEWARE CONFIGURATION
// --------------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname)));

// Multer Storage Configuration
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
// Get User State Database
app.get('/api/userdata', authenticateToken, async (req, res) => {
    try {
        const db = await getUserState(req.user.username);
        res.json(db);
    } catch (err) {
        console.error("Error in /api/userdata:", err.message);
        if (err.message.includes("MongoDB database")) {
            return res.status(503).json({ error: 'Database service is currently unavailable. Please wait while connection is established.' });
        }
        res.status(500).json({ error: 'Failed to retrieve user database' });
    }
});

// Update/Sync Full Database state
app.post('/api/sync', authenticateToken, async (req, res) => {
    const updatedState = req.body;
    const updateData = {
        progress: updatedState.progress,
        logs: updatedState.logs,
        events: updatedState.events,
        resources: updatedState.resources,
        todos: updatedState.todos,
        mockTests: updatedState.mockTests
    };

    try {
        await saveUserState(req.user.username, updateData);
        res.json({ success: true, message: 'Sync complete' });
    } catch (err) {
        console.error("Error in /api/sync:", err.message);
        if (err.message.includes("MongoDB database")) {
            return res.status(503).json({ error: 'Database service is currently unavailable. Changes cannot be synchronized.' });
        }
        res.status(500).json({ error: 'Failed to write synced state to database' });
    }
});

// File Management Endpoints

// 1. Upload File
app.post('/api/files/upload', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileMeta = {
        id: Date.now() + "_" + Math.floor(Math.random() * 1000),
        name: req.file.originalname,
        filename: req.file.filename,
        size: req.file.size,
        type: req.file.mimetype || 'application/octet-stream',
        uploadedAt: new Date().toISOString().split("T")[0]
    };

    try {
        const db = await getUserState(req.user.username);
        const files = db.files || [];
        files.push(fileMeta);
        await saveUserState(req.user.username, { files });
        res.json({ success: true, file: fileMeta });
    } catch (err) {
        console.error("Error in /api/files/upload:", err.message);
        if (err.message.includes("MongoDB database")) {
            return res.status(503).json({ error: 'Database service is currently unavailable. File metadata cannot be saved.' });
        }
        res.status(500).json({ error: 'Failed to save file metadata' });
    }
});

// 2. Download File
app.get('/api/files/download/:id', async (req, res) => {
    let file = null;
    
    if (isMongoConfigured) {
        try {
            const isReady = await ensureDbReady();
            if (isReady) {
                const doc = await StudyState.findOne({ "files.id": req.params.id }, { files: 1 });
                if (doc && doc.files) {
                    file = doc.files.find(f => f.id === req.params.id);
                }
            }
        } catch (e) {
            console.error("MongoDB file download look up error", e);
        }
    }

    if (!file) {
        // Fallback local lookup ONLY if MongoDB is not configured
        if (!isMongoConfigured) {
            const db = readDatabase();
            file = db.files.find(f => f.id === req.params.id);
        }
    }

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
app.delete('/api/files/:id', authenticateToken, async (req, res) => {
    try {
        const db = await getUserState(req.user.username);
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

        // Delete metadata from list
        const files = db.files;
        files.splice(fileIndex, 1);
        await saveUserState(req.user.username, { files });

        res.json({ success: true, message: 'File deleted successfully' });
    } catch (err) {
        console.error("Error in delete file:", err.message);
        if (err.message.includes("MongoDB database")) {
            return res.status(503).json({ error: 'Database service is currently unavailable. File cannot be deleted.' });
        }
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

// Catch-all route to serve SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`StellarStudy premium backend listening at http://localhost:${PORT}`);
});
