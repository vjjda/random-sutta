import { SQLITE_OK, SQLITE_IOERR_LOCK, SQLITE_IOERR_UNLOCK, SQLITE_IOERR_CHECKRESERVEDLOCK, SQLITE_NOTFOUND, SQLITE_LOCK_NONE, SQLITE_BUSY, SQLITE_LOCK_RESERVED, SQLITE_LOCK_EXCLUSIVE, SQLITE_LOCK_SHARED } from './chunk-5HQBLAUX.js';

// node_modules/.pnpm/wa-sqlite@https+++codeload.github.com+rhashimoto+wa-sqlite+tar.gz+a3b1324ed5a57928141b02eb3204421e1164ed53/node_modules/wa-sqlite/src/WebLocksMixin.js
var SHARED = { mode: "shared" };
var POLL_SHARED = { ifAvailable: true, mode: "shared" };
var POLL_EXCLUSIVE = { ifAvailable: true, mode: "exclusive" };
var POLICIES = ["exclusive", "shared", "shared+hint"];
var WebLocksMixin = (superclass) => class extends superclass {
  #options = {
    lockPolicy: "exclusive",
    lockTimeout: Infinity
  };
  /** @type {Map<number, LockState>} */
  #mapIdToState = /* @__PURE__ */ new Map();
  constructor(name, module, options) {
    super(name, module, options);
    Object.assign(this.#options, options);
    if (POLICIES.indexOf(this.#options.lockPolicy) === -1) {
      throw new Error(`WebLocksMixin: invalid lock mode: ${options.lockPolicy}`);
    }
  }
  /**
   * @param {number} fileId 
   * @param {number} lockType 
   * @returns {Promise<number>}
   */
  async jLock(fileId, lockType) {
    try {
      const lockState = this.#getLockState(fileId);
      if (lockType <= lockState.type) return SQLITE_OK;
      switch (this.#options.lockPolicy) {
        case "exclusive":
          return await this.#lockExclusive(lockState, lockType);
        case "shared":
        case "shared+hint":
          return await this.#lockShared(lockState, lockType);
      }
    } catch (e) {
      console.error("WebLocksMixin: lock error", e);
      return SQLITE_IOERR_LOCK;
    }
  }
  /**
   * @param {number} fileId 
   * @param {number} lockType 
   * @returns {Promise<number>}
   */
  async jUnlock(fileId, lockType) {
    try {
      const lockState = this.#getLockState(fileId);
      if (!(lockType < lockState.type)) return SQLITE_OK;
      switch (this.#options.lockPolicy) {
        case "exclusive":
          return await this.#unlockExclusive(lockState, lockType);
        case "shared":
        case "shared+hint":
          return await this.#unlockShared(lockState, lockType);
      }
    } catch (e) {
      console.error("WebLocksMixin: unlock error", e);
      return SQLITE_IOERR_UNLOCK;
    }
  }
  /**
   * @param {number} fileId 
   * @param {DataView} pResOut 
   * @returns {Promise<number>}
   */
  async jCheckReservedLock(fileId, pResOut) {
    try {
      const lockState = this.#getLockState(fileId);
      switch (this.#options.lockPolicy) {
        case "exclusive":
          return this.#checkReservedExclusive(lockState, pResOut);
        case "shared":
        case "shared+hint":
          return await this.#checkReservedShared(lockState, pResOut);
      }
    } catch (e) {
      console.error("WebLocksMixin: check reserved lock error", e);
      return SQLITE_IOERR_CHECKRESERVEDLOCK;
    }
    pResOut.setInt32(0, 0, true);
    return SQLITE_OK;
  }
  /**
   * @param {number} fileId
   * @param {number} op
   * @param {DataView} pArg
   * @returns {number|Promise<number>}
   */
  jFileControl(fileId, op, pArg) {
    if (op === WebLocksMixin.WRITE_HINT_OP_CODE && this.#options.lockPolicy === "shared+hint") {
      const lockState = this.#getLockState(fileId);
      lockState.writeHint = true;
    }
    return SQLITE_NOTFOUND;
  }
  #getLockState(fileId) {
    let lockState = this.#mapIdToState.get(fileId);
    if (!lockState) {
      const name = this.getFilename(fileId);
      lockState = {
        baseName: name,
        type: SQLITE_LOCK_NONE,
        writeHint: false
      };
      this.#mapIdToState.set(fileId, lockState);
    }
    return lockState;
  }
  /**
   * @param {LockState} lockState 
   * @param {number} lockType 
   * @returns 
   */
  async #lockExclusive(lockState, lockType) {
    if (!lockState.access) {
      if (!await this.#acquire(lockState, "access")) {
        return SQLITE_BUSY;
      }
      console.assert(!!lockState.access);
    }
    lockState.type = lockType;
    return SQLITE_OK;
  }
  /**
   * @param {LockState} lockState 
   * @param {number} lockType 
   * @returns {number}
   */
  #unlockExclusive(lockState, lockType) {
    if (lockType === SQLITE_LOCK_NONE) {
      lockState.access?.();
      console.assert(!lockState.access);
    }
    lockState.type = lockType;
    return SQLITE_OK;
  }
  /**
   * @param {LockState} lockState 
   * @param {DataView} pResOut 
   * @returns {number}
   */
  #checkReservedExclusive(lockState, pResOut) {
    pResOut.setInt32(0, 0, true);
    return SQLITE_OK;
  }
  /**
   * @param {LockState} lockState 
   * @param {number} lockType 
   * @returns 
   */
  async #lockShared(lockState, lockType) {
    switch (lockState.type) {
      case SQLITE_LOCK_NONE:
        switch (lockType) {
          case SQLITE_LOCK_SHARED:
            if (lockState.writeHint) {
              if (!await this.#acquire(lockState, "hint")) {
                return SQLITE_BUSY;
              }
            }
            if (!await this.#acquire(lockState, "gate", SHARED)) {
              lockState.hint?.();
              return SQLITE_BUSY;
            }
            await this.#acquire(lockState, "access", SHARED);
            lockState.gate();
            console.assert(!lockState.gate);
            console.assert(!!lockState.access);
            console.assert(!lockState.reserved);
            break;
          default:
            throw new Error("unsupported lock transition");
        }
        break;
      case SQLITE_LOCK_SHARED:
        switch (lockType) {
          case SQLITE_LOCK_RESERVED:
            if (this.#options.lockPolicy === "shared+hint") {
              if (!lockState.hint && !await this.#acquire(lockState, "hint", POLL_EXCLUSIVE)) {
                return SQLITE_BUSY;
              }
            }
            if (!await this.#acquire(lockState, "reserved", POLL_EXCLUSIVE)) {
              lockState.hint?.();
              return SQLITE_BUSY;
            }
            lockState.access();
            console.assert(!lockState.gate);
            console.assert(!lockState.access);
            console.assert(!!lockState.reserved);
            break;
          case SQLITE_LOCK_EXCLUSIVE:
            if (!await this.#acquire(lockState, "gate")) {
              return SQLITE_BUSY;
            }
            lockState.access();
            if (!await this.#acquire(lockState, "access")) {
              lockState.gate();
              return SQLITE_BUSY;
            }
            console.assert(!!lockState.gate);
            console.assert(!!lockState.access);
            console.assert(!lockState.reserved);
            break;
          default:
            throw new Error("unsupported lock transition");
        }
        break;
      case SQLITE_LOCK_RESERVED:
        switch (lockType) {
          case SQLITE_LOCK_EXCLUSIVE:
            if (!await this.#acquire(lockState, "gate")) {
              return SQLITE_BUSY;
            }
            if (!await this.#acquire(lockState, "access")) {
              lockState.gate();
              return SQLITE_BUSY;
            }
            console.assert(!!lockState.gate);
            console.assert(!!lockState.access);
            console.assert(!!lockState.reserved);
            break;
          default:
            throw new Error("unsupported lock transition");
        }
        break;
    }
    lockState.type = lockType;
    return SQLITE_OK;
  }
  /**
   * @param {LockState} lockState 
   * @param {number} lockType 
   * @returns 
   */
  async #unlockShared(lockState, lockType) {
    if (lockType === SQLITE_LOCK_NONE) {
      lockState.access?.();
      lockState.gate?.();
      lockState.reserved?.();
      lockState.hint?.();
      lockState.writeHint = false;
      console.assert(!lockState.access);
      console.assert(!lockState.gate);
      console.assert(!lockState.reserved);
      console.assert(!lockState.hint);
    } else {
      switch (lockState.type) {
        case SQLITE_LOCK_EXCLUSIVE:
          lockState.access();
          await this.#acquire(lockState, "access", SHARED);
          lockState.gate();
          lockState.reserved?.();
          lockState.hint?.();
          console.assert(!!lockState.access);
          console.assert(!lockState.gate);
          console.assert(!lockState.reserved);
          break;
        case SQLITE_LOCK_RESERVED:
          await this.#acquire(lockState, "access", SHARED);
          lockState.reserved();
          lockState.hint?.();
          console.assert(!!lockState.access);
          console.assert(!lockState.gate);
          console.assert(!lockState.reserved);
          break;
      }
    }
    lockState.type = lockType;
    return SQLITE_OK;
  }
  /**
   * @param {LockState} lockState 
   * @param {DataView} pResOut 
   * @returns {Promise<number>}
   */
  async #checkReservedShared(lockState, pResOut) {
    if (await this.#acquire(lockState, "reserved", POLL_SHARED)) {
      lockState.reserved();
      pResOut.setInt32(0, 0, true);
    } else {
      pResOut.setInt32(0, 1, true);
    }
    return SQLITE_OK;
  }
  /**
   * @param {LockState} lockState 
   * @param {'gate'|'access'|'reserved'|'hint'} name
   * @param {LockOptions} options 
   * @returns {Promise<boolean>}
   */
  #acquire(lockState, name, options = {}) {
    console.assert(!lockState[name]);
    return new Promise((resolve) => {
      if (!options.ifAvailable && this.#options.lockTimeout < Infinity) {
        const controller = new AbortController();
        options = Object.assign({}, options, { signal: controller.signal });
        setTimeout(() => {
          controller.abort();
          resolve?.(false);
        }, this.#options.lockTimeout);
      }
      const lockName = `lock##${lockState.baseName}##${name}`;
      navigator.locks.request(lockName, options, (lock) => {
        if (lock) {
          return new Promise((release) => {
            lockState[name] = () => {
              release();
              lockState[name] = null;
            };
            resolve(true);
            resolve = null;
          });
        } else {
          lockState[name] = null;
          resolve(false);
          resolve = null;
        }
      }).catch((e) => {
        if (e.name !== "AbortError") throw e;
      });
    });
  }
};
WebLocksMixin.WRITE_HINT_OP_CODE = -9999;

export { WebLocksMixin };
