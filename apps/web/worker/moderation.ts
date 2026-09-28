import type { Env } from './env';

export type Verdict = {
  /** Risk of harm to the writer — goes to the safeguarding lead, never auto-cleared. */
  safety: boolean;
  /** Anything else the checks did not like — human review before it appears. */
  flagged: boolean;
  categories: string[];
  source: 'openai' | 'rules' | 'openai+rules';
};

// Deterministic rules run on every write, with or without OpenAI. They catch the
// two things this community cannot afford to miss: a girl at risk, and an adult
// trying to move a girl somewhere unwatched.
const SELF_HARM = [
  /\b(kill|hurt|cut|harm)\s+(myself|me)\b/i,
  /\bdon'?t\s+want\s+to\s+(be\s+here|live|exist)\b/i,
  /\b(end\s+it\s+all|suicid\w*|want\s+to\s+die|better\s+off\s+dead)\b/i,
  /\bno\s+reason\s+to\s+live\b/i,
  /\b(tired|sick)\s+of\s+(living|being\s+alive|it\s+all)\b/i,
  /\bnobody\s+would\s+(miss|notice)\s+(me|if\s+i)\b/i,
];
const GROOMING = [
  /\b(send|give)\s+me\s+your\s+(number|phone|address|pic|pics|photo|photos)\b/i,
  /\b(chat|talk|meet)\s+(somewhere|some\s+place)\s+else\b/i,
  /\b(whats\s?app|snap(chat)?|telegram|insta(gram)?|tiktok)\s+(me|id|handle)\b/i,
  /\bdon'?t\s+tell\s+(your|ur)\s+(mum|mom|mother|dad|father|parents?|mentor)\b/i,
  /\b(\+?233|0)[\s-]?[235]\d[\s-]?\d{3}[\s-]?\d{4}\b/, // Ghana phone numbers
];
const UNKIND = [/\b(stupid|ugly|fat|idiot|loser|dumb)\b/i];

export async function moderate(env: Env, input: string): Promise<Verdict> {
  // Phones type curly quotes; the rules are written with straight ones.
  const text = input.replace(/[‘’ʼ`]/g, "'").replace(/[“”]/g, '"');
  const categories: string[] = [];
  let safety = false;
  let flagged = false;

  if (SELF_HARM.some((r) => r.test(text))) { safety = true; categories.push('self-harm (rules)'); }
  if (GROOMING.some((r) => r.test(text))) { safety = true; categories.push('contact-off-platform (rules)'); }
  if (UNKIND.some((r) => r.test(text))) { flagged = true; categories.push('unkind (rules)'); }

  if (!env.OPENAI_API_KEY) return { safety, flagged, categories, source: 'rules' };

  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'omni-moderation-latest', input: text }),
    });
    if (!res.ok) throw new Error(`moderation ${res.status}`);
    const data = (await res.json()) as { results: { flagged: boolean; categories: Record<string, boolean> }[] };
    const r = data.results[0];
    for (const [k, v] of Object.entries(r.categories)) {
      if (!v) continue;
      categories.push(k);
      if (k.startsWith('self-harm') || k.startsWith('sexual/minors')) safety = true;
    }
    if (r.flagged) flagged = true;
    return { safety, flagged, categories, source: 'openai+rules' };
  } catch (e) {
    // Fail closed: if the check cannot run, a person looks at it.
    console.error('OpenAI moderation failed', e);
    return { safety, flagged: true, categories: [...categories, 'check-unavailable'], source: 'rules' };
  }
}
