import { describe, expect, test } from 'bun:test';
import { createRequire } from 'node:module';
import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const forge = require('node-forge');
const queryString = require('query-string');
const imageSize = require('image-size').default;

describe('patched dependency boundaries', () => {
  test('query-string keeps decoding ordinary and malformed inputs with the ESM decoder', () => {
    expect(queryString.parse('q=calm+music&emoji=%F0%9F%8C%BF')).toMatchObject({ q: 'calm music', emoji: '🌿' });
    expect(typeof queryString.parse('q=' + '%FF'.repeat(20_000)).q).toBe('string');
  });
  test('Metro-compatible image-size default export reads real project assets', () => {
    const result = imageSize(readFileSync(new URL('../assets/images/icon.png', import.meta.url)));
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });
  test('Metro loads image assets through its filename-based API', async () => {
    const { getAssetData } = require(require.resolve('metro/package.json').replace('package.json', 'src/Assets.js'));
    const asset = await getAssetData(fileURLToPath(new URL('../assets/images/icon.png', import.meta.url)), 'assets/images/icon.png', [], 'android', '/assets');
    expect(asset.width).toBeGreaterThan(0);
    expect(asset.height).toBeGreaterThan(0);
  });
  test('RSA accepts valid signatures but rejects extra nested DigestAlgorithm children', () => {
    const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const privateKey = forge.pki.privateKeyFromPem(keys.privateKey.export({ type: 'pkcs1', format: 'pem' }));
    const publicKey = forge.pki.publicKeyFromPem(keys.publicKey.export({ type: 'pkcs1', format: 'pem' }));
    const md = forge.md.sha256.create().update('frame regression fixture');
    expect(publicKey.verify(md.digest().getBytes(), privateKey.sign(md))).toBe(true);
    const a = forge.asn1;
    const primitive = (type, value) => a.create(a.Class.UNIVERSAL, type, false, value);
    for (const withNull of [false, true]) {
      const algorithm = [primitive(a.Type.OID, a.oidToDer(forge.oids.sha256).getBytes())];
      if (withNull) algorithm.push(primitive(a.Type.NULL, ''));
      const info = a.create(a.Class.UNIVERSAL, a.Type.SEQUENCE, true, [
        a.create(a.Class.UNIVERSAL, a.Type.SEQUENCE, true, algorithm),
        primitive(a.Type.OCTETSTRING, md.digest().getBytes()),
      ]);
      const sign = () => privateKey.sign(a.toDer(info).getBytes(), 'NONE');
      expect(publicKey.verify(md.digest().getBytes(), sign())).toBe(true);
      info.value[0].value.push(primitive(a.Type.OCTETSTRING, 'unexpected nested content'));
      expect(() => publicKey.verify(md.digest().getBytes(), sign())).toThrow();
    }
  });
});
