import config from './config'
import { payments as Payments, bip32, address, networks as Networks, crypto as Crypto, script as Script } from 'bitcoinjs-lib'
import { listunspent } from './electrumx'
import { Scale } from './lib/Prices'
import _ from 'lodash'
import hrtime from 'pretty-hrtime'
import b58 from 'bs58check'

// we default to bitcoinjs & add features
const Address = address 
const networkMap = { mainnet: 'bitcoin', testnet: 'testnet' }

// https://github.com/satoshilabs/slips/blob/master/slip-0132.md
const slip0132 = {
    xpub: { network: 'mainnet', magic: '0488b21e', path: `m/44'/0'`, type: 'p2pkh'    , addressesStartWith: '1..', info: 'P2PKH or P2SH' }          // tested (legacy)
  , ypub: { network: 'mainnet', magic: '049d7cb2', path: `m/49'/0'`, type: 'p2wpkh'   , addressesStartWith: '3..', info: 'P2SH > P2WPKH nested' }   // tested (segwit)
  , Ypub: { network: 'mainnet', magic: '0295b43f', path: ``        , type: 'p2wsh'    , addressesStartWith: '3..', info: 'P2SH > P2WSH nested' }    // not tested (segwit)
  , zpub: { network: 'mainnet', magic: '04b24746', path: `m/84'/0'`, type: 'p2wpkh'   , addressesStartWith: 'bc1', info: 'P2WPKH' }                 // tested (segwit nativ)
  , Zpub: { network: 'mainnet', magic: '02aa7ed3', path: ``        , type: 'p2wsh'    , addressesStartWith: 'bc1', info: 'P2WSH' }                  // tested (segwit nativ)

  , tpub: { network: 'testnet', magic: '043587cf', path: `m/44'/1'`, type: 'p2pkh'    , addressesStartWith: 'm|n', info: 'P2PKH or P2SH' }          // tested (legacy)
  , upub: { network: 'testnet', magic: '044a5262', path: `m/49'/1'`, type: 'p2wpkh'   , addressesStartWith: '...', info: 'P2SH > P2WPKH nested' }   // not tested (segwit)
  , Upub: { network: 'testnet', magic: '024289ef', path: ``        , type: 'p2wsh'    , addressesStartWith: '...', info: 'P2SH > P2WSH nested' }    // not tested (segwit)
  , vpub: { network: 'testnet', magic: '045f1cf6', path: `m/84'/1'`, type: 'p2wpkh'   , addressesStartWith: 'tb1', info: 'P2WPKH' }                 // tested (segwit nativ)
  , Vpub: { network: 'testnet', magic: '02575483', path: ``        , type: 'p2wsh'    , addressesStartWith: 'tb1', info: 'P2WSH' }                  // not tested (segwit nativ)
}



Address.derive = (pubkey, { start=0, end=4, type='received' } = {}) => {
  // cast ints
  start = parseInt(start, 10)
  end = parseInt(end, 10)

  const prefix = pubkey.substr(0, 4)
  const options = slip0132[prefix]
  if(!options) throw `invalid/unsupported pubkey`

  const pubkeyType = options.type
  const networkName = options.network
  const network = Networks[networkMap[networkName]]

  const info = {
      network: networkName
    , pubkeyType
    , prefix
  }

  // reconvert to xpub or tbup (only way bitcoins derivation works)
  if(options.network == 'mainnet' && prefix != 'xpub') pubkey = pubkeyTo('xpub', pubkey)
  if(options.network == 'testnet' && prefix != 'tpub') pubkey = pubkeyTo('tpub', pubkey)


  const node = bip32.fromBase58(pubkey, network)

  const derivations = _.range(start, end+1).map(i => {
    const derivedKey = node.derive(({received:0, change:1})[type]).derive(i)
    const addressPublicKey = derivedKey.publicKey

    const result = (prefix == 'ypub' || prefix == 'upub') 
      ? Payments.p2sh({ redeem: Payments.p2wpkh({ pubkey: addressPublicKey }) })  // non native segwit (for now i only assume this is for TREZOR wallet)
      : Payments[pubkeyType]({ pubkey: addressPublicKey, network }) // non segwit or segwit nativ

    return result.address
  })

  if(!derivations.length) throw `invalid/unsupported pubkey`

  return [derivations, info]
}


// Convert a WIF to scripthash
// electrum reverse scripthash for whatever reason, so that function implement a reverse return for ease of use
export const addressToScriptHash = Address.addressToScriptHash = (address, reverse) => {
  let script = Address.toOutputScript(address)
  let hash = Crypto.sha256(script)
  // electrum reverse the scripthash for whatevere reason
  return reverse ? hash.reverse().toString('hex') : hash.toString('hex')
}


export const pubkeyTo = (prefix='xpub', pubkey) => {
  let data = b58.decode(pubkey)
  data = data.slice(4)
  data = Buffer.concat([Buffer.from(slip0132[prefix].magic,'hex'), data])
  return b58.encode(data)
}

export const isPubkeyValid = Address.isPubkeyValid = (pubkey, network) => {
  try { 
    const { 1: info } = Address.derive(pubkey, { end: 1 })
    if(network && info.network != network) return false
    return true 
  }
  catch(e){ return false }
}




// given an xpub, discover the next non utxo
Address.discover = async (xpub, { gap=5 } = {}) => {
  const exec_start = process.hrtime()

  // cast ints
  gap = parseInt(gap, 10)

  const [received, change] = await Promise.all([
      Address.scan(xpub, { gap, type: 'received' })
    , Address.scan(xpub, { gap, type: 'change' })
    // uncomment line below to test scan for only received type, and comment line scan type change 
    // , new Promise(resolve => resolve({
    //     "balance": 0,
    //     "utxos": [],
    //     "address": "",
    //     "cursor": 0,
    //     "balance_btc": 0
    //   }))
  ])

  const result = {
      balance: received.balance + change.balance
    , balance_btc:  Scale.satoshis2btc(received.balance + change.balance)
    , gap
    , exec_time: hrtime(process.hrtime(exec_start), { precise: false })
    , utxos_count: received.utxos.length + change.utxos.length
    , utxos: { received, change }
  }

  return result
}



// Scan utxos from xpub and return infos
// - balance (total scanned utxos 'value')
// - next available 'address' and 'cursor'
// - utxos set
//
// example response :
//
//    {
//        balance: 45783193
//      , address: "15ZbNesdzcYRc69nT6vj2ZojtoMoTj77ko"
//      , cursor: 10
//      , utxos:[
//          {
//              height:498100
//            , tx_hash: "8cae34f81abde53a47c2c1374c5f7d4841c509e852b56d50e2d34530fc78fd51"
//            , tx_pos: 28
//            , value: 45783193
//          }, ...
//        ]
//    }
// TODO: implement memory limit safeguard (if iteration > 1000, throw)
Address.scan = async (xpub, { 
    network = "mainnet"
  , type='received'
  , gap=5
  , start=0
  , end=0
  , counter=0
  , result={ balance: 0, utxos: [] } 
  , exec_start=process.hrtime() 
} = {}) => {

  try {
    // const timeout = setTimeout(()=>{ throw new Error('scan timeout') },)
    end = end || (start+(gap-1))

    const [ addresses ] = Address.derive(xpub, { start, end, type })    
    const  utxos = await listunspent(addresses)
    
    const query = _.reduce(_.keys(utxos), (acc, address) => {
      if(acc.finish) return acc

       // every time time we get an empty utxo set
      if(!utxos[address].length){
        acc.counter++

        // set future potential result
        if(acc.counter == 1){
          // console.log('potential next address', address, start+acc.index)
          acc.result.address = address
          acc.result.cursor = start+acc.index
        }
      
      // else reset
      }else{
        acc.counter = 0

        // increment balance
        utxos[address].forEach(xo => {
          acc.result.utxos.push(xo) // utxos set
          acc.result.balance += xo.value // add up balance
        })
      }

      // gap found, we end
      if(acc.counter === gap) acc.finish = true

      acc.index++
      return acc

    }, { index: 0, finish: false, counter, result })

    // console.log('query', query) 

    if(query.finish){
      query.result.exec_time = hrtime(process.hrtime(exec_start), { precise: false })
      query.result.balance_btc = Scale.satoshis2btc(query.result.balance)
      return query.result
    }else{
      return await Address.scan(xpub, { 
          network
        , type
        , gap
        , start: end+1
        , end: (end+gap)
        , counter: query.counter
        , result: query.result 
        , exec_start
      })
    }

  }catch(e){
    console.log('Address.scan() catch:', e.message || e)
    throw e
  }
}





export default Address