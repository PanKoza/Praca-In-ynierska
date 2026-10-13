const DATABASE = 'tourniDesk-live-scoring';
const DATABASE_VERSION = 1;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      database.createObjectStore('matches', { keyPath: 'id' });
      const commands = database.createObjectStore('commands', { keyPath: 'commandId' });
      commands.createIndex('matchId', 'matchId');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Nie udało się otworzyć lokalnej bazy wyników.'));
  });
}

async function transact(storeName, mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const request = operation(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Nie udało się zapisać lokalnej kolejki wyników.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error || new Error('Lokalna baza wyników zgłosiła błąd.'));
  });
}

export function readCachedMatch(id) {
  return transact('matches', 'readonly', (store) => store.get(id));
}

export function cacheMatch(match) {
  return transact('matches', 'readwrite', (store) => store.put(match));
}

export function enqueueMatchCommand(command) {
  return transact('commands', 'readwrite', (store) => store.put(command));
}

export async function readMatchCommands(matchId) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('commands', 'readonly');
    const request = transaction.objectStore('commands').index('matchId').getAll(matchId);
    request.onsuccess = () => resolve(request.result.sort((first, second) => first.createdAt - second.createdAt));
    request.onerror = () => reject(request.error || new Error('Nie udało się odczytać kolejki wyników.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error || new Error('Lokalna baza wyników zgłosiła błąd.'));
  });
}

export function removeMatchCommand(commandId) {
  return transact('commands', 'readwrite', (store) => store.delete(commandId));
}

