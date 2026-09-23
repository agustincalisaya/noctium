-- Orden natural de Aula.nombre (spec_modulo_K.md §2.2, HU-K-02 criterio 2):
-- "Aula 2" antes que "Aula 10". Verificado en HU-K-01 que ni la collation ni
-- la columna existían todavía — se aplica acá, sobre datos ya poblados.
CREATE COLLATION IF NOT EXISTS natural_es (provider = icu, locale = 'es-u-kn-true');

-- AlterTable
ALTER TABLE "aulas" ALTER COLUMN "nombreAula" TYPE VARCHAR(30) COLLATE "natural_es";
