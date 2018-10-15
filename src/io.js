import config from './config'
import Io from 'socket.io'
import ctx from './ctx'
import chain from './chain'

const io = Io({
  'transports': ['websocket']
})

export default io


io.of(config.ns).on('connection', function(socket){
  // console.log('socket', socket.handshake.url, socket.handshake)
  // console.log('> [new connection]')
  socket.on('node', events.node)
  socket.on('mempool', events.mempool)
  socket.on('tip', events.tip)
  socket.on('last_blocks', events.last_blocks)
})

export const events = {
    node:  x => io.of(config.ns).emit('node', ctx.node)
  , mempool:  x => io.of(config.ns).emit('mempool', ctx.mempool)
  , tip:  x => io.of(config.ns).emit('tip', ctx.tip)
  , last_blocks:  x => io.of(config.ns).emit('last_blocks', ctx.last_blocks)
}


