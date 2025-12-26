import { wa_sqlite_default } from './chunk-XTDXRGBP.js';
import { FacadeVFS } from './chunk-V74BWXVI.js';
import './chunk-EOQABE3P.js';
import { SQLITE_OPEN_MAIN_DB, SQLITE_OPEN_READONLY, SQLITE_LOCK_SHARED, SQLITE_LOCK_NONE, SQLITE_OPEN_CREATE, SQLITE_OPEN_READWRITE, SQLITE_LOCK_RESERVED, SQLITE_LOCK_EXCLUSIVE, SQLITE_FCNTL_BEGIN_ATOMIC_WRITE, SQLITE_FCNTL_COMMIT_ATOMIC_WRITE, SQLITE_FCNTL_SYNC, SQLITE_SYNC_NORMAL, SQLITE_UTF8, SQLITE_ROW, SQLITE_OK, SQLITE_CANTOPEN, SQLITE_OPEN_DELETEONCLOSE, SQLITE_IOERR_SHORT_READ, SQLITE_DETERMINISTIC, SQLITE_DIRECTONLY, SQLITE_NOTICE, SQLITE_RANGE, SQLITE_TEXT, SQLITE_NULL, SQLITE_INTEGER, SQLITE_FLOAT, SQLITE_BLOB, SQLITE_MISUSE, SQLITE_DONE } from './chunk-5HQBLAUX.js';

// node_modules/.pnpm/wa-sqlite@https+++codeload.github.com+rhashimoto+wa-sqlite+tar.gz+a3b1324ed5a57928141b02eb3204421e1164ed53/node_modules/wa-sqlite/src/sqlite-api.js
var MAX_INT64 = 0x7fffffffffffffffn;
var MIN_INT64 = -0x8000000000000000n;
var AsyncFunction = Object.getPrototypeOf(async function() {
}).constructor;
var SQLiteError = class extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
};
var async = true;
function Factory(Module) {
  const sqlite3 = {};
  Module.retryOps = [];
  const sqliteFreeAddress = Module._getSqliteFree();
  const tmp = Module._malloc(8);
  const tmpPtr = [tmp, tmp + 4];
  const textEncoder = new TextEncoder();
  function createUTF8(s) {
    if (typeof s !== "string") return 0;
    const utf8 = textEncoder.encode(s);
    const zts = Module._sqlite3_malloc(utf8.byteLength + 1);
    Module.HEAPU8.set(utf8, zts);
    Module.HEAPU8[zts + utf8.byteLength] = 0;
    return zts;
  }
  function cvt32x2ToBigInt(lo32, hi32) {
    return BigInt(hi32) << 32n | BigInt(lo32) & 0xffffffffn;
  }
  const cvt32x2AsSafe = (function() {
    const hiMax = BigInt(Number.MAX_SAFE_INTEGER) >> 32n;
    const hiMin = BigInt(Number.MIN_SAFE_INTEGER) >> 32n;
    return function(lo32, hi32) {
      if (hi32 > hiMax || hi32 < hiMin) {
        return cvt32x2ToBigInt(lo32, hi32);
      } else {
        return hi32 * 4294967296 + (lo32 & 2147483647) - (lo32 & 2147483648);
      }
    };
  })();
  const databases = /* @__PURE__ */ new Set();
  function verifyDatabase(db) {
    if (!databases.has(db)) {
      throw new SQLiteError("not a database", SQLITE_MISUSE);
    }
  }
  const mapStmtToDB = /* @__PURE__ */ new Map();
  function verifyStatement(stmt) {
    if (!mapStmtToDB.has(stmt)) {
      throw new SQLiteError("not a statement", SQLITE_MISUSE);
    }
  }
  sqlite3.bind_collection = function(stmt, bindings) {
    verifyStatement(stmt);
    const isArray = Array.isArray(bindings);
    const nBindings = sqlite3.bind_parameter_count(stmt);
    for (let i = 1; i <= nBindings; ++i) {
      const key = isArray ? i - 1 : sqlite3.bind_parameter_name(stmt, i);
      const value = bindings[key];
      if (value !== void 0) {
        sqlite3.bind(stmt, i, value);
      }
    }
    return SQLITE_OK;
  };
  sqlite3.bind = function(stmt, i, value) {
    verifyStatement(stmt);
    switch (typeof value) {
      case "number":
        if (value === (value | 0)) {
          return sqlite3.bind_int(stmt, i, value);
        } else {
          return sqlite3.bind_double(stmt, i, value);
        }
      case "string":
        return sqlite3.bind_text(stmt, i, value);
      case "boolean":
        return sqlite3.bind_int(stmt, i, value ? 1 : 0);
      default:
        if (value instanceof Uint8Array || Array.isArray(value)) {
          return sqlite3.bind_blob(stmt, i, value);
        } else if (value === null) {
          return sqlite3.bind_null(stmt, i);
        } else if (typeof value === "bigint") {
          return sqlite3.bind_int64(stmt, i, value);
        } else if (value === void 0) {
          return SQLITE_NOTICE;
        } else {
          console.warn("unknown binding converted to null", value);
          return sqlite3.bind_null(stmt, i);
        }
    }
  };
  sqlite3.bind_blob = (function() {
    const fname = "sqlite3_bind_blob";
    const f = Module.cwrap(fname, ...decl("nnnnn:n"));
    return function(stmt, i, value) {
      verifyStatement(stmt);
      const byteLength = value.byteLength ?? value.length;
      const ptr = Module._sqlite3_malloc(byteLength);
      Module.HEAPU8.subarray(ptr).set(value);
      const result = f(stmt, i, ptr, byteLength, sqliteFreeAddress);
      return check2(fname, result, mapStmtToDB.get(stmt));
    };
  })();
  sqlite3.bind_parameter_count = (function() {
    const fname = "sqlite3_bind_parameter_count";
    const f = Module.cwrap(fname, ...decl("n:n"));
    return function(stmt) {
      verifyStatement(stmt);
      const result = f(stmt);
      return result;
    };
  })();
  sqlite3.bind_double = (function() {
    const fname = "sqlite3_bind_double";
    const f = Module.cwrap(fname, ...decl("nnn:n"));
    return function(stmt, i, value) {
      verifyStatement(stmt);
      const result = f(stmt, i, value);
      return check2(fname, result, mapStmtToDB.get(stmt));
    };
  })();
  sqlite3.bind_int = (function() {
    const fname = "sqlite3_bind_int";
    const f = Module.cwrap(fname, ...decl("nnn:n"));
    return function(stmt, i, value) {
      verifyStatement(stmt);
      if (value > 2147483647 || value < -2147483648) return SQLITE_RANGE;
      const result = f(stmt, i, value);
      return check2(fname, result, mapStmtToDB.get(stmt));
    };
  })();
  sqlite3.bind_int64 = (function() {
    const fname = "sqlite3_bind_int64";
    const f = Module.cwrap(fname, ...decl("nnnn:n"));
    return function(stmt, i, value) {
      verifyStatement(stmt);
      if (value > MAX_INT64 || value < MIN_INT64) return SQLITE_RANGE;
      const lo32 = value & 0xffffffffn;
      const hi32 = value >> 32n;
      const result = f(stmt, i, Number(lo32), Number(hi32));
      return check2(fname, result, mapStmtToDB.get(stmt));
    };
  })();
  sqlite3.bind_null = (function() {
    const fname = "sqlite3_bind_null";
    const f = Module.cwrap(fname, ...decl("nn:n"));
    return function(stmt, i) {
      verifyStatement(stmt);
      const result = f(stmt, i);
      return check2(fname, result, mapStmtToDB.get(stmt));
    };
  })();
  sqlite3.bind_parameter_name = (function() {
    const fname = "sqlite3_bind_parameter_name";
    const f = Module.cwrap(fname, ...decl("n:s"));
    return function(stmt, i) {
      verifyStatement(stmt);
      const result = f(stmt, i);
      return result;
    };
  })();
  sqlite3.bind_text = (function() {
    const fname = "sqlite3_bind_text";
    const f = Module.cwrap(fname, ...decl("nnnnn:n"));
    return function(stmt, i, value) {
      verifyStatement(stmt);
      const ptr = createUTF8(value);
      const result = f(stmt, i, ptr, -1, sqliteFreeAddress);
      return check2(fname, result, mapStmtToDB.get(stmt));
    };
  })();
  sqlite3.changes = (function() {
    const fname = "sqlite3_changes";
    const f = Module.cwrap(fname, ...decl("n:n"));
    return function(db) {
      verifyDatabase(db);
      const result = f(db);
      return result;
    };
  })();
  sqlite3.clear_bindings = (function() {
    const fname = "sqlite3_clear_bindings";
    const f = Module.cwrap(fname, ...decl("n:n"));
    return function(stmt) {
      verifyStatement(stmt);
      const result = f(stmt);
      return check2(fname, result, mapStmtToDB.get(stmt));
    };
  })();
  sqlite3.close = (function() {
    const fname = "sqlite3_close";
    const f = Module.cwrap(fname, ...decl("n:n"), { async });
    return async function(db) {
      verifyDatabase(db);
      const result = await f(db);
      databases.delete(db);
      return check2(fname, result, db);
    };
  })();
  sqlite3.column = function(stmt, iCol) {
    verifyStatement(stmt);
    const type = sqlite3.column_type(stmt, iCol);
    switch (type) {
      case SQLITE_BLOB:
        return sqlite3.column_blob(stmt, iCol);
      case SQLITE_FLOAT:
        return sqlite3.column_double(stmt, iCol);
      case SQLITE_INTEGER:
        const lo32 = sqlite3.column_int(stmt, iCol);
        const hi32 = Module.getTempRet0();
        return cvt32x2AsSafe(lo32, hi32);
      case SQLITE_NULL:
        return null;
      case SQLITE_TEXT:
        return sqlite3.column_text(stmt, iCol);
      default:
        throw new SQLiteError("unknown type", type);
    }
  };
  sqlite3.column_blob = (function() {
    const fname = "sqlite3_column_blob";
    const f = Module.cwrap(fname, ...decl("nn:n"));
    return function(stmt, iCol) {
      verifyStatement(stmt);
      const nBytes = sqlite3.column_bytes(stmt, iCol);
      const address = f(stmt, iCol);
      const result = Module.HEAPU8.subarray(address, address + nBytes);
      return result;
    };
  })();
  sqlite3.column_bytes = (function() {
    const fname = "sqlite3_column_bytes";
    const f = Module.cwrap(fname, ...decl("nn:n"));
    return function(stmt, iCol) {
      verifyStatement(stmt);
      const result = f(stmt, iCol);
      return result;
    };
  })();
  sqlite3.column_count = (function() {
    const fname = "sqlite3_column_count";
    const f = Module.cwrap(fname, ...decl("n:n"));
    return function(stmt) {
      verifyStatement(stmt);
      const result = f(stmt);
      return result;
    };
  })();
  sqlite3.column_double = (function() {
    const fname = "sqlite3_column_double";
    const f = Module.cwrap(fname, ...decl("nn:n"));
    return function(stmt, iCol) {
      verifyStatement(stmt);
      const result = f(stmt, iCol);
      return result;
    };
  })();
  sqlite3.column_int = (function() {
    const fname = "sqlite3_column_int64";
    const f = Module.cwrap(fname, ...decl("nn:n"));
    return function(stmt, iCol) {
      verifyStatement(stmt);
      const result = f(stmt, iCol);
      return result;
    };
  })();
  sqlite3.column_int64 = (function() {
    const fname = "sqlite3_column_int64";
    const f = Module.cwrap(fname, ...decl("nn:n"));
    return function(stmt, iCol) {
      verifyStatement(stmt);
      const lo32 = f(stmt, iCol);
      const hi32 = Module.getTempRet0();
      const result = cvt32x2ToBigInt(lo32, hi32);
      return result;
    };
  })();
  sqlite3.column_name = (function() {
    const fname = "sqlite3_column_name";
    const f = Module.cwrap(fname, ...decl("nn:s"));
    return function(stmt, iCol) {
      verifyStatement(stmt);
      const result = f(stmt, iCol);
      return result;
    };
  })();
  sqlite3.column_names = function(stmt) {
    const columns = [];
    const nColumns = sqlite3.column_count(stmt);
    for (let i = 0; i < nColumns; ++i) {
      columns.push(sqlite3.column_name(stmt, i));
    }
    return columns;
  };
  sqlite3.column_text = (function() {
    const fname = "sqlite3_column_text";
    const f = Module.cwrap(fname, ...decl("nn:s"));
    return function(stmt, iCol) {
      verifyStatement(stmt);
      const result = f(stmt, iCol);
      return result;
    };
  })();
  sqlite3.column_type = (function() {
    const fname = "sqlite3_column_type";
    const f = Module.cwrap(fname, ...decl("nn:n"));
    return function(stmt, iCol) {
      verifyStatement(stmt);
      const result = f(stmt, iCol);
      return result;
    };
  })();
  sqlite3.create_function = function(db, zFunctionName, nArg, eTextRep, pApp, xFunc, xStep, xFinal) {
    verifyDatabase(db);
    function adapt(f) {
      return f instanceof AsyncFunction ? (async (ctx, n, values) => f(ctx, Module.HEAP32.subarray(values / 4, values / 4 + n))) : ((ctx, n, values) => f(ctx, Module.HEAP32.subarray(values / 4, values / 4 + n)));
    }
    const result = Module.create_function(
      db,
      zFunctionName,
      nArg,
      eTextRep,
      pApp,
      xFunc && adapt(xFunc),
      xStep && adapt(xStep),
      xFinal
    );
    return check2("sqlite3_create_function", result, db);
  };
  sqlite3.data_count = (function() {
    const fname = "sqlite3_data_count";
    const f = Module.cwrap(fname, ...decl("n:n"));
    return function(stmt) {
      verifyStatement(stmt);
      const result = f(stmt);
      return result;
    };
  })();
  sqlite3.exec = async function(db, sql, callback) {
    for await (const stmt of sqlite3.statements(db, sql)) {
      let columns;
      while (await sqlite3.step(stmt) === SQLITE_ROW) {
        if (callback) {
          columns = columns ?? sqlite3.column_names(stmt);
          const row = sqlite3.row(stmt);
          await callback(row, columns);
        }
      }
    }
    return SQLITE_OK;
  };
  sqlite3.finalize = (function() {
    const fname = "sqlite3_finalize";
    const f = Module.cwrap(fname, ...decl("n:n"), { async });
    return async function(stmt) {
      const result = await f(stmt);
      mapStmtToDB.delete(stmt);
      return result;
    };
  })();
  sqlite3.get_autocommit = (function() {
    const fname = "sqlite3_get_autocommit";
    const f = Module.cwrap(fname, ...decl("n:n"));
    return function(db) {
      const result = f(db);
      return result;
    };
  })();
  sqlite3.libversion = (function() {
    const fname = "sqlite3_libversion";
    const f = Module.cwrap(fname, ...decl(":s"));
    return function() {
      const result = f();
      return result;
    };
  })();
  sqlite3.libversion_number = (function() {
    const fname = "sqlite3_libversion_number";
    const f = Module.cwrap(fname, ...decl(":n"));
    return function() {
      const result = f();
      return result;
    };
  })();
  sqlite3.limit = (function() {
    const fname = "sqlite3_limit";
    const f = Module.cwrap(fname, ...decl("nnn:n"));
    return function(db, id, newVal) {
      const result = f(db, id, newVal);
      return result;
    };
  })();
  sqlite3.open_v2 = (function() {
    const fname = "sqlite3_open_v2";
    const f = Module.cwrap(fname, ...decl("snnn:n"), { async });
    return async function(zFilename, flags, zVfs) {
      flags = flags || SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE;
      zVfs = createUTF8(zVfs);
      try {
        const rc = await retry(() => f(zFilename, tmpPtr[0], flags, zVfs));
        const db = Module.getValue(tmpPtr[0], "*");
        databases.add(db);
        Module.ccall("RegisterExtensionFunctions", "void", ["number"], [db]);
        check2(fname, rc);
        return db;
      } finally {
        Module._sqlite3_free(zVfs);
      }
    };
  })();
  sqlite3.progress_handler = function(db, nProgressOps, handler, userData) {
    verifyDatabase(db);
    Module.progress_handler(db, nProgressOps, handler, userData);
  };
  sqlite3.reset = (function() {
    const fname = "sqlite3_reset";
    const f = Module.cwrap(fname, ...decl("n:n"), { async });
    return async function(stmt) {
      verifyStatement(stmt);
      const result = await f(stmt);
      return check2(fname, result, mapStmtToDB.get(stmt));
    };
  })();
  sqlite3.result = function(context, value) {
    switch (typeof value) {
      case "number":
        if (value === (value | 0)) {
          sqlite3.result_int(context, value);
        } else {
          sqlite3.result_double(context, value);
        }
        break;
      case "string":
        sqlite3.result_text(context, value);
        break;
      default:
        if (value instanceof Uint8Array || Array.isArray(value)) {
          sqlite3.result_blob(context, value);
        } else if (value === null) {
          sqlite3.result_null(context);
        } else if (typeof value === "bigint") {
          return sqlite3.result_int64(context, value);
        } else {
          console.warn("unknown result converted to null", value);
          sqlite3.result_null(context);
        }
        break;
    }
  };
  sqlite3.result_blob = (function() {
    const fname = "sqlite3_result_blob";
    const f = Module.cwrap(fname, ...decl("nnnn:n"));
    return function(context, value) {
      const byteLength = value.byteLength ?? value.length;
      const ptr = Module._sqlite3_malloc(byteLength);
      Module.HEAPU8.subarray(ptr).set(value);
      f(context, ptr, byteLength, sqliteFreeAddress);
    };
  })();
  sqlite3.result_double = (function() {
    const fname = "sqlite3_result_double";
    const f = Module.cwrap(fname, ...decl("nn:n"));
    return function(context, value) {
      f(context, value);
    };
  })();
  sqlite3.result_int = (function() {
    const fname = "sqlite3_result_int";
    const f = Module.cwrap(fname, ...decl("nn:n"));
    return function(context, value) {
      f(context, value);
    };
  })();
  sqlite3.result_int64 = (function() {
    const fname = "sqlite3_result_int64";
    const f = Module.cwrap(fname, ...decl("nnn:n"));
    return function(context, value) {
      if (value > MAX_INT64 || value < MIN_INT64) return SQLITE_RANGE;
      const lo32 = value & 0xffffffffn;
      const hi32 = value >> 32n;
      f(context, Number(lo32), Number(hi32));
    };
  })();
  sqlite3.result_null = (function() {
    const fname = "sqlite3_result_null";
    const f = Module.cwrap(fname, ...decl("n:n"));
    return function(context) {
      f(context);
    };
  })();
  sqlite3.result_text = (function() {
    const fname = "sqlite3_result_text";
    const f = Module.cwrap(fname, ...decl("nnnn:n"));
    return function(context, value) {
      const ptr = createUTF8(value);
      f(context, ptr, -1, sqliteFreeAddress);
    };
  })();
  sqlite3.row = function(stmt) {
    const row = [];
    const nColumns = sqlite3.data_count(stmt);
    for (let i = 0; i < nColumns; ++i) {
      const value = sqlite3.column(stmt, i);
      row.push(value?.buffer === Module.HEAPU8.buffer ? value.slice() : value);
    }
    return row;
  };
  sqlite3.set_authorizer = function(db, xAuth, pApp) {
    verifyDatabase(db);
    function cvtArgs(_, iAction, p3, p4, p5, p6) {
      return [
        _,
        iAction,
        Module.UTF8ToString(p3),
        Module.UTF8ToString(p4),
        Module.UTF8ToString(p5),
        Module.UTF8ToString(p6)
      ];
    }
    function adapt(f) {
      return f instanceof AsyncFunction ? (async (_, iAction, p3, p4, p5, p6) => f(...cvtArgs(_, iAction, p3, p4, p5, p6))) : ((_, iAction, p3, p4, p5, p6) => f(...cvtArgs(_, iAction, p3, p4, p5, p6)));
    }
    const result = Module.set_authorizer(db, adapt(xAuth), pApp);
    return check2("sqlite3_set_authorizer", result, db);
  };
  sqlite3.sql = (function() {
    const fname = "sqlite3_sql";
    const f = Module.cwrap(fname, ...decl("n:s"));
    return function(stmt) {
      verifyStatement(stmt);
      const result = f(stmt);
      return result;
    };
  })();
  sqlite3.statements = function(db, sql, options = {}) {
    const prepare = Module.cwrap(
      "sqlite3_prepare_v3",
      "number",
      ["number", "number", "number", "number", "number", "number"],
      { async: true }
    );
    return (async function* () {
      const onFinally = [];
      try {
        let maybeFinalize2 = function() {
          if (stmt && !options.unscoped) {
            sqlite3.finalize(stmt);
          }
          stmt = 0;
        };
        var maybeFinalize = maybeFinalize2;
        const utf8 = textEncoder.encode(sql);
        const allocSize = utf8.byteLength - utf8.byteLength % 4 + 12;
        const pzHead = Module._sqlite3_malloc(allocSize);
        const pzEnd = pzHead + utf8.byteLength + 1;
        onFinally.push(() => Module._sqlite3_free(pzHead));
        Module.HEAPU8.set(utf8, pzHead);
        Module.HEAPU8[pzEnd - 1] = 0;
        const pStmt = pzHead + allocSize - 8;
        const pzTail = pzHead + allocSize - 4;
        let stmt;
        onFinally.push(maybeFinalize2);
        Module.setValue(pzTail, pzHead, "*");
        do {
          maybeFinalize2();
          const zTail = Module.getValue(pzTail, "*");
          const rc = await retry(() => {
            return prepare(
              db,
              zTail,
              pzEnd - pzTail,
              options.flags || 0,
              pStmt,
              pzTail
            );
          });
          if (rc !== SQLITE_OK) {
            check2("sqlite3_prepare_v3", rc, db);
          }
          stmt = Module.getValue(pStmt, "*");
          if (stmt) {
            mapStmtToDB.set(stmt, db);
            yield stmt;
          }
        } while (stmt);
      } finally {
        while (onFinally.length) {
          onFinally.pop()();
        }
      }
    })();
  };
  sqlite3.step = (function() {
    const fname = "sqlite3_step";
    const f = Module.cwrap(fname, ...decl("n:n"), { async });
    return async function(stmt) {
      verifyStatement(stmt);
      const rc = await retry(() => f(stmt));
      return check2(fname, rc, mapStmtToDB.get(stmt), [SQLITE_ROW, SQLITE_DONE]);
    };
  })();
  sqlite3.commit_hook = function(db, xCommitHook) {
    verifyDatabase(db);
    Module.commit_hook(db, xCommitHook);
  };
  sqlite3.update_hook = function(db, xUpdateHook) {
    verifyDatabase(db);
    function cvtArgs(iUpdateType, dbName, tblName, lo32, hi32) {
      return [
        iUpdateType,
        Module.UTF8ToString(dbName),
        Module.UTF8ToString(tblName),
        cvt32x2ToBigInt(lo32, hi32)
      ];
    }
    function adapt(f) {
      return f instanceof AsyncFunction ? (async (iUpdateType, dbName, tblName, lo32, hi32) => f(...cvtArgs(iUpdateType, dbName, tblName, lo32, hi32))) : ((iUpdateType, dbName, tblName, lo32, hi32) => f(...cvtArgs(iUpdateType, dbName, tblName, lo32, hi32)));
    }
    Module.update_hook(db, adapt(xUpdateHook));
  };
  sqlite3.value = function(pValue) {
    const type = sqlite3.value_type(pValue);
    switch (type) {
      case SQLITE_BLOB:
        return sqlite3.value_blob(pValue);
      case SQLITE_FLOAT:
        return sqlite3.value_double(pValue);
      case SQLITE_INTEGER:
        const lo32 = sqlite3.value_int(pValue);
        const hi32 = Module.getTempRet0();
        return cvt32x2AsSafe(lo32, hi32);
      case SQLITE_NULL:
        return null;
      case SQLITE_TEXT:
        return sqlite3.value_text(pValue);
      default:
        throw new SQLiteError("unknown type", type);
    }
  };
  sqlite3.value_blob = (function() {
    const fname = "sqlite3_value_blob";
    const f = Module.cwrap(fname, ...decl("n:n"));
    return function(pValue) {
      const nBytes = sqlite3.value_bytes(pValue);
      const address = f(pValue);
      const result = Module.HEAPU8.subarray(address, address + nBytes);
      return result;
    };
  })();
  sqlite3.value_bytes = (function() {
    const fname = "sqlite3_value_bytes";
    const f = Module.cwrap(fname, ...decl("n:n"));
    return function(pValue) {
      const result = f(pValue);
      return result;
    };
  })();
  sqlite3.value_double = (function() {
    const fname = "sqlite3_value_double";
    const f = Module.cwrap(fname, ...decl("n:n"));
    return function(pValue) {
      const result = f(pValue);
      return result;
    };
  })();
  sqlite3.value_int = (function() {
    const fname = "sqlite3_value_int64";
    const f = Module.cwrap(fname, ...decl("n:n"));
    return function(pValue) {
      const result = f(pValue);
      return result;
    };
  })();
  sqlite3.value_int64 = (function() {
    const fname = "sqlite3_value_int64";
    const f = Module.cwrap(fname, ...decl("n:n"));
    return function(pValue) {
      const lo32 = f(pValue);
      const hi32 = Module.getTempRet0();
      const result = cvt32x2ToBigInt(lo32, hi32);
      return result;
    };
  })();
  sqlite3.value_text = (function() {
    const fname = "sqlite3_value_text";
    const f = Module.cwrap(fname, ...decl("n:s"));
    return function(pValue) {
      const result = f(pValue);
      return result;
    };
  })();
  sqlite3.value_type = (function() {
    const fname = "sqlite3_value_type";
    const f = Module.cwrap(fname, ...decl("n:n"));
    return function(pValue) {
      const result = f(pValue);
      return result;
    };
  })();
  sqlite3.vfs_register = function(vfs, makeDefault) {
    const result = Module.vfs_register(vfs, makeDefault);
    return check2("sqlite3_vfs_register", result);
  };
  function check2(fname, result, db = null, allowed = [SQLITE_OK]) {
    if (allowed.includes(result)) return result;
    const message = db ? Module.ccall("sqlite3_errmsg", "string", ["number"], [db]) : fname;
    throw new SQLiteError(message, result);
  }
  async function retry(f) {
    let rc;
    do {
      if (Module.retryOps.length) {
        await Promise.all(Module.retryOps);
        Module.retryOps = [];
      }
      rc = await f();
    } while (rc && Module.retryOps.length);
    return rc;
  }
  return sqlite3;
}
function decl(s) {
  const result = [];
  const m = s.match(/([ns@]*):([nsv@])/);
  switch (m[2]) {
    case "n":
      result.push("number");
      break;
    case "s":
      result.push("string");
      break;
    case "v":
      result.push(null);
      break;
  }
  const args = [];
  for (let c of m[1]) {
    switch (c) {
      case "n":
        args.push("number");
        break;
      case "s":
        args.push("string");
        break;
    }
  }
  result.push(args);
  return result;
}

// src/io/common.ts
async function check(code) {
  if (await code !== SQLITE_OK) {
    throw new Error(`Error code: ${await code}`);
  }
}
function ignoredDataView() {
  return new DataView(new ArrayBuffer(4));
}
async function getHandle(vfs, path, create) {
  let root;
  if (vfs.releaser instanceof FileSystemDirectoryHandle) {
    [root] = await vfs.getPathComponents(path, create);
  } else {
    root = await navigator.storage.getDirectory();
  }
  return await root.getFileHandle(path, { create });
}
function isFsHandleVFS(vfs) {
  return "releaser" in vfs;
}

// src/io/export.ts
function dumpVFS(vfs, path, onDone) {
  const cleanupTasks = [];
  let resolve;
  let reject;
  new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  }).finally(async () => {
    while (cleanupTasks.length) {
      await cleanupTasks.pop()();
    }
    onDone?.(vfs, path);
  });
  const fileId = Math.floor(Math.random() * 4294967296);
  let iOffset = 0;
  let bytesRemaining = 0;
  return new ReadableStream({
    async start(controller) {
      try {
        const flags = SQLITE_OPEN_MAIN_DB | SQLITE_OPEN_READONLY;
        await check(vfs.jOpen(path, fileId, flags, ignoredDataView()));
        cleanupTasks.push(() => vfs.jClose(fileId));
        await check(vfs.jLock(fileId, SQLITE_LOCK_SHARED));
        cleanupTasks.push(() => vfs.jUnlock(fileId, SQLITE_LOCK_NONE));
        const fileSize = new DataView(new ArrayBuffer(8));
        await check(vfs.jFileSize(fileId, fileSize));
        bytesRemaining = Number(fileSize.getBigUint64(0, true));
      } catch (e) {
        controller.error(e);
        reject(e);
      }
    },
    async pull(controller) {
      if (bytesRemaining === 0) {
        controller.close();
        resolve();
        return;
      }
      try {
        const chunkSize = Math.min(bytesRemaining, 65536);
        const buffer = new Uint8Array(chunkSize);
        await check(vfs.jRead(fileId, buffer, iOffset));
        controller.enqueue(buffer);
        iOffset += chunkSize;
        bytesRemaining -= chunkSize;
        if (bytesRemaining === 0) {
          controller.close();
          resolve();
        }
      } catch (e) {
        controller.error(e);
        reject(e);
      }
    },
    cancel(reason) {
      reject(new Error(reason));
    }
  });
}
async function exportDatabaseFromIDB(vfs, path) {
  const stream2 = dumpVFS(vfs, path);
  const chunks = [];
  const reader = stream2.getReader();
  let totalLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      chunks.push(value);
      totalLength += value.length;
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(totalLength);
  let position = 0;
  for (const chunk of chunks) {
    result.set(chunk, position);
    position += chunk.length;
  }
  return result;
}
async function exportDatabaseFromFsHandle(vfs, path) {
  return await getHandle(vfs, path).then((handle) => handle.getFile()).then((file) => file.arrayBuffer()).then((buf) => new Uint8Array(buf));
}
async function exportDatabase(vfs, path) {
  return isFsHandleVFS(vfs) ? await exportDatabaseFromFsHandle(vfs, path) : await exportDatabaseFromIDB(vfs, path);
}

// src/io/import.ts
var SQLITE_BINARY_HEADER = new Uint8Array([
  83,
  81,
  76,
  105,
  116,
  101,
  32,
  102,
  // SQLite f
  111,
  114,
  109,
  97,
  116,
  32,
  51,
  0
  // ormat 3\0
]);
async function parseHeaderAndVerify(reader) {
  const headerData = await readExactBytes(reader, 32);
  for (let i = 0; i < SQLITE_BINARY_HEADER.length; i++) {
    if (headerData[i] !== SQLITE_BINARY_HEADER[i]) {
      throw new Error("Not a SQLite database file");
    }
  }
  return headerData;
}
async function readExactBytes(reader, size) {
  const result = new Uint8Array(size);
  let offset = 0;

  // 1. Consume leftover from previous reads attached to reader
  if (reader.leftover) {
    const toCopy = Math.min(size, reader.leftover.length);
    result.set(reader.leftover.subarray(0, toCopy), 0);
    offset += toCopy;
    
    if (toCopy < reader.leftover.length) {
      reader.leftover = reader.leftover.subarray(toCopy);
    } else {
      reader.leftover = null;
    }
  }

  while (offset < size) {
    const { done, value } = await reader.read();
    if (done) {
       // If we already filled the buffer (offset == size), break loop.
       // But if we still need bytes (offset < size), then it is an error.
       if (offset < size) {
           throw new Error(`Unexpected EOF: Expected ${size}, got ${offset}`);
       }
       break;
    }

    const bytesToCopy = Math.min(size - offset, value.length);
    result.set(value.subarray(0, bytesToCopy), offset);
    offset += bytesToCopy;
    
    // Save excess bytes to reader.leftover
    if (bytesToCopy < value.length) {
       reader.leftover = value.subarray(bytesToCopy);
    }
  }
  return result;
}
async function* pagify(stream2) {
  const reader = stream2.getReader();
  try {
    const headerData = await parseHeaderAndVerify(reader);
    const view = new DataView(headerData.buffer);
    const rawPageSize = view.getUint16(16);
    const pageSize = rawPageSize === 1 ? 65536 : rawPageSize;
    const pageCount = view.getUint32(28);
    
    // Fix: Reconstruct the first page using the consumed header and the rest of the page
    const firstPageRest = await readExactBytes(reader, pageSize - 32);
    const firstPage = new Uint8Array(pageSize);
    firstPage.set(headerData);
    firstPage.set(firstPageRest, 32);
    yield firstPage;

    // Iterate for the remaining pages (starting from 1)
    for (let i = 1; i < pageCount; i++) {
      yield await readExactBytes(reader, pageSize);
    }
    const { done } = await reader.read();
    if (!done) {
      throw new Error("Unexpected data after last page");
    }
  } finally {
    reader.releaseLock();
  }
}
async function importDatabaseToIdb(vfs, path, stream2) {
  const onFinally = [];
  try {
    const fileId = 1234;
    const flags = SQLITE_OPEN_MAIN_DB | SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE;
    await check(vfs.jOpen(path, fileId, flags, ignoredDataView()));
    onFinally.push(() => vfs.jClose(fileId));
    await check(vfs.jLock(fileId, SQLITE_LOCK_SHARED));
    onFinally.push(() => vfs.jUnlock(fileId, SQLITE_LOCK_NONE));
    await check(vfs.jLock(fileId, SQLITE_LOCK_RESERVED));
    onFinally.push(() => vfs.jUnlock(fileId, SQLITE_LOCK_SHARED));
    await check(vfs.jLock(fileId, SQLITE_LOCK_EXCLUSIVE));
    const ignored = ignoredDataView();
    await vfs.jFileControl(fileId, SQLITE_FCNTL_BEGIN_ATOMIC_WRITE, ignored);
    await check(vfs.jTruncate(fileId, 0));
    let iOffset = 0;
    for await (const page of pagify(stream2)) {
      await check(vfs.jWrite(fileId, page, iOffset));
      iOffset += page.byteLength;
    }
    await vfs.jFileControl(fileId, SQLITE_FCNTL_COMMIT_ATOMIC_WRITE, ignored);
    await vfs.jFileControl(fileId, SQLITE_FCNTL_SYNC, ignored);
    await vfs.jSync(fileId, SQLITE_SYNC_NORMAL);
  } finally {
    while (onFinally.length) {
      await onFinally.pop()();
    }
  }
}
async function importDatabaseToFsHandle(vfs, path, stream2) {
  const handle = await getHandle(vfs, path, true);
  const [verifyStream, dataStream] = stream2.tee();
  const verifyReader = verifyStream.getReader();
  try {
    await parseHeaderAndVerify(verifyReader);
  } finally {
    verifyReader.releaseLock();
  }
  const writable = await handle.createWritable();
  await dataStream.pipeTo(writable);
}
async function importDatabase(vfs, path, data) {
  const stream2 = data instanceof globalThis.File ? data.stream() : data;
  if (isFsHandleVFS(vfs)) {
    await importDatabaseToFsHandle(vfs, path, stream2);
  } else {
    await importDatabaseToIdb(vfs, path, stream2);
  }
}

// src/utils.ts
function isIdbSupported() {
  return "locks" in navigator;
}
async function isOpfsSupported() {
  const inner = () => new Promise((resolve) => {
    if (typeof navigator?.storage?.getDirectory !== "function") {
      resolve(false);
      return;
    }
    navigator.storage.getDirectory().then((root) => {
      if (!root) {
        resolve(false);
        return;
      }
      root.getFileHandle("_CHECK", { create: true }).then((handle) => handle.createSyncAccessHandle()).then((access) => (access.close(), root.removeEntry("_CHECK"))).then(() => resolve(true)).catch(
        () => root.removeEntry("_CHECK").then(() => resolve(false)).catch(() => resolve(false))
      );
    }).catch(() => resolve(false));
  });
  if ("importScripts" in globalThis) {
    return await inner();
  }
  try {
    if (typeof Worker === "undefined" || typeof Promise === "undefined") {
      return false;
    }
    const url = URL.createObjectURL(
      new Blob(
        [`(${inner})().then(postMessage)`],
        { type: "text/javascript" }
      )
    );
    const worker = new Worker(url);
    const result = await new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => resolve(data);
      worker.onerror = (err) => (err.preventDefault(), reject(false));
    });
    worker.terminate();
    URL.revokeObjectURL(url);
    return result;
  } catch {
    return false;
  }
}
function isModuleWorkerSupport() {
  let supports = false;
  try {
    new Worker("data:,", {
      // @ts-expect-error check assign
      get type() {
        supports = true;
      }
    }).terminate();
  } finally {
    return supports;
  }
}
function customFunction(sqlite, db, fnName, fn, options = {}) {
  let flags = SQLITE_UTF8;
  if (options.deterministic) {
    flags |= SQLITE_DETERMINISTIC;
  }
  if (options.directOnly) {
    flags |= SQLITE_DIRECTONLY;
  }
  sqlite.create_function(
    db,
    fnName,
    options.varargs || fn.length === 0 ? -1 : fn.length,
    flags,
    0,
    (ctx, value) => {
      const args = [];
      for (let i = 0; i < fn.length; i++) {
        args.push(sqlite.value(value[i]));
      }
      return sqlite.result(ctx, fn(...args));
    }
  );
}
function customFunctionCore(core, fnName, fn, options = {}) {
  return customFunction(core.sqlite, core.db, fnName, fn, options);
}
function withExistDB(data, options) {
  return {
    ...options,
    beforeOpen: (vfs, path) => importDatabase(vfs, path, data)
  };
}
async function close(core) {
  await core.sqlite.close(core.pointer);
}
function changes(core) {
  return core.sqliteModule._sqlite3_changes(core.pointer);
}
function lastInsertRowId(core) {
  return core.sqliteModule._sqlite3_last_insert_rowid(core.pointer);
}
async function stream(core, onData, sql, parameters) {
  const { sqlite, pointer } = core;
  for await (const stmt of sqlite.statements(pointer, sql)) {
    if (parameters) {
      sqlite.bind_collection(stmt, parameters);
    }
    const cols = sqlite.column_names(stmt);
    while (await sqlite.step(stmt) === SQLITE_ROW) {
      const row = sqlite.row(stmt);
      onData(Object.fromEntries(cols.map((key, i) => [key, row[i]])));
    }
  }
}
async function run(core, sql, parameters) {
  const results = [];
  await stream(core, (data) => results.push(data), sql, parameters);
  return results;
}
async function* iterator(core, sql, parameters, chunkSize = 1) {
  const { sqlite, pointer } = core;
  let cache = new Array(chunkSize);
  for await (const stmt of sqlite.statements(pointer, sql)) {
    if (parameters?.length) {
      sqlite.bind_collection(stmt, parameters);
    }
    let idx = 0;
    const cols = sqlite.column_names(stmt);
    while (1) {
      const result = await sqlite.step(stmt);
      if (result === SQLITE_ROW) {
        const row = sqlite.row(stmt);
        cache[idx] = Object.fromEntries(cols.map((key, i) => [key, row[i]]));
        if (++idx === chunkSize) {
          yield cache.slice(0, idx);
          idx = 0;
        }
      } else if (result === SQLITE_OK) {
        if (++idx === chunkSize) {
          yield [];
        }
      } else {
        if (idx > 0) {
          yield cache.slice(0, idx);
        }
        break;
      }
    }
  }
  cache = void 0;
}
function parseOpenV2Flag(readonly) {
  return readonly ? SQLITE_OPEN_READONLY : SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE;
}
async function reopen(core, readonly) {
  await close(core);
  const newPointer = await core.sqlite.open_v2(core.path, parseOpenV2Flag(readonly));
  core.pointer = newPointer;
}

// src/core.ts
async function initSQLite(options) {
  const core = await initSQLiteCore(options);
  return {
    ...core,
    changes: () => changes(core),
    close: () => close(core),
    dump: () => exportDatabase(core.vfs, core.path),
    lastInsertRowId: () => lastInsertRowId(core),
    run: (...args) => run(core, ...args),
    stream: (...args) => stream(core, ...args),
    sync: (data) => importDatabase(core.vfs, core.path, data)
  };
}
async function initSQLiteCore(options) {
  const { path, sqliteModule, vfsFn, vfsOptions, readonly, beforeOpen } = await options;
  const sqlite = Factory(sqliteModule);
  const vfs = await vfsFn(path, sqliteModule, vfsOptions);
  sqlite.vfs_register(vfs, true);
  await beforeOpen?.(vfs, path);
  const pointer = await sqlite.open_v2(
    path,
    parseOpenV2Flag(readonly)
  );
  return {
    db: pointer,
    path,
    pointer,
    sqlite,
    sqliteModule,
    vfs
  };
}

// node_modules/.pnpm/wa-sqlite@https+++codeload.github.com+rhashimoto+wa-sqlite+tar.gz+a3b1324ed5a57928141b02eb3204421e1164ed53/node_modules/wa-sqlite/src/examples/MemoryVFS.js
var MemoryVFS = class _MemoryVFS extends FacadeVFS {
  // Map of existing files, keyed by filename.
  mapNameToFile = /* @__PURE__ */ new Map();
  // Map of open files, keyed by id (sqlite3_file pointer).
  mapIdToFile = /* @__PURE__ */ new Map();
  static async create(name, module) {
    const vfs = new _MemoryVFS(name, module);
    await vfs.isReady();
    return vfs;
  }
  constructor(name, module) {
    super(name, module);
  }
  close() {
    for (const fileId of this.mapIdToFile.keys()) {
      this.jClose(fileId);
    }
  }
  /**
   * @param {string?} filename 
   * @param {number} fileId 
   * @param {number} flags 
   * @param {DataView} pOutFlags 
   * @returns {number|Promise<number>}
   */
  jOpen(filename, fileId, flags, pOutFlags) {
    const url = new URL(filename || Math.random().toString(36).slice(2), "file://");
    const pathname = url.pathname;
    let file = this.mapNameToFile.get(pathname);
    if (!file) {
      if (flags & SQLITE_OPEN_CREATE) {
        file = {
          pathname,
          flags,
          size: 0,
          data: new ArrayBuffer(0)
        };
        this.mapNameToFile.set(pathname, file);
      } else {
        return SQLITE_CANTOPEN;
      }
    }
    this.mapIdToFile.set(fileId, file);
    pOutFlags.setInt32(0, flags, true);
    return SQLITE_OK;
  }
  /**
   * @param {number} fileId 
   * @returns {number|Promise<number>}
   */
  jClose(fileId) {
    const file = this.mapIdToFile.get(fileId);
    this.mapIdToFile.delete(fileId);
    if (file.flags & SQLITE_OPEN_DELETEONCLOSE) {
      this.mapNameToFile.delete(file.pathname);
    }
    return SQLITE_OK;
  }
  /**
   * @param {number} fileId 
   * @param {Uint8Array} pData 
   * @param {number} iOffset
   * @returns {number|Promise<number>}
   */
  jRead(fileId, pData, iOffset) {
    const file = this.mapIdToFile.get(fileId);
    const bgn = Math.min(iOffset, file.size);
    const end = Math.min(iOffset + pData.byteLength, file.size);
    const nBytes = end - bgn;
    if (nBytes) {
      pData.set(new Uint8Array(file.data, bgn, nBytes));
    }
    if (nBytes < pData.byteLength) {
      pData.fill(0, nBytes);
      return SQLITE_IOERR_SHORT_READ;
    }
    return SQLITE_OK;
  }
  /**
   * @param {number} fileId 
   * @param {Uint8Array} pData 
   * @param {number} iOffset
   * @returns {number|Promise<number>}
   */
  jWrite(fileId, pData, iOffset) {
    const file = this.mapIdToFile.get(fileId);
    if (iOffset + pData.byteLength > file.data.byteLength) {
      const newSize = Math.max(iOffset + pData.byteLength, 2 * file.data.byteLength);
      const data = new ArrayBuffer(newSize);
      new Uint8Array(data).set(new Uint8Array(file.data, 0, file.size));
      file.data = data;
    }
    new Uint8Array(file.data, iOffset, pData.byteLength).set(pData.subarray());
    file.size = Math.max(file.size, iOffset + pData.byteLength);
    return SQLITE_OK;
  }
  /**
   * @param {number} fileId 
   * @param {number} iSize 
   * @returns {number|Promise<number>}
   */
  jTruncate(fileId, iSize) {
    const file = this.mapIdToFile.get(fileId);
    file.size = Math.min(file.size, iSize);
    return SQLITE_OK;
  }
  /**
   * @param {number} fileId 
   * @param {DataView} pSize64 
   * @returns {number|Promise<number>}
   */
  jFileSize(fileId, pSize64) {
    const file = this.mapIdToFile.get(fileId);
    pSize64.setBigInt64(0, BigInt(file.size), true);
    return SQLITE_OK;
  }
  /**
   * @param {string} name 
   * @param {number} syncDir 
   * @returns {number|Promise<number>}
   */
  jDelete(name, syncDir) {
    const url = new URL(name, "file://");
    const pathname = url.pathname;
    this.mapNameToFile.delete(pathname);
    return SQLITE_OK;
  }
  /**
   * @param {string} name 
   * @param {number} flags 
   * @param {DataView} pResOut 
   * @returns {number|Promise<number>}
   */
  jAccess(name, flags, pResOut) {
    const url = new URL(name, "file://");
    const pathname = url.pathname;
    const file = this.mapNameToFile.get(pathname);
    pResOut.setInt32(0, file ? 1 : 0, true);
    return SQLITE_OK;
  }
};

// src/vfs/memory.ts
async function useMemoryStorage(options = {}) {
  const { url, ...rest } = options;
  const sqliteModule = await wa_sqlite_default(
    url ? { locateFile: () => url } : void 0
  );
  return {
    path: ":memory:",
    sqliteModule,
    vfsFn: MemoryVFS.create,
    ...rest
  };
}

export { MemoryVFS, changes, close, customFunction, customFunctionCore, dumpVFS, exportDatabase, exportDatabaseFromFsHandle, exportDatabaseFromIDB, importDatabase, importDatabaseToIdb, initSQLite, initSQLiteCore, isIdbSupported, isModuleWorkerSupport, isOpfsSupported, iterator, lastInsertRowId, parseOpenV2Flag, reopen, run, stream, useMemoryStorage, withExistDB };
