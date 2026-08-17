const { Note } = require('inkdrop').models

module.exports = {
  activate(env) {
    this.env = env
    this.subscription = env.commands.add(document.body, {
      'export-as-markdown:all': () => this.exportAll(),
      'export-as-markdown:selections': e => this.exportSelectedNotes(e),
      'export-as-markdown:notebook': e => this.exportBook(e)
    })
  },

  deactivate() {
    this.subscription.dispose()
    this.env = undefined
  },

  exportAll() {
    const { exportAll } = require('./exporter')
    exportAll(this.env)
  },

  async exportSelectedNotes(e) {
    const { exportMultipleNotes, exportSingleNote } = require('./exporter')
    const { noteListBar, editingNote } = this.env.store.getState()
    const { actionTargetNoteIds } = noteListBar
    const noteIds = e.detail?.noteId ? [e.detail.noteId] : (actionTargetNoteIds.length > 0 ? actionTargetNoteIds : [editingNote?._id])
    if (noteIds && noteIds.length > 1) {
      await exportMultipleNotes(this.env, noteIds)
      this.env.notifications.addInfo('Exporting notes completed', {
        detail: '',
        dismissable: true
      })
    } else if (noteIds.length === 1) {
      const note = await Note.loadWithId(noteIds[0])
      exportSingleNote(this.env, note)
    } else {
      this.env.notifications.addError('No note opened', {
        detail: 'Please open a note to export',
        dismissable: true
      })
    }
  },

  exportBook(e) {
    const {
      bookList: { bookForContextMenu }
    } = this.env.store.getState()
    const bookId = (e.detail || {}).bookId || (bookForContextMenu || {})._id
    if (bookId) {
      const { exportNotesInBook } = require('./exporter')
      exportNotesInBook(this.env, bookId)
    } else {
      this.env.notifications.addError('No notebook specified', {
        detail: 'Please select a notebook to export on sidebar',
        dismissable: true
      })
    }
  }
}
