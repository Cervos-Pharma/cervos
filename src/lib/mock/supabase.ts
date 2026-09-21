/**
 * @file lib/mock/supabase.ts
 * @description A Supabase-js-compatible in-memory client used ONLY in mock
 *   mode (`NEXT_PUBLIC_MOCK_MODE=true`). It implements just enough of the
 *   PostgREST surface the app actually uses — selects with nested embeds,
 *   the filter set (eq/neq/gte/gt/lte/lt/in/is/not), ordering, limits,
 *   head+exact-count queries, insert/update/upsert/delete, auth stubs,
 *   the one RPC call, and a storage stub — backed by the mutable dataset in
 *   `lib/mock/data.ts`.
 *
 * It is a *thenable* query builder, mirroring how supabase-js chains work:
 *   const { data } = await supabase.from("accounts").select("*").eq("id", x).maybeSingle();
 *
 * Mutations persist in memory for the life of the dev server, so HQ controls
 * (suspend, lock, extend trial, manage operators/team) really work end-to-end.
 */

import {
  createMockData,
  MOCK_AUTH_USERS,
  MOCK_RELATIONSHIPS,
  type MockRow,
  type MockTable,
} from "@/lib/mock/data";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MockUser {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
  aud: string;
  role: string;
}

export interface MockClientOptions {
  /** Server-side: resolve the "signed-in" demo user (reads the mock_user cookie). */
  resolveUser?: () => MockUser | null;
  /** Called on successful mock sign-in so the caller can persist the choice. */
  onSignIn?: (accountType: "pharmacy" | "supplier") => void;
  /** Called on mock sign-out so the caller can clear the persisted choice. */
  onSignOut?: () => void;
}

type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is";
interface Filter {
  op: FilterOp;
  col: string;
  value: unknown;
  negated?: boolean;
}

interface MockResult {
  data: MockRow[] | MockRow | null;
  error: { message: string } | null;
  count?: number | null;
}

function mockUserFromAuth(u: (typeof MOCK_AUTH_USERS)[number]): MockUser {
  return {
    id: u.id,
    email: u.email,
    user_metadata: {
      account_type: u.account_type,
      full_name: u.full_name,
    },
    app_metadata: {},
    aud: "authenticated",
    role: "authenticated",
  };
}

function defaultUser(): MockUser {
  return mockUserFromAuth(MOCK_AUTH_USERS[0]);
}

// ─── Query builder ───────────────────────────────────────────────────────────

type Mode = "select" | "insert" | "update" | "upsert" | "delete";

export class MockQueryBuilder {
  private mode: Mode = "select";
  private columns = "*";
  private head = false;
  private withCount = false;
  private filters: Filter[] = [];
  private orderBy: { col: string; asc: boolean }[] = [];
  private limitN: number | null = null;
  private singleMode: "none" | "maybe" | "strict" = "none";
  private payload: unknown = null;
  private onConflict = "";

  constructor(
    private db: MockTable,
    private table: string
  ) {}

  select(columns: string, opts?: { count?: string; head?: boolean }) {
    this.columns = columns;
    this.head = opts?.head ?? false;
    this.withCount = opts?.count === "exact";
    return this;
  }

  eq(col: string, value: unknown) {
    this.filters.push({ op: "eq", col, value });
    return this;
  }
  neq(col: string, value: unknown) {
    this.filters.push({ op: "neq", col, value });
    return this;
  }
  gt(col: string, value: unknown) {
    this.filters.push({ op: "gt", col, value });
    return this;
  }
  gte(col: string, value: unknown) {
    this.filters.push({ op: "gte", col, value });
    return this;
  }
  lt(col: string, value: unknown) {
    this.filters.push({ op: "lt", col, value });
    return this;
  }
  lte(col: string, value: unknown) {
    this.filters.push({ op: "lte", col, value });
    return this;
  }
  in(col: string, values: unknown[]) {
    this.filters.push({ op: "in", col, value: values });
    return this;
  }
  is(col: string, value: unknown) {
    this.filters.push({ op: "is", col, value });
    return this;
  }
  not(col: string, op: string, value: unknown) {
    this.filters.push({ op: op as FilterOp, col, value, negated: true });
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy.push({ col, asc: opts?.ascending ?? true });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single() {
    this.singleMode = "strict";
    return this;
  }
  maybeSingle() {
    this.singleMode = "maybe";
    return this;
  }

  insert(rows: MockRow | MockRow[]) {
    this.mode = "insert";
    this.payload = rows;
    return this;
  }
  upsert(rows: MockRow | MockRow[], opts?: { onConflict?: string }) {
    this.mode = "upsert";
    this.payload = rows;
    this.onConflict = opts?.onConflict ?? "id";
    return this;
  }
  update(patch: MockRow) {
    this.mode = "update";
    this.payload = patch;
    return this;
  }
  delete() {
    this.mode = "delete";
    return this;
  }

  // ── Execution ──────────────────────────────────────────────────────────────

  private matches(row: MockRow): boolean {
    return this.filters.every((f) => {
      const v = row[f.col];
      let ok: boolean;
      switch (f.op) {
        case "eq":
          ok = v === f.value;
          break;
        case "neq":
          ok = v !== f.value;
          break;
        case "gt":
          ok = (v as never) > (f.value as never);
          break;
        case "gte":
          ok = (v as never) >= (f.value as never);
          break;
        case "lt":
          ok = (v as never) < (f.value as never);
          break;
        case "lte":
          ok = (v as never) <= (f.value as never);
          break;
        case "in":
          ok = Array.isArray(f.value) && (f.value as unknown[]).includes(v);
          break;
        case "is":
          ok = v === f.value;
          break;
        default:
          ok = false;
      }
      return f.negated ? !ok : ok;
    });
  }

  private sort(rows: MockRow[]): MockRow[] {
    if (this.orderBy.length === 0) return rows;
    const copy = [...rows];
    for (const { col, asc } of [...this.orderBy].reverse()) {
      copy.sort((a, b) => {
        const av = a[col];
        const bv = b[col];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = (av as never) < (bv as never) ? -1 : (av as never) > (bv as never) ? 1 : 0;
        return asc ? cmp : -cmp;
      });
    }
    return copy;
  }

  private projectRow(table: string, row: MockRow, columns: ColumnNode[]): MockRow {
    const out: MockRow = {};
    for (const node of columns) {
      if (node.name === "*") {
        Object.assign(out, row);
        continue;
      }
      if (node.children && node.children.length > 0) {
        out[node.name] = this.resolveEmbed(table, row, node);
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(row, node.name)) {
        out[node.name] = row[node.name];
      }
    }
    return out;
  }

  private resolveEmbed(table: string, row: MockRow, node: ColumnNode): unknown {
    const rels = MOCK_RELATIONSHIPS[table] ?? [];
    const rel = rels.find((r) => r.embedTable === node.name);
    if (!rel) return null;
    const targetRows = this.db[rel.embedTable] ?? [];
    if (rel.many) {
      const fkCol = rel.fkTargetCol ?? `${rel.embedTable}_id`;
      return targetRows
        .filter((t) => t[fkCol] === row.id)
        .map((t) => this.projectRow(rel.embedTable, t, node.children ?? []));
    }
    const target = targetRows.find((t) => t.id === row[rel.fkCol]);
    return target ? this.projectRow(rel.embedTable, target, node.children ?? []) : null;
  }

  private execute(): MockResult {
    const tableRows = this.db[this.table] ?? [];
    let matched = tableRows.filter((r) => this.matches(r));
    const count = matched.length;

    if (this.mode === "delete") {
      this.db[this.table] = tableRows.filter((r) => !this.matches(r));
      return { data: matched, error: null, count };
    }
    if (this.mode === "insert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const clean = rows.filter(Boolean).map((r) => {
        const row = { ...(r as MockRow) };
        // Stand in for Postgres column defaults that the mock schema lacks —
        // keeps mock rows well-formed when callers omit server-generated fields.
        if (this.table === "app_releases") {
          if (!row.id) row.id = `rel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const now = new Date().toISOString();
          if (!row.created_at) row.created_at = now;
          if (!row.uploaded_at) row.uploaded_at = now;
        }
        return row;
      });
      this.db[this.table] = [...tableRows, ...clean];
      return { data: clean, error: null, count: clean.length };
    }
    if (this.mode === "upsert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const conflictCol = this.onConflict || "id";
      const out: MockRow[] = [];
      for (const raw of rows) {
        const row = raw as MockRow;
        const existing = tableRows.find((t) => t[conflictCol] === row[conflictCol]);
        if (existing) {
          Object.assign(existing, row);
          out.push(existing);
        } else {
          this.db[this.table].push(row);
          out.push(row);
        }
      }
      return { data: out, error: null, count: out.length };
    }
    if (this.mode === "update") {
      const patch = (this.payload ?? {}) as MockRow;
      for (const r of matched) Object.assign(r, patch);
      return { data: matched, error: null, count: matched.length };
    }

    // select
    if (this.head) {
      return { data: [], error: null, count: this.withCount ? count : null };
    }
    let rows = this.sort(matched);
    if (this.limitN != null) rows = rows.slice(0, this.limitN);

    if (this.singleMode === "strict") {
      const first = rows[0];
      if (!first) return { data: null, error: { message: "Row not found" }, count };
      if (rows.length > 1) return { data: null, error: { message: "Multiple rows returned" }, count };
      return { data: this.projectRow(this.table, first, parseColumns(this.columns)), error: null, count };
    }
    if (this.singleMode === "maybe") {
      const first = rows[0];
      return {
        data: first ? this.projectRow(this.table, first, parseColumns(this.columns)) : null,
        error: null,
        count,
      };
    }
    return {
      data: rows.map((r) => this.projectRow(this.table, r, parseColumns(this.columns))),
      error: null,
      count: this.withCount ? count : null,
    };
  }

  then<TResult1 = MockResult, TResult2 = never>(
    onfulfilled?: ((value: MockResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    try {
      const result = this.execute();
      return Promise.resolve(result).then(onfulfilled as never, onrejected as never);
    } catch (e) {
      return Promise.reject(e).then(onfulfilled as never, onrejected as never);
    }
  }
}

interface ColumnNode {
  name: string;
  children?: ColumnNode[];
}

function parseColumns(columns: string): ColumnNode[] {
  if (columns === "*" || columns === "*," || columns === "") return [{ name: "*" }];
  const nodes: ColumnNode[] = [];
  const raw = columns.trim();
  let depth = 0;
  let buf = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "(") {
      depth++;
      buf += ch;
    } else if (ch === ")") {
      depth--;
      buf += ch;
    } else if (ch === "," && depth === 0) {
      pushColumnNode(nodes, buf.trim());
      buf = "";
    } else {
      buf += ch;
    }
  }
  pushColumnNode(nodes, buf.trim());
  return nodes;
}

function pushColumnNode(nodes: ColumnNode[], token: string) {
  if (!token) return;
  const open = token.indexOf("(");
  if (open === -1) {
    if (token === "*") nodes.push({ name: "*" });
    else if (token) nodes.push({ name: token });
    return;
  }
  const name = token.slice(0, open).trim();
  const inner = token.slice(open + 1, token.lastIndexOf(")"));
  nodes.push({ name, children: parseColumns(inner) });
}

// ─── Client ──────────────────────────────────────────────────────────────────

/**
 * Singleton in-memory store shared by every mock client in the process.
 * Lives for the lifetime of the dev server, so mutations made by one server
 * action (e.g. HQ suspends an account) are visible to subsequent requests.
 * Restarting `next dev` resets the dataset.
 */
// Backed by globalThis so every module instance in the process shares one
// store. A module-scoped singleton is NOT enough: Next dev compiles route
// handlers and pages/actions into separate module graphs, so each would get
// its own `sharedDb` and a row inserted by a server action would be invisible
// to /api/* route handlers (and vice versa).
const globalStore = globalThis as unknown as { __cervosMockDb?: MockTable };

function getSharedDb(): MockTable {
  if (!globalStore.__cervosMockDb) globalStore.__cervosMockDb = createMockData();
  return globalStore.__cervosMockDb;
}

/** Builds the demo user object for a given account type (used by the role switcher). */
export function mockUserForType(accountType: "pharmacy" | "supplier"): MockUser {
  const found = MOCK_AUTH_USERS.find((u) => u.account_type === accountType);
  if (!found) return defaultUser();
  return mockUserFromAuth(found);
}

export function createMockSupabase(options: MockClientOptions = {}) {
  const db = getSharedDb();

  const auth = {
    async getUser() {
      const user = options.resolveUser?.() ?? defaultUser();
      return { data: { user: user ? (user as unknown) : null }, error: null };
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const found = MOCK_AUTH_USERS.find(
        (u) => u.email.toLowerCase() === String(email ?? "").trim().toLowerCase()
      );
      if (!found || found.password !== password) {
        return { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
      }
      options.onSignIn?.(found.account_type);
      return { data: { user: mockUserFromAuth(found), session: {} }, error: null };
    },
    async signUp({
      email,
      password,
      options: opts,
    }: {
      email: string;
      password: string;
      options?: { data?: Record<string, unknown> };
    }) {
      void password;
      const accountType =
        opts?.data?.account_type === "supplier"
          ? "supplier"
          : opts?.data?.account_type === "pharmacy"
            ? "pharmacy"
            : "pharmacy";
      options.onSignIn?.(accountType);
      return {
        data: {
          user: {
            id: `user-${Date.now()}`,
            email,
            user_metadata: opts?.data ?? { account_type: accountType },
            app_metadata: {},
            aud: "authenticated",
            role: "authenticated",
          },
          session: {},
        },
        error: null,
      };
    },
    async signOut() {
      options.onSignOut?.();
      return { error: null };
    },
    async resetPasswordForEmail() {
      return { data: {}, error: null };
    },
    async exchangeCodeForSession() {
      return { data: { session: {} }, error: null };
    },
  };

  return {
    auth,
    from(table: string) {
      return new MockQueryBuilder(db, table);
    },
    rpc(name: string, args: Record<string, unknown> = {}) {
      if (name === "set_current_release") {
        // Mirrors the real SQL function: demote everything on the target's
        // platform, then promote the target — one current per platform.
        const releases = db.app_releases ?? [];
        const target = releases.find((r) => r.id === args.p_release_id);
        if (target) {
          for (const r of releases) {
            if (r.platform === target.platform) r.is_current = false;
          }
          target.is_current = true;
        }
      }
      return Promise.resolve({ data: null, error: null });
    },
    storage: {
      from() {
        return {
          getPublicUrl(path: string) {
            return { data: { publicUrl: `/mock/storage/app-releases/${path}` } };
          },
          createSignedUrl(path: string) {
            // Mock "signed" read URLs are just the public mock route.
            return Promise.resolve({
              data: { signedUrl: `/mock/storage/app-releases/${path}` },
              error: null,
            });
          },
          createSignedUploadUrl(path: string) {
            // The client PUTs to /api/mock/storage/upload, which stores the
            // binary under .mock-releases and requires the HQ cookie.
            return Promise.resolve({
              data: { signedUrl: `/api/mock/storage/upload?path=${encodeURIComponent(path)}`, path },
              error: null,
            });
          },
          list() {
            // Pretend the bucket always exists; contents live on disk.
            return Promise.resolve({ data: [{}], error: null });
          },
          remove() {
            // The .mock-releases file is left on disk — harmless in mock mode.
            return Promise.resolve({ data: [], error: null });
          },
        };
      },
    },
  };
}
