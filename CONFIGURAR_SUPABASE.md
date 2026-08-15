# Configurar Supabase · GymLedger 2.0.5

## Estado actual

GymLedger reutiliza el mismo proyecto de Supabase ya utilizado por GigPlan y WorkCycle. No se crea un proyecto nuevo.

El script `supabase/setup.sql` crea únicamente recursos `gymledger_*`, con RLS por usuario y contador atómico para códigos `EX-####`.

La Project URL y la Publishable Key públicas ya están incorporadas en `js/cloud-config.js`. En un dispositivo nuevo basta con iniciar sesión.

## Si hay que reconstruir la configuración

1. Entrar al proyecto compartido de Supabase.
2. Abrir SQL Editor.
3. Ejecutar todo `supabase/setup.sql`.
4. Comprobar `Success. No rows returned`.
5. Si la URL o Publishable Key cambian, actualizar `js/cloud-config.js` o sobrescribirlas temporalmente desde Ajustes.
6. Nunca usar `service_role`, secret keys ni credenciales administrativas en el cliente.

## Identificadores de ejercicio

- `EX-0001..EX-0022`: biblioteca inicial reservada.
- Ejercicios nuevos: `EX-0023+`, asignados por Supabase al sincronizar.
- El UUID interno existe desde la creación local; el código `EX-####` es el identificador estable para intercambio con ChatGPT.
