export const INCIDENT_TYPES = Object.freeze([
  {
    code: "atraco",
    name: "Atraco",
    description: "Robo mediante amenaza o violencia.",
    severity: 4,
  },
  {
    code: "homicidio",
    name: "Homicidio",
    description: "Muerte violenta reportada.",
    severity: 5,
  },
  {
    code: "robo",
    name: "Robo",
    description: "Sustraccion de bienes con fuerza.",
    severity: 3,
  },
  {
    code: "hurto",
    name: "Hurto",
    description: "Sustraccion de bienes sin violencia.",
    severity: 2,
  },
  {
    code: "agresion",
    name: "Agresion",
    description: "Ataque fisico o amenaza directa.",
    severity: 4,
  },
  {
    code: "secuestro",
    name: "Secuestro",
    description: "Privacion ilegal de la libertad.",
    severity: 5,
  },
  {
    code: "extorsion",
    name: "Extorsion",
    description: "Exigencia mediante amenaza o coaccion.",
    severity: 4,
  },
  {
    code: "violencia_sexual",
    name: "Violencia sexual",
    description: "Hecho relacionado con violencia sexual.",
    severity: 5,
  },
  {
    code: "violencia_intrafamiliar",
    name: "Violencia intrafamiliar",
    description: "Violencia dentro del entorno familiar.",
    severity: 4,
  },
  {
    code: "vandalismo",
    name: "Vandalismo",
    description: "Dano deliberado a bienes publicos o privados.",
    severity: 2,
  },
  {
    code: "actividad_sospechosa",
    name: "Actividad sospechosa",
    description: "Situacion inusual que requiere atencion comunitaria.",
    severity: 1,
  },
  {
    code: "otro",
    name: "Otro",
    description: "Incidente que no corresponde a otra categoria.",
    severity: 1,
  },
]);

export const INCIDENT_TYPE_CODES = Object.freeze(
  INCIDENT_TYPES.map(({ code }) => code),
);

export const SENSITIVE_INCIDENT_TYPES = new Set([
  "secuestro",
  "violencia_sexual",
  "violencia_intrafamiliar",
]);

export function incidentTypeDefinition(code) {
  return INCIDENT_TYPES.find((incidentType) => incidentType.code === code);
}
