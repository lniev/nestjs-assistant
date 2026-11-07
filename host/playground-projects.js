/**
 * Playground project store for the NestJS Assistant plugin.
 *
 * The store turns the single "playground" workspace into a set of practice
 * modules and named code versions:
 *
 *   playground-modules/<moduleId>/module.json      module metadata
 *   playground-modules/<moduleId>/default/**       module default project
 *   playground-saves/<moduleId>/<snapshotId>/meta.json   saved version metadata
 *   playground-saves/<moduleId>/<snapshotId>/files/**    saved version files
 *   playground-state.json                          active module / version / dirty
 *   playground/**                                  the active workspace (owned by the runtime)
 *
 * Only Node.js built-in modules are imported here. Filesystem mutation of the
 * workspace itself is delegated to the playground runtime (replaceFrom /
 * captureTo) so the compile/run pipeline keeps owning that directory.
 */
import fs from 'node:fs';
import path from 'node:path';

const MODULE_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const DEFAULT_MODULE_ID = 'sandbox';
const DEFAULT_DEFAULT_FILE = 'src/app.module.ts';
const SNAPSHOT_NAME_MAX = 60;

// #region small helpers
/** Read one error's message. */
function errorMessage(error) {
  if (error === null || error === undefined) return '未知错误';
  if (typeof error.message === 'string' && error.message !== '') return error.message;
  return String(error);
}

/** Whether a filesystem entry exists (including broken symlinks). */
function pathExists(target) {
  try {
    fs.lstatSync(target);
    return true;
  } catch (_error) {
    return false;
  }
}

/** Whether a path is an existing directory. */
function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch (_error) {
    return false;
  }
}

/** Whether `child` is inside (or equal to) `parent`. */
function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}

/** Read one JSON file, returning null when it is missing or malformed. */
function readJsonFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_error) {
    return null;
  }
}

/** Write one JSON file (pretty, newline-terminated); creates parent dirs. */
function writeJsonFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

/** Whether a string is a valid module / snapshot id. */
function isValidId(value) {
  return typeof value === 'string' && MODULE_ID_PATTERN.test(value);
}

/** Generate a server-side snapshot id: `s-<base36-ms>-<3 random chars>`. */
function generateSnapshotId() {
  let suffix = '';
  while (suffix.length < 3) suffix += Math.random().toString(36).slice(2);
  return 's-' + Date.now().toString(36) + '-' + suffix.slice(0, 3);
}

/** Validate + normalize one user-supplied version name. */
function normalizeSnapshotName(name) {
  if (typeof name !== 'string') throw new Error('版本名称必须是字符串');
  const trimmed = name.trim();
  if (trimmed === '') throw new Error('版本名称不能为空');
  if (trimmed.length > SNAPSHOT_NAME_MAX) {
    throw new Error('版本名称不能超过 ' + String(SNAPSHOT_NAME_MAX) + ' 个字符');
  }
  if (trimmed.indexOf('/') >= 0 || trimmed.indexOf('\\') >= 0) {
    throw new Error('版本名称不能包含斜杠');
  }
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) throw new Error('版本名称不能包含控制字符');
  return trimmed;
}
// #endregion

/**
 * Create one playground project store.
 *
 * @param {object} options
 * @param {string} [options.pluginRoot] Plugin root (used to derive default paths).
 * @param {string} options.rootDir Absolute active workspace directory.
 * @param {string} [options.templateDir] Absolute original template directory.
 * @param {string} [options.modulesDir] Absolute module collection directory.
 * @param {string} [options.savesDir] Absolute snapshot collection directory.
 * @param {string} [options.stateFile] Absolute playground-state.json path.
 * @param {object} options.runtime Playground runtime (replaceFrom / captureTo).
 * @param {(line: string) => void} [options.log] Optional diagnostic sink.
 */
export function createProjectStore(options = {}) {
  const input = options !== null && typeof options === 'object' ? options : {};
  const pluginRoot = path.resolve(
    typeof input.pluginRoot === 'string' && input.pluginRoot.trim() !== '' ? input.pluginRoot : process.cwd(),
  );
  const pickPath = (value, fallback) =>
    path.resolve(typeof value === 'string' && value.trim() !== '' ? value : fallback);
  const rootDir = pickPath(input.rootDir, path.join(pluginRoot, 'playground'));
  const templateDir = pickPath(input.templateDir, path.join(pluginRoot, 'host', 'playground-template'));
  const modulesDir = pickPath(input.modulesDir, path.join(pluginRoot, 'playground-modules'));
  const savesDir = pickPath(input.savesDir, path.join(pluginRoot, 'playground-saves'));
  const stateFile = pickPath(input.stateFile, path.join(pluginRoot, 'playground-state.json'));
  const runtime = input.runtime;
  const logSink = typeof input.log === 'function' ? input.log : null;

  if (
    runtime === null ||
    runtime === undefined ||
    typeof runtime.replaceFrom !== 'function' ||
    typeof runtime.captureTo !== 'function'
  ) {
    throw new Error('项目存储需要 playground runtime（缺少 replaceFrom/captureTo）');
  }

  /** Best-effort plugin-level logging; never lets a bad log sink break the store. */
  function safeLog(message) {
    if (logSink === null) return;
    try {
      logSink(String(message));
    } catch (_error) {
      /* logging is best-effort */
    }
  }

  // #region state
  /** Fresh (in-memory) state used when the state file is missing or corrupt. */
  function defaultState() {
    return { version: 1, activeModuleId: DEFAULT_MODULE_ID, dirty: false, versions: {}, updatedAt: Date.now() };
  }

  /** Keep only well-formed per-module version records. */
  function normalizeVersions(raw) {
    const versions = {};
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return versions;
    for (const [moduleId, record] of Object.entries(raw)) {
      if (!isValidId(moduleId)) continue;
      if (record === null || typeof record !== 'object' || Array.isArray(record)) continue;
      if (record.kind === 'default') {
        versions[moduleId] = { kind: 'default' };
        continue;
      }
      if (record.kind === 'snapshot' && isValidId(record.snapshotId)) {
        const entry = { kind: 'snapshot', snapshotId: record.snapshotId };
        if (typeof record.name === 'string' && record.name !== '') entry.name = record.name;
        versions[moduleId] = entry;
      }
    }
    return versions;
  }

  /** Read the state file, falling back to the documented default when broken. */
  function readState() {
    const parsed = readJsonFile(stateFile);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return defaultState();
    return {
      version: 1,
      activeModuleId: isValidId(parsed.activeModuleId) ? parsed.activeModuleId : DEFAULT_MODULE_ID,
      dirty: parsed.dirty === true,
      versions: normalizeVersions(parsed.versions),
      updatedAt: typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : Date.now(),
    };
  }

  /** @type {object | null} */
  let state = null;
  let stateLoaded = false;

  /** Load the state file at most once per store instance (in-memory copy wins afterwards). */
  function ensureStateLoaded() {
    if (!stateLoaded) {
      state = readState();
      stateLoaded = true;
    }
    return state;
  }

  /** Persist the current state (best-effort: never throws at the caller). */
  function writeState() {
    if (state === null) return;
    try {
      writeJsonFile(stateFile, state);
    } catch (error) {
      safeLog('写入 playground-state.json 失败：' + errorMessage(error));
    }
  }

  /** Refresh the state timestamp. */
  function touch() {
    if (state !== null) state.updatedAt = Date.now();
  }
  // #endregion

  // #region serialization
  /** All mutating/reading operations run one at a time to avoid double-click races. */
  let queueTail = Promise.resolve();
  function serialize(task) {
    const run = queueTail.then(() => task());
    queueTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
  // #endregion

  // #region module scanning
  /** Read one module's module.json (null when missing/corrupt). */
  function readModuleMeta(moduleId) {
    const meta = readJsonFile(path.join(modulesDir, moduleId, 'module.json'));
    if (meta === null || typeof meta !== 'object' || Array.isArray(meta)) return null;
    return meta;
  }

  /** Every module id that has a readable module.json. */
  function scanModuleIds() {
    let entries;
    try {
      entries = fs.readdirSync(modulesDir, { withFileTypes: true });
    } catch (_error) {
      return [];
    }
    const ids = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!isValidId(entry.name)) continue;
      if (readModuleMeta(entry.name) === null) continue;
      ids.push(entry.name);
    }
    return ids;
  }

  /** Root directory of one module's default project. */
  function defaultDir(moduleId) {
    return path.join(modulesDir, moduleId, 'default');
  }

  /** Root directory of one saved version (contains meta.json + files/). */
  function snapshotDir(moduleId, snapshotId) {
    return path.join(savesDir, moduleId, snapshotId);
  }

  /** Directory holding one saved version's project files. */
  function snapshotFilesDir(moduleId, snapshotId) {
    return path.join(snapshotDir(moduleId, snapshotId), 'files');
  }

  /** Display name recorded in a snapshot meta.json ('' when unknown). */
  function snapshotName(moduleId, snapshotId) {
    const meta = readJsonFile(path.join(snapshotDir(moduleId, snapshotId), 'meta.json'));
    return meta !== null && typeof meta.name === 'string' && meta.name !== '' ? meta.name : '';
  }

  /** List one module's saved versions, newest first. */
  function listSnapshots(moduleId) {
    let entries;
    try {
      entries = fs.readdirSync(path.join(savesDir, moduleId), { withFileTypes: true });
    } catch (_error) {
      return [];
    }
    const snapshots = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // A stray directory that is not a valid snapshot id is never exposed.
      if (!isValidId(entry.name)) continue;
      const filesDir = snapshotFilesDir(moduleId, entry.name);
      if (!isDirectory(filesDir)) continue;
      const meta = readJsonFile(path.join(snapshotDir(moduleId, entry.name), 'meta.json'));
      const createdAt = meta !== null && typeof meta.createdAt === 'number' ? meta.createdAt : 0;
      snapshots.push({
        id: entry.name,
        name: meta !== null && typeof meta.name === 'string' && meta.name !== '' ? meta.name : entry.name,
        createdAt,
        updatedAt: meta !== null && typeof meta.updatedAt === 'number' ? meta.updatedAt : createdAt,
        fileCount: meta !== null && typeof meta.fileCount === 'number' ? meta.fileCount : 0,
      });
    }
    snapshots.sort((left, right) => right.createdAt - left.createdAt || left.id.localeCompare(right.id));
    return snapshots;
  }

  /** Build one ModuleSummary (SPEC §6). */
  function summarizeModule(meta) {
    const id = isValidId(meta.id) ? meta.id : '';
    const title = typeof meta.title === 'string' ? meta.title : id;
    const titleZh = typeof meta.titleZh === 'string' && meta.titleZh !== '' ? meta.titleZh : title;
    return {
      id,
      itemId: typeof meta.itemId === 'string' ? meta.itemId : null,
      stageId: typeof meta.stageId === 'string' ? meta.stageId : '',
      stageIndex: typeof meta.stageIndex === 'number' && Number.isFinite(meta.stageIndex) ? meta.stageIndex : 999,
      itemIndex: typeof meta.itemIndex === 'number' && Number.isFinite(meta.itemIndex) ? meta.itemIndex : 999,
      stageTitleZh: typeof meta.stageTitleZh === 'string' ? meta.stageTitleZh : '',
      titleZh,
      title,
      level: typeof meta.level === 'string' ? meta.level : '',
      summary: typeof meta.summary === 'string' ? meta.summary : '',
      defaultFile:
        typeof meta.defaultFile === 'string' && meta.defaultFile !== '' ? meta.defaultFile : DEFAULT_DEFAULT_FILE,
      snapshots: listSnapshots(id),
    };
  }

  /** Every module summary, ordered by stage then item (sandbox first). */
  function scanModules() {
    const modules = [];
    for (const moduleId of scanModuleIds()) {
      const meta = readModuleMeta(moduleId);
      if (meta === null) continue;
      modules.push(summarizeModule(meta));
    }
    modules.sort(
      (left, right) =>
        left.stageIndex - right.stageIndex ||
        left.itemIndex - right.itemIndex ||
        left.id.localeCompare(right.id),
    );
    return modules;
  }

  /** Resolve one module's stored version to a concrete project directory. */
  function resolveVersionTarget(moduleId, record) {
    if (record !== null && typeof record === 'object' && record.kind === 'snapshot' && isValidId(record.snapshotId)) {
      const filesDir = snapshotFilesDir(moduleId, record.snapshotId);
      if (isDirectory(filesDir)) {
        const name = snapshotName(moduleId, record.snapshotId) || record.name || record.snapshotId;
        return {
          version: { kind: 'snapshot', snapshotId: record.snapshotId, name },
          dir: filesDir,
        };
      }
    }
    return { version: { kind: 'default' }, dir: defaultDir(moduleId) };
  }

  /** Pick the module that should be active, honoring the state but validating it. */
  function pickActiveModuleId(modules) {
    if (modules.some((module) => module.id === state.activeModuleId)) return state.activeModuleId;
    if (modules.some((module) => module.id === DEFAULT_MODULE_ID)) return DEFAULT_MODULE_ID;
    return modules.length > 0 ? modules[0].id : DEFAULT_MODULE_ID;
  }

  /** Build the `active` payload (SPEC §6); null when no module exists at all. */
  function activeNow(modules) {
    const list = Array.isArray(modules) ? modules : scanModules();
    ensureStateLoaded();
    const meta = list.find((module) => module.id === state.activeModuleId) || null;
    if (meta === null) return null;
    const resolved = resolveVersionTarget(meta.id, state.versions[meta.id]);
    return {
      moduleId: meta.id,
      moduleTitleZh: meta.titleZh,
      stageId: meta.stageId,
      stageTitleZh: meta.stageTitleZh,
      defaultFile: meta.defaultFile,
      version: resolved.version,
      dirty: state.dirty === true,
    };
  }
  // #endregion

  return {
    /**
     * Create the storage directories, read/repair the state and, only when the
     * workspace has no `src/app.module.ts`, load the active module version.
     * Existing workspace files are never overwritten.
     */
    async ensure() {
      return serialize(async () => {
        ensureStateLoaded();
        fs.mkdirSync(modulesDir, { recursive: true });
        fs.mkdirSync(savesDir, { recursive: true });
        const modules = scanModules();
        state.activeModuleId = pickActiveModuleId(modules);
        if (modules.length > 0) {
          const resolved = resolveVersionTarget(state.activeModuleId, state.versions[state.activeModuleId]);
          state.versions[state.activeModuleId] = resolved.version;
          const appModulePath = path.join(rootDir, 'src', 'app.module.ts');
          if (!pathExists(appModulePath)) {
            await runtime.replaceFrom(resolved.dir);
            state.dirty = false;
            safeLog('initialized workspace from ' + resolved.dir);
          }
        } else {
          safeLog('no playground modules found under ' + modulesDir);
        }
        touch();
        writeState();
        return { ok: true, active: activeNow(modules) };
      });
    },

    /** List every module summary plus the active selection. */
    async listModules() {
      return serialize(async () => {
        ensureStateLoaded();
        const modules = scanModules();
        const activeModuleId = pickActiveModuleId(modules);
        if (activeModuleId !== state.activeModuleId) {
          state.activeModuleId = activeModuleId;
          touch();
          writeState();
        }
        return { active: activeNow(modules), modules };
      });
    },

    /** Switch the whole workspace to another module (default or its last version). */
    async switchModule(moduleId) {
      return serialize(async () => {
        ensureStateLoaded();
        const wanted = typeof moduleId === 'string' ? moduleId.trim() : '';
        if (!isValidId(wanted)) throw new Error('未知模块：' + String(moduleId));
        const modules = scanModules();
        const meta = modules.find((module) => module.id === wanted);
        if (meta === undefined) throw new Error('未知模块：' + wanted);
        // Remember the current module's selection before leaving it.
        if (state.versions[state.activeModuleId] === undefined) {
          state.versions[state.activeModuleId] = { kind: 'default' };
        }
        const resolved = resolveVersionTarget(wanted, state.versions[wanted]);
        await runtime.replaceFrom(resolved.dir);
        state.activeModuleId = wanted;
        state.versions[wanted] = resolved.version;
        state.dirty = false;
        touch();
        writeState();
        safeLog('switched playground module to ' + wanted + ' (' + resolved.version.kind + ')');
        return { active: activeNow(modules) };
      });
    },

    /**
     * Load the active module's default code or one of its snapshots.
     * @param {'default'|'snapshot'} kind
     * @param {string} [snapshotId]
     */
    async loadVersion(kind, snapshotId) {
      return serialize(async () => {
        ensureStateLoaded();
        const modules = scanModules();
        const moduleId = state.activeModuleId;
        if (!modules.some((module) => module.id === moduleId)) throw new Error('当前没有活动模块');
        let version;
        let directory;
        if (kind === 'default') {
          version = { kind: 'default' };
          directory = defaultDir(moduleId);
          if (!isDirectory(directory)) throw new Error('模块默认代码不存在：' + moduleId);
        } else if (kind === 'snapshot') {
          const wantedSnapshot = typeof snapshotId === 'string' ? snapshotId.trim() : '';
          if (!isValidId(wantedSnapshot)) throw new Error('代码版本不存在');
          const filesDir = snapshotFilesDir(moduleId, wantedSnapshot);
          if (!isDirectory(filesDir)) throw new Error('代码版本不存在');
          directory = filesDir;
          version = {
            kind: 'snapshot',
            snapshotId: wantedSnapshot,
            name: snapshotName(moduleId, wantedSnapshot) || wantedSnapshot,
          };
        } else {
          throw new Error('未知的版本类型：' + String(kind));
        }
        await runtime.replaceFrom(directory);
        state.versions[moduleId] = version;
        state.dirty = false;
        touch();
        writeState();
        safeLog('loaded playground version ' + version.kind + ' for ' + moduleId);
        return { active: activeNow(modules) };
      });
    },

    /**
     * Capture the current workspace as a named version of the active module.
     * @param {string} name
     */
    async saveSnapshot(name) {
      return serialize(async () => {
        ensureStateLoaded();
        const modules = scanModules();
        const moduleId = state.activeModuleId;
        if (!modules.some((module) => module.id === moduleId)) throw new Error('当前没有活动模块');
        const cleanName = normalizeSnapshotName(name);
        if (listSnapshots(moduleId).some((snapshot) => snapshot.name === cleanName)) {
          throw new Error('同一模块下已存在同名版本：' + cleanName);
        }
        let snapshotId = generateSnapshotId();
        while (pathExists(snapshotDir(moduleId, snapshotId))) snapshotId = generateSnapshotId();
        const directory = snapshotDir(moduleId, snapshotId);
        const filesDir = snapshotFilesDir(moduleId, snapshotId);
        let captured;
        try {
          captured = await runtime.captureTo(filesDir);
        } catch (error) {
          try {
            fs.rmSync(directory, { recursive: true, force: true });
          } catch (_cleanupError) {
            /* best-effort cleanup of a failed capture */
          }
          throw new Error('保存代码版本失败：' + errorMessage(error));
        }
        if (!Array.isArray(captured.files) || captured.files.length === 0) {
          try {
            fs.rmSync(directory, { recursive: true, force: true });
          } catch (_cleanupError) {
            /* best-effort cleanup */
          }
          throw new Error('工作区为空，无法保存版本');
        }
        const now = Date.now();
        const meta = {
          id: snapshotId,
          name: cleanName,
          createdAt: now,
          updatedAt: now,
          fileCount: captured.files.length,
        };
        try {
          writeJsonFile(path.join(directory, 'meta.json'), meta);
        } catch (error) {
          try {
            fs.rmSync(directory, { recursive: true, force: true });
          } catch (_cleanupError) {
            /* best-effort cleanup */
          }
          throw new Error('保存代码版本失败：' + errorMessage(error));
        }
        state.versions[moduleId] = { kind: 'snapshot', snapshotId, name: cleanName };
        state.dirty = false;
        touch();
        writeState();
        safeLog('saved playground snapshot ' + snapshotId + ' (' + String(meta.fileCount) + ' files)');
        return { active: activeNow(modules), snapshot: meta };
      });
    },

    /** Delete one saved version of the active module (never the one in use). */
    async deleteSnapshot(snapshotId) {
      return serialize(async () => {
        ensureStateLoaded();
        const moduleId = state.activeModuleId;
        const wantedSnapshot = typeof snapshotId === 'string' ? snapshotId.trim() : '';
        if (!isValidId(wantedSnapshot)) throw new Error('代码版本不存在');
        if (!listSnapshots(moduleId).some((snapshot) => snapshot.id === wantedSnapshot)) {
          throw new Error('代码版本不存在');
        }
        const current = state.versions[moduleId];
        if (
          current !== null &&
          typeof current === 'object' &&
          current.kind === 'snapshot' &&
          current.snapshotId === wantedSnapshot
        ) {
          throw new Error('当前正在使用该版本，先切换到其他版本');
        }
        try {
          fs.rmSync(snapshotDir(moduleId, wantedSnapshot), { recursive: true, force: true });
        } catch (error) {
          throw new Error('删除代码版本失败：' + errorMessage(error));
        }
        touch();
        writeState();
        safeLog('deleted playground snapshot ' + wantedSnapshot + ' of ' + moduleId);
        return { ok: true };
      });
    },

    /** Reset the active module to its default code and drop the version selection. */
    async resetActive() {
      return serialize(async () => {
        ensureStateLoaded();
        const modules = scanModules();
        const moduleId = state.activeModuleId;
        if (!modules.some((module) => module.id === moduleId)) throw new Error('当前没有活动模块');
        const directory = defaultDir(moduleId);
        if (!isDirectory(directory)) throw new Error('模块默认代码不存在：' + moduleId);
        await runtime.replaceFrom(directory);
        state.versions[moduleId] = { kind: 'default' };
        state.dirty = false;
        touch();
        writeState();
        safeLog('reset playground module ' + moduleId + ' to its default code');
        return { active: activeNow(modules) };
      });
    },

    /** Mark the workspace as modified (called after successful file writes). */
    markDirty() {
      try {
        ensureStateLoaded();
        state.dirty = true;
        touch();
        writeState();
      } catch (error) {
        safeLog('标记工作区修改失败：' + errorMessage(error));
      }
    },

    /** Current active selection (module / version / dirty flag). */
    async status() {
      return serialize(async () => {
        ensureStateLoaded();
        return { active: activeNow() };
      });
    },
  };
}
