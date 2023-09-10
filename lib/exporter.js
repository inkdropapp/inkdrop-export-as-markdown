const { dialog } = require('@electron/remote')
const path = require('path')
const sanitize = require('sanitize-filename')
const fs = require('fs')
const touch = require('touch')
const { logger, exportUtils } = require('inkdrop')
const { Note } = require('inkdrop').models

module.exports = {
  exportAll,
  exportNotesInBook,
  exportMultipleNotes,
  exportSingleNote
}

async function exportAll() {
  const { filePaths: pathArrayToSave } = await dialog.showOpenDialog({
    title: 'Select a directory to export all notes',
    properties: ['openDirectory', 'createDirectory']
  })
  if (pathArrayToSave instanceof Array && pathArrayToSave.length > 0) {
    const [pathToSave] = pathArrayToSave
    const books = inkdrop.store.getState().books.tree
    try {
      await books.reduce((promise, book) => {
        return promise.then(() => exportBook(pathToSave, book))
      }, Promise.resolve())
      logger.info('Finished exporting all notes')
      inkdrop.notifications.addInfo('Finished exporting all notes', {
        detail: 'Directory: ' + pathToSave,
        dismissable: true
      })
    } catch (e) {
      logger.error('Failed to export:', e)
      inkdrop.notifications.addError('Failed to export', {
        detail: e.message,
        dismissable: true
      })
    }
  }
}

async function exportNotesInBook(bookId) {
  const book = findNoteFromTree(bookId, inkdrop.store.getState().books.tree)
  if (!book) {
    throw new Error('Notebook not found: ' + bookId)
  }
  const { filePaths: pathArrayToSave } = await dialog.showOpenDialog({
    title: `Select a directory to export a book "${book.name}"`,
    properties: ['openDirectory', 'createDirectory']
  })
  if (pathArrayToSave instanceof Array && pathArrayToSave.length > 0) {
    const [pathToSave] = pathArrayToSave
    try {
      await exportBook(pathToSave, book, { createBookDir: false })
      inkdrop.notifications.addInfo(
        `Finished exporting notes in "${book.name}"`,
        {
          detail: 'Directory: ' + pathToSave,
          dismissable: true
        }
      )
    } catch (e) {
      logger.error('Failed to export:', e)
      inkdrop.notifications.addError('Failed to export', {
        detail: e.message,
        dismissable: true
      })
    }
  }
}

async function exportSingleNote(note) {
  const { filePath: pathToSave } = await dialog.showSaveDialog({
    title: 'Save Markdown File',
    defaultPath: `${note.title}.md`,
    filters: [{ name: 'Markdown Files', extensions: ['md'] }]
  })
  if (pathToSave) {
    try {
      const destDir = path.dirname(pathToSave)
      const fileName = path.basename(pathToSave)
      await exportUtils.exportNoteAsMarkdown(note, destDir, fileName)
    } catch (e) {
      logger.error('Failed to export editing note:', e, note)
      inkdrop.notifications.addError('Failed to export editing note', {
        detail: e.message,
        dismissable: true
      })
    }
  }
}

async function exportMultipleNotes(noteIds) {
  const { notes } = inkdrop.store.getState()
  const { filePaths: res } = await dialog.showOpenDialog(inkdrop.window, {
    title: 'Select Destination Directory',
    properties: ['openDirectory']
  })
  if (res instanceof Array && res.length > 0) {
    const destDir = res[0]

    for (let noteId of noteIds) {
      const note = await Note.loadWithId(noteId)
      if (note) {
        const fileName = `${note.title}.md`
        await exportUtils.exportNoteAsMarkdown(note, destDir, fileName)
      }
    }
  }
}

async function exportBook(parentDir, book, opts = {}) {
  const { createBookDir = true } = opts
  const db = inkdrop.main.dataStore.getLocalDB()
  const dirName = sanitize(book.name, { replacement: '-' })
  const pathToSave = createBookDir ? path.join(parentDir, dirName) : parentDir
  const notes = (await db.notes.db.allDocs({
    include_docs: true,
    attachments: false,
    startkey: "note:",
    endkey: "note:￿",
  })).rows.filter((row) => row.doc.bookId == book._id).map((row) => row.doc)

  !fs.existsSync(pathToSave) && fs.mkdirSync(pathToSave)
  for (let i = 0; i < notes.length; ++i) {
    await exportUtils.exportNoteAsMarkdown(notes[i], pathToSave)
  }

  if (book.children) {
    await book.children.reduce((promise, childBook) => {
      return promise.then(() => exportBook(pathToSave, childBook))
    }, Promise.resolve())
  }
}

function findNoteFromTree(bookId, tree) {
  for (let i = 0; i < tree.length; ++i) {
    const item = tree[i]
    if (item._id === bookId) {
      return item
    } else if (item.children) {
      const book = findNoteFromTree(bookId, item.children)
      if (book) {
        return book
      }
    }
  }
  return undefined
}
