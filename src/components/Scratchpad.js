import React from 'react';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from '@blocknote/core/extensions';
import {
  useCreateBlockNote,
  getDefaultReactSlashMenuItems,
  SuggestionMenuController,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/mantine/style.css';
import '@blocknote/core/fonts/inter.css';
import { createTerminalBlock } from '../tools/TerminalBlock';

// Schema: default blocks + our custom Terminal block only
// (Toggle Headings are already in defaultBlockSpecs — no need to add them)
const schema = BlockNoteSchema.create().extend({
  blockSpecs: {
    ...defaultBlockSpecs,
    terminal: createTerminalBlock(),
  },
});

// Slash menu item that inserts a Terminal block
const insertTerminalItem = (editor) => ({
  title: 'Terminal',
  subtext: 'Run bash commands in the terminal',
  aliases: ['bash', 'shell', 'command', 'run', 'terminal', 'code'],
  group: 'Commands',
  icon: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
      stroke="currentColor" strokeWidth="2">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  onItemClick: () => {
    insertOrUpdateBlockForSlashMenu(editor, { type: 'terminal', props: { code: '' } });
  },
});

// Slash menu — built-in Toggle Heading 3 + Paragraph + lists + Terminal
const ALLOWED_DEFAULT_TITLES = new Set([
  'Heading 3',
  'Toggle Heading 3',
  'Paragraph',
  'Bullet List',
  'Numbered List',
]);

const getSlashMenuItems = (editor) => {
  const defaults = getDefaultReactSlashMenuItems(editor).filter(
    (item) => ALLOWED_DEFAULT_TITLES.has(item.title)
  );
  return [...defaults, insertTerminalItem(editor)];
};

function Scratchpad({ editorData, onSave, leftPaneWidth, theme }) {
  const isDark = theme === 'dark-theme';

  const editor = useCreateBlockNote({
    schema,
    initialContent:
      Array.isArray(editorData) && editorData.length > 0
        ? editorData
        : undefined,
  });

  return (
    <div
      className={`scratchpad-pane ${theme}`}
      style={{ width: `${leftPaneWidth}%`, flex: 'none', paddingLeft: "20px" }}
    >
      {/* slashMenu={false} disables the built-in menu so we render our own */}
      <BlockNoteView
        editor={editor}
        onChange={() => onSave?.(editor.document)}
        theme={isDark ? 'dark' : 'light'}
        className="scratchpad-bn-view"
        slashMenu={false}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          getItems={async (query) =>
            filterSuggestionItems(getSlashMenuItems(editor), query)
          }
        />
      </BlockNoteView>
    </div>
  );
}

export default Scratchpad;
