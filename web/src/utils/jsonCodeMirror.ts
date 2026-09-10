// [AGC:FILE] tool=Cc author=fangkun date=2026-09-10
// web/src/utils/jsonCodeMirror.ts

// [AGC:START] tool=Cc author=fangkun
import { json } from '@codemirror/lang-json'
import { bracketMatching, HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import { basicSetup } from 'codemirror'

// JSON syntax colors, VS Code Light+ palette. Tag mapping from
// @lezer/json: PropertyName/String/Number/bool/Null/separator/brackets.
export const jsonHighlightStyle = HighlightStyle.define([
  { tag: t.propertyName, color: '#0550ae' },
  { tag: t.string, color: '#a31515' },
  { tag: t.number, color: '#098658' },
  { tag: [t.bool, t.null], color: '#0000ff' },
  { tag: t.separator, color: '#6e7781' },
  { tag: [t.squareBracket, t.brace], color: '#1f2328' },
])

export const jsonLightTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#fdfdfe', color: '#1f2328', height: '100%' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
      fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      fontSize: '13px',
      lineHeight: '1.6',
    },
    '.cm-content': { caretColor: '#1f2328', padding: '8px 0' },
    '.cm-cursor': { borderLeftColor: '#1f2328' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: '#b3d7ff',
    },
    '.cm-gutters': {
      backgroundColor: '#f6f8fa',
      color: '#57606a',
      borderRight: '1px solid #e2e5ea',
    },
    '.cm-matchingBracket': {
      backgroundColor: '#cfe8ff',
      outline: '1px solid #a4cdfe',
      borderRadius: '3px',
      transition: 'background-color 0.15s ease, outline-color 0.15s ease',
    },
    '.cm-nonmatchingBracket': {
      backgroundColor: '#fde2e2',
      outline: '1px solid #d73a49',
      borderRadius: '3px',
    },
    '.cm-foldPlaceholder': {
      backgroundColor: '#f1f3f5',
      border: '1px solid #d0d7de',
      color: '#57606a',
    },
  },
  { dark: false }
)

// Base setup: line numbers, fold, history, selection, matching-bracket etc.
// The custom HighlightStyle (non-fallback) overrides basicSetup's default one.
export const jsonEditorBase = [
  basicSetup,
  EditorView.lineWrapping,
  json(),
  syntaxHighlighting(jsonHighlightStyle),
  jsonLightTheme,
]

// Editable editor (request payload). Callers may append a component-local keymap.
export const editableJsonExtensions = [...jsonEditorBase]

// Read-only editor (response). readOnly keeps the caret/selection working so
// bracketMatching still responds to clicks; only typing is blocked.
export const readonlyJsonExtensions = [
  ...jsonEditorBase,
  EditorState.readOnly.of(true),
]

// Pretty-print JSON, throwing on invalid input (caller handles the error).
export function formatJson(text: string): string {
  return JSON.stringify(JSON.parse(text), null, 2)
}
// [AGC:END]
