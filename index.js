'use babel'
import { remote } from 'electron'
import path from 'path'
import sanitize from 'sanitize-filename'
import fs from 'fs'
import touch from 'touch'
import moment from 'moment'
const { dialog, app } = remote

module.exports = {
  activate () {
    this.subscription = inkdrop.commands.add(document.body, {
      'export-all:export': () => this.exportAll()
    })
  },

  async exportAll () {
    const pathArrayToSave = dialog.showOpenDialog({
      title: 'Select a directory to export all notes',
      properties: ['openDirectory', 'createDirectory']
    })
    if (pathArrayToSave) {
      const [ pathToSave ] = pathArrayToSave
      const books = inkdrop.flux.stores.bookList.getState().bookTree
      try {
        await books.reduce(
          (promise, book) => {
            return promise.then(() => this.exportBook(pathToSave, book))
          },
          Promise.resolve()
        )
      } catch (e) {
        console.error('Failed to export:', e)
        inkdrop.notifications.addError('Failed to export', { detail: e.message, dismissable: true })
      }
    }
  },

  async exportBook (parentDir, book) {
    const dirName = sanitize(book.name, { replacement: '-' })
    const pathToSave = path.join(parentDir, dirName)
    const notes = await app.db.local.notes.findInBook(book._id)

    fs.mkdirSync(pathToSave)
    for (let i = 0; i < notes.length; ++i) {
      await this.exportNote(notes[i], pathToSave)
    }

    if (book.children) {
      await book.children.reduce((promise, childBook) => {
        return promise.then(() => this.exportBook(pathToSave, childBook))
      }, Promise.resolve())
    }
  },

  async exportNote (note, pathToSave) {
    if (note.body) {
      const datestr = moment(note.createdAt).format('YYYYMMDD')
      const fileName = sanitize(datestr + '-' + note.title) + '.md'
      const filePath = path.join(pathToSave, fileName)
      let body = '# ' + note.title + '\n\n' + note.body

      // find attachments
      const uris = body.match(/inkdrop:\/\/file:[^\) ]*/g) || []
      for (let i = 0; i < uris.length; ++i) {
        const uri = uris[i]
        const imagePath = await this.exportImage(uri, pathToSave)
        if (imagePath) {
          body = body.replace(uri, imagePath)
        }
      }

      fs.writeFileSync(filePath, body)
      touch.sync(filePath, { time: new Date(note.updatedAt) })
    }
  },

  async exportImage (uri, pathToSave) {
    try {
      const file = await inkdrop.models.File.getDocumentFromUri(uri)
      return file.saveFileSync(pathToSave)
    } catch (e) {
      console.error('Failed to export image file:', e)
      return false
    }
  },

  deactivate () {
    this.subscription.dispose()
  }

}
