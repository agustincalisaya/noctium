import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const m=vi.hoisted(()=>({permiso:vi.fn(),detalle:vi.fn(),historico:vi.fn()}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw new Error(`REDIRECT ${url}`);}}));
vi.mock("@/server/shared/with-permission",()=>({exigirPermiso:m.permiso,verificarPermiso:m.permiso,PermisoError:class extends Error{status=403;}}));
vi.mock("@/server/turnos/turno.detalle",()=>({obtenerDetalleTurno:m.detalle}));
vi.mock("@/server/historial/historial.publico",()=>({profesorPuedeRegistrarIndicacion:m.historico}));
vi.mock("@/app/(dashboard)/alumnos/[id]/historial-academico",()=>({HistorialAcademico:({alumnoId,materiaInicial}:{alumnoId:string;materiaInicial:string})=><div data-alumno={alumnoId} data-materia={materiaInicial}>Historial acotado</div>}));
import Page from "./page";
beforeEach(()=>{vi.clearAllMocks();m.permiso.mockResolvedValue({id:"u",rol:"PROFESOR"});m.detalle.mockResolvedValue({resultado:"ok",turno:{materia_id:"m",profesor_id:"p",alumnos:[{id:"a",puede_ver_historial:true}]}});m.historico.mockResolvedValue(false);});
const props={params:Promise.resolve({id:"t",alumnoId:"a"})};
describe("E02 historial acotado desde clase",()=>{
 it("renderiza alcance materia sin ficha ni redirección general",async()=>{const html=renderToStaticMarkup(await Page(props));expect(html).toContain('data-materia="m"');expect(html).toContain('href="/turnos/t"');expect(html).not.toMatch(/DNI|Contacto|Pagos|\/alumnos\/a/);});
 it("admite alumno histórico de esa materia y clase propia",async()=>{m.detalle.mockResolvedValue({resultado:"ok",turno:{materia_id:"m",profesor_id:"p",alumnos:[]}});m.historico.mockResolvedValue(true);expect(renderToStaticMarkup(await Page(props))).toContain("Historial acotado");});
 it("rechaza otro turno o alumno",async()=>{m.detalle.mockResolvedValue({resultado:"sin_permiso"});await expect(Page(props)).rejects.toThrow("/sin-permiso");m.detalle.mockResolvedValue({resultado:"ok",turno:{materia_id:"m",profesor_id:"p",alumnos:[]}});await expect(Page(props)).rejects.toThrow("/sin-permiso");});
 it("rechaza rol distinto de Profesor",async()=>{m.permiso.mockResolvedValue({id:"u",rol:"GERENTE"});await expect(Page(props)).rejects.toThrow("/sin-permiso");expect(m.detalle).not.toHaveBeenCalled();});
});
