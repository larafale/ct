import { Router } from 'express'
import { auth, load, own, toRes } from './mw'
import _ from 'lodash'
import Address from '../address'
import { listunspent } from '../electrumx'




const router = Router()
export default router 


// Given an xpub, return full wallet data structure
router.get('/derive/:pubkey', async ({ params, query }, res) => {
  try { toRes(res)(null, Address.derive(params.pubkey, { end: query.end })) }
  catch(e) { toRes(res, 400)(e) }
})

// Given an xpub, return full wallet data structure
router.get('/wallet/:pubkey', async ({ params }, res) => {
  try { toRes(res)(null, await Address.discover(params.pubkey, { gap: 5 })) }
  catch(e) { toRes(res, 400)(e) }
}) 

// get utxos from addresses
router.get('/utxos/:addresses', async ({ params }, res) => {
  try { toRes(res)(null, await listunspent(params.addresses)) }
  catch(e) { toRes(res, 400)(e) }
}) 


