const path = require('path')
const fs = require('fs')
const { logger, exportUtils } = require('inkdrop')
const { Note } = require('inkdrop').models

module.exports = {
  exportAll,
  exportNotesInBook,
  exportMultipleNotes,
  exportSingleNote
}

async function exportAll(env) {
  const { filePaths: pathArrayToSave } = await env.dialog.showOpenDialog({
    title: 'Select a directory to export all notes',
    properties: ['openDirectory', 'createDirectory']
  })
  if (pathArrayToSave instanceof Array && pathArrayToSave.length > 0) {
    const [pathToSave] = pathArrayToSave
    const books = env.store.getState().books.tree
    try {
      await books.reduce((promise, book) => {
        return promise.then(() => exportBook(env, pathToSave, book))
      }, Promise.resolve())
      logger.info('Finished exporting all notes')
      env.notifications.addInfo('Finished exporting all notes', {
        detail: 'Directory: ' + pathToSave,
        dismissable: true
      })
    } catch (e) {
      logger.error('Failed to export:', e)
      env.notifications.addError('Failed to export', {
        detail: e.message,
        dismissable: true
      })
    }
  }
}

async function exportNotesInBook(env, bookId) {
  const book = findNoteFromTree(bookId, env.store.getState().books.tree)
  if (!book) {
    throw new Error('Notebook not found: ' + bookId)
  }
  const { filePaths: pathArrayToSave } = await env.dialog.showOpenDialog({
    title: `Select a directory to export a book "${book.name}"`,
    properties: ['openDirectory', 'createDirectory']
  })
  if (pathArrayToSave instanceof Array && pathArrayToSave.length > 0) {
    const [pathToSave] = pathArrayToSave
    try {
      await exportBook(env, pathToSave, book, { createBookDir: false })
      env.notifications.addInfo(
        `Finished exporting notes in "${book.name}"`,
        {
          detail: 'Directory: ' + pathToSave,
          dismissable: true
        }
      )
    } catch (e) {
      logger.error('Failed to export:', e)
      env.notifications.addError('Failed to export', {
        detail: e.message,
        dismissable: true
      })
    }
  }
}

async function exportSingleNote(env, note) {
  const { filePath: pathToSave } = await env.dialog.showSaveDialog({
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
      env.notifications.addError('Failed to export editing note', {
        detail: e.message,
        dismissable: true
      })
    }
  }
}

async function exportMultipleNotes(env, noteIds) {
  const { filePaths: res } = await env.dialog.showOpenDialog({
    title: 'Select Destination Directory',
    properties: ['openDirectory']
  })
  if (res instanceof Array && res.length > 0) {
    const destDir = res[0]

    try {
      for (let noteId of noteIds) {
        const note = await Note.loadWithId(noteId)
        if (note) {
          const fileName = exportUtils.sanitizeFileName(note.title, {
            extension: '.md'
          })
          await exportUtils.exportNoteAsMarkdown(note, destDir, fileName)
        }
      }
    } catch (e) {
      logger.error('Failed to export notes:', e)
      env.notifications.addError('Failed to export notes', {
        detail: e.message,
        dismissable: true
      })
    }
  }
}

async function exportBook(env, parentDir, book, opts = {}) {
  const { createBookDir = true } = opts
  const db = env.localDB
  const dirName = exportUtils.sanitizeFileName(book.name, { replacement: '-' })
  const pathToSave = createBookDir ? path.join(parentDir, dirName) : parentDir
  const notes = await db.notes.searchWithQuery(
    [{ type: 'field', field: 'book', id: book._id }],
    { limit: 9999 }
  )

  !fs.existsSync(pathToSave) && fs.mkdirSync(pathToSave)
  for (let i = 0; i < notes.length; ++i) {
    await exportUtils.exportNoteAsMarkdown(notes[i], pathToSave)
  }

  if (book.children) {
    await book.children.reduce((promise, childBook) => {
      return promise.then(() => exportBook(env, pathToSave, childBook))
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
