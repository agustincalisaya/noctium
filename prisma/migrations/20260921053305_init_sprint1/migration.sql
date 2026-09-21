-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('ALUMNO', 'PROFESOR');

-- CreateEnum
CREATE TYPE "FormaPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'DEBITO', 'MERCADO_PAGO');

-- CreateEnum
CREATE TYPE "DiaSemana" AS ENUM ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO');

-- CreateEnum
CREATE TYPE "DuracionTurno" AS ENUM ('UNA_HORA', 'DOS_HORAS', 'TRES_HORAS');

-- CreateTable
CREATE TABLE "usuarios" (
    "idUsuario" TEXT NOT NULL,
    "emailUsuario" TEXT NOT NULL,
    "passwordHashUsuario" TEXT NOT NULL,
    "rolUsuario" "RolUsuario" NOT NULL,
    "createdAtUsuario" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtUsuario" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("idUsuario")
);

-- CreateTable
CREATE TABLE "alumnos" (
    "idAlumno" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombreAlumno" TEXT NOT NULL,
    "apellidoAlumno" TEXT NOT NULL,
    "dniAlumno" TEXT NOT NULL,
    "telefonoAlumno" TEXT NOT NULL,
    "emailAlumno" TEXT NOT NULL,
    "direccionAlumno" TEXT,
    "formaPagoPreferidaAlumno" "FormaPago" NOT NULL,
    "createdAtAlumno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtAlumno" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alumnos_pkey" PRIMARY KEY ("idAlumno")
);

-- CreateTable
CREATE TABLE "profesores" (
    "idProfesor" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nombreProfesor" TEXT NOT NULL,
    "apellidoProfesor" TEXT NOT NULL,
    "dniProfesor" TEXT NOT NULL,
    "telefonoProfesor" TEXT NOT NULL,
    "emailProfesor" TEXT NOT NULL,
    "direccionProfesor" TEXT,
    "createdAtProfesor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtProfesor" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profesores_pkey" PRIMARY KEY ("idProfesor")
);

-- CreateTable
CREATE TABLE "horarios_profesor" (
    "idHorario" TEXT NOT NULL,
    "profesorId" TEXT NOT NULL,
    "diaSemanaHorario" "DiaSemana" NOT NULL,
    "horaDesdeHorario" TIME NOT NULL,
    "horaHastaHorario" TIME NOT NULL,

    CONSTRAINT "horarios_profesor_pkey" PRIMARY KEY ("idHorario")
);

-- CreateTable
CREATE TABLE "materias" (
    "idMateria" TEXT NOT NULL,
    "nombreMateria" TEXT NOT NULL,
    "codigoMateria" TEXT,

    CONSTRAINT "materias_pkey" PRIMARY KEY ("idMateria")
);

-- CreateTable
CREATE TABLE "profesor_materia" (
    "profesorId" TEXT NOT NULL,
    "materiaId" TEXT NOT NULL,

    CONSTRAINT "profesor_materia_pkey" PRIMARY KEY ("profesorId","materiaId")
);

-- CreateTable
CREATE TABLE "aulas" (
    "idAula" TEXT NOT NULL,
    "nombreAula" TEXT NOT NULL,
    "capacidadAula" INTEGER NOT NULL,

    CONSTRAINT "aulas_pkey" PRIMARY KEY ("idAula")
);

-- CreateTable
CREATE TABLE "turnos" (
    "idTurno" TEXT NOT NULL,
    "fechaTurno" DATE NOT NULL,
    "horaInicioTurno" TIME NOT NULL,
    "duracionTurno" "DuracionTurno" NOT NULL,
    "materiaId" TEXT NOT NULL,
    "profesorId" TEXT NOT NULL,
    "aulaId" TEXT NOT NULL,
    "createdAtTurno" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAtTurno" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("idTurno")
);

-- CreateTable
CREATE TABLE "turno_alumno" (
    "turnoId" TEXT NOT NULL,
    "alumnoId" TEXT NOT NULL,

    CONSTRAINT "turno_alumno_pkey" PRIMARY KEY ("turnoId","alumnoId")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_emailUsuario_key" ON "usuarios"("emailUsuario");

-- CreateIndex
CREATE UNIQUE INDEX "alumnos_usuarioId_key" ON "alumnos"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "alumnos_dniAlumno_key" ON "alumnos"("dniAlumno");

-- CreateIndex
CREATE UNIQUE INDEX "profesores_usuarioId_key" ON "profesores"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "profesores_dniProfesor_key" ON "profesores"("dniProfesor");

-- CreateIndex
CREATE UNIQUE INDEX "materias_nombreMateria_key" ON "materias"("nombreMateria");

-- CreateIndex
CREATE UNIQUE INDEX "materias_codigoMateria_key" ON "materias"("codigoMateria");

-- CreateIndex
CREATE UNIQUE INDEX "aulas_nombreAula_key" ON "aulas"("nombreAula");

-- AddForeignKey
ALTER TABLE "alumnos" ADD CONSTRAINT "alumnos_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("idUsuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profesores" ADD CONSTRAINT "profesores_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("idUsuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "horarios_profesor" ADD CONSTRAINT "horarios_profesor_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "profesores"("idProfesor") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profesor_materia" ADD CONSTRAINT "profesor_materia_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "profesores"("idProfesor") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profesor_materia" ADD CONSTRAINT "profesor_materia_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "materias"("idMateria") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_materiaId_fkey" FOREIGN KEY ("materiaId") REFERENCES "materias"("idMateria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "profesores"("idProfesor") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_aulaId_fkey" FOREIGN KEY ("aulaId") REFERENCES "aulas"("idAula") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno_alumno" ADD CONSTRAINT "turno_alumno_turnoId_fkey" FOREIGN KEY ("turnoId") REFERENCES "turnos"("idTurno") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turno_alumno" ADD CONSTRAINT "turno_alumno_alumnoId_fkey" FOREIGN KEY ("alumnoId") REFERENCES "alumnos"("idAlumno") ON DELETE CASCADE ON UPDATE CASCADE;
