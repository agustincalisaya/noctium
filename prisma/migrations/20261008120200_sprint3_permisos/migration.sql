-- ============================================================
-- Sprint 3 — PR 0: matriz RBAC completa (PR-0.md §2.9 y §2.9.1,
-- spec_modulo_A.md §2.4 + §2.8). Deja en una base SIN seed exactamente la
-- misma matriz que `PERMISOS` de prisma/seed.ts.
--
--  1. Pasa a migración las acciones que hasta ahora solo sembraba el seed
--     (sesion:ping, materias:crear/leer, aulas:crear/leer, alumnos:crear,
--     profesores:crear, calendario:leer).
--  2. Corrige profesores:*: las migraciones 20260923015526 y 20260923200000
--     se las daban a GERENTE y ninguna a MESA_ENTRADA, al revés de la spec.
--     Queda crear/editar solo de M y leer de M y G (convención 8 d).
--  3. Convención 8 g: el PROFESOR pierde alumnos:leer en el mismo cambio en
--     que gana su acceso acotado al historial (helper del módulo E); el
--     GERENTE gana alumnos:leer (consulta).
--  4. Agrega todas las acciones nuevas del sprint (tabla cerrada).
-- roles_permisos es configuración (no una entidad de dominio): quitar una
-- fila es la forma de revocar una acción, como ya hacía el seed.
-- ============================================================
BEGIN;

DELETE FROM "roles_permisos"
WHERE ("rolPermiso" = 'PROFESOR' AND "accionPermiso" = 'alumnos:leer')
   OR ("rolPermiso" <> 'MESA_ENTRADA' AND "accionPermiso" IN ('profesores:crear', 'profesores:editar'));

INSERT INTO "roles_permisos" ("idPermiso", "rolPermiso", "accionPermiso", "creadoEnPermiso")
SELECT 's3-' || lower(rol) || '-' || replace(replace(accion, ':', '-'), '_', '-'), rol::"RolUsuario", accion, now()
FROM (VALUES
  -- 1. Acciones que solo estaban en el seed
  ('MESA_ENTRADA', 'sesion:ping'), ('GERENTE', 'sesion:ping'),
  ('PROFESOR', 'sesion:ping'), ('ALUMNO', 'sesion:ping'),
  ('GERENTE', 'materias:crear'),
  ('MESA_ENTRADA', 'materias:leer'), ('GERENTE', 'materias:leer'), ('PROFESOR', 'materias:leer'),
  ('GERENTE', 'aulas:crear'), ('GERENTE', 'aulas:leer'),
  ('MESA_ENTRADA', 'alumnos:crear'),
  ('MESA_ENTRADA', 'calendario:leer'), ('GERENTE', 'calendario:leer'), ('PROFESOR', 'calendario:leer'),
  -- 2. Profesores (HU-D-01..08)
  ('MESA_ENTRADA', 'profesores:crear'),
  ('MESA_ENTRADA', 'profesores:editar'),
  ('MESA_ENTRADA', 'profesores:leer'), ('GERENTE', 'profesores:leer'),
  -- 3. Alumnos en consulta para el Gerente (HU-E-02 criterio 8)
  ('GERENTE', 'alumnos:leer'),
  -- 4. Acciones nuevas del Sprint 3 (tabla cerrada de PR-0.md §2.9.1)
  ('MESA_ENTRADA', 'cuenta:cambiar_password'), ('GERENTE', 'cuenta:cambiar_password'),
  ('PROFESOR', 'cuenta:cambiar_password'), ('ALUMNO', 'cuenta:cambiar_password'),
  ('MESA_ENTRADA', 'observaciones:registrar'), ('PROFESOR', 'observaciones:registrar'),
  ('MESA_ENTRADA', 'indicaciones:registrar'), ('PROFESOR', 'indicaciones:registrar'),
  ('MESA_ENTRADA', 'examenes:corregir'), ('PROFESOR', 'examenes:corregir'),
  ('MESA_ENTRADA', 'clases:corregir'), ('PROFESOR', 'clases:corregir'),
  ('ALUMNO', 'historial:leer_propio'),
  ('ALUMNO', 'turnos:cancelar_propia'),
  ('MESA_ENTRADA', 'reservas:leer'),
  ('MESA_ENTRADA', 'pagos:corregir'), ('GERENTE', 'pagos:corregir'),
  ('ALUMNO', 'pagos:leer_propios'),
  ('MESA_ENTRADA', 'comprobantes:leer'), ('GERENTE', 'comprobantes:leer'),
  ('ALUMNO', 'comprobantes:leer_propios'),
  ('MESA_ENTRADA', 'cajas:abrir'), ('MESA_ENTRADA', 'cajas:movimiento'),
  ('MESA_ENTRADA', 'cajas:cerrar'), ('MESA_ENTRADA', 'cajas:leer'),
  ('GERENTE', 'cajas:leer_todas'), ('GERENTE', 'cajas:cerrar_ausencia'),
  ('GERENTE', 'formas_pago:editar'), ('GERENTE', 'formas_pago:desactivar'),
  ('GERENTE', 'materias:cambiar_tarifa'),
  ('MESA_ENTRADA', 'materias:ver_tarifa'),
  ('MESA_ENTRADA', 'alumnos:cambiar_estado'),
  ('GERENTE', 'profesores:cambiar_estado'),
  ('GERENTE', 'personal:crear'), ('GERENTE', 'personal:editar'),
  ('GERENTE', 'personal:leer'), ('GERENTE', 'personal:cambiar_estado'),
  ('GERENTE', 'gerentes:crear'), ('GERENTE', 'gerentes:editar'),
  ('GERENTE', 'gerentes:leer'), ('GERENTE', 'gerentes:cambiar_estado'),
  ('GERENTE', 'configuracion:leer'), ('GERENTE', 'configuracion:editar')
) AS p(rol, accion)
ON CONFLICT ("rolPermiso", "accionPermiso") DO NOTHING;

COMMIT;
