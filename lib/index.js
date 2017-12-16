'use strict';

var _electron = require('electron');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _sanitizeFilename = require('sanitize-filename');

var _sanitizeFilename2 = _interopRequireDefault(_sanitizeFilename);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _touch = require('touch');

var _touch2 = _interopRequireDefault(_touch);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const { dialog, app } = _electron.remote;

module.exports = {
  activate() {
    this.subscription = inkdrop.commands.add(document.body, {
      'export-all:export': () => this.exportAll()
    });
  },

  async exportAll() {
    const pathArrayToSave = dialog.showOpenDialog({
      title: 'Select a directory to export all notes',
      properties: ['openDirectory', 'createDirectory']
    });
    if (pathArrayToSave) {
      const [pathToSave] = pathArrayToSave;
      const books = inkdrop.flux.stores.bookList.getState().bookTree;
      try {
        await books.reduce((promise, book) => {
          return promise.then(() => this.exportBook(pathToSave, book));
        }, Promise.resolve());
      } catch (e) {
        console.error('Failed to export:', e);
        inkdrop.notifications.addError('Failed to export', { detail: e.message, dismissable: true });
      }
    }
  },

  async exportBook(parentDir, book) {
    const dirName = (0, _sanitizeFilename2.default)(book.name, { replacement: '-' });
    const pathToSave = _path2.default.join(parentDir, dirName);
    const notes = await app.db.local.notes.findInBook(book._id);

    _fs2.default.mkdirSync(pathToSave);
    notes.forEach(note => {
      if (note.body) {
        const fileName = (0, _sanitizeFilename2.default)(note.title) + '.md';
        const filePath = _path2.default.join(pathToSave, fileName);
        _fs2.default.writeFileSync(filePath, note.body);
        _touch2.default.sync(filePath, { time: new Date(note.updatedAt) });
      }
    });

    if (book.children) {
      await book.children.reduce((promise, childBook) => {
        return promise.then(() => this.exportBook(pathToSave, childBook));
      }, Promise.resolve());
    }
  },

  deactivate() {
    this.subscription.dispose();
  }

};