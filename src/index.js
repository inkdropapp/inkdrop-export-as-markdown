module.exports = {
  activate() {
    this.subscription = inkdrop.commands.add(document.body, {
      'export-all:export': () => this.execute()
    })
  },

  execute() {
    const { exportAll } = require('./exporter')
    exportAll()
  }
}
