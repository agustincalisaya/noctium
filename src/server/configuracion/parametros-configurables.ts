export const CATALOGO = {
  plazo_pago_horas: { campo: "plazoPagoHoras", min: 1, max: 72, porDefecto: 24, unidad: "h" },
  cancelacion_anticipacion_horas: { campo: "cancelacionAnticipacionHoras", min: 1, max: 72, porDefecto: 24, unidad: "h" },
  umbral_presentismo: { campo: "umbralPresentismo", min: 1, max: 100, porDefecto: 75, unidad: "%" },
} as const;

export type ClaveConfigurable = keyof typeof CATALOGO;
export type CampoConfigurable = (typeof CATALOGO)[ClaveConfigurable]["campo"];
export const CLAVES_CONFIGURABLES = Object.keys(CATALOGO) as ClaveConfigurable[];
