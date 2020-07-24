"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.exportAll = exportAll;
exports.exportSingleNote = exportSingleNote;
exports.exportBook = exportBook;
exports.exportNote = exportNote;

var _electron = require("electron");

var _path = _interopRequireDefault(require("path"));

var _sanitizeFilename = _interopRequireDefault(require("sanitize-filename"));

var _fs = _interopRequireDefault(require("fs"));

var _touch = _interopRequireDefault(require("touch"));

var _inkdrop = require("inkdrop");

var _inkdropExportUtils = require("inkdrop-export-utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const {
  dialog
} = _electron.remote;

async function exportAll() {
  const {
    filePaths: pathArrayToSave
  } = await dialog.showOpenDialog({
    title: 'Select a directory to export all notes',
    properties: ['openDirectory', 'createDirectory']
  });

  if (pathArrayToSave) {
    const [pathToSave] = pathArrayToSave;
    const books = inkdrop.store.getState().books.tree;

    try {
      await books.reduce((promise, book) => {
        return promise.then(() => exportBook(pathToSave, book));
      }, Promise.resolve());

      _inkdrop.logger.info('Finished exporting all notes');

      inkdrop.notifications.addInfo('Finished exporting all notes', {
        detail: 'Directory: ' + pathToSave,
        dismissable: true
      });
    } catch (e) {
      _inkdrop.logger.error('Failed to export:', e);

      inkdrop.notifications.addError('Failed to export', {
        detail: e.message,
        dismissable: true
      });
    }
  }
}

async function exportSingleNote() {
  const {
    editingNote
  } = inkdrop.store.getState();
  const {
    filePath: pathToSave
  } = await dialog.showSaveDialog({
    title: 'Save Markdown File',
    defaultPath: `${editingNote.title}.md`,
    filters: [{
      name: 'Markdown Files',
      extensions: ['md']
    }]
  });

  if (pathToSave) {
    try {
      const destDir = _path.default.dirname(pathToSave);

      const fileName = _path.default.basename(pathToSave);

      await exportNote(editingNote, destDir, fileName);
    } catch (e) {
      _inkdrop.logger.error('Failed to export editing note:', e, editingNote);

      inkdrop.notifications.addError('Failed to export editing note', {
        detail: e.message,
        dismissable: true
      });
    }
  }
}

async function exportBook(parentDir, book) {
  const db = inkdrop.main.dataStore.getLocalDB();
  const dirName = (0, _sanitizeFilename.default)(book.name, {
    replacement: '-'
  });

  const pathToSave = _path.default.join(parentDir, dirName);

  const {
    docs: notes
  } = await db.notes.findInBook(book._id, {
    limit: false
  });
  !_fs.default.existsSync(pathToSave) && _fs.default.mkdirSync(pathToSave);

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
    const datestr = new Date(note.createdAt).toISOString().split('T')[0].replace(/-/g, '');
    fileName = fileName || (0, _sanitizeFilename.default)(datestr + '-' + note.title + '-' + note._id.substr(5)) + '.md';

    const filePath = _path.default.join(pathToSave, fileName);

    let body = '# ' + note.title + '\n\n' + note.body;
    body = await (0, _inkdropExportUtils.replaceImages)(body, pathToSave, pathToSave);

    _fs.default.writeFileSync(filePath, body);

    _touch.default.sync(filePath, {
      time: new Date(note.updatedAt)
    });
  }
}