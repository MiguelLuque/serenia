# Correcciones de calidad antes de publicar

Autorización del usuario1noviembre: buscar mejoras/errores, auditarlos y corregirlos. Continúa la publicación pendiente para Pablo; no sustituye su objetivo ni autoriza nuevos costes, modelos o correos.

La auditoría estática encontró siete candidatos en sesión y continuidad clínica. Cada corrección requiere reproducción RED, cambio mínimo y GREEN; un candidato refutado se documenta. Conservar permisos, idempotencia, tiempo autoritativo, scoring canónico y consentimiento propio. No introducir nuevos instrumentos, diagnóstico autónomo, prompts expansivos, dependencias ni roles.

Sesión: separar borrador del envío activo; al recuperar un retry no reaparece texto ya enviado, pero se conserva lo escrito después. La URL de una sesión propia cerrada permite leer su respuesta final con envío deshabilitado y navegación voluntaria. Al hidratar, reconciliar transcript/estado/recovery de modo que un commit entre consultas no deje la respuesta guardada oculta con estado listo; no basta invertir el orden de consultas sin comprobar la carrera inversa. No cargar sesiones de otro owner.

Evaluación: un evento crítico abierto no puede desaparecer de la decisión por el límite de diez detalles. Conservar incertidumbre/fundamento de riesgo en el contexto con presupuesto acotado. Mantener tiempo de observación de la sesión separado del de revisión: confirmar hoy contenido antiguo no es observar al paciente hoy ni debe desplazar una sesión posterior. Chat e inbox deben conservar la misma semántica temporal; si requiere SQL, nueva migración forward, sin modificar historia ni paquetes revisados. El recordatorio PHQ9 debe usar su banda canónica15–19 moderadamente severa; GAD7 conserva su banda distinta. No cambiar reglas de frecuencia ni inferir una resolución clínica nueva.

Despliegue: paquete de perfil ya revisado intacto. Una eventual corrección SQL adicional es paquete forward separado con target/baseline/guard/ACL exactos y prueba SQL; nunca se relaja preservación del primer paquete. Publicación automática desde main sólo después de revisión de los cambios y siete gates. Conversación con modelo real sigue pendiente de AI Gateway403 hasta decisión del usuario sobre acceso, sin cambios financieros implícitos.

## Gate de dependencias1noviembre

El audit vivo detectó GHSA-g3hv-75wg-m249 (minimatch<11.0.1), propagado a22entradas moderadas de producción. Se permite la remediación mínima y fijada necesaria para cumplir el gate cero-advisories, con compatibilidad de consumidores y wireprobada. Esta excepción concreta al alcance inicial sin dependencias no habilita upgrades generales, waivers, auditfixforce ni un override mayor global no compatible.

## Guard de migración sensible al contexto

El paquete preparado nunca llegó a aplicarse: al ejecutarlo, sólo la representación de funciones de eventtriggers cambió con search_path y provocó rollback. Se permite revisar su captura/comparación para usar identidad de esquema+nombre+argumentos estable, con testRED de ambos contextos y todos los guards de drift. Se conserva el baseline30oct del intento fallido y se añade baseline oficial1nov; fuentes DDL y paquetes históricos aplicados permanecen intactos. Main/deploy siguen bloqueados por el gate de dependencias; la preparación/aplicación DB segura e independiente puede completarse.
