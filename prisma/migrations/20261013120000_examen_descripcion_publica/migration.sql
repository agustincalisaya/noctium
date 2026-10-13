-- Sin copiar observaciones históricas: pueden contener información interna.
ALTER TABLE "resultados_examen" ADD COLUMN "descripcionPublica" VARCHAR(1000);
