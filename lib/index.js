const { logger } = require('inkdrop')

module.exports = {
  activate() {
    this.subscription = inkdrop.commands.add(document.body, {
      'export-as-markdown:all': () => this.exportAll(),
      'export-as-markdown:selections': () => this.exportSelectedNotes(),
      'export-as-markdown:book': e => this.exportBook(e)
    })
  },

  exportAll() {
    const { exportAll } = require('./exporter')
    exportAll()
  },

  exportSelectedNotes() {
    const { exportSelectedNotes } = require('./exporter')
    exportSelectedNotes()
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
      logger.error('`bookId` must be specified in the parameters')
    }
  }
}
