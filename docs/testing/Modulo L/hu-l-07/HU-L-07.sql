-- HU-L-07: comprobación de solo lectura con aserciones.
-- Ejecutar exclusivamente en una base nueva y descartable noctium_pruebas_<8 hex>, con las migraciones
-- existentes, DESPUÉS de recorrer el cambio masivo con la colección Postman de esta carpeta. No ejecutar
-- sobre la base de desarrollo ni sobre datos cotidianos.
-- Cualquier aserción que falle aborta el script con un mensaje que empieza con su número (A1…A9):
--   psql -v ON_ERROR_STOP=1 -d noctium_pruebas_<8 hex> -f HU-L-07.sql
--
-- Datos que deja el recorrido de Postman y que esta comprobación necesita:
--   * al menos un cambio masivo confirmado que haya actualizado 2 o más materias (entre las seleccionadas
--     puede haber otras «Sin cambio», que no deben dejar fila);
--   * una materia INACTIVA que no formó parte de ningún cambio exitoso: reemplazar abajo su id y la
--     tarifa que tenía antes del recorrido (la variable materiaInactivaId de la colección; escribir
--     null si no tenía tarifa).
-- Las inscripciones previas al cambio se verifican si existen; si la base del recorrido no tiene
-- ninguna, A8 informa 0 verificadas (el precio congelado lo cubre la prueba PG con los servicios de
-- Turnos y Pagos).

BEGIN READ ONLY;

DO $$
BEGIN
  IF current_database() !~ '^noctium_pruebas_[0-9a-f]{8}$' THEN
    RAISE EXCEPTION 'Esta comprobación exige una base nueva descartable';
  END IF;
END $$;

SELECT set_config('l07.materia_inactiva_id', '<MATERIA_INACTIVA_ID>', true);
SELECT set_config('l07.tarifa_inactiva_esperada', '<TARIFA_INACTIVA_ESPERADA>', true);

-- A1. El recorrido dejó al menos un cambio masivo (si no, el resto sería vacuamente cierto).
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM historial_tarifas WHERE masivo;
  IF n = 0 THEN RAISE EXCEPTION 'A1: no hay filas de historial con masivo = true'; END IF;
  RAISE NOTICE 'A1 ok: % filas de historial masivo', n;
END $$;

-- A2. Todas las filas de un mismo cambio masivo comparten fecha, usuario y tarifa nueva, y al menos
-- un cambio actualizó 2 o más materias con la misma fecha (una fecha por materia no sería común).
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT fecha FROM historial_tarifas WHERE masivo
    GROUP BY fecha
    HAVING count(DISTINCT "usuarioId") > 1 OR count(DISTINCT "tarifaNueva") > 1
  ) t;
  IF n > 0 THEN RAISE EXCEPTION 'A2: % fechas masivas con más de un usuario o más de una tarifa nueva', n; END IF;
  SELECT coalesce(max(filas), 0) INTO n FROM (
    SELECT count(*) AS filas FROM historial_tarifas WHERE masivo GROUP BY fecha
  ) t;
  IF n < 2 THEN RAISE EXCEPTION 'A2: ningún cambio masivo actualizó 2 o más materias con la misma fecha'; END IF;
  RAISE NOTICE 'A2 ok: fecha, usuario y tarifa nueva únicos por cambio masivo; el mayor actualizó % materias', n;
END $$;

-- A3. Una sola fila por materia en cada cambio masivo.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT "materiaId", fecha FROM historial_tarifas WHERE masivo
    GROUP BY "materiaId", fecha HAVING count(*) > 1
  ) t;
  IF n > 0 THEN RAISE EXCEPTION 'A3: % materias con más de una fila en el mismo cambio masivo', n; END IF;
  RAISE NOTICE 'A3 ok: una fila por materia y cambio';
END $$;

-- A4. «Sin cambio» no deja fila: ninguna fila masiva repite la tarifa que la materia ya tenía.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM historial_tarifas WHERE masivo AND "tarifaAnterior" = "tarifaNueva";
  IF n > 0 THEN RAISE EXCEPTION 'A4: % filas masivas con tarifa anterior igual a la nueva', n; END IF;
  RAISE NOTICE 'A4 ok: las materias sin cambio no dejaron historial';
END $$;

-- A5. El historial de cada materia es una cadena continua: la tarifa anterior de cada fila es la
-- nueva de la fila previa (la primera fila puede venir de una materia sin tarifa: null).
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM (
    SELECT "tarifaAnterior",
           lag("tarifaNueva") OVER (PARTITION BY "materiaId" ORDER BY fecha, "idHistorialTarifa") AS nueva_previa,
           row_number() OVER (PARTITION BY "materiaId" ORDER BY fecha, "idHistorialTarifa") AS orden
    FROM historial_tarifas
  ) c
  WHERE orden > 1 AND "tarifaAnterior" IS DISTINCT FROM nueva_previa;
  IF n > 0 THEN RAISE EXCEPTION 'A5: % filas de historial que no continúan la tarifa de la fila previa', n; END IF;
  RAISE NOTICE 'A5 ok: cadena de historial continua';
END $$;

-- A6. La tarifa vigente de toda materia con historial es la tarifa nueva de su última fila
-- (una tarifa cambiada sin su fila de historial, o al revés, rompe esta igualdad).
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM materias m
  JOIN LATERAL (
    SELECT h."tarifaNueva" FROM historial_tarifas h WHERE h."materiaId" = m."idMateria"
    ORDER BY h.fecha DESC, h."idHistorialTarifa" DESC LIMIT 1
  ) u ON true
  WHERE m."tarifaHoraMateria" IS DISTINCT FROM u."tarifaNueva";
  IF n > 0 THEN RAISE EXCEPTION 'A6: % materias cuya tarifa no coincide con su último historial', n; END IF;
  RAISE NOTICE 'A6 ok: tarifa vigente = último historial';
END $$;

-- A7. La materia inactiva conserva su tarifa y no tiene historial masivo.
DO $$
DECLARE
  id_inactiva text := current_setting('l07.materia_inactiva_id');
  esperada text := current_setting('l07.tarifa_inactiva_esperada');
  fila materias%ROWTYPE;
  masivas integer;
BEGIN
  IF id_inactiva LIKE '<%' OR esperada LIKE '<%' THEN
    RAISE EXCEPTION 'A7: reemplazar <MATERIA_INACTIVA_ID> y <TARIFA_INACTIVA_ESPERADA> (con los signos < >) al inicio del script';
  END IF;
  SELECT * INTO fila FROM materias WHERE "idMateria" = id_inactiva;
  IF NOT FOUND THEN RAISE EXCEPTION 'A7: no existe la materia %', id_inactiva; END IF;
  IF fila."activaMateria" THEN RAISE EXCEPTION 'A7: la materia % está activa', id_inactiva; END IF;
  IF fila."tarifaHoraMateria"::text IS DISTINCT FROM NULLIF(esperada, 'null') THEN
    RAISE EXCEPTION 'A7: la inactiva tiene tarifa % y se esperaba %', fila."tarifaHoraMateria", esperada;
  END IF;
  SELECT count(*) INTO masivas FROM historial_tarifas WHERE "materiaId" = id_inactiva AND masivo;
  IF masivas > 0 THEN RAISE EXCEPTION 'A7: la inactiva tiene % filas de historial masivo', masivas; END IF;
  RAISE NOTICE 'A7 ok: la inactiva conserva tarifa % y no tiene historial masivo', esperada;
END $$;

-- A8. Las inscripciones creadas antes de un cambio masivo conservan el precio de la tarifa que
-- regía al reservar: precio = tarifa de entonces × duración / 60. La tarifa de entonces es la
-- nueva de la última fila de historial anterior a la reserva o, si no hay, la anterior de la
-- primera fila posterior. Supone que la duración de la clase no se modificó después de reservar.
DO $$
DECLARE
  verificadas integer;
  incorrectas integer;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE precio * 60 <> tarifa_entonces * duracion) INTO verificadas, incorrectas
  FROM (
    SELECT i.precio, t."duracionMinutosTurno" AS duracion,
      COALESCE(
        (SELECT h."tarifaNueva" FROM historial_tarifas h
          WHERE h."materiaId" = t."materiaId" AND h.fecha <= i."reservadaEl"
          ORDER BY h.fecha DESC, h."idHistorialTarifa" DESC LIMIT 1),
        (SELECT h."tarifaAnterior" FROM historial_tarifas h
          WHERE h."materiaId" = t."materiaId" AND h.fecha > i."reservadaEl"
          ORDER BY h.fecha, h."idHistorialTarifa" LIMIT 1)
      ) AS tarifa_entonces
    FROM turno_alumno i JOIN turnos t ON t."idTurno" = i."turnoId"
    WHERE EXISTS (
      SELECT 1 FROM historial_tarifas h
      WHERE h."materiaId" = t."materiaId" AND h.masivo AND h.fecha > i."reservadaEl"
    )
  ) previas
  WHERE tarifa_entonces IS NOT NULL;
  IF incorrectas > 0 THEN
    RAISE EXCEPTION 'A8: % de % inscripciones previas a un cambio masivo no conservan su precio', incorrectas, verificadas;
  END IF;
  RAISE NOTICE 'A8 ok: % inscripciones previas a un cambio masivo con precio intacto', verificadas;
END $$;

-- A9. Permiso real: exactamente GERENTE puede cambiar tarifas.
DO $$
DECLARE roles text;
BEGIN
  SELECT string_agg("rolPermiso"::text, ',' ORDER BY "rolPermiso"::text) INTO roles
  FROM roles_permisos WHERE "accionPermiso" = 'materias:cambiar_tarifa';
  IF roles IS DISTINCT FROM 'GERENTE' THEN
    RAISE EXCEPTION 'A9: materias:cambiar_tarifa está asignado a % y debe ser solo GERENTE', coalesce(roles, '(nadie)');
  END IF;
  RAISE NOTICE 'A9 ok: permiso solo de GERENTE';
END $$;

-- Detalle para revisión manual de lo que se acaba de asertar.
-- Cambios masivos: uno por fecha, con la cantidad de materias que cambiaron.
SELECT fecha, "usuarioId", "tarifaNueva", count(*) AS materias_actualizadas, bool_and(masivo) AS todas_masivas
FROM historial_tarifas WHERE masivo
GROUP BY fecha, "usuarioId", "tarifaNueva" ORDER BY fecha;

-- Historial completo, en el orden en que se registró.
SELECT "materiaId", "tarifaAnterior", "tarifaNueva", "usuarioId", fecha, masivo
FROM historial_tarifas ORDER BY fecha, "materiaId", "idHistorialTarifa";

-- Materias con su tarifa vigente; las inactivas no se listan en el modal y conservan la suya.
SELECT "idMateria", "nombreMateria", "codigoMateria", "tarifaHoraMateria", "activaMateria",
       version, "updatedAtMateria", "modificadoPorUsuarioId"
FROM materias ORDER BY "activaMateria" DESC, "nombreNormalizadaMateria", "idMateria";

ROLLBACK;
