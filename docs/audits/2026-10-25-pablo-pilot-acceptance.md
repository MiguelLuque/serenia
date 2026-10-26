# Verificación de la versión de conversación para Pablo

Preparación 25-10-2026; verificación integrada 26-10-2026. Base: `4b546a4`. Variante de prompts: `0.1.0-pilot`.

Estado: versión local preparada para prueba ficticia supervisada por Pablo. Implementación, revisión independiente, correcciones y siete gates integrales verificados. La revisión clínica y las conversaciones reales con el proveedor siguen pendientes.

## Entrega

[Guía y procedencia de las notas](/Users/miguelluque/git/serenia/docs/handoff/para-pablo-piloto-2026-10-25/README.md), [once episodios propuestos](/Users/miguelluque/git/serenia/docs/handoff/para-pablo-piloto-2026-10-25/casos.md), [hoja de revisión](/Users/miguelluque/git/serenia/docs/handoff/para-pablo-piloto-2026-10-25/revision.md).

Configuración explícita del servidor, sólo development/test; inicio local mediante `rtk npm run dev:clinical` en127.0.0.1:3217. Se conservan dos prompts de referencia y se añaden dos de piloto, sin activar drafts. Sin cambios de proveedor, dependencias, instrumentos, bandas, SQL ni datos alojados.

## Regresiones observadas

- Selección de ambos prompts, rechazo del piloto en producción y rechazo de rutas arbitrarias: correcto en tests.
- La ruta piloto deja llegar la mención y aclaración repetida al historial/modelo sustituto, conserva `p_crisis/p_urgent`, replay, fallbacks y guard de cierre. No demuestra que un modelo real interprete bien.
- En modo estricto se selecciona C-SSRS antes del límite de instancia y no se convierten fallos/bandas desconocidas en negativo.
- Cinco acuerdos máximos no borran las instrucciones y el riesgo; retorno sin informe reconoce continuidad y el mantenimiento no afirma trabajo completado por contador.
- Los hechos canónicos de todas las instancias puntuadas se conservan como datos disponibles en cada turno piloto; no son un acuse de devolución.
- Lectura de riesgo fallida impide generación de un informe de aparente ausencia; el contexto del informe distingue una observación léxica automática.

Grupos focales verificados (se solapan, no sumar): root40/40 selección/assets/avisos/resultados; root59/59 ruta/estado/seguridad; root46/46 generador/workflow; contexto100/100; seguridad105/105. Los logs completos están en `.cache/pablo-pilot/logs/`, `.cache/clinical-review-20261025/` y `/private/tmp/serenia-pilot-safety-checks/logs/`. Las fases RED y GREEN se conservaron. Un fallo inicial de escritura del logger global se resolvió usando una copia local idéntica de `project_checks.py`; no se modificó la herramienta global.

## Revisión independiente y correcciones

La revisión externa al implementador encontró cuatro fallos; no otorgó aprobación mientras existieran. Informe original privado: `.cache/pablo-pilot/independent-review.md`. Se corrigieron en una pasada con nuevas regresiones RED→GREEN:

1. Los avisos piloto pending/negative/low/moderate/textual ya no heredan vetos ante información nueva fundada; conservan hechos disponibles y atención oportuna sin esperar formulario. Los requisitos high/acute se conservan.
2. Una aceptación afirmativa natural que no pasa el gate renueva sólo una propuesta anterior del mismo motivo y añade una aclaración; una duda/rechazo no autoriza cierre. La confirmación clara del turno siguiente puede completar el cierre sin cambiar SQL.
3. La conversación sólo reconoce un cierre de tool con `output.closed === true`; un resultado `false` mantiene la entrada y no redirige.
4. Si la herramienta ya creó un cuestionario y después falla generación, el fallback conserva el resultado real de esa operación en partes/chunks persistidos; así la tarjeta se refresca y el replay es coherente. No se fabrica una instancia ni se la elimina.

Después de las correcciones: **842/842 pruebas en71 archivos**, lint y typecheck exit0. Evidencia íntegra: `.cache/pablo-pilot/logs/20261026-083745-ajb76ssi.log`, `20261026-083742-ows58ij7.log`, `20261026-083742-5s713cpl.log`. El fallo anterior de cuatro pruebas de transporte fue `listen EPERM` del sandbox; las seis pruebas de ese archivo pasaron con permiso loopback y luego la suite completa pasó. No se relajan aserciones para ocultarlo.

## Gates integrales

`rtk npm run verify` terminó con exit0 el26-10-2026. Fuente construida: **`38384a315febd7abb4f63e1ed02772eb38effac8`**, sin cambios locales al ejecutar el gate. Lock SHA256 `cb963dbb3901c1f91e74c86c979e68062a823c464383250f72f95f7d26c9a425`; Node24.14.1. La actualización documental posterior no se atribuye a otro build.

| Gate | Resultado |
| --- | --- |
| test | PASS —842/842 en71 archivos |
| lint | PASS |
| typecheck | PASS |
| workflow:wire | PASS |
| db:test | PASS —Postgres efímero; sin BD alojada |
| audit:dependencies | PASS —gate estricto vigente |
| build:isolated | PASS —archive del commit exacto, entorno sintético limpio |

Resultados y logs íntegros: `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-ukeqhe/results.json` y logs contiguos. Build: `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-build-3jLWl5/project`; metadata/result/build.log en su directorio padre. El build de producción compila las ramas del piloto pero no habilita su ejecución: el flag piloto se rechaza en producción por diseño.

## Arranque local comprobado

Se ejecutó `rtk npm run dev:clinical`, con piloto/continuidad activados y telemetría desactivada. Listener observado: node PID59534 en127.0.0.1:3217. `/registro` devolvió HTTP200; el navegador mostró su formulario y permitió navegar a `/login`, donde se vieron los campos y botón de acceso. POST anónimo a `/api/chat` fue redirigido por el proxy de autenticación; no inició generación ni creó datos.

La comprobación se detuvo antes de iniciar sesión: no se usaron cuentas, transcripciones reales ni modelos de pago. No acredita el recorrido autenticado contra BD/proveedor, disponibilidad de credenciales del modelo ni calidad clínica. La guía indica ese requisito y cómo registrar un fallo de configuración sin confundirlo con el método. El servicio permanece local para la prueba, sin publicación remota.

`next dev` actualizó su bloque generado de `AGENTS.md` y añadió `/.swc` a `.gitignore`. Se inspeccionó el diff y el generador instalado; son cambios auxiliares de desarrollo, sin modificar el código ejecutable construido ni las instrucciones clínicas. Se conservan para evitar suciedad repetida al arrancar.

## Límites de aceptación

La revisión de Pablo y la calidad conversacional real todavía no se han medido. Los once episodios son material de prueba humana, no once conversaciones ejecutadas. No hay resultados de pacientes ni afirmación de eficacia.

Se mantienen límites explícitos: eventos léxicos `high/open`, enums sin «no evaluado», falta de cancelación persistida de cuestionarios, aceptación SQL conservadora de cierre y contador sin fase trabajada persistida. El piloto permite examinarlos con comportamiento más coherente; no los considera resueltos por el prompt. No hay publicación, avisos externos ni garantía de revisión humana/plazo.
