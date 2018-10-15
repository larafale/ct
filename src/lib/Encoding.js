const crypto = require('crypto')
const base58 = module.exports.base58 = require('bs58')

// hash a public key
// ripemd160(sha256(pk))
module.exports.pubkeyHash = (pubkey, encoding = 'hex') => {
  if (typeof pubkey === 'string') pubkey = new Buffer(pubkey, 'hex')
  if (!(pubkey instanceof Buffer)) throw new TypeError('"pubkey" must be a buffer')
  return crypto.createHash('ripemd160').update(
    crypto.createHash('sha256').update(pubkey).digest()
  ).digest(encoding)
}

// WIF (Wallet Import Format)

// https://en.bitcoin.it/wiki/Base58Check_encoding
// Prefix Table
//
const encodeWif_help = ` 
  Args:
  - pubkey | required
  - version | hexa, default: 00

  Ex: 
  > encodeWif 03ba5b589e06ea5067ffbb236f13ce47ee6d2deb4642711f5f0ce4e0606482bdd7 6F
  > mm8MvPAZ4GPQ79qs1Du2oQg5evobfeVtgp
  
  |---------|---------|---------|------------------------------|
  | decimal | hexa    | leading | Use                          |
  | version | version | symbol  |                              |
  |---------|---------|---------|------------------------------|
  | 0       | 00      | 1       | Bitcoin pubkey hash          |
  | 5       | 05      | 3       | Bitcoin script hash          |
  | 21      | 15      | 4       | Bitcoin (compact) public key |
  | 52      | 34      | M or N  | Namecoin pubkey hash         |
  | 128     | 80      | 5       | Private key                  |
  | 111     | 6F      | m or n  | Bitcoin testnet pubkey hash  |
  | 196     | C4      | 2       | Bitcoin testnet script hash  |
  |---------|---------|---------|------------------------------|
`

module.exports.encodeWif = (pubkey, version = '00') => {
  if(!pubkey) return encodeWif_help
  const pubkeyhash = new Buffer(module.exports.pubkeyHash(pubkey), 'hex')
  if (!(pubkeyhash instanceof Buffer)) throw new TypeError('"pubkeyhash" must be a buffer')
  if (!(version instanceof Buffer)) version = new Buffer(version, 'hex')
  
  let hash = Buffer.concat([version, pubkeyhash])
  hash = crypto.createHash('sha256').update(hash).digest()
  hash = crypto.createHash('sha256').update(hash).digest()
  hash = Buffer.concat([version, pubkeyhash, hash.slice(0, 4)])
  return base58.encode(hash)
}

module.exports.decodeWif = (address, encoding) => {
  const buffer = new Buffer(base58.decode(address))

  let version = buffer.slice(0, 1)
  let pubkeyhash = buffer.slice(1, -4)
  let checksum = buffer.slice(-4)

  let doublehash = Buffer.concat([ version, pubkeyhash ])
  doublehash = crypto.createHash('sha256').update(doublehash).digest()
  doublehash = crypto.createHash('sha256').update(doublehash).digest()
  checksum.forEach((check, index) => {
    if (check !== doublehash[index]) {
      throw new Error('Invalid checksum')
    }
  })

  if (encoding) {
    version = version.toString(encoding)
    pubkeyhash = pubkeyhash.toString(encoding)
    checksum = checksum.toString(encoding)
    doublehash = doublehash.toString(encoding)
  }

  return { version, pubkeyhash, checksum, doublehash }
}



