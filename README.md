## sysdb

A lightweight **SQLite-backed JSON document database** for Node.js with a **minimal API** and **multi-process safety**. All persistence, locking, durability, and recovery are delegated entirely to SQLite.

`sysdb` keeps the same simple query and mutation model as `sysdb`, but uses **SQLite as the sole source of truth**, making it safe for **multiple processes, workers, and restarts**.

---

### Features

* **SQLite-backed:** Disk is authoritative.
* **Multi-process safe:** Concurrent readers and writers supported.
* **Crash safe:** SQLite journaling and recovery.
* **Mongo-style Queries:** `$gt`, `$lt`, `$gte`, `$lte`, `$ne`, `$in`, `$nin`, `$regex`.
* **JSON Documents:** Schema-less records stored as JSON.
* **Atomic Writes:** Each mutation is fully committed or rolled back.
* **Pagination:** Built-in `limit` and `skip`.
* **Minimal API:** Only `get()` and `set()`.

---

### Installation

```sh
npm i sysdb
```

Node.js **v22+** required (uses built-in `node:sqlite`).

---

### Usage

```js
var sysdb = require('sysdb')
var db = sysdb('./sysdb.sqlite')
```

---

### Usage Examples

#### 1. Inserting Data

Passing a single object inserts a new document. A UUID `id` is generated automatically if missing.

```js
await db.set({
  name: 'Project Alpha',
  status: 'pending',
  priority: 1,
  createdAt: new Date()
})
```

---

#### 2. Querying with Operators

```js
// Find high priority tasks
var tasks = db.get({
  priority: { $gte: 5 },
  status: { $ne: 'archived' }
})

// Regex and array operators
var results = db.get({
  name: { $regex: /^Project/i },
  tags: { $in: ['urgent', 'active'] }
})
```

---

#### 3. Updating Data

```js
// Update all pending tasks
await db.set({ status: 'pending' }, { status: 'active' })

// Update by ID
await db.set({ id: 'some-uuid' }, { progress: 100 })
```

---

#### 4. Deleting Data

```js
// Delete one record
await db.set({ id: 'some-uuid' }, null)

// Delete all completed tasks
await db.set({ status: 'completed' }, null)
```

---

#### 5. Pagination

```js
var page = db.get({ type: 'log' }, {
  limit: 10,
  skip: 10
})
```

---

### Data Model

Internally, `sysdb` uses:

* One SQLite database file
* One table:

  * `id TEXT PRIMARY KEY`
  * `json TEXT` (serialized document)

No schema migrations are required.

---

### Concurrency Model

* Multiple processes can read and write safely
* SQLite enforces locking and ordering
* Readers never see partial writes
* Writers are serialized automatically

---

### API Reference

| Method                  | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `get(query, [options])` | Returns matching documents. Supports `{ limit, skip, sort }`. |
| `set(query, [values])`  | Insert, update, or delete documents.                          |

---

### License

ISC.

Created by [Vidar Eldøy](https://eldoy.com)
