# Minimatch corregido y compatibilidad de consumidores

El advisory [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) afecta a versiones anteriores a 11.0.1. El lock fija la versión oficial 11.0.4 en el grafo; la auditoría sigue exigiendo cero avisos, sin excepciones ni manipular los informes. Node permanece fijado a 24.14.1. El paquete conserva el algoritmo oficial corregido; el proyecto mantiene una adaptación propia y limitada para consumidores antiguos.

`postinstall` valida la versión, rechaza enlaces simbólicos en las rutas de instalación y comprueba los hashes SHA-256 originales de ambos archivos antes de modificar cualquiera:

- `dist/commonjs/index.js`: `235c5458355f1449cc100f1cea1a43d45f788a4feb524a83497aa146bea88f32`.
- `dist/esm/index.js`: `b238ca70371b1f192817ae9516afaacb566d1df2a7a85e47c6c24f41f1707864`.

Añade únicamente la exportación CommonJS invocable y la exportación ESM por defecto. Una segunda ejecución acepta sólo el contenido original o el original con el sufijo exacto, por lo que es idempotente y falla ante cambios inesperados. No es una garantía de equivalencia de todas las opciones de minimatch 3. Una actualización necesita revisar la versión, el código, los hashes y los consumidores; instalaciones con scripts desactivados no son aceptables como build del proyecto.

Los tests dirigidos verifican plugins reales de React y accesibilidad, exportaciones CommonJS/ESM, una regresión acotada de expansión, repetición, versión incorrecta, archivo modificado y enlace simbólico. La suite también cubre el segundo paso simulado del transporte directo OpenAI con herramienta, persistencia y repetición; no realiza llamadas al proveedor. En un experimento aislado se compararon además 405 patrones representativos y la configuración normalizada de 113 reglas de ESLint en tres archivos. Estas muestras no prueban equivalencia universal ni validación clínica.

ESLint 9.39.4 emite un aviso de versión sin soporte durante la instalación; su actualización requiere trabajo de compatibilidad separado. Los gates completos y la auditoría deben ejecutarse sobre el commit final; este documento no convierte ensayos aislados en aceptación de despliegue.

El 2 de noviembre la instalación limpia con scripts terminó correctamente y la auditoría estricta informó cero avisos en producción y árbol completo. Las pruebas dirigidas (22), lint y tipos pasaron en el checkout; la aceptación completa sigue sujeta a los gates del commit final.
