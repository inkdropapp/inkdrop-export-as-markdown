'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.exportAll = exportAll;
exports.exportSingleNote = exportSingleNote;
exports.exportBook = exportBook;
exports.exportNote = exportNote;
exports.exportImage = exportImage;

var _electron = require('electron');

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _sanitizeFilename = require('sanitize-filename');

var _sanitizeFilename2 = _interopRequireDefault(_sanitizeFilename);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _touch = require('touch');

var _touch2 = _interopRequireDefault(_touch);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const { dialog, app } = _electron.remote;

async function exportAll() {
  const pathArrayToSave = dialog.showOpenDialog({
    title: 'Select a directory to export all notes',
    properties: ['openDirectory', 'createDirectory']
  });
  if (pathArrayToSave) {
    const [pathToSave] = pathArrayToSave;
    const books = inkdrop.flux.stores.bookList.getState().bookTree;
    try {
      await books.reduce((promise, book) => {
        return promise.then(() => exportBook(pathToSave, book));
      }, Promise.resolve());
    } catch (e) {
      console.error('Failed to export:', e);
      inkdrop.notifications.addError('Failed to export', {
        detail: e.message,
        dismissable: true
      });
    }
  }
}

async function exportSingleNote() {
  const { document } = inkdrop.flux.getStore('editor').getState();
  const pathToSave = dialog.showSaveDialog({
    title: 'Save Markdown File',
    defaultPath: `${document.title}.md`,
    filters: [{ name: 'Markdown Files', extensions: ['md'] }]
  });
  if (pathToSave) {
    try {
      const destDir = _path2.default.dirname(pathToSave);
      const fileName = _path2.default.basename(pathToSave);
      await exportNote(document, destDir, fileName);
    } catch (e) {
      console.error('Failed to export:', e);
      inkdrop.notifications.addError('Failed to export', {
        detail: e.message,
        dismissable: true
      });
    }
  }
}

async function exportBook(parentDir, book) {
  const dirName = (0, _sanitizeFilename2.default)(book.name, { replacement: '-' });
  const pathToSave = _path2.default.join(parentDir, dirName);
  const { docs: notes } = await app.db.local.notes.findInBook(book._id, {
    limit: false
  });

  _fs2.default.mkdirSync(pathToSave);
  for (let i = 0; i < notes.length; ++i) {
    await exportNote(notes[i], pathToSave);
  }

  if (book.children) {
    await book.children.reduce((promise, childBook) => {
      return promise.then(() => exportBook(pathToSave, childBook));
    }, Promise.resolve());
  }
}

async function exportNote(note, pathToSave, fileName) {
  if (note.body) {
    const datestr = (0, _moment2.default)(note.createdAt).format('YYYYMMDD');
    fileName = fileName || (0, _sanitizeFilename2.default)(datestr + '-' + note.title + '-' + note._id.substr(5)) + '.md';
    const filePath = _path2.default.join(pathToSave, fileName);
    let body = '# ' + note.title + '\n\n' + note.body;

    // find attachments
    const uris = body.match(/inkdrop:\/\/file:[^\) ]*/g) || [];
    for (let i = 0; i < uris.length; ++i) {
      const uri = uris[i];
      const imagePath = await exportImage(uri, pathToSave);
      if (imagePath) {
        body = body.replace(uri, imagePath);
      }
    }

    _fs2.default.writeFileSync(filePath, body);
    _touch2.default.sync(filePath, { time: new Date(note.updatedAt) });
  }
}

async function exportImage(uri, pathToSave) {
  try {
    const file = await inkdrop.models.File.getDocumentFromUri(uri);
    return file.saveFileSync(pathToSave);
  } catch (e) {
    console.error('Failed to export image file:', e);
    return false;
  }
}