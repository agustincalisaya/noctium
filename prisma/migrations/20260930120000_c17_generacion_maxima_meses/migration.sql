-- HU-C-17: límite de generación en meses calendario (sin cambiar el schema).
INSERT INTO "parametros_sistema" ("clave", "valor")
VALUES ('generacion_maxima_meses', '6')
ON CONFLICT ("clave") DO UPDATE SET "valor" = EXCLUDED."valor";
