'use strict'

const Cron = require('cron')
const cron = Cron.CronJob

module.exports = function(cuk){
  let pkgId = 'task',
    pkg = cuk.pkg[pkgId]
  const { _, moment, helper } = cuk.lib

  const timeoutFn = function (c) {
    if (!(_.has(c, 'timeout') && (_.has(c, 'locked')))) return
    if (c.locked) {
      if (moment().diff(c.locked, 'seconds') > c.timeout) {
        pkg.trace('%s: forced to execute after %s seconds timeout exceeded', c.name, c.timeout)
      } else {
        pkg.trace('%s: skipped', c.name)
        return false
      }
    }
    return moment()
  }

  pkg.trace('Initializing...')
  pkg.lib.cron = Cron

  return new Promise((resolve, reject) => {
    helper('core:bootDeep')({
      pkgId: pkgId,
      name: '',
      action: opts => {
        let jobDef = require(cuk)(opts.file)
        pkg.trace('Serve » %s loaded', opts.key)
        let onTick = jobDef.onTick
        if (_.has(jobDef, 'timeout') && _.has(jobDef, 'locked')) {
          let oFn = onTick
          onTick = function() {
            let lock = timeoutFn(this)
            if (!lock) return
            this.locked = lock
            oFn.apply(this, arguments)
          }
        }
        let job = new cron({
          cronTime: jobDef.time,
          onTick: _.throttle(onTick, pkg.cfg.common.throttle),
          start: false,
          timeZone: jobDef.timezone || 'UTC',
        })
        job.name = `${id}:${jobId}`
        job.log = debug('paps:task:' + job.name)
        if (_.has(jobDef, 'timeout') && _.has(jobDef, 'locked')) {
          job.timeout = jobDef.timeout
          job.locked = jobDef.locked
        }
        _.set(opts.pkg, 'cuks.task.' + opts.key, job)
        setTimeout(function(){
          if (!helper('core:isSet')(jobDef.runOnInit) || jobDef.runOnInit) {
            onTick.apply(job, arguments)
          }
          let start = !helper('core:isSet')(jobDef.start) ? true : jobDef.start
          if (start) job.start()
        }, pkg.cfg.common.initDelay)

      }
    })
    resolve(true)
  })
}