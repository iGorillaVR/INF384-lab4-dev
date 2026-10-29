const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { handler } = require('../../src/handler');

async function llamar(metodo, ruta, cuerpo) {
  const r = await handler({
    rawPath: ruta,
    requestContext: { http: { method: metodo } },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  return { status: r.statusCode, cuerpo: JSON.parse(r.body) };
}

// Cada escenario usa SQLite real, pero aislada en un directorio temporal.
async function escenario(nombre, ejecutar) {
  await test(nombre, async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-test-'));
    process.env.DB_PATH = path.join(dir, 'wallet.db');
    try {
      await ejecutar();
    } finally {
      // El store de db.js cierra la conexión al abrir una ruta distinta.
      process.env.DB_PATH = path.join(os.tmpdir(), 'wallet-test-cierre-' + process.pid + '.db');
    }
  });
}

// Un escenario agrupa verificaciones que sí dependen de una misma transferencia.
// No se presume el estado inicial de un test anterior.
(async () => {
  await escenario('transferencia y persistencia de ana a beto', async () => {
    const r = await llamar('POST', '/transferir', { origen: 'ana', destino: 'beto', monto: 100 });
    assert.equal(r.status, 200);
    assert.equal(r.cuerpo.saldoOrigen, 900);
    assert.deepEqual((await llamar('GET', '/saldo/ana')).cuerpo, { usuario: 'ana', saldo: 900 });
    assert.deepEqual((await llamar('GET', '/saldo/beto')).cuerpo, { usuario: 'beto', saldo: 600 });
    const historial = await llamar('GET', '/historial/ana');
    assert.equal(historial.status, 200);
    assert.equal(historial.cuerpo.length, 1);
    assert.equal(historial.cuerpo[0].destino, 'beto');
    assert.equal(historial.cuerpo[0].monto, 100);
    const rechazo = await llamar('POST', '/transferir', { origen: 'ana', destino: 'carla', monto: 950 });
    assert.equal(rechazo.status, 400);
    assert.equal(rechazo.cuerpo.error, 'saldo insuficiente');
    assert.equal((await llamar('GET', '/saldo/ana')).cuerpo.saldo, 900);
    assert.equal((await llamar('GET', '/saldo/carla')).cuerpo.saldo, 750);
  });
  await escenario('transferencia total de diego a elena y rechazo posterior', async () => {
    const r = await llamar('POST', '/transferir', { origen: 'diego', destino: 'elena', monto: 300 });
    assert.equal(r.status, 200);
    assert.equal((await llamar('GET', '/saldo/elena')).cuerpo.saldo, 1500);
    assert.equal((await llamar('POST', '/transferir', { origen: 'diego', destino: 'ana', monto: 0.01 })).status, 400);
    const historial = await llamar('GET', '/historial/elena');
    assert.equal(historial.cuerpo.length, 1);
    assert.equal(historial.cuerpo[0].origen, 'diego');
  });
  await escenario('origen y destino iguales devuelve 422', async () => {
    assert.equal((await llamar('POST', '/transferir', { origen: 'beto', destino: 'beto', monto: 1 })).status, 422);
  });
  await escenario('usuario de destino inexistente devuelve 400', async () => {
    assert.equal((await llamar('POST', '/transferir', { origen: 'beto', destino: 'zoe', monto: 1 })).status, 400);
  });
  await escenario('cuerpo no JSON devuelve 400', async () => {
    const r = await handler({ rawPath: '/transferir', requestContext: { http: { method: 'POST' } }, body: 'monto=1' });
    assert.equal(r.statusCode, 400);
  });
})().catch((error) => { console.error(error); process.exitCode = 1; });
