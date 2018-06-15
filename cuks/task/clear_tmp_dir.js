'use strict'

module.exports = function(cuk) {
  const { _, globby, path, fs, moment, helper } = cuk.lib
  const pkg = cuk.pkg.task

  return {
    time: '*/30 * * * *',
    onTick: function() {
      this.locked = moment()
      const tmp = path.join(cuk.dir.data, 'tmp')
      const files = globby.sync(tmp, '**/*', {
        dot: true
      })
      let success = 0, error = 0, skipped = 0, excluded = 0

      let exclude = _.get(pkg.cfg, 'cuks.task.clearTmpDir.exclude', []),
        excludeDir = _.filter(exclude, item => {
          if (!fs.existsSync(item)) return false
          return fs.statSync(item).isDirectory()
        })
      exclude = _.difference(exclude, excludeDir)

      _.each(files, f => {
        if (excludeDir.indexOf(path.dirname(f)) > -1 || exclude.indexOf(f) > -1) {
          skipped++
          return
        }
        let stat = fs.statSync(f),
          mtime = moment(stat.mtime),
          maxAge = _.get(pkg.cfg, 'cuks.task.clearTmpDir.maxAge', 1000*60*60)
        if (moment().diff(mtime) > maxAge)
          try {
            fs.unlinkSync(f)
            success++
          } catch(e) {
            error++
          }
        else
          skipped++
      })
      helper('task:removeEmptyDir')(tmp)
      pkg.trace('%s » status: Success %d, Fail: %d, Skipped: %d', this.name, success, error, skipped)
      this.locked = false
    },
    timeout: 30,
    autoStart: true
  }

}