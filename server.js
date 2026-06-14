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
let mongoConnected = false;

if (!MONGODB_URI || MONGODB_URI.includes('<username>')) {
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
            console.warn("Falling back to local db/data.json file database.");
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
    progress: { dsa: 15, ai: 10, apti: 20, systemdesign: 5, tech: 25, core: 30 },
    logs: [
        { id: 1, date: getOffsetDateString(0), category: "dsa", duration: 2.5, description: "Solved 3 Medium Binary Tree problems on DFS.", percentageIncrement: 5 },
        { id: 2, date: getOffsetDateString(-1), category: "ai", duration: 3, description: "Studied Backpropagation algorithm and coded simple Neural Network layer.", percentageIncrement: 10 },
        { id: 3, date: getOffsetDateString(-2), category: "systemdesign", duration: 1.5, description: "Reviewed Key-Value store architectures and Consistency models.", percentageIncrement: 5 },
        { id: 4, date: getOffsetDateString(-3), category: "dsa", duration: 3.5, description: "Practiced sliding window algorithms and key Array patterns.", percentageIncrement: 10 },
        { id: 5, date: getOffsetDateString(-4), category: "apti", duration: 2, description: "Solved 15 Quantitative Reasoning questions on Work & Time.", percentageIncrement: 20 },
        { id: 6, date: getOffsetDateString(-5), category: "tech", duration: 4, description: "Finished reading Next.js App Router and Server Components docs.", percentageIncrement: 25 },
        { id: 7, date: getOffsetDateString(-6), category: "core", duration: 3, description: "Reviewed OS CPU scheduling algorithms and Semaphores.", percentageIncrement: 30 }
    ],
    events: [
        { id: 1, date: getOffsetDateString(1), time: "14:00", title: "DSA Contest Practice", type: "test" },
        { id: 2, date: getOffsetDateString(3), time: "09:00", title: "System Design Milestone Study", type: "milestone" },
        { id: 3, date: getOffsetDateString(5), time: "23:59", title: "Aptitude Section Test Deadline", type: "deadline" }
    ],
    resources: [
        { id: 1, name: "NeetCode 150 Map", category: "dsa", url: "https://neetcode.io/practice" },
        { id: 2, name: "CS229 Stanford AI", category: "ai", url: "https://cs229.stanford.edu" },
        { id: 3, name: "System Design Primer", category: "systemdesign", url: "https://github.com/donnemartin/system-design-primer" }
    ],
    todos: [
        { id: 1, text: "Finish Binary Tree Traversals", priority: "high", completed: false },
        { id: 2, text: "Watch Transformer Networks video", priority: "medium", completed: true },
        { id: 3, text: "Solve 10 Aptitude Logical Reasoning Qs", priority: "low", completed: false }
    ],
    mockTests: [
        { id: 1, date: getOffsetDateString(-3), title: "DSA Trees Mock Test 1", category: "dsa", problemsSolved: 3, problemsTotal: 4, duration: 45, score: 75 }
    ],
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

function isMongoConnected() {
    return mongoose.connection.readyState === 1;
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
    if (isMongoConnected()) {
        try {
            let doc = await StudyState.findOne({ username });
            if (!doc) {
                doc = new StudyState({ username, ...DEFAULT_DB });
                await doc.save();
            }
            return doc;
        } catch (e) {
            console.error("MongoDB read error, falling back to local file", e);
        }
    }
    return readDatabase();
}

// Unified Async write state helper
async function saveUserState(username, updatedFields) {
    if (isMongoConnected()) {
        try {
            const doc = await StudyState.findOneAndUpdate(
                { username },
                { $set: updatedFields },
                { new: true, upsert: true }
            );
            return doc;
        } catch (e) {
            console.error("MongoDB write error, falling back to local file write", e);
        }
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
app.use(express.json());

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
app.get('/api/userdata', authenticateToken, async (req, res) => {
    try {
        const db = await getUserState(req.user.username);
        res.json(db);
    } catch (err) {
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
        res.status(500).json({ error: 'Failed to save file metadata' });
    }
});

// 2. Download File
app.get('/api/files/download/:id', async (req, res) => {
    let file = null;
    
    if (isMongoConnected()) {
        try {
            const doc = await StudyState.findOne({ "files.id": req.params.id }, { files: 1 });
            if (doc && doc.files) {
                file = doc.files.find(f => f.id === req.params.id);
            }
        } catch (e) {
            console.error("MongoDB file download look up error", e);
        }
    }

    if (!file) {
        // Fallback file lookup
        const db = readDatabase();
        file = db.files.find(f => f.id === req.params.id);
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
