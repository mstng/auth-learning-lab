import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { generateKeyPair, exportJWK, importJWK, calculateJwkThumbprint, type JWK } from 'jose';

async function loadKeys(directory: string) {
  await mkdir(directory, { recursive: true });
  const path = join(directory, 'jwt-signing-key.json');
  let saved: { privateKey: JWK; publicKey: JWK };
  try {
    saved = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    const pair = await generateKeyPair('RS256', { modulusLength: 2048, extractable: true });
    saved = { privateKey: await exportJWK(pair.privateKey), publicKey: await exportJWK(pair.publicKey) };
    // Never overwrite an existing key. The launcher also excludes simultaneous app processes.
    await writeFile(path, JSON.stringify(saved), { mode: 0o600, flag: 'wx' });
  }
  await chmod(path, 0o600);
  // Explicit public fields prevent accidentally returning private JWK parameters.
  const publicJwk: JWK = { kty: 'RSA', n: saved.publicKey.n, e: saved.publicKey.e, alg: 'RS256', use: 'sig' };
  const kid = await calculateJwkThumbprint(publicJwk);
  return {
    privateKey: await importJWK(saved.privateKey, 'RS256'),
    publicKey: await importJWK(publicJwk, 'RS256'),
    publicJwk: { ...publicJwk, kid }, kid,
  };
}
type Keys = Awaited<ReturnType<typeof loadKeys>>;
const runtime = globalThis as unknown as { authLabJwtKeys?: Map<string, Promise<Keys>> };
export function jwtKeys() {
  const directory = resolve(process.env.LAB_DATA_DIR ?? './data/authlab');
  const cache = runtime.authLabJwtKeys ??= new Map();
  let pending = cache.get(directory);
  if (!pending) {
    pending = loadKeys(directory).catch(error => { cache.delete(directory); throw error; });
    cache.set(directory, pending);
  }
  return pending;
}
