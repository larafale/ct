import config from './config'
import _ from 'lodash'
import http from 'http'
import async from 'async'
import express, { Router } from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import jwt from 'jsonwebtoken'

import { cluster } from './cluster'
import ctx from './ctx'
import chain from './chain'
import watchlist from './watchlist'

import mailer from './services/mailer'
import { expressLogger } from './services/logger'

import { toRes } from './api/mw'
import usersRouter from './api/users'
import walletsRouter from './api/wallets'
import invoicesRouter from './api/invoices'
import pricesRouter from './api/prices'
import authRouter from './api/auth'
import rawRouter from './api/raw'
import utilsRouter from './api/utils'

import Address from './address'

// --------------------
// Exports
// --------------------

const app = express()
export default app
export const server = http.Server(app)

// --------------------
// Server Middlewares
// --------------------

app.use((req, res, next) => {
  if(req.path == '/favicon.ico') return res.status(204)
  next()
})

app.disable('x-powered-by') 
app.set('json spaces', 4)

app.use(cors())

app.use(bodyParser.json({ limit : '100kb' }))

app.use((req, res, next) => {
  const ip = (req.headers['x-forwarded-for']||'').split(',').pop()
    || (req.connection && req.connection.remoteAddress)
    || (req.socket && req.socket.remoteAddress)
    || req.ip

  req.userIP = ip.replace('::ffff:', '')
  next()
})


app.use(expressLogger({
    log: true
  , logSave: false
}))


// top level error
app.use((err, req, res, next) => {
  console.error('top level', err.stack)
  toRes(res, 500)('top level')
})




// app.get('/test', async (req, res) => {
//   try {
//     // const xpub = 'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8'
//     // const result = await Address.discover(xpub, { network: config.network })

//     const result = await mailer.template(`login`, `guest@domain.tld`, { link: `${config.weburi}/link` })
//     console.log('result', result)

//     res.json(result)

//   }catch(e){ 
//     console.log('boboo', e)
//     res.json({ err: e.message }) 
//   }
// })



// --------------------
// TMP Routes
// --------------------


app.get('/', (req, res) => {
  res.json({ 
      name: `coretool 1.0`
    , network: ctx.node.network
    , master_id: cluster.masterId
    , cluster_id: cluster.id
  })
})

app.get('/ctx', (req, res) => {
  return res.json(ctx)
})

app.get('/watchlist', (req, res) => {
  return res.json(watchlist.keys())
})

app.get('/last_blocks', (req, res) => {
  return res.json(ctx.last_blocks)
})

app.get('/block/:hash', async ({ params, query }, res) => {
  return res.json(await chain.getBlock(params.hash, query))
})


// attach routers
app.use('/auth', authRouter)
app.use('/users', usersRouter)
app.use('/wallets', walletsRouter)
app.use('/invoices', invoicesRouter)
app.use('/prices', pricesRouter)
app.use('/raw', rawRouter)  
app.use('/utils', utilsRouter)   


// api description
app.get('/help', async (req, res) => {
  const routes = app._router.stack          // registered routes
    .filter(r => r.route)    // take out all the middleware
    .map(r => r.route.path)
 
  res.json({ routes }) 
})


// return 500 if no routes founds
app.use('*', ({ baseUrl }, res, next) => {
  toRes(res, 500)(`route ${baseUrl} not found`)
})


