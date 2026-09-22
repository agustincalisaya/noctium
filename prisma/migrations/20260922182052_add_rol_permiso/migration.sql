-- CreateTable
CREATE TABLE "roles_permisos" (
    "idPermiso" TEXT NOT NULL,
    "rolPermiso" "RolUsuario" NOT NULL,
    "accionPermiso" TEXT NOT NULL,
    "creadoEnPermiso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_permisos_pkey" PRIMARY KEY ("idPermiso")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_permisos_rolPermiso_accionPermiso_key" ON "roles_permisos"("rolPermiso", "accionPermiso");
