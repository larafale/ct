// load config from config folder
import config from 'config'


const network = process.env.NETWORK
const nkey = ({mainnet:0, testnet: 1})[network]


const cfg = {
    ...config
  , network
  , ns: `/${network}` // namespace for sockets
  , port: config.port[nkey]
  , bitcoind: config.bitcoind[nkey]
  , electrumx: config.electrumx[nkey]
}

export default cfg