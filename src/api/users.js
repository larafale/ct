import { Router } from 'express'
import User from '../models/user'
import { auth, load, own, toRes } from './mw'

const router = Router()

export default router

// List users
router.get('/', auth('root'), async (req, res) => {
  res.json(await User.list())
})

// Create user (via POST or GET)
router.post('/', ({ body, userIP }, res) => {
  const user = new User(body) 
  user.isFresh = true
  user.ip = userIP
  user.save(toRes(res))
})
router.get('/new', ({ body, query, userIP }, res) => {
  const user = new User({ ...body, ...query }) 
  user.isFresh = true
  user.ip = userIP
  user.save(toRes(res))
})

// Fetch user
router.get('/:id', [
    auth()
  , load('user')
  , own(({ auth, user }) => auth.sub===user._id)
], async ({ user }, res) => {
  toRes(res)(null, user)
})

// Update user
router.put('/:id', [
    auth()
  , load('user')
  , own(({ auth, user }) => auth.sub===user._id)
], async ({ user, body }, res) => { 
  user.set(body)
  user.save(toRes(res))
})