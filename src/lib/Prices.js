import axios from 'axios'
import async from 'async'
import _ from 'lodash'
import Big from 'big.js'

export const Settings = {
    debug: false
  , timeout: 5000
  , btcTickers: ['btc', 'mbtc', 'satoshis']
  , fiatTickers: ['usd', 'eur', 'jpy', 'gbp', 'cad']
  , symbols: { 
        btc: { sign: 'BTC' , ticker: 'BTC' }
      , mbtc:{ sign: 'mBTC', ticker: 'mBTC' }
      , satoshis: { sign: 'sat' , ticker: 'satoshis' }
      , usd: { sign: '$',  ticker: '$ (USD)' }
      , eur: { sign: '€',  ticker: '€ (EUR)' }
      , jpy: { sign: '￥', ticker: '￥ (JPY)' }
      , gbp: { sign: '£',  ticker: '£ (GBP)' }
      , cad: { sign: 'C$', ticker: '$ (CAD)' }
    }
}// Alt+0243

export const Scale = {
    btc2btc: (btc=0) => btc
  , mbtc2mbtc: (mbtc=0) => mbtc
  , satoshis2satoshis: (satoshis=0) => satoshis
  , btc2satoshis: (btc=0) => parseInt((new Big(btc)).times(100000000), 10)
  , btc2mbtc: (btc=0) => parseFloat((new Big(btc)).times(1000), 10)
  , mbtc2satoshis: (mbtc=0) => parseInt((new Big(mbtc)).times(100000), 10)
  , mbtc2btc: (mbtc=0) => parseFloat((new Big(mbtc)).div(100), 10)
  , satoshis2btc: (satoshis=0) => parseInt(satoshis, 10) / 100000000
  , satoshis2mbtc: (satoshis=0) => parseInt(satoshis, 10) / 100000
}


export const formatPrice = (amount, input = 'satoshis', output) => {
  const v = {
      btc: Scale[`${input}2btc`](amount)
    , mbtc: Scale[`${input}2mbtc`](amount)
    , satoshis: Scale[`${input}2satoshis`](amount)
  }

  const ticker = output || (v.btc >= 0.1 ? 'btc' : 'mbtc')

  return v[ticker] ? `${v[ticker]} ${Settings.symbols[ticker].sign}` : 0
}

const assertTicker = fiatTicker => {
  if(!Settings.fiatTickers.includes(fiatTicker)) 
    throw new Error(`'${fiatTicker}' is not a supported currency`)
}

const assertAmount = amount => {
  if(isNaN(amount)) throw new Error(`invalid amount`)
  return Math.abs(amount)
}


const Helper = {

    avg: prices => (parseInt(_.sumBy(prices, 'price') / prices.length, 10)) || 0

  , flatAmount: a => Math.round(parseFloat(a, 10) * 100)

  , formatFiat: (number, symbol = "$", places = 2, thousand, decimal) => {
      thousand = thousand || (symbol=='€' ? '.' : ',')
      decimal = decimal || (symbol=='€' ? ',' : '.')

      let negative = number < 0 ? "-" : "",
          i = parseInt(number = Math.abs(+number || 0).toFixed(places), 10) + "",
          j = (j = i.length) > 3 ? j % 3 : 0;
      let string = negative 
        + (j ? i.substr(0, j) + thousand : "") 
        + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + thousand) 
        + (places ? decimal + Math.abs(number - i).toFixed(places).slice(2) : "");
      
      if(symbol == "€") string = string+symbol
      else string = symbol+string
      
      return string
    }
}



const Exchanges = {}


// {"mid":"16229.0","bid":"16228.0","ask":"16230.0","last_price":"16229.0","low":"14159.0","high":"16230.0","volume":"45892.96022396","timestamp":"1515149341.7253976"}
Exchanges.bitfinex = {
  ticker: (ticker = 'btc-usd') => {
    return axios
      .get(`https://api.bitfinex.com/v1/pubticker/${ticker.replace(/-/,'')}`, { 
          timeout: Settings.timeout
        , headers: { 'X-Requested-With': 'XMLHttpRequest', withCredentials: true, 'Content-Type': 'application/x-www-form-urlencoded' } 
      })
      .then(({ data }) => ({
          exchange: 'bitfinex'
        , price: Helper.flatAmount(data.mid)
        , ticker
      }))
  }
}


// {"high": "15430.27", "last": "15022.17", "timestamp": "1515106020", "bid": "15022.17", "vwap": "14803.06", "volume": "15225.74715942", "low": "14192.37", "ask": "15044.98", "open": "15155.62"}
Exchanges.bitstamp = {
  ticker: (ticker = 'btc-usd') => {
    return axios
      .get(`https://www.bitstamp.net/api/v2/ticker/${ticker.replace(/-/,'')}`, { 
          timeout: Settings.timeout 
        , headers: { 'X-Requested-With': 'XMLHttpRequest', withCredentials: true, 'Content-Type': 'application/x-www-form-urlencoded' } 
      })
      .then(({ data }) => ({
          exchange: 'bitstamp'
        , price: Helper.flatAmount(data.bid)
        , ticker
      }))
  }
}

// {"data":{"base":"BTC","currency":"USD","amount":"15165.53"}}
Exchanges.coinbase = {
  ticker: (ticker = 'btc-usd') => {
    return axios
      .get(`https://api.coinbase.com/v2/prices/${ticker.toUpperCase()}/buy`, { 
          timeout: Settings.timeout
        , headers: { 'CB-VERSION': '2017-08-10' } 
      })
      .then(({ data }) => ({
          exchange: 'coinbase'
        , price: Helper.flatAmount(data.data.amount)
        , ticker
      }))
  }
}

// {"date":"1515149560","ticker":{"high":"17400.00","vol":"360.59","last":"17375.00","low":"15128.37","buy":"17375.00","sell":"17398.99"}}
Exchanges.okcoin = {
  ticker: (ticker = 'btc-usd') => {
    return axios
      .get(`https://www.okcoin.com/api/v1/ticker.do?symbol=${ticker.replace(/-/,'_')}`, { 
          timeout: Settings.timeout 
      })
      .then(({ data }) => ({
          exchange: 'okcoin'
        , price: Helper.flatAmount(data.ticker.buy)
        , ticker
      }))
  }
}




const Prices = {}

export default Prices


Prices.list = async (ticker = 'btc-usd', exchanges = ['bitfinex', 'bitstamp', 'coinbase', 'okcoin']) => {
  assertTicker(ticker.split('-')[1])
  const used = []

  return new Promise((resolve, reject) => {
    async.map(exchanges, async (item, cb) => {
      try { 
        const price = await Exchanges[item].ticker(ticker)
        used.push(price) // exchange was used
        cb(null, price) 
      }
      catch(e){ 
        cb(null, null) 
      }
    }, (err, results) => {
      if(Settings.debug) console.log('> Exchanges used:', used)
      results = _.compact(results)
      return results.length 
        ? resolve(results)
        : reject(new Error('No prices could be fetched!'))
    })
  })
}



Prices.info = async (fiat_ticker = 'usd') => {
  assertTicker(fiat_ticker)
  const symbol = Settings.symbols[fiat_ticker].sign

  return Prices.list(`btc-${fiat_ticker}`)
    .then(Helper.avg)
    .then(fiat => ({ 
        fiat_ticker
      , fiat
      , fiat_formated: Helper.formatFiat(fiat/100, symbol)
      , ts: Date.now()
    }))
}

// => toBTC('350.50', 'eur')
// => { satoshis: 2631177, btc: 0.02631177, mbtc: 26.31177 }
Prices.toBTC = async (amount = 0, fiat_ticker = 'usd') => {
  assertTicker(fiat_ticker)
  amount = assertAmount(amount)

  return new Promise(async (resolve) => {
    const { fiat: unit } = await Prices.info(fiat_ticker)
    const fiat = Helper.flatAmount(amount)
    const symbol = Settings.symbols[fiat_ticker].sign
    const satoshis = parseInt((fiat / unit) * 100000000, 10)

    resolve({
        satoshis
      , btc: Scale.satoshis2btc(satoshis)
      , mbtc: Scale.satoshis2mbtc(satoshis)
      , fiat
      , unit
      , fiat_formated: Helper.formatFiat(fiat/100, symbol)
      , unit_formated: Helper.formatFiat(unit/100, symbol)
      , ticker: fiat_ticker
      , fiat_ticker
      , ts: Date.now()
    })
  })
}

// => toFiat('350', 'mbtc', 'usd')
// => { fiat: 571753, currency: 'usd', formated: '$5,717.53' }
Prices.toFiat = async (amount = 0, ticker = 'btc', fiat_ticker = 'usd') => {
  assertTicker(fiat_ticker)
  amount = assertAmount(amount)

  let satoshis = 0
  if(ticker == 'btc') satoshis = Scale.btc2satoshis(amount)
  if(ticker == 'mbtc') satoshis = Scale.mbtc2satoshis(amount)
  if(ticker == 'satoshis') satoshis = amount

  return new Promise(async (resolve) => {
    const { fiat: unit } = await Prices.info(fiat_ticker)

    const fiat = parseInt((satoshis * unit) / 100000000, 10)
    const symbol = Settings.symbols[fiat_ticker].sign

    resolve({
        satoshis
      , btc: Scale.satoshis2btc(satoshis)
      , mbtc: Scale.satoshis2mbtc(satoshis)
      , fiat
      , unit
      , fiat_formated: Helper.formatFiat(fiat/100, symbol)
      , unit_formated: Helper.formatFiat(unit/100, symbol)
      , ticker
      , fiat_ticker
      , ts: Date.now()
    })
  })
}

// wrapper around toFiat & toBTC, guess on args passed
Prices.convert = async (amount, ticker, fiat_ticker) => {
  return Settings.btcTickers.includes(ticker)
    ? Prices.toFiat(amount, ticker, fiat_ticker)
    : Prices.toBTC(amount, ticker)
}




