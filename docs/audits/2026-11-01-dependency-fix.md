# Dependencias: bloqueo de compatibilidad 1 noviembre 2026

Estado: **BLOQUEADO, sin remediación aplicada**. Base inspeccionada `3d83bb771835b28b0a292df52375d3b57f836616`; Node24.14.1/npm11.11.0. No se ha cambiado package.json, lock, node_modules del proyecto, configuración/reglas ESLint ni gate. Esta evidencia no permite publicar.

## Causa y grafo

El [advisory oficial GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) declara afectadas todas las versiones `<11.0.1`; no ofrece una rama legacy corregida. La [corrección upstream77a0f5c](https://github.com/isaacs/minimatch/commit/77a0f5c) limita expansión de `**/..` con braceExpandMax y evita la deduplicación cuadrática de conjuntos grandes.

El audit de referencia conserva22entradas moderadas en producción y37en full; son propagación de un solo advisory, no22/37vulnerabilidades independientes. minimatch aparece en producción por @swc/cli9.0.9, filelist5.1.9 y el nodo raíz10.2.6 (versiones de minimatch). Full añade seis copias3.1.5 en ESLint/plugins. Resultado original: production y full exit1, fixAvailable:false.

## Alternativas investigadas

Consultas actuales al registro público, con HOME/cache privados y user/global config vacíos, sin credenciales:

| Consumidor | Última versión consultada | Requisito minimatch | Resultado |
|---|---|---|---|
| eslint, rama9 | 9.39.5 | ^3.1.5 | El patch no elimina el hallazgo |
| eslint, latest | 10.14.0 | ^10.2.6 | Un major amplio tampoco adopta11 y no elimina plugins legacy |
| @eslint/eslintrc | 3.3.7 | ^3.1.5 | Ya instalado; sin padre corregido |
| eslint-plugin-import | 2.32.0 | ^3.1.2 | Ya instalado; llama export callable |
| eslint-plugin-jsx-a11y | 6.10.2 | ^3.1.2 | Ya instalado; llama export callable |
| eslint-plugin-react | 7.37.5 | ^3.1.2 | Ya instalado; llama export callable |
| filelist | 2.0.2 | ^10.2.1 | Cambiarlo requiere major y override11; insuficiente para full |
| @swc/cli | 0.8.2 | ^9.0.3 | Sin adopción11 |
| @oclif/core | 5.1.11 | ^10.2.5 | Major innecesario; sin adopción11 |
| @vercel/queue | 0.10.0 | ^10.2.4 | Sin adopción11 |
| @typescript-eslint/typescript-estree | 8.72.1 | ^10.2.2 | Sin adopción11 |

Fuentes primarias: [ESLint](https://registry.npmjs.org/eslint), [import](https://registry.npmjs.org/eslint-plugin-import), [jsx-a11y](https://registry.npmjs.org/eslint-plugin-jsx-a11y), [react](https://registry.npmjs.org/eslint-plugin-react), [minimatch](https://registry.npmjs.org/minimatch). Últimas versiones publicadas de minimatch por major investigado:3.1.5,5.1.9,9.0.9,10.2.6; todas siguen dentro del rango declarado afectado. Primera versión corregida11.0.1; latest11.0.3.

No se probó un override global en el proyecto: se cargaron los módulos reales del consumidor en memoria, sustituyendo únicamente su resolución de minimatch por una instalación temporal pristine11.0.1. Los demás requires conservaron la resolución original. Eso reproduce el contrato roto sin mutar node_modules ni el lock.

## Pruebas acotadas

`/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-task3-E6jl4y/compat.cjs` y `compat.log`, exit0, verifican con assert:

- Regla real React `jsx-pascal-case`, JSX `const el = <App_x />`, opción ignore `App*`: baseline devuelve cero errores; con11.0.1 lanza `TypeError: minimatch is not a function`.
- Helper real jsx-a11y `mayContainChildComponent`, hijo CustomInput y patrón Custom*: baseline true; con11.0.1 lanza TypeError.
- Amplificación: child separado, heap128MiB, timeout3s, patrón de12repeticiones `**/../a/b`, optimizationLevel2 y braceExpandMax64. Baseline10.2.6 crea4096sets;11.0.1 crea64. Ambos terminan exit0. Es reproducción del límite de amplificación concreto, no prueba universal DoS.

## Evidencia y decisión

Comandos de verificación ejecutados desde el repositorio (sin cambios de dependencias):

```sh
rtk proxy node /var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-task3-E6jl4y/compat.cjs
rtk proxy node /private/tmp/serenia-task3-evidence.cjs
```

El segundo ejecuta el gate original `node scripts/audit-dependencies.mjs` con su entorno privado existente. Resultado vivo repetido: production22moderate, full37moderate, cero high/critical; ambos npm exit1, gate exit1. JSON/stderr/exits exactos en `audit/`, salida gate en `audit.log` y `audit.exit.json`. El exit0 del script orquestador de evidencia no equivale a pasar el gate: el exit real del gate está guardado explícitamente.

Evidencia privada completa: `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-task3-E6jl4y`. `registry.log` contiene metadata; `fixed/package-lock.json` identifica la instalación temporal. Audit original: `/var/folders/3q/lq4c_t8s06v_jc64x_vv3f980000gn/T/serenia-verify-ulJbyy/audit-production.json` y `audit-full.json`.

No hay camino compatible disponible mediante pins/parents publicados que conserve los consumidores legacy y satisfaga cero advisories en full. Overrides11sólo sobre consumidores modernos no resuelven los paquetes legacy. Cambiar todos a11rompe código real; retirar reglas/plugins relaja aceptación. No se ha creado fork/adapter, downgradeWorkflow2, waiver ni auditfixforce.

La remediación completa requiere un backport oficial que el advisory reconozca o padres compatibles publicados; alternativamente, una ampliación explícita para un adaptador/fork mantenido y revisado o una migración de lint que preserve reglas. Eso queda fuera de esta tarea mínima. Suite/lint/types/wire/build no se presentan como validación de un cambio inexistente; root conserva revisión y siete gates antes de publicar. El gate de auditoría permanece RED.

Root conservó copia privada estable de los probes/logs/audit JSON y lock temporal (sin node_modules ni configuración global) en .cache/profile-release-20261030/dependency-blocker-evidence, con manifest de tamaños/SHA256. No sustituye el gate RED ni instala otra dependencia del proyecto.
