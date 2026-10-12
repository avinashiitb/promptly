/**
 * Promptly Document Validator & Transformer
 * Normalizes raw LLM content or input objects into the Promptly runbook block.
 *
 * Output shape (what Promptly's App.js loads and saves):
 * [{ type: "promptly", data: { groups: [{ id, title, collapsed, items }], leftPaneWidth, theme } }]
 * items: { id, type: "text", text } | { id, type: "cmd", title, cmd }
 *
 * Rule enforced here: ONE command per cmd item. Multi-command scripts are split into separate steps.
 */

const CMD_TYPES = ["cmd", "command", "terminal", "bash", "shell", "sh", "zsh", "step", "code"];
const TEXT_TYPES = ["text", "note", "markdown", "paragraph", "description", "comment"];
const THEMES = ["light-theme", "dark-theme"];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toText(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Strips markdown code fences if present
 * @param {string} rawText
 * @returns {string}
 */
function stripCodeFences(rawText) {
  if (typeof rawText !== "string") return "";
  let text = rawText.trim();

  if (text.startsWith("```")) {
    const lines = text.split("\n");
    lines.shift();
    if (lines.length > 0 && lines[lines.length - 1].trim().startsWith("```")) {
      lines.pop();
    }
    text = lines.join("\n").trim();
  }

  return text;
}

/* ---------------------------- command splitting ---------------------------- */

/**
 * Tracks open quotes across a line so multi-line quoted strings stay in one command
 * @param {string} line
 * @param {string|null} quote Quote still open from previous lines
 * @returns {string|null} Quote still open at the end of this line
 */
function trackQuotes(line, quote) {
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (quote === "'") {
      if (ch === "'") quote = null;
    } else if (quote === '"') {
      if (ch === "\\") i++;
      else if (ch === '"') quote = null;
    } else if (ch === "\\") {
      i++;
    } else if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]))) {
      break; // rest of the line is a comment
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    }
  }
  return quote;
}

/**
 * Builds a readable step title from the command itself (used when the model gave none)
 * @param {string} cmd
 * @returns {string}
 */
function deriveTitle(cmd) {
  const firstLine = cmd.split("\n")[0].replace(/\\\s*$/, "").replace(/\s+/g, " ").trim();
  return firstLine.length > 48 ? `${firstLine.slice(0, 47)}…` : firstLine || "Command";
}

/**
 * Splits a shell script into single commands.
 * Keeps backslash continuations, open quotes and heredocs together; turns "# comment" lines into notes.
 * @param {string} script
 * @returns {Array<{ type: "cmd", cmd: string } | { type: "text", text: string }>}
 */
function splitCommands(script) {
  const entries = [];
  let current = [];
  let quote = null;
  let heredocEnd = null;

  const flush = () => {
    const cmd = current.join("\n").trim();
    if (cmd) entries.push({ type: "cmd", cmd });
    current = [];
  };

  for (const rawLine of script.replace(/\r\n/g, "\n").split("\n")) {
    let line = rawLine;

    // Inside a heredoc: keep everything until the delimiter line
    if (heredocEnd) {
      current.push(line);
      if (line.trim() === heredocEnd) {
        heredocEnd = null;
        flush();
      }
      continue;
    }

    // Start of a new command
    if (current.length === 0 && !quote) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#!")) continue;

      if (trimmed.startsWith("#")) {
        const note = trimmed.replace(/^#+\s*/, "");
        const last = entries[entries.length - 1];
        if (note && last && last.type === "text") last.text += ` ${note}`;
        else if (note) entries.push({ type: "text", text: note });
        continue;
      }

      line = line.replace(/^\s*\$\s+/, ""); // drop copied prompt characters ("$ npm ci")
    }

    current.push(line);

    quote = trackQuotes(line, quote);
    if (quote) continue;

    const heredoc = line.match(/(?:^|[^<])<<-?\s*['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?/);
    if (heredoc) {
      heredocEnd = heredoc[1];
      continue;
    }

    if (/\\\s*$/.test(line)) continue; // backslash continuation

    flush();
  }

  flush();
  return entries;
}

/* ------------------------------ normalization ------------------------------ */

/**
 * Normalizes a group's items into text notes and single-command steps (without ids)
 * @param {Array} rawItems
 * @returns {Array<{ type: string, text?: string, title?: string, cmd?: string }>}
 */
function normalizeItems(rawItems) {
  const items = [];
  if (!Array.isArray(rawItems)) return items;

  const pushCommands = (script, title) => {
    let titleUsed = false;
    for (const entry of splitCommands(stripCodeFences(script))) {
      if (entry.type === "text") {
        items.push(entry);
      } else {
        items.push({ type: "cmd", title: !titleUsed && title ? title : deriveTitle(entry.cmd), cmd: entry.cmd });
        titleUsed = true;
      }
    }
  };

  for (const item of rawItems) {
    // A bare string is a command (or a small script)
    if (typeof item === "string") {
      pushCommands(item, "");
      continue;
    }
    if (!isObject(item)) continue;

    const type = toText(item.type).trim().toLowerCase();
    const title = toText(item.title || item.name || item.heading).trim();
    let cmdText = toText(item.cmd !== undefined ? item.cmd : item.command !== undefined ? item.command : item.script);
    let noteText = toText(item.text !== undefined ? item.text : item.note !== undefined ? item.note : item.description);

    // { type: "cmd", text: "npm ci" } -> the text IS the command
    if (CMD_TYPES.includes(type) && !cmdText.trim()) {
      cmdText = noteText || toText(item.code);
      noteText = "";
    }

    const isCommand = cmdText.trim() && !TEXT_TYPES.includes(type);
    if (!isCommand) {
      const text = noteText.trim() || (TEXT_TYPES.includes(type) ? title : "");
      if (text) items.push({ type: "text", text });
      continue;
    }

    // A note attached to a command becomes its own text item right before it
    if (noteText.trim()) items.push({ type: "text", text: noteText.trim() });
    pushCommands(cmdText, title);
  }

  return items;
}

/**
 * Normalizes groups (sections) and their items
 * @param {Array} rawGroups
 * @returns {Array<{ title: string, collapsed: boolean, items: Array }>}
 */
function normalizeGroups(rawGroups) {
  if (!Array.isArray(rawGroups)) return [];

  return rawGroups
    .filter(isObject)
    .map((group, index) => ({
      title: toText(group.title || group.heading || group.name).trim() || `Section ${index + 1}`,
      collapsed: false,
      items: normalizeItems(group.items || group.steps || group.commands || []),
    }));
}

/**
 * Assigns unique ids: groups g1.., commands s1.., notes n1..
 * @param {Array} groups
 * @returns {Array}
 */
function assignIds(groups) {
  let g = 0;
  let s = 0;
  let n = 0;

  return groups.map((group) => ({
    id: `g${++g}`,
    title: group.title,
    collapsed: group.collapsed,
    items: group.items.map((item) =>
      item.type === "cmd"
        ? { id: `s${++s}`, type: "cmd", title: item.title, cmd: item.cmd }
        : { id: `n${++n}`, type: "text", text: item.text }
    ),
  }));
}

/* ------------------------------ parsing input ------------------------------ */

/**
 * Converts a markdown answer (headings + ```bash blocks + prose) or a plain shell script into groups
 * - "#"/"##" headings start a group, "###"+ headings title the next command
 * @param {string} text
 * @returns {Array} Raw groups
 */
function parseTextRunbook(text) {
  if (!text.includes("```")) {
    return [{ title: "Commands", items: [text] }];
  }

  const groups = [];
  let current = null;
  let inFence = false;
  let fenceLines = [];
  let notes = [];
  let pendingTitle = "";

  const ensureGroup = () => {
    if (!current) {
      current = { title: "Commands", items: [] };
      groups.push(current);
    }
  };
  const flushNotes = () => {
    if (notes.length === 0) return;
    ensureGroup();
    current.items.push({ type: "text", text: notes.join(" ") });
    notes = [];
  };

  for (const line of text.split("\n")) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inFence) {
        ensureGroup();
        current.items.push({ type: "cmd", title: pendingTitle, cmd: fenceLines.join("\n") });
        fenceLines = [];
        pendingTitle = "";
        inFence = false;
      } else {
        flushNotes();
        inFence = true;
      }
      continue;
    }
    if (inFence) {
      fenceLines.push(line);
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushNotes();
      const title = heading[2].replace(/[*_`]/g, "").trim();
      if (heading[1].length <= 2) {
        current = { title, items: [] };
        groups.push(current);
      } else {
        pendingTitle = title;
      }
      continue;
    }

    if (trimmed) notes.push(trimmed.replace(/^[-*]\s+/, ""));
    else flushNotes();
  }

  flushNotes();
  if (inFence && fenceLines.length > 0) {
    ensureGroup();
    current.items.push({ type: "cmd", title: pendingTitle, cmd: fenceLines.join("\n") });
  }

  return groups;
}

function looksLikeBlock(value) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isObject(candidate) && (candidate.type === "promptly" || candidate.groups !== undefined || candidate.data !== undefined || candidate.items !== undefined);
}

/**
 * Tries to parse a JSON block payload out of raw LLM text
 * @param {string} text
 * @returns {Array|Object|null}
 */
function parseJsonPayload(text) {
  const candidates = [text];

  const firstBracket = text.indexOf("[");
  const lastBracket = text.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) candidates.push(text.substring(firstBracket, lastBracket + 1));

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) candidates.push(text.substring(firstBrace, lastBrace + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (looksLikeBlock(parsed)) return parsed;
    } catch (e) {}
  }

  return null;
}

/**
 * Extracts the raw data object ({ groups, leftPaneWidth, theme }) from any supported input shape
 * @param {string|Array|Object} rawContent
 * @returns {Object}
 */
function extractData(rawContent) {
  if (Array.isArray(rawContent)) {
    const first = rawContent[0];
    // Model returned the groups array directly
    if (isObject(first) && first.type !== "promptly" && first.data === undefined && Array.isArray(first.items)) {
      return { groups: rawContent };
    }
    return extractData(first);
  }

  if (isObject(rawContent)) {
    if (rawContent.data === undefined) return rawContent;
    if (typeof rawContent.data === "string") return extractData(rawContent.data);
    return isObject(rawContent.data) ? rawContent.data : {};
  }

  if (typeof rawContent === "string") {
    const text = stripCodeFences(rawContent);
    if (!text) return {};

    const parsed = parseJsonPayload(text);
    if (parsed) return extractData(parsed);

    return { groups: parseTextRunbook(text) };
  }

  return {};
}

/**
 * Validates raw input and transforms it into the standard promptly document payload
 * @param {string|Array|Object} rawContent
 * @returns {Array<Object>} Array containing the single promptly block
 */
function validateAndTransform(rawContent) {
  const data = extractData(rawContent);

  let groups = normalizeGroups(data.groups || data.sections);
  // Promptly shows its built-in demo runbook when groups is empty, so always keep one group
  if (groups.length === 0) groups = [{ title: "Commands", collapsed: false, items: [] }];

  const width = Number(data.leftPaneWidth);

  return [
    {
      type: "promptly",
      data: {
        groups: assignIds(groups),
        leftPaneWidth: width >= 20 && width <= 80 ? width : 50,
        theme: THEMES.includes(data.theme) ? data.theme : "light-theme",
      },
    },
  ];
}

module.exports = {
  validateAndTransform,
  splitCommands,
  stripCodeFences,
  parseTextRunbook,
};
