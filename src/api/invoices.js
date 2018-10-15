import { Router } from 'express'
import Invoice from '../models/invoice'
import { auth, load, own, toRes } from './mw'
 
const router = Router()

export default router

// List invoices
router.get('/', auth(), async ({ auth }, res) => {
  const query = { uid: auth.sub }
  res.json(await Invoice.list({ query }))
})

// Create invoice (via POST or GET)
router.post('/', auth(), ({ auth, body }, res) => {
  const invoice = new Invoice(body) 
  invoice.uid = auth.sub
  invoice.save(toRes(res))
})
router.get('/new', auth(), ({ auth, body, query }, res) => {
  const invoice = new Invoice({ ...body, ...query }) 
  invoice.uid = auth.sub
  invoice.save(toRes(res))
})

// Fetch invoice
router.get('/:id', [
    auth('*')
  , load('invoice')
  // , own(({ auth, invoice }) => auth.uid===invoice.uid)
], async ({ invoice }, res) => {
  toRes(res)(null, invoice)
})

// Update invoice
router.put('/:id', [
    auth()
  , load('invoice')
  , own(({ auth, invoice }) => auth.sub===invoice.uid)
], async ({ invoice, body }, res) => { 
  invoice.set(body)
  invoice.save(toRes(res))
})

// Delete invoice
router.delete('/:id', [
    auth()
  , load('invoice')
  , own(({ auth, invoice }) => auth.sub===invoice.uid)
], async ({ params }, res) => { 

  Invoice.delete(params.id)
    .then(ok => toRes(res)(null, {}))
    .catch(toRes(res))
})