"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.exportAll = exportAll;
exports.exportSelectedNotes = exportSelectedNotes;
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

async function exportSelectedNotes() {
  const {
    noteListBar,
    notes
  } = inkdrop.store.getState();

  if (noteListBar.selectedNoteIds.length > 1) {
    inkdrop.notifications.addInfo('Exporting notes started', {
      detail: 'It may take a while..',
      dismissable: true
    });
    await exportMultipleNotes(noteListBar.selectedNoteIds);
    inkdrop.notifications.addInfo('Exporting notes completed', {
      detail: '',
      dismissable: true
    });
  } else if (noteListBar.selectedNoteIds.length === 1) {
    const note = notes.hashedItems[noteListBar.selectedNoteIds[0]];
    exportSingleNote(note);
  } else {
    inkdrop.notifications.addError('No note opened', {
      detail: 'Please open a note to export',
      dismissable: true
    });
  }
}

async function exportSingleNote(note) {
  const {
    filePath: pathToSave
  } = await dialog.showSaveDialog({
    title: 'Save Markdown File',
    defaultPath: `${note.title}.md`,
    filters: [{
      name: 'Markdown Files',
      extensions: ['md']
    }]
  });

  if (pathToSave) {
    try {
      const destDir = _path.default.dirname(pathToSave);

      const fileName = _path.default.basename(pathToSave);

      await exportNote(note, destDir, fileName);
    } catch (e) {
      _inkdrop.logger.error('Failed to export editing note:', e, note);

      inkdrop.notifications.addError('Failed to export editing note', {
        detail: e.message,
        dismissable: true
      });
    }
  }
}

async function exportMultipleNotes(noteIds) {
  const {
    notes
  } = inkdrop.store.getState();
  const {
    filePaths: res
  } = await dialog.showOpenDialog(inkdrop.window, {
    title: 'Select Destination Directory',
    properties: ['openDirectory']
  });

  if (res instanceof Array && res.length > 0) {
    const destDir = res[0];

    for (let noteId of noteIds) {
      const note = notes.hashedItems[noteId];

      if (note) {
        const fileName = `${note.title}.md`;
        await exportNote(note, destDir, fileName);
      }
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
