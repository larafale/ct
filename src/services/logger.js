import winston from 'winston'
import expressWinston from 'express-winston'
// import { Loggly } from 'winston-loggly-bulk'
// import R7 from 'r7insight_node' // this just expose Logentries to winston.transports


const Format = winston.format
const Cache = {}

let logFilter = /.*/
export const setLogFilter = (filter) => { logFilter = filter }
export const doFilter = (filter) => { logFilter = filter }



// const createLogglyTransport = (tags) => {
//   const logger = new Loggly({
//       subdomain: ''
//     , token: ''
//     , json: true
//     , tags: Array.isArray(tags) ? tags : (tags ? [tags] : []) 
//   })

//   logger.on('error', err => console.log('loggly err', err))
//   return logger
// }

// const createR7Transport = () => {
//   const logger = new winston.transports.Logentries({
//       token: '123ff19b-9418-4686-a67e-cf0649d81617'
//     , region: 'eu'
//   })
//   logger.on('error', err => console.log('r7 err', err))
//   return logger
// }



// Console Log
export const log = (namespace, message, meta={}, {level='info'}={}) => {
  const key = `log:${namespace}`
  const logger = Cache[key] || winston.createLogger({
      transports: [ new winston.transports.Console({
          format: Format.combine(
            Format.colorize(),
            Format.simple(),
            // Format.printf(info => `${JSON.stringify(info)}`)
          )
      }) ]
    , exitOnError: false
    , meta: true
  })

  // cache logger
  Cache[key] = logger

  // execute log
  message = `[${namespace}] ${message}`
  if(logFilter.test(namespace)) logger[level](message, meta)
}

log.error = (namespace, message, meta={}, options={}) => {
  log(namespace, message, meta, { ...options, level: 'error' }) 
}

log.warn = (namespace, message, meta={}, options={}) => {
  log(namespace, message, meta, { ...options, level: 'warn' }) 
}



// Saas Log
export const logSave = (namespace, message, meta = {}) => {
  const key = `logSave:${namespace}`
  const logger = Cache[key] || winston.createLogger({
      transports: [ 
          // createLogglyTransport(namespace) 
        // , createR7Transport()
      ]
    , exitOnError: false
    , meta: true
  })

  // cache logger
  Cache[key] = logger

  // execute log
  // top level safety before trigger
  // logger.info(message, meta) // uncomment for test
  process.env.NODE_ENV == 'production' && logger.info(message, meta)
} 





// Express HTTP Log middleware

export const expressLogger = ({ 
    namespace='http'
  , log=true
  , logSave=false
}) => (req, res, next) => {

  const transports = []

  // console log
  if(log) transports.push(new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
  }))

  // sass log
  if(logSave){
    // transports.push(createR7Transport()) // logentries
    // transports.push(createLogglyTransport(namespace)) // loggly
  }


  // Remove all tokens info before sending to 3th party service
  // because req.url cannot be set, we use a different filed (endpoint) to represent the url
  req.endpoint = req.url.replace(/token=[a-zA-Z0-9\-_.]*/, 'token=xxx')
  req.endpoint = req.endpoint.replace(/apikey=[a-zA-Z0-9\-_.]*/, 'apikey=xxx')
  

  expressWinston.logger({
      winstonInstance: winston.createLogger({
          transports
        , exitOnError: false
        , meta: true
      })
    // , msg: "{{req.date}} [http] {{req.method}} {{req.endpoint}} {{res.statusCode}}"
    , msg: `[http]`
    , requestWhitelist: ['userIP', 'method', 'endpoint', 'body']
    , responseWhitelist: ['statusCode']
    , bodyBlacklist: ['token', 'xpub']
    , ignoreRoute: (req, res) => {
        const cond = req.endpoint == '/favicon.ico'
          || /^\/users\/[a-z0-9\-]*\/views/.test(req.endpoint)
        // console.log('route', req.url, cond)
        return cond
      }
  })(req, res, next)

}