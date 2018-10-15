import config from '../config'
import mongoose from 'mongoose'
import shortid from 'shortid'
import moment from 'moment'
import * as util from '../utils'
import _ from 'lodash'
import jwt from 'jsonwebtoken'
import mailer from '../services/mailer'
import MongoError from '../lib/MongoError'
import { log } from '../services/logger'

const isAuthRoot = auth => (auth && auth.role === 'root')

const protectedFields = [
    'ip'
  , 'role'
  , 'cat'
]




/**
 * Schema
 */
const Schema = new mongoose.Schema({
  _id:          { type: String, default: shortid.generate },
  ip:           { type: String },
  role:         { type: String }, // root, default
  email:        { type: String, validate: [ util.is.email, 'invalid email' ], lowercase: true, required: true, unique: true },
  slug:         { type: String },
  firstname:    { type: String },
  lastname:     { type: String },

  cat: { type: Date, default: Date.now }
}, { collection: 'users', versionKey: false })

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */

Schema.virtual('isFresh')
  .set(function (value) { this._isFresh = value || false })
  .get(function () { return this._isFresh || false })

Schema.virtual('auth')
  .set(function (value) { this._auth = value })
  .get(function () { return this._auth || {} })






Schema.pre('validate', function(next) {
  const self = this

  // invalidate protected fields in case of update
  if(!this.isNew && !isAuthRoot(this.auth)){
    protectedFields.forEach(key => self.isModified(key) && self.invalidate(key, `The '${key}' field is protected`))
  }

  next()
})


Schema.pre('save', async function(next){
  let user = this

  if(user.isNew){
    user.wasNew = true
  }

  next()
})


Schema.post('save', async function(next){
  let user = this

  if(user.wasNew) {
    const link = `${config.weburi}/login/${this.jwt('10m')}`
    mailer.template(`signup`, this.email, { link })

    log('user', 'signup', user.toObject())
  } 
})



Schema.options.toJSON = {
  getters: true,
  virtuals: true,
  minimize: false,
  transform(doc, ret, options) {

    const isRoot = isAuthRoot(ret.auth)

    if(!isRoot){
      protectedFields.forEach(key => {
        delete ret[key]
      })
    }

    delete ret._id
    delete ret.auth
    delete ret.isFresh

    return ret
  }
}

/**
 * Methods
 */
Schema.method({

  // send tmp jwt via email
  login: function() {
    const link = `${config.weburi}/login/${this.jwt('10m')}`
    // send via mail
    mailer.template(`login`, this.email, { link, date: new moment.utc().format('DD MMM YYYY @ HH:mm [Z]') })
  },

  jwt: function(expires) {
    const data = { 
        uid: this._id
      , sub: this._id
      , role: this.role || 'default'
      , email: this.email
    }

    const options = {}
    if(expires !== false) options.expiresIn = expires || config.jwt.expires 

    return jwt.sign(data, config.jwt.secret, options)
  }

})

/**
 * Statics
 */
Schema.statics = {


  get: async function(id) {
    return new Promise(async (resolve, reject) => {
      if(!id) return reject(`user not found`)
      const user = await this.findOne({ $or: [{_id: id}, {email: id}] })
      return user ? resolve(user) : reject(`user '${id}' not found`)
    }) 
  },

  list: async function({ query = {}, sort = { cat: -1 }, skip = 0, limit = 50 } = {}) {
    return await this.find(query)
      .sort(sort)
      .skip(+skip)
      .limit(+limit)
      .exec()
  }

}

Schema.plugin(MongoError)

export default mongoose.model('User', Schema)
