import { describe,it,expect } from "vitest";
import { ajustarPeriodo } from "./filtro-periodo";
describe("ajustarPeriodo",()=>{
 it("ajusta hasta a un desde posterior",()=>expect(ajustarPeriodo({desde:"2026-01",hasta:"2026-06"},"desde","2026-10")).toEqual({desde:"2026-10",hasta:"2026-10"}));
 it("ajusta desde a un hasta anterior",()=>expect(ajustarPeriodo({desde:"2026-01",hasta:"2026-06"},"hasta","2025-10")).toEqual({desde:"2025-10",hasta:"2025-10"}));
 it("máximo inclusivo 24 meses en ambos extremos",()=>{expect(ajustarPeriodo({desde:"2026-01",hasta:"2026-06"},"hasta","2028-01")).toEqual({desde:"2026-02",hasta:"2028-01"});expect(ajustarPeriodo({desde:"2026-01",hasta:"2026-06"},"desde","2024-01")).toEqual({desde:"2024-01",hasta:"2025-12"});});
});
