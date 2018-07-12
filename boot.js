'use strict'

const Cron = require('cron')
const cron = Cron.CronJob

module.exports = function(cuk){
  let pkgId = 'task',
    pkg = cuk.pkg[pkgId]
  const { _, moment, helper } = cuk.pkg.core.lib

  const timeoutFn = function (c) {
    if (!_.has(c, 'timeout')) return
    if (c.locked) {
      if (!c.locked.isValid()) return
      if (moment().diff(c.locked, 'seconds') > c.timeout) {
        pkg.trace('%s: forced to execute after %s seconds timeout exceeded', c.name, c.timeout)
      } else {
        pkg.trace('%s: skipped', c.name)
        return false
      }
    }
    return moment()
  }

  pkg.lib.cron = Cron

  return new Promise((resolve, reject) => {
    helper('core:bootDeep')({
      pkgId: pkgId,
      name: '',
      action: opts => {
        const disabled = _.get(cuk.pkg.task, 'cfg.common.disabled', []),
          name = `${opts.pkg.id}:${opts.key}`
        if (disabled.indexOf(name) > -1) {
          helper('core:bootTrace')('%A Disabled %K %s loaded', null, null, name)
          return
        }
        let jobDef = require(opts.file)(cuk)
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
          onTick: _.throttle(onTick, helper('core:parseUnitOfTime')(pkg.cfg.common.throttle)),
          start: false,
          timeZone: jobDef.timezone || 'UTC',
        })
        job.name = name
        if (cuk.pkg.log && _.get(opts.pkg, 'cfg.cuks.task.log.' + opts.key))
          job.log = helper('log:make')(`${opts.pkg.id}:${opts.key}`)
        if (_.has(jobDef, 'timeout')) {
          job.timeout = jobDef.timeout
          job.locked = jobDef.locked || false
        }
        _.set(opts.pkg, 'cuks.task.' + opts.key, job)
        helper('core:bootTrace')('%A Enabled %K %s loaded', null, null, job.name)
        setTimeout(function(){
          if (!helper('core:isSet')(jobDef.autoStart) || jobDef.autoStart) {
            onTick.apply(job, arguments)
          }
          let start = !helper('core:isSet')(jobDef.start) ? true : jobDef.start
          if (start) job.start()
        }, helper('core:parseUnitOfTime')(pkg.cfg.common.initDelay))
      }
    })
    resolve(true)
  })
}