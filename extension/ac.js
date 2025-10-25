// Aho-Corasick automaton implementation in JavaScript
export function buildAutomaton(entries, opts = {}) {
  const { caseInsensitive = false, wholeWord = false } = opts;

  // Normalize entries -> [{term, payload}]
  const list = [];
  for (const e of entries || []) {
    if (!e) continue;
    if (typeof e === "string") list.push({ term: e, payload: undefined });
    else if (typeof e.term === "string") list.push({ term: e.term, payload: e.payload });
  }

  // Optionally fold case for dictionary
  const norm = caseInsensitive
    ? list.map(e => ({ term: e.term.toLowerCase(), payload: e.payload }))
    : list.slice();

  // Trie node: { go: {char: nextIndex}, fail: number, out: [{term,payload}] }
  const nodes = [{ go: Object.create(null), fail: 0, out: [] }];

  // Insert terms
  for (const { term, payload } of norm) {
    if (!term) continue;
    let state = 0;
    for (const ch of term) {
      const go = nodes[state].go;
      if (go[ch] == null) {
        go[ch] = nodes.length;
        nodes.push({ go: Object.create(null), fail: 0, out: [] });
      }
      state = go[ch];
    }
    nodes[state].out.push({ term, payload });
  }

  // Build failure links (BFS)
  const q = [];
  // Depth 1: fail -> 0
  for (const ch in nodes[0].go) {
    const s = nodes[0].go[ch];
    nodes[s].fail = 0;
    q.push(s);
  }
  // Other depths
  while (q.length) {
    const r = q.shift();
    const goR = nodes[r].go;
    for (const ch in goR) {
      const s = goR[ch];
      q.push(s);

      // Compute fail(s)
      let f = nodes[r].fail;
      while (f && nodes[f].go[ch] == null) f = nodes[f].fail;
      if (nodes[f].go[ch] != null && nodes[f].go[ch] !== s) f = nodes[f].go[ch];

      nodes[s].fail = f;
      // Merge outputs
      if (nodes[f].out.length) nodes[s].out = nodes[s].out.concat(nodes[f].out);
    }
  }

  // Store options in automaton for use during search
  return { nodes, caseInsensitive, wholeWord };
}


export function findAll(automaton, text) {
    if (!automaton || !automaton.nodes || !text) return [];

    const { nodes, caseInsensitive, wholeWord } = automaton;
    const src = caseInsensitive ? text.toLowerCase() : text;
    const hits = [];
    
    let state = 0;

    const isWord = (ch) => /\w/.test(ch);

    for (let i = 0; i < src.length; i++) {
        const ch = src[i];

        // Follow transitions
        while (state && nodes[state].go[ch] == null) {
            state = nodes[state].fail;
        }
        if (nodes[state].go[ch] != null) {
            state = nodes[state].go[ch];
        }
        
        if (nodes[state].out.length) {
            for (const { term, payload } of nodes[state].out) {
                const startIdx = i - term.length + 1;
                const endIdx = i + 1;

                if (startIdx < 0) continue;

                // Whole word check
                if (wholeWord) {
                    const prev = startIdx > 0 ? text[startIdx - 1] : "";
                    const next = endIdx < text.length ? text[endIdx] : "";
                    if ((prev && isWord(prev)) || (next && isWord(next))) {
                        continue;
                    }
                }

                hits.push({
                    term: text.slice(startIdx, endIdx),
                    payload: payload,
                    start: startIdx,
                    end: endIdx
                });
            }
        }
    }
    return hits;
}
// Example usage:
/*
import { buildAutomaton, findAll } from './ac.js';

const entries = [
    { term: "cocaine", payload: "drug" },
    { term: "heroin", payload: "drug" },
];
    const automaton = buildAutomaton(entries, { caseInsensitive: true, wholeWord: false });

    // Scan text
    lt text = "The dealer sold cocaine and heroin.";
    const hits = findAll(automaton, text);
    console.log(hits);

    // Apply censoring
    hits.sort((a, b) => b.start - a.start)).forEach(hit => {
        const len = hit.end - hit.start;
        text = text.slice(0, hit.start) + "█".repeat(len) + text.slice(hit.end);
    });
*/