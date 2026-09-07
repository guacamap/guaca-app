import { z } from 'zod';
import type { Inference } from '@guaca/agents';
import type { SpotterMission } from '@guaca/db';

const ReplySchema = z.object({
  text: z.string().min(1).max(800),
  missionIds: z.array(z.string().uuid()).max(6),
});

export interface SpotterAskReply {
  text: string;
  missionIds: string[];
}

function line(m: SpotterMission, lang: 'en' | 'es'): string {
  const place = m.placeName ?? (lang === 'es' ? 'un lugar cercano' : 'a nearby place');
  const kind = m.taskKind === 'hours'
    ? (lang === 'es' ? 'horario' : 'hours')
    : m.taskKind === 'access'
      ? (lang === 'es' ? 'acceso' : 'access')
      : (lang === 'es' ? 'evidencia' : 'a photo check');
  const pts = `${m.rewardMinor} pts`;
  if (m.status === 'submitted' && !m.mine) {
    return lang === 'es'
      ? `${place}: falta un segundo local (${kind}, ${pts}).`
      : `${place}: waiting on a second local (${kind}, ${pts}).`;
  }
  if (m.status === 'accepted' && m.mine) {
    return lang === 'es'
      ? `${place}: ya la aceptaste. Toca para enviar evidencia (${kind}, ${pts}).`
      : `${place}: you already accepted this. Open it to send evidence (${kind}, ${pts}).`;
  }
  return lang === 'es'
    ? `${place}: ${kind} por comprobar (${pts}).`
    : `${place}: ${kind} to check (${pts}).`;
}

/** Grounded, model-free brief so a recording take still works if inference is down. */
export function groundedSpotterAsk(
  missions: SpotterMission[],
  text: string,
  lang: 'en' | 'es',
): SpotterAskReply {
  const q = text.toLowerCase();
  const open = missions.filter((m) => m.status === 'offered' && m.mine);
  const mine = missions.filter((m) => m.mine && (m.status === 'accepted' || m.status === 'offered'));
  const witness = missions.filter((m) => m.status === 'submitted' && !m.mine);
  const breakfast = /breakfast|desayuno|hours|horario|mañana|morning/.test(q);
  const second = /second|witness|testigo|confirm|segundo/.test(q);
  const access = /beach|playa|access|acceso|fort[ií]n|entrance|entrada/.test(q);

  let picked: SpotterMission[] = [];
  if (breakfast) {
    picked = missions.filter((m) => m.taskKind === 'hours' && (m.status === 'offered' || m.status === 'accepted'));
  } else if (second) {
    picked = witness;
  } else if (access) {
    picked = missions.filter((m) => m.taskKind === 'access' && (m.status === 'offered' || m.status === 'accepted'));
  } else {
    picked = [...mine.filter((m) => m.status === 'accepted'), ...open, ...witness].slice(0, 4);
  }

  if (picked.length === 0) {
    return {
      text: lang === 'es'
        ? 'No hay un chequeo abierto que coincida. En el mapa, toca First visit o I\'m here para verificar un lugar que todavía no tiene misión.'
        : 'Nothing open matches that. On the map, use First visit or I\'m here to check a place that does not have a mission yet.',
      missionIds: [],
    };
  }

  const header = lang === 'es'
    ? 'Esto es lo que un local puede comprobar ahora, con lo que está en el mapa. No invento horarios ni digo que algo esté verificado.'
    : 'Here is what a local can check now, from the map. I do not invent hours or call anything locally verified.';
  const body = picked.map((m) => line(m, lang)).join(' ');
  return { text: `${header} ${body}`, missionIds: picked.map((m) => m.id) };
}

export async function answerSpotterAsk(
  missions: SpotterMission[],
  text: string,
  lang: 'en' | 'es',
  inference?: Inference,
): Promise<SpotterAskReply> {
  const grounded = groundedSpotterAsk(missions, text, lang);
  if (!inference) return grounded;
  const catalog = missions.slice(0, 12).map((m) => ({
    id: m.id,
    place: m.placeName,
    status: m.status,
    kind: m.taskKind,
    mine: m.mine,
    points: m.rewardMinor,
    brief: m.brief,
  }));
  try {
    const result = await inference.json({
      schema: ReplySchema,
      purpose: 'spotter-ask',
      maxOutputTokens: 280,
      system: lang === 'es'
        ? 'Eres Guaca para un Spotter en Puerto Cabello. Solo hablas de chequeos locales: horarios, acceso, evidencia, segundo testigo. Nunca inventes hechos verificados, horarios, precios ni un itinerario de turista. Responde en español, breve. missionIds solo de la lista.'
        : 'You are Guaca for a Spotter in Puerto Cabello. Only talk about local checks: hours, access, evidence, second witness. Never invent verified facts, hours, prices, or a tourist itinerary. Short English. missionIds only from the list.',
      user: `Missions:\n${JSON.stringify(catalog)}\n\nGrounded fallback:\n${grounded.text}`,
      untrusted: text,
    });
    const allowed = new Set(missions.map((m) => m.id));
    return {
      text: result.raw.text,
      missionIds: result.raw.missionIds.filter((id) => allowed.has(id)),
    };
  } catch {
    return grounded;
  }
}
