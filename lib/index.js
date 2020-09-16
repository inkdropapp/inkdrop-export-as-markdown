"use strict";

module.exports = {
  activate() {
    this.subscription = inkdrop.commands.add(document.body, {
      'export-as-markdown:all': () => this.exportAll(),
      'export-as-markdown:selections': () => this.exportSelectedNotes()
    });
  },

  exportAll() {
    const {
      exportAll
    } = require('./exporter');

    exportAll();
  },

  exportSelectedNotes() {
    const {
      exportSelectedNotes
    } = require('./exporter');

    exportSelectedNotes();
  }

};