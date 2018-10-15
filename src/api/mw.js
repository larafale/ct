import config from '../config'
import jwt from 'jsonwebtoken'
import User from '../models/user'
import Wallet from '../models/wallet'
import Invoice from '../models/invoice'


export const toRes = (res, status) => {
  return (err, thing) => {
    if(!err) return res.status(status||200).json(thing)

    const send = err => res.status(status||500).json(err)

    if(err.errors) return send(err)
    if(err.error) return send(err)
    send({ error: err.message || err })
  }
}


export const auth = (roles = ['default']) => {
  roles = typeof roles == 'string' ? [roles] : roles
  return async (req, res, next) => {
    const { body, query } = req
    const token = (req.headers.authorization || '').split(' ')[1] || ({ ...body, ...query }).apikey || false
    const deny = () => toRes(res, 401)('unauthorized token')
    req.auth = {} // default auth

    // if token is invalid, deny
    if(token){
      try { req.auth = jwt.verify(token, config.jwt.secret) } 
      catch(e){ return toRes(res, 401)(e.message) }
    }

    if(token && (!req.auth.uid || !req.auth.sub)) return deny() // if required info missing, deny
    if(roles.includes('*')) return next() // if role is *, allow
    if(req.auth.role === 'root' || roles.includes(req.auth.role)) return next() // if role valid, allow
    deny()
  }
}

// load given resource in req
export const load = (key, param = 'id') => {
  return async (req, res, next) => {
    try {
      req[key] = await ({
          user: async (resource) => {
            resource = await User.get(req.params[param] || req.body[param] || req.query[param])
            resource.auth = req.auth
            return resource
          }
        , wallet: async (resource) => {
            resource = await Wallet.get(req.params[param] || req.body[param] || req.query[param])
            resource.auth = req.auth
            return resource
          }
        , invoice: async (resource) => {
            resource = await Invoice.get(req.params[param] || req.body[param] || req.query[param])
            resource.auth = req.auth
            return resource
          }
        // append other resource here
        // , user: async () => (await User.get(req.params[param])) || false
        // , user: async () => (await User.get(req.params[param])) || false
      })[key]()

      next()
    }catch(e) {
      return toRes(res, 404)(e)      
    }
  }
}

// execute a condition on resource ownership
export const own = (condition = () => false) => {
  return async (req, res, next) => {
    if(condition(req)) return next()
    toRes(res, 401)(`token don't own the resource`)
  }
}
