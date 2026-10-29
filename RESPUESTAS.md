# Respuestas · Laboratorio 4
Alumno: 20210906
Presupuesto: 8 min  Métrica DORA: time to restore

## Parte 1 · Diagnóstico
> Nota de trazabilidad: las correcciones 1, 2 y una parte de la 5 se agruparon en un mismo commit de ci.yml. La rúbrica exige un defecto por commit; este punto necesita regularizarse antes de la calificación.

### Defecto 1
- Job y etapa: smoke, post-deploy.
- Problema que causa en el pipeline: smoke dependía de build-push, por lo que podía ejecutarse antes de finalizar deploy y validar una versión anterior.
- Link al commit: https://github.com/iGorillaVR/INF384-lab4-dev/commit/ccf01c3be74cfa4ac21065e8885234c18289ef83
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): mover de etapa y ajustar configuración; `smoke.needs: deploy`.
- Evidencia (dato observado, con link al run o fragmento de la salida local): En el run inicial, ambos jobs comenzaron alrededor de las 16:48:33 UTC. En el run corregido, smoke esperó a deploy.

### Defecto 2
- Job y etapa: smoke, post-deploy.
- Problema que causa en el pipeline: No se verificaba que Lambda ejecutara el commit correcto, permitiendo validar versiones anteriores.
- Link al commit: https://github.com/iGorillaVR/INF384-lab4-dev/commit/ccf01c3be74cfa4ac21065e8885234c18289ef83
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): ajustar configuración; definir `EXPECTED_COMMIT: ${{ github.sha }}` en el paso Smoke.
- Evidencia (dato observado, con link al run o fragmento de la salida local): en el run https://github.com/iGorillaVR/INF384-lab4-dev/actions/runs/40958204990, log de smoke: `salud: {"ok":true,"version":"1.0.0","commit":"be061e23aa121664a48823ab435212c6a26d12d4"}` y `commit: be061e23aa121664a48823ab435212c6a26d12d4`; se verificó el SHA esperado. En el run previo https://github.com/iGorillaVR/INF384-lab4-dev/actions/runs/40914966792 no aparecía la línea `commit:`.

### Defecto 3
- Job y etapa: integration, pre-build.
- Problema que causa en el pipeline: Las pruebas dependían del estado generado por pruebas anteriores, haciendo que los resultados dependieran del orden de ejecución.
- Link al commit: https://github.com/iGorillaVR/INF384-lab4-dev/commit/56aea1fc52c7d86057ff29ac1a7b3892ed633633
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): Modificar tests, agrupando verificaciones relacionadas y utilizando bases SQLite temporales independientes.
- Evidencia (dato observado, con link al run o fragmento de la salida local): El run corregido muestra integration en verde. El commit permite comprobar la separación de escenarios. No se reprodujo un fallo por cambio de orden.

### Defecto 4
- Job y etapa: load, post-deploy.
- Problema que causa en el pipeline: k6 consideraba exitosas las respuestas HTTP 400, ocultando transferencias rechazadas en sus métricas.
- Link al commit: https://github.com/iGorillaVR/INF384-lab4-dev/commit/11189a24e9fcc79e73c9dddd92249792d6dd928e
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): Modificar tests para aceptar únicamente HTTP 200 como transferencia exitosa.
- Evidencia (dato observado, con link al run o fragmento de la salida local):  En el run inicial, k6 reportó 36 448 checks exitosos y 0 % de errores bajo la configuración que aceptaba HTTP 400. En el run corregido, registró 13 568 checks exitosos y 0 % de errores con la validación más estricta.

### Defecto 5
- Job y etapa: e2e, post-deploy.
- Problema que causa en el pipeline: Las pruebas de API requerían instalar Chromium innecesariamente, aumentando el tiempo del pipeline.
- Link al commit: https://github.com/iGorillaVR/INF384-lab4-dev/commit/be061e23aa121664a48823ab435212c6a26d12d4 (adaptación de los tests); https://github.com/iGorillaVR/INF384-lab4-dev/commit/ccf01c3be74cfa4ac21065e8885234c18289ef83 (eliminación del paso Navegador).
- Corrección (una o más: mover de etapa / dejar como informativo / eliminar / ajustar configuración / modificar tests): Eliminar el paso de instalación de Chromium y modificar los tests para utilizar request de Playwright.
- Evidencia (dato observado, con link al run o fragmento de la salida local): en https://github.com/iGorillaVR/INF384-lab4-dev/actions/runs/40958204990 el job `e2e` terminó correctamente sin el paso `Navegador`. 

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
| unit | 11s |
| integration | 11s |
| sast | 20s |
| sca | 23s |
| build-push | 37s |
| deploy | 18s |
| smoke | 10s |
| e2e | 17s |
| load | 12m 9s |
| **Total** | 14m 36s |

Resultado de load en ese run:
| Métrica | Valor |
|---|---|
| p90 | 17,98 ms |
| p95 | 20,38 ms |
| Máximo | 112,01 ms |
| Tasa de error | 0% |
| Requests por segundo | 53,51 |

Conclusión sobre el comportamiento bajo carga: En la ejecución analizada, Monedero Andino presentó una latencia p95 de 20,38 ms y una tasa de errores HTTP reportada de 0 %, procesando aproximadamente 53,51 solicitudes por segundo. Esto evidencia un buen rendimiento bajo la carga simulada de 30 usuarios virtuales. Sin embargo, la configuración utilizada consideraba esperadas las respuestas HTTP 400, por lo que el resultado no garantiza que todas las transferencias hayan sido efectivamente aceptadas.

SLO propuesto (percentil, valor, ventana) y justificación: Se propone un SLO de latencia p95 inferior a 100 ms durante cada ejecución de la prueba de carga de k6, con 30 usuarios virtuales y una etapa de carga constante de al menos 4 minutos. Este umbral ofrece margen frente a la latencia p95 observada de 20,38 ms y contempla variaciones normales entre ejecuciones.

SLA propuesto y diferencia con el SLO:
Se propone un SLA de latencia p95 inferior o igual a 200 ms, medido mensualmente para los clientes del servicio. El SLA es un compromiso externo con los clientes, mientras que el SLO es un objetivo técnico interno más exigente. Por esta razón, el SLA establece un umbral de latencia mayor, dejando margen operativo antes de incumplir el compromiso de servicio.

Cambios para cumplir el presupuesto:
| Cambio | Job | Minutos recuperados |
|Reducir la prueba k6 de 12 minutos a 4 minutos y 30 segundos, manteniendo 30 usuarios virtuales y un mínimo de 4 minutos de carga constante.|load|7min 27s|
|Ajustar SLO_P95 de 500 ms a 100 ms.|load| 0s |

Total resultante: 7:24 min
Link al run en main con los cambios: https://github.com/iGorillaVR/INF384-lab4-dev/actions/runs/40963133584

Riesgo aceptado (defecto de la aplicación concreto y efecto en la métrica DORA asignada):
Al reducir la duración de load, se acepta el riesgo de no detectar una posible fuga de memoria que degrade el rendimiento tras varios minutos de uso continuo. Este defecto podría llegar a producción y aumentar el Time to Restore, debido al tiempo adicional necesario para identificar el problema y restaurar el servicio.

Decisión sobre sast (se queda / se mueve a otra etapa o evento / informativo) y razón:
Se mantiene sast como obligatorio en pre-build, ya que consume únicamente 23 segundos (0,38 minutos) y permite detectar vulnerabilidades antes del despliegue. Eliminarlo o hacerlo informativo podría aumentar el riesgo de incidentes en producción y, por tanto, el Time to Restore. Como el presupuesto se cumplió optimizando load, no fue necesario modificar sast.


## Declaración de uso de IA
Herramientas usadas y para qué: ChatGPT (OpenAI), para analizar el pipeline, identificar y corregir defectos, revisar los resultados de GitHub Actions y apoyar la redacción de las respuestas.
