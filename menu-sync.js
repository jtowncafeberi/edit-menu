export class MenuSync {
  constructor({source, edits, stored, validate, onState, request = (...args) => fetch(...args)}) {
    this.source = source; this.edits = {...edits}; this.validate = validate;
    this.request = request; this.onState = onState;
    this.revision = stored?.revision ?? 0;
    this.pending = stored?.pending ?? Object.keys(edits).length > 0;
    this.updatedAt = stored?.updatedAt ?? null;
    this.status = 'connecting'; this.connected = false; this.running = null;
  }
  metadata() { return {revision: this.revision, pending: this.pending, updatedAt: this.updatedAt}; }
  notify() { this.onState(this); }
  async read() {
    const response = await this.request('/api/menu', {cache: 'no-store', signal: AbortSignal.timeout(10000)});
    if (!response.ok) throw Error('Shared storage unavailable.');
    const record = await response.json();
    if (record.source !== this.source || !Number.isSafeInteger(record.revision) || record.revision < 0) throw Error('Invalid saved menu.');
    this.validate(record.edits); return record;
  }
  async connect({useSaved = false} = {}) {
    if (this.running) await this.running;
    this.status = 'connecting'; this.notify();
    try {
      const record = await this.read();
      this.connected = true;
      if (!useSaved && this.pending && record.revision !== this.revision && JSON.stringify(record.edits) !== JSON.stringify(this.edits)) {
        this.status = 'conflict'; this.notify(); return false;
      }
      if (useSaved || !this.pending) this.edits = {...record.edits};
      this.revision = record.revision; this.updatedAt = record.updatedAt;
      if (useSaved || JSON.stringify(record.edits) === JSON.stringify(this.edits)) this.pending = false;
      this.status = this.pending ? 'pending' : 'saved'; this.notify();
      return true;
    } catch { this.connected = false; this.status = 'offline'; this.notify(); return false; }
  }
  change(edits) {
    this.edits = {...edits}; this.pending = true;
    if (this.status !== 'conflict') this.status = this.connected ? 'pending' : 'offline';
    this.notify();
    return this.flush();
  }
  flush() {
    if (this.running || !this.connected || this.status === 'conflict' || !this.pending) return this.running;
    this.running = this.write().finally(() => { this.running = null; });
    return this.running;
  }
  async write() {
    while (this.pending && this.connected && this.status !== 'conflict') {
      const snapshot = JSON.stringify(this.edits);
      const mutationId = crypto.randomUUID();
      this.status = 'saving'; this.notify();
      try {
        const response = await this.request('/api/menu', {method: 'PUT', signal: AbortSignal.timeout(10000), headers: {'Content-Type': 'application/json'}, body: JSON.stringify({source: this.source, revision: this.revision, edits: JSON.parse(snapshot), mutationId})});
        if (response.status === 409) { this.status = 'conflict'; this.notify(); return; }
        if (!response.ok) throw Error('Save failed.');
        const record = await response.json();
        if (record.source !== this.source || record.mutationId !== mutationId || record.revision !== this.revision + 1) throw Error('Unexpected save response.');
        this.revision = record.revision; this.updatedAt = record.updatedAt;
        this.pending = snapshot !== JSON.stringify(this.edits);
        this.status = this.pending ? 'pending' : 'saved'; this.notify();
      } catch { this.connected = false; this.status = 'offline'; this.notify(); return; }
    }
  }
}
