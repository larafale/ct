import { Router } from 'express'
import Wallet from '../models/wallet'
import { auth, load, own, toRes } from './mw'
 
const router = Router()

export default router

// List wallets
router.get('/', auth(), async ({ auth }, res) => {
  const query = { uid: auth.sub }
  res.json(await Wallet.list({ query }))
})

// Create wallet (via POST or GET)
router.post('/', auth(), ({ auth, body }, res) => {
  const wallet = new Wallet(body) 
  wallet.uid = auth.sub
  wallet.isFresh = true
  wallet.save(toRes(res))
})
router.get('/new', auth(), ({ auth, body, query }, res) => {
  const wallet = new Wallet({ ...body, ...query }) 
  wallet.uid = auth.sub
  wallet.isFresh = true
  wallet.save(toRes(res))
})

// Fetch wallet
router.get('/:id', [
    auth('*')
  , load('wallet')
  // , own(({ auth, wallet }) => auth.sub===wallet.uid)
], async ({ wallet }, res) => {
  toRes(res)(null, wallet)
})

// Update wallet
router.put('/:id', [
    auth()
  , load('wallet')
  , own(({ auth, wallet }) => auth.sub===wallet.uid)
], async ({ wallet, body }, res) => { 
  wallet.set(body)
  wallet.save(toRes(res))
})

// Delete wallet
router.delete('/:id', [
    auth()
  , load('wallet')
  , own(({ auth, wallet }) => auth.sub===wallet.uid)
], async ({ params }, res) => { 

  Wallet.delete(params.id)
    .then(ok => toRes(res)(null, {}))
    .catch(toRes(res))
})