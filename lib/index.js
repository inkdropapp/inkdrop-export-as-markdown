"use strict";

module.exports = {
  activate() {
    this.subscription = inkdrop.commands.add(document.body, {
      'export-as-markdown:all': () => this.exportAll(),
      'export-as-markdown:single': () => this.exportSingleNote()
    });
  },

  exportAll() {
    const {
      exportAll
    } = require('./exporter');

    exportAll();
  },

  exportSingleNote() {
    const {
      exportSingleNote
    } = require('./exporter');

    exportSingleNote();
  }

};