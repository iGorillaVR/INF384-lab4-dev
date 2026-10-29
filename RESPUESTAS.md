# Respuestas · Laboratorio 4
Alumno: 20210906
Presupuesto: 8 min  Métrica DORA: time to restore

## Parte 1 · Diagnóstico
> Nota de trazabilidad: las correcciones 1, 2 y una parte de la 5 se agruparon en un mismo commit de ci.yml. La rúbrica exige un defecto por commit; este punto necesita regularizarse antes de la calificación.

### Defecto 1
- Job y etapa: smoke, post-deploy (dependencia inicial incorrecta con build-push).
- Problema que causa en el pipeline: smoke comenzaba en paralelo con deploy porque tenía `needs: build-push`. Podía probar la versión anterior de Lambda, dar un falso positivo o fallar por una actualización todavía en curso.
- Link al commit: https://github.com/iGorillaVR/INF384-lab4-dev/commit/ccf01c3be74cfa4ac21065e8885234c18289ef83
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): mover de etapa y ajustar configuración; `smoke.needs: deploy`.
- Evidencia (dato observado, con link al run o fragmento de la salida local): en el run inicial https://github.com/iGorillaVR/INF384-lab4-dev/actions/runs/40914966792 los jobs smoke y deploy empezaron ambos alrededor de las 16:48:33 UTC; por tanto no existía una dependencia entre ellos. En el run corregido https://github.com/iGorillaVR/INF384-lab4-dev/actions/runs/40958204990, smoke se ejecuta después de deploy.

### Defecto 2
- Job y etapa: smoke, post-deploy.
- Problema que causa en el pipeline: smoke.sh tiene la validación opcional EXPECTED_COMMIT, pero ci.yml no la proporcionaba. El test podía aprobar aunque Lambda respondiera con otro commit.
- Link al commit: https://github.com/iGorillaVR/INF384-lab4-dev/commit/ccf01c3be74cfa4ac21065e8885234c18289ef83
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): ajustar configuración; definir `EXPECTED_COMMIT: ${{ github.sha }}` en el paso Smoke.
- Evidencia (dato observado, con link al run o fragmento de la salida local): en el run https://github.com/iGorillaVR/INF384-lab4-dev/actions/runs/40958204990, log de smoke: `salud: {"ok":true,"version":"1.0.0","commit":"be061e23aa121664a48823ab435212c6a26d12d4"}` y `commit: be061e23aa121664a48823ab435212c6a26d12d4`; se verificó el SHA esperado. En el run previo https://github.com/iGorillaVR/INF384-lab4-dev/actions/runs/40914966792 no aparecía la línea `commit:`.

### Defecto 3
- Job y etapa: integration, pre-build.
- Problema que causa en el pipeline: varias pruebas asumían el saldo o el historial modificado por pruebas anteriores, por ejemplo saldo de ana = 900 después de la transferencia. El resultado dependía del orden y del estado compartido.
- Link al commit: https://github.com/iGorillaVR/INF384-lab4-dev/commit/56aea1fc52c7d86057ff29ac1a7b3892ed633633
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): modificar tests; agrupar comprobaciones dependientes en escenarios y asignar una ruta SQLite temporal por escenario.
- Evidencia (dato observado, con link al run o fragmento de la salida local): https://github.com/iGorillaVR/INF384-lab4-dev/actions/runs/40958204990: job `integration` finalizó en verde tras el cambio; el diff del commit muestra que el estado inicial ya no se presupone entre tests. La ejecución exitosa evidencia la corrección, aunque no demuestra por sí sola un fallo previo reproducido.

### Defecto 4
- Job y etapa: load, post-deploy.
- Problema que causa en el pipeline: k6 declaraba exitosos los HTTP 400 y comprobaba `200 || 400`, de modo que rechazos de transferencias podían contarse como operaciones válidas y ocultarse en la tasa de errores.
- Link al commit: https://github.com/iGorillaVR/INF384-lab4-dev/commit/11189a24e9fcc79e73c9dddd92249792d6dd928e
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): modificar tests; `expectedStatuses(200)` y comprobación de HTTP 200 para transferencia aceptada.
- Evidencia (dato observado, con link al run o fragmento de la salida local): en el run inicial https://github.com/iGorillaVR/INF384-lab4-dev/actions/runs/40914966792, k6 informó `checks_succeeded: 100.00% 36448 out of 36448` y `http_req_failed: 0.00%`, con reglas que aceptaban HTTP 400. **Pendiente:** contrastar con los logs del run corregido para confirmar el efecto y evaluar rechazos legítimos por saldo insuficiente.

### Defecto 5
- Job y etapa: e2e, post-deploy.
- Problema que causa en el pipeline: una batería de pruebas de API basada en Playwright usaba `page` y requería instalar Chromium, con costo innecesario para la mayoría de las validaciones HTTP.
- Link al commit: https://github.com/iGorillaVR/INF384-lab4-dev/commit/be061e23aa121664a48823ab435212c6a26d12d4 (adaptación de los tests); https://github.com/iGorillaVR/INF384-lab4-dev/commit/ccf01c3be74cfa4ac21065e8885234c18289ef83 (eliminación del paso Navegador).
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): eliminar y modificar tests; usar `request` y eliminar la instalación de Chromium.
- Evidencia (dato observado, con link al run o fragmento de la salida local): en https://github.com/iGorillaVR/INF384-lab4-dev/actions/runs/40958204990 el job `e2e` terminó correctamente sin el paso `Navegador`. **Pendiente:** registrar minutos antes/después del cambio para cuantificar el tiempo recuperado.

## Parte 2 · Implementación
- Link al run en verde en main: https://github.com/iGorillaVR/INF384-lab4-dev/actions/runs/40958204990
- Link al pull request: https://github.com/iGorillaVR/INF384-lab4-dev/pull/1
- Defecto de la aplicación introducido (archivo y descripción): Se modificó src/wallet.js, específicamente la función transferir(), cambiando la condición cuentaOrigen.saldo < centimos por cuentaOrigen.saldo < 0. Esto provoca que la aplicación no valide correctamente si el usuario tiene saldo suficiente para realizar una transferencia, permitiendo intentar operaciones que deberían rechazarse.
- Job que debería detenerlo: unit (etapa pre-build). La prueba unitaria transferir con saldo insuficiente es 400 verifica que una transferencia superior al saldo disponible sea rechazada con HTTP 400.
- Link al run fallido: https://github.com/iGorillaVR/INF384-lab4-dev/actions/runs/40960807309

## Parte 3 · Decisión bajo restricción
> Presupuesto asignado: **8 minutos**. Métrica DORA asignada: **time to restore**. Registrar datos de un run en verde de la Parte 2. La suma de duraciones de todos los jobs, no la duración de reloj, es la medida de la rúbrica.
Link al run medido:

| Job | Duración (min:seg) |
|---|---|
| unit | |
| integration | |
| sast | |
| sca | |
| build-push | |
| deploy | |
| smoke | |
| e2e | |
| load | |
| **Total** | |

Resultado de load en ese run:
| Métrica | Valor |
|---|---|
| p90 | |
| p95 | |
| Máximo | |
| Tasa de error | |
| Requests por segundo | |

Conclusión sobre el comportamiento bajo carga:

SLO propuesto (percentil, valor, ventana) y justificación:

SLA propuesto y diferencia con el SLO:

Cambios para cumplir el presupuesto:
| Cambio | Job | Minutos recuperados |
|---|---|---|

Total resultante: [ ] min
Link al run en main con los cambios:

Riesgo aceptado (defecto de la aplicación concreto y efecto en la métrica DORA asignada):

Decisión sobre sast (se queda / se mueve a otra etapa o evento / informativo) y razón:

## Declaración de uso de IA
Herramientas usadas y para qué: ChatGPT (OpenAI), para revisar el código y la configuración del pipeline, proponer correcciones, interpretar logs de GitHub Actions y redactar/documentar las respuestas. Las evidencias y enlaces incluidos corresponden a ejecuciones observadas en mi fork.
