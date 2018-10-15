import { log } from './services/logger'


let w = {}

export default {

    get: address => address ? (w[address]||false) : w
  , set: list => { w = list || w }
  , push: (address, data) => {
      log('watchlist', 'add', { address })
      w[address] = data
    }
  , pull: (address) => {
      log('watchlist', 'remove', { address })
      delete w[address]
    } 
  , keys: () => Object.keys(w)

}