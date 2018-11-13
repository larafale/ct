import { Router } from 'express'
import { auth, load, own, toRes } from './mw'
import _ from 'lodash'
import Address from '../address'
import { listunspent } from '../electrumx'




const router = Router()
export default router 


// derive an xpubkey
router.get('/derive/:pubkey', async ({ params, query }, res) => {
  const limit = { start: parseInt(query.start, 10) || 0, end: parseInt(query.end, 10) || 0 }
  if(limit.end && (limit.end-limit.start) > 100) return toRes(res, 400)('maximum of 100 derivations per call')
  try { toRes(res)(null, Address.derive(params.pubkey, { start: query.start, end: query.end })) }
  catch(e) { toRes(res, 400)(e) }
})

// Given an xpub, return full wallet data structure
router.get('/wallet/:pubkey', async ({ params }, res) => {
  try { toRes(res)(null, await Address.discover(params.pubkey, { gap: 5 })) }
  catch(e) { toRes(res, 400)(e) }
}) 

// get utxos from addresses
// /utxos/adr1,adr2,adr3...
router.get('/utxos/:addresses', async ({ params }, res) => {
  try { toRes(res)(null, await listunspent(params.addresses)) }
  catch(e) { toRes(res, 400)(e) }
}) 


