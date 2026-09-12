/* Almacenamiento local de grabaciones de voz usando IndexedDB,
   para que los audios persistan aunque se cierre el navegador. */
(function (global) {
  'use strict';

  var DB_NAME = 'andri';
  var DB_VERSION = 1;
  var STORE = 'recordings';
  var MAX_KEEP = 30;

  var dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    if (!global.indexedDB) return Promise.reject(new Error('IndexedDB no disponible'));

    dbPromise = new Promise(function (resolve, reject) {
      var req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function getAll() {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).getAll();
        req.onsuccess = function () { resolve(req.result || []); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function put(rec) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(rec);
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function remove(id) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function clear() {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear();
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function trimToMax(storedCount) {
    var over = Math.max(0, storedCount - MAX_KEEP);
    if (!over) return Promise.resolve();
    return getAll().then(function (list) {
      list.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
      var toRemove = list.slice(MAX_KEEP);
      return Promise.all(toRemove.map(function (r) { return remove(r.id); }));
    });
  }

  global.RecordingStore = {
    MAX_KEEP: MAX_KEEP,
    getAll: getAll,
    put: put,
    remove: remove,
    clear: clear,
    trimToMax: trimToMax
  };
})(window);