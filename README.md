## sysdb

A lightweight, **in-memory JSON database** for Node.js designed for speed and simplicity. Use it safely in single process environments only. Cluster or multi process not supported.

It is optimized for smaller datasets, in the order of **100,000 records**, providing synchronous read performance with asynchronous, debounced background writes.

---

### Features

* **Mongodb-style Queries:** Supports `$gt`, `$lt`, `$gte`, `$lte`, `$ne`, `$in`, `$nin`, and `$regex`.
* **Atomic Persistence:** Writes to a `.tmp` file and renames it to ensure the database is never corrupted during a write.
* **Date Support:** Automatic normalization and comparison of `Date` objects.
* **Pagination:** Built-in `limit` and `skip` options.

---

### Installation

```sh
npm i sysdb
```

### Usage

```js
// Single database / collection
var sysdb = require('sysdb')
var db = sysdb('./sysdb.json')

var users = db.get({ type: 'user' })

// Multiple "tables"
var db = {
  users: sysdb('./users.json'),
  projects: sysdb('./projects.json'),
}

var users = db.users.get()
var projects = db.projects.get()
```

---

### Usage Examples

#### 1. Inserting Data

If you pass a single object to `set()`, it performs an insert. It automatically generates a UUID `id` if one isn't provided.

```js
await db.set({
  name: 'Project Alpha',
  status: 'pending',
  priority: 1,
  createdAt: new Date()
})
```

#### 2. Querying with Operators

The `get()` method accepts a query object and an optional options object for pagination.

```js
// Find high priority tasks
var tasks = db.get({
  priority: { $gte: 5 },
  status: { $ne: 'archived' }
})

// Use Regex and In-array checks
var results = db.get({
  name: { $regex: /^Project/i },
  tags: { $in: ['urgent', 'active'] }
})

```

#### 3. Updating Data

Pass a query as the first argument and an update object as the second.

```js
// Update all pending tasks to active
await db.set({ status: 'pending' }, { status: 'active' })

// Update a specific record by ID
await db.set({ id: 'some-uuid' }, { progress: 100 })

```

#### 4. Deleting Data

Pass `null` as the second argument to delete matching records.

```js
// Remove a specific record
await db.set({ id: 'some-uuid' }, null)

// Clear all completed tasks
await db.set({ status: 'completed' }, null)

// Clear entire database
await db.set({}, null)
```

#### 5. Pagination

Efficiently page through results using `limit` and `skip`.

```js
// Page 2: 10 items per page
var page = db.get({ type: 'log' }, {
  limit: 10,
  skip: 10
})

```

#### 6. Manual Commits

Writes are debounced by 5ms to group rapid changes. Use `commit()` to ensure all data is flushed to the physical JSON file immediately.

```js
await db.set({ important: 'data' })
await db.commit() // Resolves once the JSON file is safely updated

```

#### 7. Direct data access

The dataset is just an in-memory Javascript array. You can use it directly with normal Javascript functions.

```js
// Reading data
var activeDocs = db.data.filter((doc) => doc.active)

// Writing data is possible but unsafe
db.data = []
db.data = db.data.filter((doc) => doc.type ===  'project')

// Use this to persist to disk immediately
await db.commit()
```

---

### API Reference

| Method | Description |
| --- | --- |
| `get(query, [options])` | Returns an array of matching documents. Options: `{ limit, skip }`. |
| `set(query, [values])` | **Insert:** One arg. **Update:** Query + Data. **Delete:** Query + `null`. |
| `commit()` | Returns a promise that resolves once all in-flight writes are flushed to disk. |
| `get data / set data` | Direct access to the in-memory array for bulk operations. |

### License

ISC.

### Acknowledgements

Created by Vidar Eldøy, [Tekki AS](https://tekki.no)
