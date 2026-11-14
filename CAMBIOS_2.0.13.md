# GymLedger 2.0.13

- Búsqueda en tiempo real por nombre, código EX, músculo, zona y equipo (sin acentos y por varias palabras).
- Filtro por grupo muscular y ordenación ascendente/descendente por nombre/código; orden por zona muscular.
- Controles compartidos entre biblioteca y selector de ejercicios del editor de rutinas.
- NO cambia el orden manual de las rutinas ni modifica sesiones, identidades, historial, IndexedDB o Supabase.
- Versión, caché del service worker e importaciones actualizadas.

## Validación local

`node --test tests/exercise-search-tests.mjs`

Antes de publicar, comprobar manualmente creación/edición de rutina, filtro por músculos secundarios, búsqueda por acentos y funcionamiento sin conexión de la PWA.
