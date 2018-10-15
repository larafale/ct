import config from '../config'
import mongoose from 'mongoose'
import shortid from 'shortid'
import moment from 'moment'
import * as util from '../utils'
import _ from 'lodash'
import jwt from 'jsonwebtoken'
import Wallet from './wallet'
import watchlist from '../watchlist'
import Prices from '../lib/Prices'
import io from '../io'
import { log } from '../services/logger'



const isAuthRoot = auth => (auth && auth.role === 'root')

const protectedFields = []


/**
 * Schema
 */
const Schema = new mongoose.Schema({
  _id:          { type: String, default: shortid.generate },
  uid:          { type: String, required: true },
  wid:          { type: String, required: true }, // wallet id
  status:       { type: String, enum: ['pending', 'received', 'confirmed', 'expired'], default: 'pending' },
  network:      { type: String, default: config.network },
  address:      { type: String, required: true },
  cursor:       { type: Number }, // invoice with autogen address have no cursor 
  confs:        { type: Number }, // we default only in wallet model (which override invoice.confs if not passed)
  tx:           {
      satoshis: Number
    , height_discover: Number
    , height: Number
    , blockhash: String 
    , txhash: String 
    , index: Number 
    , ts: Number 
  },
  price:        {
      satoshis: Number
    , btc: Number
    , mbtc: Number
    , fiat: Number            // fiat values are always represented in a * 100 factor in database
    , unit: Number            // btc price in fiat
    , fiat_formated: String   // formated fiat string
    , unit_formated: String   // btc price in fiat
    , ticker: String
    , fiat_ticker: String
    , ts: Number
  }, 

  eat: { type: Date, default: Date.now },
  cat: { type: Date, default: Date.now }
}, { collection: 'invoices', versionKey: false })

/**
 * Add your
 * - pre-save hooks
 * - validations
 * - virtuals
 */

Schema.virtual('auth')
  .set(function (value) { this._auth = value })
  .get(function () { return this._auth || {} })

Schema.virtual('amount')
  .set(function (value) { this._amount = value })
  .get(function () { return this._amount || {} })

Schema.virtual('spread')
  .get(function () { 
    return this.price.satoshis && this.tx.satoshis
      ? (this.tx.satoshis - this.price.satoshis)
      : undefined
  })






Schema.pre('validate', async function(next) {
  const invoice = this

  // invalidate protected fields in case of update
  if(!this.isNew && !isAuthRoot(this.auth)){
    protectedFields.forEach(key => invoice.isModified(key) && invoice.invalidate(key, `The '${key}' field is protected`))
  }

  // at invoice creation, if no address is provided we ask the wallet for one.
  if(this.isNew && !this.address){
    try {
      const wallet = await Wallet.get(this.wid)
      const { address, cursor } = await wallet.nextAddress()
      this.address = address
      this.cursor = cursor
    }catch(e){
      invoice.invalidate('wid', e.message || e)
    }
  }

  if(this.amount.value){
    try { 
      const wallet = await Wallet.get(this.wid)
      const { ticker, fiat } = wallet
      this.price = await Prices.convert(this.amount.value, this.amount.ticker || ticker, this.amount.fiat || fiat) 
    }
    catch(e){ invoice.invalidate('amount', e.message) }
  }

  next()
})

Schema.pre('save', async function(next){
  let invoice = this

  if(invoice.isNew){
    invoice.wasNew = true

    // get expires settings from wallet
    const wallet = await Wallet.get(this.wid)
    invoice.wallet__ = wallet // ephemere proxy for post save

    // define expiration date
    invoice.eat = moment(invoice.cat).add(wallet.expires, 'm').toDate()
    // define confirmation numbers
    invoice.confs = (invoice.confs||invoice.confs==0) ? invoice.confs : wallet.confs
  }

  next()
})


Schema.post('save', async function(next){
  let invoice = this

  if(invoice.wasNew){
    watchlist.push(invoice.address, { iid: invoice.id })

    // trigger invoice expiration on time
    setTimeout(()=>{
      invoice.model('Invoice').updateExpired()
    }, invoice.wallet__.expires * 60 * 1000)
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
    delete ret.amount

    return ret
  }
}

/**
 * Methods
 */
Schema.method({


  // jwt: function() {
  //   const data = { 
  //       uid: this._id
  //     , sub: this._id
  //     , role: 'default'
  //     , email: this.email
  //   }

  //   return jwt.sign(data, config.jwt.secret, { 
  //     expiresIn: config.jwt.expires 
  //   })
  // }

  // broadcast invoice state
  broadcast: function() {
    const state = { 
        status: this.status 
      , height: this.tx.height || 0
      , satoshis: this.tx.satoshis || 0
    }

    log('invoice', 'status', { iid: this.id, ...state })
    io.of(config.ns).emit(`${this.id}`, state) // emit update
  }

})

/**
 * Statics
 */
Schema.statics = {


  get: async function(id) {
    return new Promise(async (resolve, reject) => {
      if(!id) return reject(`no invoice found`)

      let query = 
           (typeof id === 'object' && id)
        || (typeof id === 'string' && { $or: [{_id: id}] })

      query = { ...query, network: config.network }

      const invoice = await this.findOne(query)
      return invoice ? resolve(invoice) : reject(`invoice '${id}' not found`)
    }) 
  },

  list: async function({ query = {}, sort = { cat: -1 }, skip = 0, limit = 50 } = {}) {
    return await this.find({ ...query, network: config.network })
      .sort(sort)
      .skip(+skip)
      .limit(+limit)
      .exec()
  },

  // return eligible addresses for watchlist
  // used in app bootstraping
  watchlist: async function() {
    return new Promise(async (resolve, reject) => {
      const invoices = await this.find({ 
          $or: [
              { status: { $in: ['pending', 'received'] } }
            , { status: 'confirmed', 'tx.height': { $exists: false } }
          ]
        , network: config.network 
      }, { address: 1 }) 

      const list = invoices.reduce((acc, invoice) => {
        acc[invoice.address] = { iid: invoice._id }
        return acc
      }, {})
      
      resolve(list)
    }) 
  },

  updateExpired: async function() {
    return new Promise(async (resolve, reject) => {
      const invoices = await this.find({ 
          status: 'pending'
        , eat: { $lt: new Date() }
        , 'tx.txhash': { $exists: false }
        , 'tx.blockhash': { $exists: false }
        , network: config.network 
      }) 

      invoices.map(async (invoice) => {
        watchlist.pull(invoice.address)
        invoice.status = 'expired'
        await invoice.save()
        invoice.broadcast()
      })
      
      resolve(true)
    }) 
  },


  confirm: async function(invoice) {
    invoice = invoice.constructor.name == 'model'
      ? invoice : await this.get(invoice._id)

    invoice.status = 'confirmed' // set status
    // trigger callback

    await invoice.save()
    invoice.broadcast()

    return invoice
  },


  // this function is used everytime a block is found
  // it's also used in app bootstrap
  // It sanely confirm invoices depending on the confirmation needed
  updateUnconfirmed: async function(tip) {
    const query = [ 
        { $match:   { 
              status: { $nin: ['confirmed'] }
            , 'tx.height': { $gt: 0 } // we can only confirm is we have received the block
            , network: config.network 
        } }
      , { $project: { id: '$id', tip: { $sum: ['$confs', '$tx.height', -2] } } } // -2 offset
      , { $match:   { tip: { $lte: tip } } }
      , { $project: { id: '$id' } }
    ]
    // console.log(JSON.stringify(query))

    this.aggregate(query).then(results => {
      // console.log('scan result', tip, results)
      results.forEach(this.confirm.bind(this))
    })
  },


  // output exemple
  // { 
  //     satoshis: 2000000
  //   , address: 'mjuazEjgyC3Ks9Emzw1t14dEuNzucH6s6G'
  //   , index: 1
  //   , txhash: '12dd50276a0d607d89f546a34adabb9080646f1ff07c7eb53cf7667ff8b68290'
  //   , blockhash: '000000007a7eabeaa39964613517189d027959924c2d15282d479bfa5bce9342'
  //   , ts: 1516713565
  // }
  //
  // conf | tx        | block     | n block
  // -----|-----------|-----------|----------
  // 0    | confirmed | confirmed | X
  // 1    | received  | confirmed | X
  // n    | received  | received  | confirmed

  processOutput: async function({ type, output, height, meta }) {
    return new Promise(async (resolve, reject) => {
      try{
        let invoice = await this.get(meta && meta.iid)
        let hasChanged = false

        // match if address match then delete unneeded output values
        if(output.address != invoice.address) throw new Error('Invoice process error')
        else {
          delete output.address
          delete output.scriptPubKey
          delete output.scriptSig
        }

        // Case: receving tx (we also filter with status to avoid double tx rpc emission)
        if(type == 'tx' && invoice.status == 'pending'){
          hasChanged = true
          invoice.status = 'received'
          invoice.tx = output
          invoice.tx.height_discover = height
        }

        // Case: receving block
        if(type == 'block'){
          hasChanged = true
          invoice.tx = output
          invoice.tx.height = height
          // remove address from watchlist if block found
          watchlist.pull(invoice.address)
        }

        if(hasChanged){

          // update price info if missing
          if(!invoice.price.ts) {
            try { invoice.price = await Prices.convert(invoice.tx.satoshis, 'satoshis', 'eur') }
            catch(e){ console.log('fetch price error', e.message) }
          }

          // decide when to confirm invoice
          if(  (type == 'tx' && !invoice.confs) 
            || (type == 'block' && invoice.confs == 1)
            || (type == 'block' && !invoice.confs && !invoice.tx.txhash) // case where we missed tx with 0 confs settings
          ){
            invoice = await this.model('Invoice').confirm(invoice)
          
          // else just save state
          }else{
            invoice = await invoice.save()
            invoice.broadcast()
          }

          resolve(invoice)
        }else{
          resolve(false)
        }
        // if(invoice.price && invoice.price.satoshis != invoice.satoshis){
        //   // not the expect amount
        // }
        
      }catch(e){
        console.log('invoice process error', e)
        reject(e)
      }
    }) 
  },

  processOutputs: async function(outputs, type, height) {
    outputs.forEach(output => this.processOutput({
        type
      , output
      , height
      , meta: watchlist.get(output.address) 
    }))
    // .then(e => console.log('process result', !!e, type) )
    // .catch(e => console.log('process error', e) )
  },


  delete: async function(id) {
    return await this.remove({ _id: id })
  }

}

export default mongoose.model('Invoice', Schema)
