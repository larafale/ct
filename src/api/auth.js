import config from '../config'
import jwt from 'jsonwebtoken'
import { Router } from 'express'
import { auth, load, own, toRes } from './mw'
import User from '../models/user'

const router = Router()

export default router

// send Login request
router.post('/login', [
    load('user', 'email')
], async ({ user, auth }, res) => {
  user.login()
  toRes(res)()
})

// Swap temporary jwt with real jwt
router.post('/token', async ({ body }, res) => {
  try {
    // check if jwt is not expired
    const auth = jwt.verify(body.claim, config.jwt.secret)
    // load user
    const user = await User.get(auth.sub)
    // return fresh token
    toRes(res)(null, { jwt: user.jwt() })
  }catch(e){
    toRes(res)('Invalid/expired claim token')
  }
})

// Signup, return user with jwt (same as POST /users)
router.post('/signup', ({ body, userIP }, res) => {
  const user = new User(body) 
  user.isFresh = true
  user.ip = userIP
  user.save(toRes(res))
})


// let role=root token claim token of another user
// takes 'sub' as parameter of other user id
router.post('/supertoken', [
    auth('root')
  , load('user', 'sub')
], async ({ user, auth }, res) => {
  const data = { 
      uid: auth.uid
    , role: auth.role // auth.role in this case can only be equal to root
    , email: auth.email
    , sub: user.id // we set subject as user we want to view
  }

  const token = jwt.sign(data, config.jwt.secret, { expiresIn: config.jwt.expires })

  toRes(res)(null, { jwt: token })
})
