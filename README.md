Here is the **updated README for `sysdb`**, reflecting the **final minimal API** (`get()` + `set()` only), with **no `commit()`** and **no direct data access**.

---

## sysdb

A lightweight, **in-memory JSON database** for Node.js designed for speed and simplicity. Intended for **single-process environments only**. Clustered or multi-process usage is not supported.

`sysdb` keeps all data in memory and persists snapshots to disk asynchronously. Reads are synchronous and fast; writes are debounced and persisted in the background.

Optimized for smaller datasets, typically up to **~100,000 records**.

---

### Features

* **Mongo-style Queries:** `$gt`, `$lt`, `$gte`, `$lte`, `$ne`, `$in`, `$nin`, `$regex`
* **In-memory Authority:** All reads operate on in-memory data
* **Atomic Persistence:** Snapshots written via `.tmp` + rename
* **Date Support:** Automatic normalization and comparison of `Date` values
* **Pagination:** Built-in `limit` and `skip`
* **Minimal API:** Only `get()` and `set()`

---

### Installation

```sh
npm i sysdb
```

---

### Usage

```js
var sysdb = require('sysdb')

// Single database / collection
var db = sysdb('./sysdb.json')

var users = db.get({ type: 'user' })

// Multiple logical tables
var db = {
  users: sysdb('./users.json'),
  projects: sysdb('./projects.json'),
}

var users = db.users.get({})
var projects = db.projects.get({})
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
// Delete a single record
await db.set({ id: 'some-uuid' }, null)

// Delete all completed tasks
await db.set({ status: 'completed' }, null)

// Clear entire database
await db.set({}, null)
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

### Persistence Model

* Data is stored **in memory**
* Writes are **debounced** (5 ms) and snapshotted to disk
* Persistence is **eventual**
* On process exit before snapshot, recent writes may be lost

There is no explicit flush or commit operation.

---

### API Reference

| Method                  | Description                                                   |
| ----------------------- | ------------------------------------------------------------- |
| `get(query, [options])` | Returns matching documents. Supports `{ limit, skip, sort }`. |
| `set(query, [values])`  | Insert, update, or delete documents.                          |

---

### Limitations

* Single process only
* No multi-process safety
* No transactional guarantees
* No live reload of external file changes

For multi-process or crash-durable use cases, use **`unitdb`** instead.

---

### License

ISC.

---

### Acknowledgements

Created by Vidar Eldøy, Tekki AS.
