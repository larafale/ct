import { Router } from 'express'
import { auth, load, own, toRes } from './mw'
import Prices from '../lib/Prices'
 
const router = Router()

export default router


router.get('/:pair', async ({ params }, res) => {
  const { pair } = params
  const [ ticker, fiatTicker ] = pair.split('-')
  Prices.info(fiatTicker || ticker)
    .then(price => toRes(res)(null, price))
    .catch(toRes(res))
})

router.get('/:amount/:pair', async ({ params }, res) => {
  const { amount, pair } = params
  const [ ticker, fiatTicker ] = pair.split('-')
  Prices.convert(amount, ticker, fiatTicker)
    .then(price => toRes(res)(null, price))
    .catch(toRes(res))
})

