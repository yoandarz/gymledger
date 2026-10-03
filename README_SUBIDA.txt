GYMLEDGER 2.0.10 · ARCHIVOS PARA SUBIDA MANUAL

Cambios incluidos:
1. Barra flotante visible durante toda la sesión activa.
   - Muestra ejercicios completados / total.
   - Muestra el descanso restante cuando hay temporizador activo.
   - Permanece visible aunque se haga scroll hasta los últimos ejercicios.
2. Alarma de descanso más fuerte.
   - Mismo tono, misma secuencia y misma duración.
   - Solo aumenta la ganancia del sonido (0.18 -> 0.42).
3. Versión actualizada a 2.0.10 y caché PWA renovada.

Subir/reemplazar en GitHub respetando estas rutas:
- /index.html
- /VERSION.txt
- /service-worker.js
- /js/constants.js
- /js/views/sessions.js
- /css/session-2.0.10.css  (archivo NUEVO)

No hace falta borrar /css/session-2.0.9.css. Queda sin uso tras actualizar index.html y service-worker.js.

Después de publicar:
- Abrir GymLedger.
- Si aparece "Nueva actualización disponible", pulsar "Actualizar ahora".
- Verificar que la cabecera muestre v2.0.10.
- Iniciar una sesión y confirmar que la barra flotante muestra, por ejemplo, 0/7 y Descanso —.
- Marcar una serie: debe mostrar la cuenta atrás en la barra.
- Hacer scroll hasta el último ejercicio: la barra debe seguir visible.
- Probar la alarma con YouTube/música al volumen normal de uso y confirmar que mantiene el mismo sonido pero se oye con mayor claridad.
