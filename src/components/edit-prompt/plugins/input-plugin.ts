import { ViewPlugin, Decoration, EditorView } from '@codemirror/view'
import type { DecorationSet } from '@codemirror/view'

export let internalDragInProgress = false

export class InputDraggablePlugin {
  decorations: DecorationSet

  constructor(_view: EditorView) {
    this.decorations = Decoration.set([])
  }
}

export const inputPlugin = ViewPlugin.fromClass(InputDraggablePlugin, {
  decorations: (v) => v.decorations
})
