const { Note } = require('inkdrop').models

module.exports = {
  activate() {
    this.subscription = inkdrop.commands.add(document.body, {
      'export-as-markdown:all': () => this.exportAll(),
      'export-as-markdown:selections': e => this.exportSelectedNotes(e),
      'export-as-markdown:notebook': e => this.exportBook(e)
    })
  },

  deactivate() {
    this.subscription.dispose()
  },

  exportAll() {
    const { exportAll } = require('./exporter')
    exportAll()
  },

  async exportSelectedNotes(e) {
    const { exportMultipleNotes, exportSingleNote } = require('./exporter')
    const { noteListBar, notes } = inkdrop.store.getState()
    const { actionTargetNoteIds } = noteListBar
    const noteIds = e.detail?.noteId ? [e.detail.noteId] : actionTargetNoteIds
    if (noteIds && noteIds.length > 1) {
      await exportMultipleNotes(noteIds)
      inkdrop.notifications.addInfo('Exporting notes completed', {
        detail: '',
        dismissable: true
      })
    } else if (noteIds.length === 1) {
      const note = await Note.loadWithId(noteIds[0])
      exportSingleNote(note)
    } else {
      inkdrop.notifications.addError('No note opened', {
        detail: 'Please open a note to export',
        dismissable: true
      })
    }
  },

  exportBook(e) {
    const {
      bookList: { bookForContextMenu }
    } = inkdrop.store.getState()
    const bookId = (e.detail || {}).bookId || (bookForContextMenu || {})._id
    if (bookId) {
      const { exportNotesInBook } = require('./exporter')
      exportNotesInBook(bookId)
    } else {
      inkdrop.notifications.addError('No notebook specified', {
        detail: 'Please select a notebook to export on sidebar',
        dismissable: true
      })
    }
  }
}
