import { remote } from 'electron'
import path from 'path'
import sanitize from 'sanitize-filename'
import fs from 'fs'
import touch from 'touch'
import moment from 'moment'
import { logger } from 'inkdrop'
import { replaceImages } from 'inkdrop-export-utils'
const { dialog } = remote

export async function exportAll() {
  const pathArrayToSave = dialog.showOpenDialog({
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

export async function exportSingleNote() {
  const { editingNote } = inkdrop.store.getState()
  const pathToSave = dialog.showSaveDialog({
    title: 'Save Markdown File',
    defaultPath: `${editingNote.title}.md`,
    filters: [{ name: 'Markdown Files', extensions: ['md'] }]
  })
  if (pathToSave) {
    try {
      const destDir = path.dirname(pathToSave)
      const fileName = path.basename(pathToSave)
      await exportNote(editingNote, destDir, fileName)
    } catch (e) {
      logger.error('Failed to export editing note:', e, editingNote)
      inkdrop.notifications.addError('Failed to export editing note', {
        detail: e.message,
        dismissable: true
      })
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

  fs.mkdirSync(pathToSave)
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
    const datestr = moment(note.createdAt).format('YYYYMMDD')
    fileName =
      fileName ||
      sanitize(datestr + '-' + note.title + '-' + note._id.substr(5)) + '.md'
    const filePath = path.join(pathToSave, fileName)
    let body = '# ' + note.title + '\n\n' + note.body
    body = await replaceImages(body, pathToSave)

    fs.writeFileSync(filePath, body)
    touch.sync(filePath, { time: new Date(note.updatedAt) })
  }
}
