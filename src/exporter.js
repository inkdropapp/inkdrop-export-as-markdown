import { remote } from 'electron'
import path from 'path'
import sanitize from 'sanitize-filename'
import fs from 'fs'
import touch from 'touch'
import { logger } from 'inkdrop'
import { replaceImages } from 'inkdrop-export-utils'
const { dialog } = remote

export async function exportAll() {
  const { filePaths: pathArrayToSave } = await dialog.showOpenDialog({
    title: 'Select a directory to export all notes',
    properties: ['openDirectory', 'createDirectory']
  })
  if (pathArrayToSave) {
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

export async function exportSelectedNotes() {
  const { noteListBar, notes } = inkdrop.store.getState()
  if (noteListBar.selectedNoteIds.length > 1) {
    inkdrop.notifications.addInfo('Exporting notes started', {
      detail: 'It may take a while..',
      dismissable: true
    })
    await exportMultipleNotes(noteListBar.selectedNoteIds)
    inkdrop.notifications.addInfo('Exporting notes completed', {
      detail: '',
      dismissable: true
    })
  } else if (noteListBar.selectedNoteIds.length === 1) {
    const note = notes.hashedItems[noteListBar.selectedNoteIds[0]]
    exportSingleNote(note)
  } else {
    inkdrop.notifications.addError('No note opened', {
      detail: 'Please open a note to export',
      dismissable: true
    })
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
      await exportNote(note, destDir, fileName)
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
      const note = notes.hashedItems[noteId]
      if (note) {
        const fileName = `${note.title}.md`
        await exportNote(note, destDir, fileName)
      }
    }
  }
}

export async function exportBook(parentDir, book) {
  const db = inkdrop.main.dataStore.getLocalDB()
  const dirName = sanitize(book.name, { replacement: '-' })
  const pathToSave = path.join(parentDir, dirName)
  const { docs: notes } = await db.notes.findInBook(book._id, {
    limit: false
  })

  !fs.existsSync(pathToSave) && fs.mkdirSync(pathToSave)
  for (let i = 0; i < notes.length; ++i) {
    await exportNote(notes[i], pathToSave)
  }

  if (book.children) {
    await book.children.reduce((promise, childBook) => {
      return promise.then(() => exportBook(pathToSave, childBook))
    }, Promise.resolve())
  }
}

export async function exportNote(note, pathToSave, fileName) {
  if (note.body) {
    const datestr = new Date(note.createdAt)
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '')
    fileName =
      fileName ||
      sanitize(datestr + '-' + note.title + '-' + note._id.substr(5)) + '.md'
    const filePath = path.join(pathToSave, fileName)
    let body = '# ' + note.title + '\n\n' + note.body
    body = await replaceImages(body, pathToSave, pathToSave)

    fs.writeFileSync(filePath, body)
    touch.sync(filePath, { time: new Date(note.updatedAt) })
  }
}
