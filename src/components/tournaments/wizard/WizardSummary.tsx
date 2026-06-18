import { Badge } from "@/components/ui/badge";
import {
  PRESETS_BY_KEY,
  type PresetKey,
  type PresetKnobs,
  type TournamentModality,
  type TournamentSport,
} from "@/lib/tournament-presets";
import type { ScoringProfile } from "@/lib/scoring-profile";
import { FORMAT_ICON_BY_PRESET } from "./FormatIcons";

interface Props {
  name: string;
  sport: TournamentSport;
  modality: TournamentModality;
  maxParticipants: number;
  presetKey: PresetKey;
  knobs: PresetKnobs;
  scoring: ScoringProfile;
  cuotaClp: string;
  cuotaOverridden: boolean;
  premios: string;
  premiosOverridden: boolean;
  americanoRoundsTarget: number;
}

const SCORING_PROFILE_LABEL = (s: ScoringProfile): string => {
  if (s.sets === 1) return `1 set a ${s.games_per_set}`;
  if (s.final_set === "super_tb10")
    return `Mejor de ${s.sets} · súper TB a 10 en el último`;
  return `Mejor de ${s.sets} sets a ${s.games_per_set}`;
};

const structureLabel = (
  presetKey: PresetKey,
  knobs: PresetKnobs,
  max: number,
  rounds: number,
): string => {
  switch (knobs.motor) {
    case "round_robin":
      return "todos contra todos";
    case "grupos_playoff": {
      const groupSize = max >= 16 ? 4 : 3;
      const groups = Math.max(2, Math.round(max / groupSize));
      return `${groups} grupos de ${groupSize}`;
    }
    case "americano_rotacion":
      return `${rounds} rondas con rotación`;
    case "consolacion":
      return "cuadro principal + consolación";
    case "doble_eliminacion":
      return "doble eliminación";
    default:
      return PRESETS_BY_KEY[presetKey].helper.toLowerCase();
  }
};

const rulesFor = (
  presetKey: PresetKey,
  knobs: PresetKnobs,
): { key: string; text: string }[] => {
  const base: Record<string, { key: string; text: string }[]> = {
    round_robin_liga: [
      { key: "A", text: "Al mejor de 3 sets · súper tie-break a 10 en el tercero." },
      { key: "B", text: "Gana quien sume más victorias en la tabla." },
      { key: "C", text: "Si dos jugadores empatan, gana quien lo enfrentó cara a cara." },
    ],
    grupos_playoff: [
      { key: "A", text: "Fase de grupos: todos contra todos dentro del grupo." },
      { key: "B", text: "Los 2 primeros de cada grupo clasifican al cuadro final." },
      { key: "C", text: "El cuadro final es por eliminación directa." },
    ],
    eliminacion_simple: [
      { key: "A", text: "El que pierde queda fuera del cuadro." },
      { key: "B", text: "Al mejor de 3 sets · tie-break a 7 en cada set." },
      { key: "C", text: "El campeón se define en la final." },
    ],
    consolacion: [
      { key: "A", text: "Eliminación simple en el cuadro principal." },
      { key: "B", text: "Quien pierde en primera ronda pasa al cuadro de consolación." },
      { key: "C", text: "Dos campeones: principal y consolación." },
    ],
    doble_eliminacion: [
      { key: "A", text: "Hace falta perder dos veces para quedar eliminado." },
      { key: "B", text: "Quien pierde en winners baja al cuadro de losers." },
      { key: "C", text: "Final entre el campeón de winners y el de losers." },
    ],
    americano_rotacion: [
      { key: "A", text: "Inscripción individual: cada ronda recompone parejas." },
      { key: "B", text: "No se repite compañero entre rondas mientras sea posible." },
      { key: "C", text: "Gana quien sume más juegos al final de las rondas." },
    ],
  };
  return (
    base[presetKey] ?? [
      { key: "A", text: PRESETS_BY_KEY[presetKey].helper },
      { key: "B", text: `Scoring: ${knobs.scoring.replace(/_/g, " ")}.` },
      { key: "C", text: "Reglas estándar del formato." },
    ]
  );
};

const SPORT_LABEL: Record<TournamentSport, string> = { tenis: "Tenis", padel: "Pádel" };
const MODALITY_LABEL: Record<TournamentModality, string> = {
  singles: "Singles",
  dobles: "Dobles",
};

export function WizardSummary(props: Props) {
  const {
    name,
    sport,
    modality,
    maxParticipants,
    presetKey,
    knobs,
    scoring,
    cuotaClp,
    cuotaOverridden,
    premios,
    premiosOverridden,
    americanoRoundsTarget,
  } = props;

  const preset = PRESETS_BY_KEY[presetKey];
  const Icon = FORMAT_ICON_BY_PRESET[presetKey];
  const structure = structureLabel(presetKey, knobs, maxParticipants, americanoRoundsTarget);
  const rules = rulesFor(presetKey, knobs);
  const cuotaText =
    cuotaClp.trim() === ""
      ? "Sin cuota"
      : `$${Number(cuotaClp).toLocaleString("es-CL")} CLP`;
  const premiosText = premios.trim() === "" ? "—" : premios;

  return (
    <div className="stagger space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
              {name} · {SPORT_LABEL[sport]} · {MODALITY_LABEL[modality]}
            </div>
            <div className="mt-1 font-serif text-2xl leading-tight text-foreground">
              {preset.label}
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              {maxParticipants} jugadores · {structure}
            </div>
          </div>
          <div className="flex h-16 w-16 flex-none items-center justify-center rounded-xl bg-primary/5 p-2 text-primary">
            <Icon />
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <SummaryCell label="Disciplina" value={`${SPORT_LABEL[sport]} ${MODALITY_LABEL[modality].toLowerCase()}`} />
          <SummaryCell label="Scoring" value={SCORING_PROFILE_LABEL(scoring)} />
          <SummaryCell
            label="Cuota"
            value={cuotaText}
            chip={cuotaOverridden ? "Propio" : "Heredado del evento"}
          />
          <SummaryCell
            label="Premios"
            value={premiosText}
            chip={premiosOverridden ? "Propio" : "Heredado del evento"}
          />
        </div>
      </div>

      <div>
        <div className="px-1 pb-2 font-mono text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
          Reglas del cuadro
        </div>
        <div className="stagger space-y-2">
          {rules.map((r) => (
            <div
              key={r.key}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground">
                {r.key}
              </div>
              <div className="text-[13px] leading-snug text-foreground">{r.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  chip,
}: {
  label: string;
  value: string;
  chip?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-2.5">
      <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] font-medium text-foreground">{value}</div>
      {chip && (
        <Badge variant="secondary" className="mt-1 text-[9px] uppercase tracking-wider">
          {chip}
        </Badge>
      )}
    </div>
  );
}