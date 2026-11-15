# Task 2 — implementación y evidencia

Estado: IMPLEMENTADO, commit local `3d83bb771835b28b0a292df52375d3b57f836616`, base `1c71a0ad2cd07e5b71e20ef8c908c21af172b556`. Revisión independiente y siete gates finales corresponden a root. No se ha publicado ni aplicado SQL remoto.

## Cambios

- **AQ1:** los diez detalles abiertos permanecen acotados. Dos probes globales de una fila conservan cualquier critical abierto y el último high abierto; los detalles ya incluyen el último evento de cualquier severidad. Todos filtran propietario/estado y propagan errores. El cálculo puro recibe los datos suficientes sin cambiar su política.
- **AQ2:** el contexto revisado conserva notas de riesgo, heteroagresión y sustancias. Reserva ese bloque dentro del presupuesto existente de 2500 caracteres, distingue `none` de negación/no evaluación y marca explícitamente notas truncadas a 500 caracteres para consultar el informe. No genera una conclusión clínica nueva.
- **AQ3:** `observedAt=clinical_sessions.closed_at` queda separado de `reviewedAt`. Selección de cierre revisado por observación de sesión; filtros de closure, sesión cerrada/propietario y fechas no nulas; orden padre PostgREST con desempates deterministas. El borrador tenía la misma causa de orden embebido y se corrige también. Edad/tier/riesgo y acuerdos históricos usan observación; encabezado conserva procedencia de revisión separada. La API TS de riesgo nombra `observedAt` y los fixtures de paridad usan esa fuente.
- **Inbox:** forward separado modifica sólo la selección del informe y la fecha suministrada a la rutina pura. La rutina SQL conserva el nombre legado `p_reviewed_at`; un comentario explica que ahora recibe observación. No se modifica su cuerpo ni firma.
- **AQ4:** la frase PHQ-9 de 15–19 es «moderadamente severo»; desde 20 sigue «severo». GAD-7 desde 15 conserva «severo». Las condiciones temporales y frecuencia no cambian.
- **Estabilización autorizada aparte por root:** `tests/profile/view.test.tsx:46` espera `findByRole` para el botón Activar memoria después del error. El alert puede renderizarse antes de que finalice `useTransition`. No hay cambios en producto/permisos/consentimiento de perfil.

Se preserva explícitamente la diferencia preexistente: builder excluye informes observados hace más de 90 días de su cálculo actual; inbox no añade esa ventana. No se reconcilia ni redefine esa política. Sin cambios de instrumentos, bandas, scoring, ventanas, frecuencia, modelos, dependencias, roles, historia SQL ni paquete de perfiles.

## TDD y logs completos

Logs privados completos bajo `/Users/miguelluque/git/serenia/.cache/pablo-pilot/logs/`. Todos los checks se invocaron con `.cache/pablo-pilot/project_checks.py run /Users/miguelluque/git/serenia -- ...`.

| Paso | Resultado | Log completo relativo al directorio anterior |
| --- | --- | --- |
| RED TS, nuevos casos antes del cambio | 13 fallos esperados: critical/high ocultos, probes sin failclosed, cronología/orden, notas perdidas, PHQ9 | `20261101-114640-osku0qd2.log` |
| Primer intento focal GREEN | 3 fallos: dos timeouts por retries SDK de respuesta 503 sintética y una expectativa heredada de PHQ9=18 como severo; corregida la fixture de error a 400 no reintentable y la expectativa canónica | `20261101-114749-hudj96og.log` |
| Focal GREEN | 177/177, ocho archivos: continuidad SDK, builder/render/cuestionarios, cross-session y paridad | `20261101-114857-6pycpfz0.log` |
| Edge cases GREEN adicionales | 85/85, filtros/fechas nulas, presupuesto/notas truncadas y acuerdos posteriores a observación | `20261101-115119-qbanlogt.log` |
| SQL intento restringido | Fallo de infraestructura: socket Docker denegado por sandbox; no se contó como RED de producto | `20261101-114835-5b9tn42d.log` |
| **RED SQL nativo** antes de crear el forward | Fallo esperado `CHRONOLOGY REGRESSION: late confirmation displaced later observed active session` | `20261101-114846-dyd2qy4h.log` |
| Primer SQL GREEN | Harness completo pasa; guard y cronología incluidos | `20261101-115025-o86mjpan.log` |
| **SQL GREEN final** | Harness completo pasa; ocho drifts rechazados atómicamente: cuerpo/config/owner/ACL/security/volatility/defaults/signature. Metadatos completos se comparan antes/después, sin diferencias aparte del cuerpo. Incluye confirmación tardía A/B y high posterior | `20261101-115227-szkq7pzn.log` |
| Suite completa restringida | 4 fallos de infraestructura en dependency-integration por EPERM al escuchar loopback; 1106 pasan | `20261101-114908-_l3eh0zi.log` |
| Suite completa con loopback autorizado | 1110/1110 antes de añadir tres edge cases | `20261101-114929-3oa01826.log` |
| Suite completa posterior | 1112 pasan, falla el test intermitente de transición de perfil descrito arriba; evidencia conservada | `20261101-115230-3tqxrw4n.log` |
| Diagnóstico focal perfil previo al ajuste | 26/26; confirma que el fallo depende del momento de fin de transición | `20261101-115304-8h7m1zhx.log` |
| **Suite completa GREEN final** tras el ajuste autorizado | **1113/1113, 89 archivos**; no se repitió después de este GREEN | `20261101-115336-qkpiy0aj.log` |
| **Lint final** | exit 0, cero warnings ESLint | `20261101-115347-twnfhl7l.log` |
| **Typecheck final** | exit 0 | `20261101-115347-omp9pxwm.log` |

La suite completa mantiene un `TimeoutNaNWarning` de Node en su salida, ya presente en el GREEN anterior; no se oculta ni se atribuye al código de evaluación. `git diff --check` pasó. El commit contiene sólo los 16 archivos de código/pruebas/forward preparados explícitamente; los documentos root permanecen sin staging.

## Forward SQL exacto

Archivo: `supabase/migrations/20261101104931_assessment_observed_chronology.sql`, creado con CLI local instalada después de consultar `migration new --help`.

- Bytes: **7215**.
- SHA-256 archivo: **`5ef4d9fcef5191dbe0959689ecf1a32358a77d17c327801cc1e3aaf7f833499b`**.
- Baseline body MD5: `9c91fd44e4c712465ebb44692b30c1da`.
- Baseline definition MD5: `50706695637b61aacecc5d31e14b4b8d`.
- Nuevo body MD5: **`9a5b7e54043035a657de3500907dcc84`**.
- Nueva definition MD5: **`8655ff635e6e3072366bd6625f51f755`**.
- Firma preservada: `public.get_clinician_inbox_page(integer,integer,boolean) returns jsonb`.
- Owner `postgres`, lenguaje `plpgsql`, stable/definer, `search_path=public, pg_temp`, ACL exacta `{postgres=X/postgres,authenticated=X/postgres}`. Guard previo rechaza sobrecargas o baseline inesperado; postguard verifica los hashes y metadatos pretendidos. El harness confirma la igualdad del resto del registro `pg_proc`.

Los hashes de definición se calcularon offline y después fueron comprobados por el postguard real en PostgreSQL 17.6 efímero del harness. La identidad actual del inbox remoto sólo procede del recibo oficial que root comunicó en el diseño; este agente no consultó servicios remotos.

## Límites de la evidencia

- Ningún candidato AQ1–AQ4 quedó refutado: hubo RED del comportamiento afectado y GREEN posterior. La corrección del orden padre de borradores comparte la causa demostrada de AQ3.
- La prueba del SDK real usa transporte ficticio y captura `order=observed_session(closed_at)...` en el padre, filtros y límites. El harness SQL prueba selección no vacía y la fecha suministrada al cálculo. No acredita por sí solo ejecución de esa consulta PostgREST contra servidor real; root anunció su comprobación alojada de sólo lectura sobre cuenta ficticia, todavía fuera de este informe.
- PostgreSQL efímero usa el shim `auth.uid()` del proyecto; no acredita GoTrue/JWT/servicio alojado ni operación clínica.
- No se leyeron `.env.local` ni credenciales, no se ejecutaron proveedores/modelos, ni se escribieron datos clínicos/remotos. Docker se ejecutó efímero y sin red; la suite sólo necesitó loopback para probes sintéticos existentes.
- No se ejecutaron build aislado, workflow wire, auditoría de dependencias o los siete gates finales en este turno: root los posee después de revisión. No se afirma despliegue, aprobación clínica ni eficacia.
