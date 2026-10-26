# Publicación de la prueba supervisada de Pablo

26-10-2026. Autorización del usuario: integrar cambios en main, publicar automáticamente en Vercel, crear una cuenta ficticia de paciente y enviar a Pablo sus credenciales e instrucciones. No amplía el alcance clínico ni autoriza dar acceso clínico a esa cuenta.

## Destino verificado

- GitHub: `MiguelLuque/serenia`, rama de producción `main`.
- Vercel: `serenia`, proyecto `prj_YbY1hykOMF1YPAW4auniJddSn0QR`, equipo `team_cQ1syb16Rg80lHZ77BLTXoLJ` (`miguelluques-projects`). Enlace GitHub y productionBranch=main verificados por API autenticada.
- Supabase: `brpozobkoatabctjjadc`. Sólo una cuenta nueva ficticia, creada por Auth Admin API; no se modifican SQL, roles clínicos, datos ni cuentas existentes.

## Activación acotada

La prohibición inicial de usar el piloto en production se conserva salvo esta excepción explícita de revisión en Vercel:

1. `FEATURE_CLINICAL_CONVERSATION_PILOT=on`.
2. `CLINICAL_PILOT_REVIEW_USER_IDS` contiene sólo UUID de **Auth users de prueba** expresamente autorizados, separados por comas. No admite comodines, emails, IDs de filas de perfil ni valores inválidos.
3. En producción, `VERCEL=1` y el usuario autenticado de la sesión debe estar en la lista. El caller pasa identidad validada por Auth o el propietario de la sesión que procesa el workflow. Un cuerpo de petición, metadata editable o preferencia del navegador no eligen variante.
4. Sin identidad o fuera de la lista se usa la referencia; configuración on incompleta/inválida falla cerrada. Flag off desactiva el piloto.

Chat e informe usan la misma identidad del propietario. La cuenta de prueba conserva rol paciente y sus permisos normales. No se promueve a clínico para revisar otros usuarios. Los criterios de interpretación siguen pendientes de prueba profesional.

Mantener la continuidad configurada según el entorno revisado. No publicar secretos ni credenciales de cuenta en Git, logs, PR o documentación; guardar el manifiesto de la cuenta fuera de Git con permisos privados y entregar la contraseña sólo al destinatario autorizado.

## Secuencia de publicación

1. Revisar tests de allowlist y propagación de identidad, revisión independiente, lint/tipos y gates nativos del proyecto.
2. Preparar la cuenta ficticia y verificar su login por API de Auth; leer sólo el perfil recién creado. No explorar perfiles de pacientes para buscar cuentas de prueba.
3. Configurar el UUID nuevo y flags en el proyecto/entorno exactos antes de activar el piloto. Credenciales de servicios se mantienen en Vercel; no se rotan ni se sustituyen por placeholders.
4. Fast-forward de main desde la rama revisada si sigue siendo descendiente de origin/main. No force-push ni elusión de protecciones. Push autorizado a main dispara la integración Git existente.
5. Verificar que Vercel construye el SHA publicado y alcanza READY; comprobar URL/alias, autenticación y acceso de prueba. No equiparar READY a calidad de conversación o validación clínica.
6. Completar mensaje con URL y credenciales verificadas, casos prioritarios y límites; enviar a la dirección exacta de Pablo, sin inferir destinatario por nombre.

## Estado de esta anotación

Configuración Git y destino comprobados. Credencial Vercel renovada por el usuario. Creada una única cuenta nueva de rol paciente y verificado su login/sign-out; perfil pendiente de onboarding, sin aceptar consentimientos por Pablo. Flags de producción configurados sólo para su UUID; continuidad existente verificada on. Test de configuración/identidad69/69 y revisión independiente del delta sin hallazgos materiales. Release y CI/despliegue se registrarán con sus resultados efectivos al finalizar. La lectura de perfiles reales solicitada inicialmente fue rechazada por revisión automática; se abandonó y se sustituyó por creación de una cuenta ficticia autorizada por el usuario.

Última instrucción sobre correo: el destinatario aún no se conoce; guardar como borrador y **no enviar**. El borrador privado puede contener las credenciales autorizadas; el documento en Git sólo mantiene instrucciones/plantilla sin contraseñas.

## Compatibilidad con el plan Hobby

El primer despliegue Git de `6ba0c7c` fue rechazado antes de compilar por el cron `*/15 * * * *`. Se adapta a `0 8 * * *` (una vez al día, horaUTC) para mantener el plan existente. [Vercel documenta el límite diario y la precisión horaria de Hobby](https://vercel.com/docs/cron-jobs/usage-and-pricing).

La limpieza de sesiones abandonadas puede demorarse hasta el siguiente barrido; no se promete un cierre en15min ni respuesta clínica por cron. Para las pruebas se recomienda cerrar manualmente cada sesión y comprobar su informe. El límite técnico de conversación sigue aplicándose al admitir turnos. `CRON_SECRET` debe existir como secreto de producción para autenticar la llamada de Vercel; no se publica su valor. Esta adaptación no cambia bandas, criterios de urgencia o permisos.
