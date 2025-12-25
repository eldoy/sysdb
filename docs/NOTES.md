# Typescript

This can be included in the library (`database.d.ts`):

```ts
export interface DocumentQuery {
  [key: string]: any | {
    $gt?: any;
    $lt?: any;
    $gte?: any;
    $lte?: any;
    $ne?: any;
    $in?: any[];
    $nin?: any[];
    $regex?: string | RegExp;
  };
}

export interface QueryOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
}

export interface DatabaseInstance<T> {
  /** The raw in-memory array for high-speed access. */
  data: T[];

  /** Query documents using Selector syntax. */
  get(query: DocumentQuery, options?: QueryOptions): T[];

  /** * Insert a document: set(doc)
   * Update matching documents: set(query, updates)
   * Delete matching documents: set(query, null)
   */
  set(query: DocumentQuery | T, values?: Partial<T> | null): Promise<string | void>;

  /** Syncs the Write-Ahead Log (WAL) to the master JSON file. */
  commit(): Promise<void>;
}

/**
 * Initializes a new JSON-backed database instance.
 */
declare function database<T>(file: string): DatabaseInstance<T>;

export default database;
```

This is how you use it:

```ts
import database from './database.js';
import { DocumentQuery, QueryOptions } from './database.d.ts';

interface LogEntry {
  id?: string;
  level: 'info' | 'error' | 'warn';
  message: string;
  timestamp: string;
}

const db = database<LogEntry>('logs.json');

async function main() {
  // 1. Insert using custom type
  await db.set({
    level: 'info',
    message: 'System initialized',
    timestamp: new Date().toISOString()
  });

  // 2. Query with specific QueryOptions
  const options: QueryOptions = { limit: 10, sort: { timestamp: -1 } };
  const query: DocumentQuery = { level: 'error' };

  const recentErrors = db.get(query, options);

  console.log(`Found ${recentErrors.length} recent errors.`);
}
```

Package.json setup:

```json
{
  "name": "your-db-name",
  "version": "1.0.0",
  "description": "Zero-dependency JSON database with DocumentQuery support",
  "main": "database.js",
  "types": "database.d.ts",
  "type": "module",
  "exports": {
    ".": {
      "types": "./database.d.ts",
      "import": "./database.js"
    }
  },
  "scripts": {
    "test": "node test.js"
  },
  "keywords": ["database", "json", "document-query", "nosql", "fast"],
  "author": "",
  "license": "MIT"
}
```

User `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "node",
    "allowJs": true,           /* Important: allows TS to look at your .js file */
    "checkJs": false,          /* We use the .d.ts for checking, not the JS code */
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true       /* Speeds up build by not re-checking your .d.ts */
  },
  "include": ["**/*.ts"]
}
```
