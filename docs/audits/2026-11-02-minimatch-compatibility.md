# Minimatch corregido y compatibilidad de consumidores

El advisory [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) afecta a versiones anteriores a 11.0.1. El lock fija la versión oficial 11.0.4 en el grafo; la auditoría sigue exigiendo cero avisos, sin excepciones ni manipular los informes. Node permanece fijado a 24.14.1. El paquete conserva el algoritmo oficial corregido; el proyecto mantiene una adaptación propia y limitada para consumidores antiguos.

`postinstall` valida las versiones, rechaza enlaces simbólicos en las rutas de instalación y comprueba los hashes SHA-256 originales de todos los archivos presentes antes de modificar cualquiera. El plugin es de desarrollo y puede faltar en una instalación solo de producción:

- `dist/commonjs/index.js`: `235c5458355f1449cc100f1cea1a43d45f788a4feb524a83497aa146bea88f32`.
- `dist/esm/index.js`: `b238ca70371b1f192817ae9516afaacb566d1df2a7a85e47c6c24f41f1707864`.
- `eslint-plugin-import@2.32.0/lib/rules/no-internal-modules.js`: `f36ab9b9b97cc2d8a49f8fe474c4200875db4fa357c5061fe71538b01db696a4`.

Añade la exportación CommonJS invocable y la exportación ESM por defecto. Además, adapta las dos llamadas de una regla de `eslint-plugin-import` al comparador oficial, ya que minimatch 11 no ofrece `makeRe`. Una segunda ejecución acepta sólo los archivos originales o las transformaciones exactas, por lo que es idempotente y falla ante cambios inesperados. No es una garantía de equivalencia de todas las opciones de minimatch 3. Una actualización necesita revisar la versión, el código, los hashes y los consumidores; instalaciones con scripts desactivados no son aceptables como build del proyecto.

Los tests dirigidos verifican plugins reales de React, accesibilidad e importación, exportaciones CommonJS/ESM, una regresión acotada de expansión, repetición, versión incorrecta, archivo modificado y enlace simbólico. La suite también cubre el segundo paso simulado del transporte directo OpenAI con herramienta, persistencia y repetición; no realiza llamadas al proveedor. En un experimento aislado se compararon además 405 patrones representativos y la configuración normalizada de 113 reglas de ESLint en tres archivos. Estas muestras no prueban equivalencia universal ni validación clínica.

ESLint 9.39.4 emite un aviso de versión sin soporte durante la instalación; su actualización requiere trabajo de compatibilidad separado. Los gates completos y la auditoría deben ejecutarse sobre el commit final; este documento no convierte ensayos aislados en aceptación de despliegue.

El 2 de noviembre la instalación limpia completa con scripts terminó correctamente y la auditoría estricta informó cero avisos en producción y árbol completo. Una instalación `npm ci --omit=dev` independiente también terminó y pudo repetir el adaptador. Tras la revisión de compatibilidad pasaron 26 pruebas dirigidas, lint y tipos en el checkout; la aceptación completa sigue sujeta a los gates del commit final.
