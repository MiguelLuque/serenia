# Tiempo y cierre de sesión: contrato verificable

27-10-2026. Base ebe41d1; rama codex/session-time-boundaries. Petición: arreglar consciencia del tiempo, avisos y cierre temporal sin perder conversación o señales nuevas.

- Conservar60min máximos y30min de inactividad. El servidor controla admisión/cierre; el contador orienta desde una muestra de hora servidor, sin certificar cierre por sí mismo.
- Dar al agente estado temporal en cada generación, también antes de los últimos10min; avisar con proporción, sin insistir cada turno ni abrir trabajo largo al final.
- Comprobar de nuevo antes de generar. Un turno admitido antes del plazo puede terminar dentro de su timeout existente; si cruza el límite, conservar su respuesta y añadir cierre temporal confirmado en la misma persistencia. No iniciar una generación posterior fuera del plazo.
- Conservar prioridad de seguridad, último texto admitido, recuperación/replay e idempotencia del informe. Una señal nueva sigue el camino de seguridad existente antes del cierre.
- La UI distingue tiempo agotado/cierre pendiente y cierre persistido. Confirmar el cierre mediante resultado servidor, no reloj. Cierre explícito por tiempo sin redirección que borre borradores; no cerrar desde SSR antes de recuperar un turno en curso.
- Permitir reintento del mismo turno al vencer; no admite nuevas conversaciones ordinarias. Mantener visible/copiar el borrador al cerrar, incluidas señales urgentes escritas mientras llega una respuesta.
- Comprobar inactividad al retomar un turno ordinario mediante el resolver SQL existente; no anteponer cierre ordinario a registrar una señal de seguridad. No prometer cierre puntual en segundo plano: cronHobby sigue diario.
- Sin migraciones, cambios clínicos/de modelos, envío automático de borradores ni publicación en esta ronda.

El cierre manual es una decisión explícita; no se introduce un cierre automático desde el navegador. Un fallo de cierre no se presenta como éxito. Las comprobaciones de pendientes del servidor evitan el caso conocido de recargar con una respuesta en curso; no se declara una garantía nueva de cierre global entre dispositivos sin cambiar SQL.
