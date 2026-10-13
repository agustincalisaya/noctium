-- HU-E-11 criterio 5: conservar originales y registrar la anulación aparte.
CREATE TABLE "anulaciones_clase_dictada" (
  "idAnulacionClase" TEXT NOT NULL PRIMARY KEY,
  "claseDictadaId" TEXT NOT NULL,
  "anuladoAnterior" BOOLEAN NOT NULL DEFAULT false,
  "anuladoNuevo" BOOLEAN NOT NULL DEFAULT true,
  CHECK (NOT "anuladoAnterior" AND "anuladoNuevo"),
  "motivo" VARCHAR(300) NOT NULL,
  "createdAtAnulacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "creadoPorUsuarioId" TEXT,
  CONSTRAINT "anulaciones_clase_dictada_claseDictadaId_fkey" FOREIGN KEY ("claseDictadaId")
    REFERENCES "clases_dictadas"("idClaseDictada") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "anulaciones_clase_dictada_claseDictadaId_key"
  ON "anulaciones_clase_dictada"("claseDictadaId");

-- Migrar la auditoría previa sin reescribir ni borrar ninguna clase.
INSERT INTO "anulaciones_clase_dictada"
  ("idAnulacionClase", "claseDictadaId", "motivo", "createdAtAnulacion", "creadoPorUsuarioId")
SELECT 'legacy-' || "idClaseDictada", "idClaseDictada", COALESCE("motivoAnulacion", ''),
  "anuladaEl", "anuladaPorUsuarioId"
FROM "clases_dictadas" WHERE "anuladaEl" IS NOT NULL;

-- La unicidad dinámica no puede ser un índice parcial que consulte otra tabla.
-- Una proyección transaccional mantiene una única clase vigente por turno.
CREATE TABLE "clases_dictadas_vigentes" (
  "turnoId" TEXT NOT NULL PRIMARY KEY,
  "claseDictadaId" TEXT NOT NULL,
  CONSTRAINT "clases_dictadas_vigentes_claseDictadaId_fkey" FOREIGN KEY ("claseDictadaId")
    REFERENCES "clases_dictadas"("idClaseDictada") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "clases_dictadas_vigentes_claseDictadaId_key"
  ON "clases_dictadas_vigentes"("claseDictadaId");
INSERT INTO "clases_dictadas_vigentes" ("turnoId", "claseDictadaId")
SELECT "turnoId", "idClaseDictada" FROM "clases_dictadas" WHERE "anuladaEl" IS NULL;
DROP INDEX "clases_dictadas_turno_no_anulada_key";

CREATE FUNCTION "sincronizar_clase_dictada_vigente"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."anuladaEl" IS NULL AND NOT EXISTS (
    SELECT 1 FROM "anulaciones_clase_dictada" WHERE "claseDictadaId" = NEW."idClaseDictada"
  ) THEN
    INSERT INTO "clases_dictadas_vigentes" ("turnoId", "claseDictadaId")
    VALUES (NEW."turnoId", NEW."idClaseDictada");
  ELSE
    DELETE FROM "clases_dictadas_vigentes" WHERE "claseDictadaId" = NEW."idClaseDictada";
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "clase_dictada_insertada" AFTER INSERT ON "clases_dictadas"
  FOR EACH ROW EXECUTE FUNCTION "sincronizar_clase_dictada_vigente"();
-- Compatibilidad con escrituras de marcas históricas; la aplicación nueva no las usa.
CREATE TRIGGER "clase_dictada_marca_legacy" AFTER UPDATE OF "anuladaEl" ON "clases_dictadas"
  FOR EACH ROW WHEN (OLD."anuladaEl" IS DISTINCT FROM NEW."anuladaEl")
  EXECUTE FUNCTION "sincronizar_clase_dictada_vigente"();

CREATE FUNCTION "liberar_clase_dictada_anulada"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM "clases_dictadas_vigentes" WHERE "claseDictadaId" = NEW."claseDictadaId";
  RETURN NEW;
END;
$$;
CREATE TRIGGER "clase_dictada_anulada" AFTER INSERT ON "anulaciones_clase_dictada"
  FOR EACH ROW EXECUTE FUNCTION "liberar_clase_dictada_anulada"();
