# Release unblock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver los gates de dependencias y entregar el SQL con historial verificable antes de publicar el MVP.
**Architecture:** Adaptador mínimo de exports sobre minimatch oficial corregido y artefacto SQL separado con transacción/registro atómico. Los contratos de producto y fuentes revisadas se conservan.
**Tech Stack:** Node24.14.1/npm11, Next16.4.1, React19.3.1, PostgreSQL17, herramientas Vercel/Supabase existentes.
**Spec:** docs/superpowers/specs/2026-11-02-release-unblock-design.md

## Global Constraints

- Sin .env.local, lectura de secretos, compras, permisos globales o bypass de confirmaciones.
- Cero avisos audit full+prod; reglas y configuración de lint sin cambios.
- Paquete/fuentes de perfil intactos, una nueva fila de historial y ninguna modificación de las43anteriores.
- Aplicación alojada sólo root con preflight fresco y readback; sin replay ciego tras ambigüedad.
- Nueva selección Luna/Sol/OpenAI directo; revisión clínica pendiente y datos ficticios.

## Review Focus

- Paquete inesperado o segunda exportación manipulada no puede dejar una adaptación parcial.
- npm ci limpio reproduce el adaptador y conserva APIs modernas y legacy reales.
- Inserción o verificación de historial que falla revierte también tablas/ACL/funciones nuevas.
- Timeout o respuesta perdida no se trata como éxito ni permite reintento sin comprobar estado.
- Un segundo paso SSE preserva resultado de herramienta, límite de tokens, store false y replay.

### Task 1: Dependencia oficial corregida y compatibilidad de exports

**Files:** package.json/lock, scripts/restore-minimatch-legacy-api.mjs, tests/tooling/minimatch-compat.test.ts, docs/audits/2026-11-02-minimatch-compatibility.md.
**Interfaces:** postinstall sin argumentos, raíz relativa al script, sólo las dos exportaciones de la versión/hash aprobadas. No nuevo API de producto.

- [ ] Fijar versión corregida después de revisar el registro/experimento; prueba de consumidor legacy RED con dependencia sin adaptar.
- [ ] Tests de integridad/version/symlink/segundo archivo manipulado antes de escribir.
- [ ] Adaptador mínimo y npm ci; APIs reales CJS/ESM, React/a11y y límite de expansión GREEN.
- [ ] Auditoría estricta, suite y gates; revisión independiente del incremento antes de publicar.

### Task 2: Entrega manual de perfil atómica y registrada

**Files:** scripts/profile-dashboard-packet.mjs, scripts/test-profile-dashboard-packet.py, supabase/hosted/profile-dashboard-20261102.sql/.json, docs/audits/2026-11-02-profile-dashboard-delivery.md.
**Interfaces:** original profile-atomic.sql inmutable, wrapper PG17/50s con versión20261102122007; mapping real sólo root tras aplicación observada.

- [ ] Tests RED antes de generar el artefacto: éxito44, repeatreject, insertfail, postcheckfail y preservación de43.
- [ ] Generador/artefacto/manifest, timeout transaccional50s y exactitud bytes/hash; pruebas aisladas GREEN.
- [ ] Revisión independiente; probe ROLLBACK del editor autenticado, preflight fresco, ejecución exacta y readback.
- [ ] Forward de cronología revisado después del perfil, mapping y advisors/readback.

### Task 3: Aceptación y publicación

- [x] Caso SSE directo con herramienta/razonamiento/persistencia/replay PASS sin proveedor real.
- [ ] Verificación global y db:verify del código final; no reutilizar PASS del código anterior.
- [ ] Confirmar configuración de modelo/entorno y pasos alojados; integrar a main/desplegar sólo al superar sus gates.
- [ ] Actualizar PR, recibos y límites de aceptación para Pablo sin enviar otro correo no solicitado.
