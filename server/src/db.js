const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'app.db');

let db = null;

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON;');

  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER DEFAULT 0,
      approved INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      company TEXT NOT NULL,
      position TEXT NOT NULL,
      job_url TEXT DEFAULT '',
      delivery_date TEXT NOT NULL,
      interview_date TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT '已投递',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
      event_date TEXT NOT NULL,
      event_type TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      due_date TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Migration: add user_id column to existing tables if missing
  try {
    db.run('ALTER TABLE applications ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;');
  } catch (e) { /* column already exists */ }
  try {
    db.run('ALTER TABLE applications ADD COLUMN interview_date TEXT DEFAULT \'\';');
  } catch (e) { /* column already exists */ }
  try {
    db.run('ALTER TABLE timeline ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;');
  } catch (e) { /* column already exists */ }
  try {
    db.run('ALTER TABLE todos ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;');
  } catch (e) { /* column already exists */ }

  // Migration: add is_admin and approved columns
  try {
    db.run('ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;');
  } catch (e) { /* already exists */ }
  try {
    db.run('ALTER TABLE users ADD COLUMN approved INTEGER DEFAULT 1;');
  } catch (e) { /* already exists */ }
  // Ensure admin user is marked as admin and approved
  db.run("UPDATE users SET is_admin = 1, approved = 1 WHERE username = 'admin'");

  // If there are existing rows without user_id, assign them to a default user
  const existingApps = db.exec('SELECT COUNT(*) FROM applications WHERE user_id IS NULL');
  const hasOrphaned = existingApps[0]?.values[0]?.[0] > 0;

  if (hasOrphaned) {
    // Create a default user for migration
    const existingUser = db.exec('SELECT id FROM users WHERE username = \'admin\'');
    let defaultUserId;
    if (existingUser.length > 0 && existingUser[0].values.length > 0) {
      defaultUserId = existingUser[0].values[0][0];
    } else {
      const bcrypt = require('bcryptjs');
      const hash = bcrypt.hashSync('admin123', 10);
      db.run('INSERT INTO users (username, password_hash, is_admin, approved) VALUES (?, ?, 1, 1)', ['admin', hash]);
      const idResult = db.exec('SELECT last_insert_rowid()');
      defaultUserId = idResult[0].values[0][0];
    }
    db.run('UPDATE applications SET user_id = ? WHERE user_id IS NULL', [defaultUserId]);
    db.run('UPDATE timeline SET user_id = ? WHERE user_id IS NULL', [defaultUserId]);
    db.run('UPDATE todos SET user_id = ? WHERE user_id IS NULL', [defaultUserId]);
  }

  // Indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_app_user ON applications(user_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_app_status ON applications(status);');
  db.run('CREATE INDEX IF NOT EXISTS idx_app_date ON applications(delivery_date);');
  db.run('CREATE INDEX IF NOT EXISTS idx_tl_user ON timeline(user_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_tl_app ON timeline(application_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_todo_user ON todos(user_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_todo_date ON todos(due_date);');
  db.run('CREATE INDEX IF NOT EXISTS idx_todo_done ON todos(done);');

  // Company ratings / interview notes
  db.run(`
    CREATE TABLE IF NOT EXISTS company_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      company TEXT NOT NULL,
      application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
      rating INTEGER CHECK(rating >= 1 AND rating <= 5),
      interview_stage TEXT DEFAULT '',
      interview_notes TEXT DEFAULT '',
      salary TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Share links (read-only access)
  db.run(`
    CREATE TABLE IF NOT EXISTS share_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      title TEXT DEFAULT '',
      expire_date TEXT DEFAULT '',
      view_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_rating_user ON company_ratings(user_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_share_token ON share_links(token);');

  // Salary comparison
  db.run(`
    CREATE TABLE IF NOT EXISTS salary_comparison (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      application_id INTEGER REFERENCES applications(id) ON DELETE SET NULL,
      company TEXT NOT NULL,
      position TEXT DEFAULT '',
      base_salary REAL DEFAULT 0,
      bonus REAL DEFAULT 0,
      stock REAL DEFAULT 0,
      signing_bonus REAL DEFAULT 0,
      allowance_meal REAL DEFAULT 0,
      allowance_housing REAL DEFAULT 0,
      other_benefits TEXT DEFAULT '',
      total_package REAL DEFAULT 0,
      work_hours REAL DEFAULT 0,
      commute_minutes INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Resume versions
  db.run(`
    CREATE TABLE IF NOT EXISTS resume_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      version_name TEXT NOT NULL,
      target_position TEXT DEFAULT '',
      content TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Interview questions bank
  db.run(`
    CREATE TABLE IF NOT EXISTS interview_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      company TEXT DEFAULT '',
      position TEXT DEFAULT '',
      question_type TEXT DEFAULT '',
      question TEXT NOT NULL,
      answer TEXT DEFAULT '',
      difficulty INTEGER DEFAULT 3,
      tags TEXT DEFAULT '',
      interview_date TEXT DEFAULT '',
      source TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Migration: applications new columns
  try {
    db.run('ALTER TABLE applications ADD COLUMN resume_version_id INTEGER REFERENCES resume_versions(id) ON DELETE SET NULL;');
  } catch (e) { /* exists */ }
  try {
    db.run('ALTER TABLE applications ADD COLUMN rejection_reason TEXT DEFAULT \'\';');
  } catch (e) { /* exists */ }
  try {
    db.run('ALTER TABLE applications ADD COLUMN rejection_stage TEXT DEFAULT \'\';');
  } catch (e) { /* exists */ }

  // === Friends & Groups & Sharing ===

  // Friend relationships
  db.run(`
    CREATE TABLE IF NOT EXISTS friends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(user_id, friend_id)
    );
  `);

  // Groups
  db.run(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      invite_token TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Group members
  db.run(`
    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT DEFAULT (datetime('now', 'localtime')),
      UNIQUE(group_id, user_id)
    );
  `);

  // Friend permissions (bidirectional - each user controls what the other sees)
  db.run(`
    CREATE TABLE IF NOT EXISTS friend_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      relationship_id INTEGER NOT NULL REFERENCES friends(id) ON DELETE CASCADE,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      can_view_questions INTEGER DEFAULT 1,
      can_view_ratings INTEGER DEFAULT 1,
      UNIQUE(relationship_id, owner_id)
    );
  `);

  // Group permissions (each member controls what others see from them)
  db.run(`
    CREATE TABLE IF NOT EXISTS group_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      can_view_questions INTEGER DEFAULT 1,
      can_view_ratings INTEGER DEFAULT 1,
      UNIQUE(group_id, owner_id)
    );
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_salary_user ON salary_comparison(user_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_resume_user ON resume_versions(user_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_question_user ON interview_questions(user_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_question_company ON interview_questions(company);');

  // Friends & Groups indexes
  db.run('CREATE INDEX IF NOT EXISTS idx_friends_user ON friends(user_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_friends_friend ON friends(friend_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);');
  db.run('CREATE INDEX IF NOT EXISTS idx_group_token ON groups(invite_token);');
  db.run('CREATE INDEX IF NOT EXISTS idx_groupmem_group ON group_members(group_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_groupmem_user ON group_members(user_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_fperm_rel ON friend_permissions(relationship_id);');
  db.run('CREATE INDEX IF NOT EXISTS idx_gperm_group ON group_permissions(group_id);');

  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, buffer);
}

function getDb() {
  return db;
}

module.exports = { initDb, getDb, saveDb };
