import assert from 'node:assert/strict';
import {sharePDF} from './share-pdf.js';
const file = new File(['original PDF bytes'], 'J-Town-Cafe-Menu.pdf', {type: 'application/pdf'});
let downloads = 0, calls = 0;
const download = received => { assert.equal(received, file); downloads++; };
const platform = {canShare: data => data.files[0] === file, share: data => { assert.equal(data.files[0], file); calls++; return Promise.resolve(); }};
const pending = sharePDF(file, platform, download);
assert.equal(calls, 1, 'Native sharing must start synchronously within the click');
assert.equal(await pending, 'shared'); assert.equal(downloads, 0);
assert.equal(await sharePDF(file, {}, download), 'downloaded');
assert.equal(await sharePDF(file, {...platform, canShare: () => false}, download), 'downloaded');
assert.equal(await sharePDF(file, {...platform, canShare: () => {throw Error('Blocked');}}, download), 'downloaded');
for (const name of ['NotAllowedError', 'DataError']) {
 assert.equal(await sharePDF(file, {...platform, share: () => Promise.reject(Object.assign(Error(), {name}))}, download), 'downloaded');
}
assert.equal(downloads, 5);
assert.equal(await sharePDF(file, {...platform, share: () => Promise.reject(Object.assign(Error(), {name: 'AbortError'}))}, download), 'cancelled');
assert.equal(downloads, 5, 'Cancelling must not force a download');
await assert.rejects(sharePDF(null, platform, download), /not ready/);
console.log('PDF sharing: native invocation, file identity, cancellation and fallback passed.');
