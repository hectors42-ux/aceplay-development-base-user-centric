export interface FormatTableRow {
  key: string;
  value: string;
}

export interface RuleTemplate {
  key: string;
  label: string;
  descriptive_md: string;
  format_table_json: FormatTableRow[];
  key_rules_md: string;
  tiebreak_rules_md: string;
  player_guide_md: string;
  operator_guide_md: string;
  image_rights_md: string;
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    key: "americana_social",
    label: "Americana social (pádel/tenis)",
    descriptive_md:
      "Una americana social es un torneo donde las parejas rotan en cada ronda: juegas con un compañero distinto cada vez y los puntos se acumulan a tu nombre, no a la pareja. Es rápido, social y todos juegan todas las rondas — ideal para activación con influencers.",
    format_table_json: [
      { key: "Formato", value: "Americana social" },
      { key: "Disciplina", value: "Pádel dobles" },
      { key: "Jugadores", value: "80 individuales (40 parejas)" },
      { key: "Canchas", value: "6 reservadas por sesión" },
      { key: "Sesiones", value: "2 (Mié & Jue) · 18-22h" },
      { key: "Rondas", value: "7 en total" },
      { key: "Puntaje", value: "A 24 puntos sin ventaja" },
      { key: "Gana", value: "Suma individual más alta" },
    ],
    key_rules_md:
      "- El sorteo arma las parejas de cada ronda al azar.\n- Cada partido se juega a 24 puntos, sin ventaja.\n- Ambas parejas validan el resultado al final del partido.\n- Faltar a una ronda afecta a tu pareja: confirma tus sesiones con anticipación.",
    tiebreak_rules_md:
      "- En empate de puntos individuales, gana el jugador con mejor diferencia.\n- Si persiste el empate, decide el head-to-head del último cruce.\n- Premiación: top 3 individuales reciben reconocimiento.",
    player_guide_md:
      "1. **Inscríbete desde el inicio**\n   Reserva tu cupo apenas se abran las inscripciones.\n2. **Confirma tu disponibilidad**\n   Marca las sesiones a las que sí vas a llegar.\n3. **Llega 15 minutos antes**\n   Para revisar el bracket y conocer a tu pareja de la ronda.\n4. **Juega tu partido**\n   Sigue las reglas del formato y respeta el cronograma.\n5. **Valida el resultado**\n   Ambas parejas confirman desde la app al terminar.\n6. **Revisa tu ranking**\n   Tu posición se actualiza en vivo entre rondas.",
    operator_guide_md:
      "1. **Abre la sesión** desde el panel de operador.\n2. **Llama parejas a sus canchas** según el bracket de la ronda.\n3. **Cierra la ronda** cuando todos los partidos estén validados.\n4. **Resuelve disputas** con captura del marcador físico.\n5. **Comparte el ranking** al cierre de cada ronda.",
    image_rights_md:
      "Al inscribirte aceptas que el organizador y sus partners pueden usar tu imagen y resultados con fines de difusión deportiva del torneo en redes y medios. No se cederá tu imagen a terceros sin tu consentimiento.",
  },
  {
    key: "grupos_playoff",
    label: "Grupos + eliminación directa",
    descriptive_md:
      "Torneo de fase de grupos seguido de eliminación directa, estilo Mundial. Garantiza que todas las parejas jueguen varios partidos antes de los cruces decisivos.",
    format_table_json: [
      { key: "Formato", value: "Grupos + eliminación directa" },
      { key: "Disciplina", value: "Pádel dobles" },
      { key: "Jugadores", value: "40 (20 parejas)" },
      { key: "Estructura", value: "4 grupos de 5 parejas · 2 clasifican" },
      { key: "Rondas", value: "Grupos + cuartos + semis + final" },
      { key: "Puntaje", value: "Al set con punto de oro (40-40 sin ventaja)" },
      { key: "Calendario", value: "4 días" },
    ],
    key_rules_md:
      "- **Punto de oro:** en 40–40 el punto se define con una sola bola, sin ventaja.\n- **Fase de grupos:** 5 parejas por grupo, todos contra todos.\n- **Clasificación:** los 2 primeros de cada grupo avanzan a cuartos.\n- **Eliminación directa:** desde cuartos, quien pierde queda fuera.",
    tiebreak_rules_md:
      "- Empate de puntos en grupos: diferencia de games.\n- Persiste empate: head-to-head.\n- Persiste empate: sorteo o set extra a discreción del organizador.",
    player_guide_md:
      "1. **Confirma tu pareja**\n   La inscripción es por pareja para este formato.\n2. **Revisa tu grupo**\n   Verás tus 4 rivales al cierre de inscripciones.\n3. **Juega tus partidos de grupo**\n   Coordina con tus rivales en los días asignados.\n4. **Clasifica a cuartos**\n   Top 2 de cada grupo avanzan.\n5. **Eliminación directa**\n   Una sola vida desde cuartos.\n6. **Premiación**\n   Los 4 finalistas suben al podio.",
    operator_guide_md:
      "1. **Cierra inscripciones** y arma los grupos por sorteo.\n2. **Publica el calendario** de fase de grupos.\n3. **Valida resultados** ronda a ronda.\n4. **Genera el bracket de cuartos** cuando termine la fase de grupos.\n5. **Coordina la final** en cancha central.",
    image_rights_md:
      "Al inscribirte aceptas el uso de tu imagen y resultados por parte del organizador y sus partners para difusión del torneo.",
  },
  {
    key: "eliminacion_simple",
    label: "Eliminación simple",
    descriptive_md:
      "Cuadro de eliminación directa: pierdes y quedas fuera. Formato clásico, rápido de organizar y con cruces decisivos desde la primera ronda.",
    format_table_json: [
      { key: "Formato", value: "Eliminación simple" },
      { key: "Disciplina", value: "Tenis singles" },
      { key: "Jugadores", value: "16 o 32" },
      { key: "Rondas", value: "Octavos · cuartos · semis · final" },
      { key: "Puntaje", value: "Mejor de 3 sets con tiebreak" },
      { key: "Premio", value: "Trofeo a campeón y finalista" },
    ],
    key_rules_md:
      "- Cuadro generado por seeding del ranking interno.\n- Quien pierde queda eliminado.\n- Los partidos se juegan al mejor de 3 sets.\n- Walkover si un jugador no se presenta 15 minutos después de la hora.",
    tiebreak_rules_md:
      "- Tiebreak a 7 puntos en 6–6 de cada set.\n- Súper tiebreak a 10 reemplaza el tercer set si así lo decide el organizador.",
    player_guide_md:
      "1. **Revisa el cuadro**\n   Mira a tu próximo rival y la cancha asignada.\n2. **Coordina horario**\n   Confirma con tu rival y el organizador.\n3. **Juega tu partido**\n   Llega con tiempo y respeta el código deportivo.\n4. **Valida el resultado**\n   Reporta el marcador al admin al terminar.\n5. **Avanza a la próxima ronda**\n   Tu nombre se mueve en el bracket si ganas.\n6. **Final**\n   La final se juega en cancha central con público.",
    operator_guide_md:
      "1. **Genera el cuadro** con seeding por ranking.\n2. **Programa los partidos** con horario y cancha.\n3. **Valida resultados** y avanza los ganadores.\n4. **Notifica walkovers** y resuelve disputas.\n5. **Coordina la final** y la premiación.",
    image_rights_md:
      "Al inscribirte aceptas el uso de tu imagen y resultados por parte del organizador para fines de difusión del torneo.",
  },
];

export const getRuleTemplate = (key: string): RuleTemplate | null =>
  RULE_TEMPLATES.find((t) => t.key === key) ?? null;