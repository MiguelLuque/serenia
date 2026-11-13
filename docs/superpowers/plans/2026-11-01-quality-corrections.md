# Quality correction plan

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

Spec: docs/superpowers/specs/2026-11-01-quality-corrections-design.md. Basee1c6725; branchcodex/pablo-profile-release; root integra con publicación autorizada existente.

Global constraints: cwd/Users/miguelluque/git/serenia; RTK+AGENTS+Next installed docs; no .env.local/secretos/patientdata/model/dependency/role/consent changes. No modificación del paquete perfil revisado ni migraciones históricas. Un implementer a la vez. Root owns hosted operations. Reports/audit cases live in .cache/profile-release-20261030/; distinguish static hypothesis, reproduced regression, local gates, hosted acceptance and clinical review.

Task1: corregir SQ1–SQ3 del informe session-quality-audit.md. RED primero, mínimo cambio, focusedGREEN+lint/types+suite, commit y review. Leer sesión cerrada propia; borrador/retry; reconciliación SSR coherente o delimitada que cubra ambos intercalados. No deduplicar texto intencional.

Task2: corregir cuatro candidatos assessment-quality-audit.md. RED por causa, timestamps observación/revisión separados en chat e inbox, evento crítico fuera del límite de detalle, fundamento acotado y hint canónico. Nueva migración forward sólo si necesaria con SQLtest/ACL/version exactos, nunca editar historia. Focused+suite; review.

Task3(root): revisión final del delta completo, siete gates+DB pertinentes, material Pablo actualizado, guardar auditoría/recibos sin secretos. Integrar con el plan de publicación pendiente y comprobar SHA/CI/Vercel/alias y login sin consentimiento. Provider403 y validación clínica explícitos si persisten.

Task3 adicional: corregir GHSA-g3hv-75wg-m249 con dependencias fijadas y remediación mínima compatible; consultar fuentes primarias/registro actuales, no rebajar gate, no downgrades Workflow2 ni override global incompatible. Revisar task independiente antes del final. Taskrootfinal pasa a4.

Task4 adicional: corregir guard del paquete PREPARED nunca aplicado para identidad estable de función de eventtrigger entre search_path, baseline oficial nuevo sin borrar anterior, regressions contexto+drift. Taskrootfinal pasa a5; Task3dependencias permaneceBLOCKED, no waiver/merge/deploy.
