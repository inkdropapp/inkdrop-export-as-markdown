'use babel'
import { remote } from 'electron'
import path from 'path'
import sanitize from 'sanitize-filename'
import fs from 'fs'
import touch from 'touch'
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
    notes.forEach((note) => {
      if (note.body) {
        const fileName = sanitize(note.title) + '.md'
        const filePath = path.join(pathToSave, fileName)
        fs.writeFileSync(filePath, note.body)
        touch.sync(filePath, { time: new Date(note.updatedAt) })
      }
    })

    if (book.children) {
      await book.children.reduce((promise, childBook) => {
        return promise.then(() => this.exportBook(pathToSave, childBook))
      }, Promise.resolve())
    }
  },

  deactivate () {
    this.subscription.dispose()
  }

}
