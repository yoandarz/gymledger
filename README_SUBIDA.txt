GymLedger 2.0.11 — corrección del reloj flotante

Problema corregido:
- En tema oscuro, el valor del descanso flotante usaba var(--brand-ink), que es casi negro.
- La barra flotante tiene fondo oscuro, por lo que el reloj sí se actualizaba pero quedaba visualmente oculto.

Cambio:
- El reloj flotante ahora usa var(--text), visible tanto en tema claro como oscuro.
- No se modifica la lógica del temporizador ni el sonido.

Archivos a subir/reemplazar:
1. index.html
2. VERSION.txt
3. service-worker.js
4. js/constants.js
5. css/session-2.0.11.css (archivo nuevo)

No hace falta volver a subir js/views/sessions.js: la lógica de 2.0.10 ya es correcta.
Tampoco es necesario borrar css/session-2.0.10.css; quedará sin uso.
