import config from '../config'
import mongoose from 'mongoose'
import shortid from 'shortid'
import moment from 'moment'
import * as util from '../utils'
import _ from 'lodash'
import jwt from 'jsonwebtoken'
import Address from '../address'
import MongoError from '../lib/MongoError'
import { isWebUri } from 'valid-url'



const isAuthRoot = auth => (auth && auth.role === 'root')

const protectedFields = []

 
/**
 * Schema
 */
const Schema = new mongoose.Schema({
  _id:          { type: String, default: shortid.generate },
  token:        { type: String },
  name:         { type: String, default: 'The Moon ☾ Wallet', required: true },
  uid:          { type: String, required: true },
  xpub:         { type: String, unique: true, sparse: true, trim: true }, 
  network:      { type: String, default: config.network },
  cursor:       { type: Number, default: -1 },
  
  // Invoice settings
  hook:         { type: String, validate: { validator: v => !v || !!isWebUri(v), message: 'Invalid hook url' } },
  confs:        { type: Number, default: 1, min: 0, max: 10 }, // block confs
  ticker:       { type: String, default: 'mbtc' },
  fiat:         { type: String, default: 'usd' },
  expires:      { type: Number, default: 20, min: 1, max: 1440 }, // number of minutes before epiration
  authOnly:     { type: Boolean, default: true }, // by default, you cannot create invoice without auth

  cat: { type: Date, default: Date.now }
}, { collection: 'wallets', versionKey: false })

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
  const wallet = this

  // invalidate protected fields in case of update
  if(!this.isNew && !isAuthRoot(this.auth)){
    protectedFields.forEach(key => wallet.isModified(key) && wallet.invalidate(key, `The '${key}' field is protected`))
  }

  // removing xpub
  if(!wallet.xpub && wallet.isModified('xpub')){
    wallet.xpub = undefined // we unset field from db, allowing unique index to not throw on empty fields
  }

  // adding/changing xpub
  if(wallet.xpub && wallet.isModified('xpub')){
    const network = config.network

    if(Address.isPubkeyValid(wallet.xpub, network)){ // set wallet config
      wallet.index = 0
      wallet.network = network
    }else{
      wallet.invalidate('xpub', `Not a valid "${network}" pubkey`)
    }
  } 

  next()
})


Schema.pre('save', async function(next){
  let wallet = this

  if(wallet.isNew){
    wallet.wasNew = true
  }

  next()
})


Schema.post('save', async function(next){
  let wallet = this

  // if(wallet.wasNew) wallet.sendEmail('signup')
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
    // if(!ret.isFresh) delete ret.token // we may want to return token for root wallet (just take this line in the above condition)
    delete ret.isFresh

    return ret
  }
}

/**
 * Methods
 */
Schema.method({

  nextAddress: async function() {
    let { xpub, network, cursor, pool=[] } = this
    if(!xpub || !network) throw new Error('Wallet has no pubkey')
    
    if(pool.length){
      cursor = pool[0]
      // this.pool = new pool array
    }else{
      cursor++
      this.cursor = cursor
    }
 
    const [ derivations ] = Address.derive(xpub, { 
        start: cursor
      , end: cursor 
    })

    await this.save()

    return { cursor, address: derivations[0] }
  }

})

/**
 * Statics
 */
Schema.statics = {

  get: async function(id) {
    return new Promise(async (resolve, reject) => {
      if(!id) return reject(`wallet not found`)

      let query = 
           (typeof id === 'object' && id)
        || (typeof id === 'string' && { $or: [{_id: id}] })

      query = { ...query }

      const wallet = await this.findOne(query)
      return wallet ? resolve(wallet) : reject(`wallet '${id}' not found`)
    }) 
  },

  // return default wallet of an user
  getDefault: async function(uid) {
    return new Promise(async (resolve, reject) => {
      if(!uid) return reject(`no uid provided, can't find default wallet`)

      let query = { uid, network: config.network }
      const wallet = await this.findOne(query)
      return wallet ? resolve(wallet) : reject(`no default wallet found for uid "${uid}"`)
    }) 
  },

  list: async function({ query = {}, sort = { cat: -1 }, skip = 0, limit = 50 } = {}) {
    return await this.find({ ...query, network: config.network })
      .sort(sort)
      .skip(+skip)
      .limit(+limit)
      .exec()
  },

  delete: async function(id) {
    return await this.remove({ _id: id })
  }

}

Schema.plugin(MongoError)

export default mongoose.model('Wallet', Schema)
