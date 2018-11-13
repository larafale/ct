import config from '../config'
import { Router } from 'express'
import { auth, load, own, toRes } from './mw'
import _ from 'lodash'
import chain from '../chain'
import bitcoind from '../bitcoind'
import electrumx from '../electrumx'
import Address from '../address'
import Tx from '../tx'
import rateLimit from 'express-rate-limit'


const router = Router()
export default router

const limiter = rateLimit({
    windowMs: 10 * 60 * 1000 // 10 minutes
  , max: 10
  , keyGenerator: (req, res) => { return req.userIP }
  // , handler: (req, res) => { toRes(res, 429)(`Too many calls from this IP (${req.userIP}), please try again in 10min.`) }
  , handler: (req, res) => { toRes(res, 429)(`Rate limit reached, try again in 10min.`) }
  , onLimitReached: (req, res, options) => { console.log(`rate limit reached`, options) }
})

// router.use(limiter) 


router.get('/tx/:hash', async ({ params, query }, res) => {
  try {
    if(config.network != 'mainnet') throw Error(`Endpoint is not '${config.network}' ready yet !`)

    // return hex
    const hex = await electrumx.call('blockchain.transaction.get', params.hash)
    if(query.format == 'hex') return res.json({ hex })

    // or full dumped tx
    const tx = (await Tx.fromHex(hex)).dump()
    res.json(tx)
  }catch(e){
    toRes(res)(e.message || 'unable to fetch tx')
  }
})


// proxy bitcoind rcp commands
// GET /bitcoind/command,arg1,arg2...
router.get('/bitcoind/:args', async ({ params }, res) => {
  let result = false

  // sanitize args (cast numbers to int)
  const args = _.map(params.args.split(','), a => {
    return isNaN(a) ? a : parseFloat(a, 10)
  })

  // make the rpc call
  try { result = await bitcoind.call(...args) }
  catch(e) { result = e.message }

  // return result
  res.json({ args, result })
})


// proxy electrum rcp commands
// GET /electrum/command,arg1,arg2...
router.get('/electrumx/:args', async ({ params }, res) => {
  let result = false

  // sanitize args (cast numbers to int)
  const args = _.map(params.args.split(','), a => {
    return isNaN(a) ? a : parseFloat(a, 10)
  })

  // make the rpc call
  try { result = await electrumx.call(...args) }
  catch(e) { result = e.message }

  // return result
  res.json({ args, result })
})

