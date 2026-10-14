import { loadShareCards, shareSourceHash } from '../lib/share-cards.mjs';
const input = await loadShareCards();
console.log(JSON.stringify({...input, sourceHash: await shareSourceHash(input)}));
