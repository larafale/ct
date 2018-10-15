import config from '../config'
import Sendgrid from '../lib/Sendgrid'
import { log } from './logger'


export default Sendgrid({
    apikey: config.mail.apikey
  , forceTo: config.mail.forceTo
  , mock: config.mail.mock
  , from: { email: 'noreply@8333.io', name: '8333.io' }
  , debug: true
  , log: log
  , templates: {
        "signup": { "template_id": "d-51717018a6714e67893b3b5a8ef12203" }
      , "login": { "template_id": "d-35c398b27f4349b99933cbd94bf95ac1" }
    }
}) 