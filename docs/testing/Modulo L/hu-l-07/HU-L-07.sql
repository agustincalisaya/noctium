-- HU-L-07: exclusivamente una base nueva y descartable noctium_pruebas_<8 hex>.
-- Aplicar solo las migraciones existentes mediante el runner autorizado.
-- No ejecutar en la base de desarrollo ni sobre datos de negocio cotidianos.
-- Preparación: crear materias con el alta existente o las fábricas del test PG;
-- definir tarifa individual/masiva mediante API y conservar los ids para filtrar.
-- La preparación y el precio congelado son reproducibles en materia.tarifas-masivo.pg.test.ts.

DO $$
BEGIN
  IF current_database() !~ '^noctium_pruebas_[0-9a-f]{8}$' THEN
    RAISE EXCEPTION 'Esta comprobación exige una base nueva descartable';
  END IF;
END $$;

-- Lista completa de activas, en el mismo orden que GET.
SELECT "idMateria", "nombreMateria", "codigoMateria", "tarifaHoraMateria",
       "activaMateria", version, "updatedAtMateria", "modificadoPorUsuarioId"
FROM materias
WHERE "activaMateria" = true
ORDER BY "nombreNormalizadaMateria", "idMateria";

-- Inactivas: comparar con el snapshot anterior al POST; deben conservar tarifa.
SELECT "idMateria", "nombreMateria", "tarifaHoraMateria"
FROM materias WHERE "activaMateria" = false;

-- Historial por actualizada: anterior nullable, nueva, actor, fecha y masivo.
SELECT "materiaId", "tarifaAnterior", "tarifaNueva", "usuarioId", fecha, masivo
FROM historial_tarifas
ORDER BY fecha, "materiaId", "idHistorialTarifa";

-- Cada operación masiva comparte fecha; solo las que cambiaron dejan fila.
SELECT fecha, "usuarioId", "tarifaNueva", count(*) AS materias_actualizadas,
       bool_and(masivo) AS todas_masivas
FROM historial_tarifas
WHERE masivo = true
GROUP BY fecha, "usuarioId", "tarifaNueva"
ORDER BY fecha;

-- Precio guardado: registrar resultado antes/después del cambio y del cobro.
-- La prueba PG compara filas completas y usa C/I para crear nuevas inscripciones.
SELECT "idInscripcion", "turnoId", "alumnoId", precio, vigencia, "estadoPago"
FROM turno_alumno
ORDER BY "idInscripcion";

-- Permiso real: exactamente GERENTE; no se agrega permiso con esta entrega.
SELECT "rolPermiso", "accionPermiso"
FROM roles_permisos
WHERE "accionPermiso" = 'materias:cambiar_tarifa'
ORDER BY "rolPermiso";

-- Rollback/no-op: comparar snapshot anterior y posterior de materias e historial.
-- Los tests PG automatizan esa comparación, sin DELETE ni limpieza de datos existentes.
