const axios = require('axios')
const crypto = require('crypto')
const https = require('https')
const querystring = require('querystring')

class BittrexClient {

  /**
   * @constructor
   * @param {String} [options.apiKey=null]
   * @param {String} [options.apiSecret=null]
   * @param {Boolean} [options.keepAlive=true]
   */
  constructor({ apiKey = null, apiSecret = null, keepAlive = true } = {}) {
    this._apiKey = apiKey
    this._apiSecret = apiSecret
    this._nonce = Date.now()
    this._client = axios.create({
      baseURL: 'https://api.bittrex.com/v3',
      httpsAgent: new https.Agent({ keepAlive })
    })
  }

  /*-------------------------------------------------------------------------*
   * Non-Authenticated API Calls
   *-------------------------------------------------------------------------*/

  /**
   * @method markets - List all available markets. Returns an array.
   * @return {Promise} - [{
      "symbol": "string",
      "baseCurrencySymbol": "string",
      "quoteCurrencySymbol": "string",
      "minTradeSize": "number (double)",
      "precision": "integer (int32)",
      "status": "string",
      "createdAt": "string (date-time)",
      "notice": "string",
      "prohibitedIn": [
        "string"
      ],
      "associatedTermsOfService": [
        "string"
      ],
      "tags": [
        "string"
      ]
    }]
   */
  async markets() {
    const results = await this.request('get', '/markets')
    return this.parseDates(results, ['Created'])
  }

  /**
   * @method currencies - List all available currencies. Returns an array.
   * @return {Promise} - [{
      "symbol": "string",
      "name": "string",
      "coinType": "string",
      "status": "string",
      "minConfirmations": "integer (int32)",
      "notice": "string",
      "txFee": "number (double)",
      "logoUrl": "string",
      "prohibitedIn": [
        "string"
      ],
      "baseAddress": "string",
      "associatedTermsOfService": [
        "string"
      ],
      "tags": [
        "string"
      ]
    }]
   */
  async currencies() {
    return this.request('get', '/currencies')
  }

  /**
   * @method ticker - Get current ticker quote (bid/ask/last price). Returns a single object if {market} param included, or array of all available markets if no {market} specified.
   * @param {String} market - Optional. Example: 'BTC-USD'
   * @return {Promise} - {
      "symbol": "string",
      "lastTradeRate": "number (double)",
      "bidRate": "number (double)",
      "askRate": "number (double)"
    }
   */
  async ticker(market) {
    if (market) return this.request('get', `/markets/${market}/ticker`)
    else return this.request('get', '/markets/tickers')
  }

  /**
   * @method marketSummaries - List 24 summaries for all available markets. Returns an array.
   * @return {Promise} - [
    {
      "symbol": "string",
      "high": "number (double)",
      "low": "number (double)",
      "volume": "number (double)",
      "quoteVolume": "number (double)",
      "percentChange": "number (double)",
      "updatedAt": "string (date-time)"
  }]
   */
  async marketSummaries() {
    const results = await this.request('get', '/markets/summaries')
    return this.parseDates(results, ['TimeStamp', 'Created'])
  }

  /**
   * @method marketSummary - Get 24 hour summary for specified market. Returns a single object.
   * @param {String} market - Required. Example: 'BTC-USD'
   * @return {Promise} - {
      "symbol": "string",
      "high": "number (double)",
      "low": "number (double)",
      "volume": "number (double)",
      "quoteVolume": "number (double)",
      "percentChange": "number (double)",
      "updatedAt": "string (date-time)"
    }
   */
  async marketSummary(market) {
    if (!market) throw new Error('market is required')
    const results = await this.request('get', `/markets/${market}/summary`)
    return this.parseDates(results, ['TimeStamp', 'Created'])
  }

  /**
   * @method marketHistory - Get list of most recently executed trades for specified market. Returns an array.
   * @param {String} market - Reqired. Example: 'BTC-USD'
   * @return {Promise} - [
    {
      "id": "string (uuid)",
      "executedAt": "string (date-time)",
      "quantity": "number (double)",
      "rate": "number (double)",
      "takerSide": "string"
    }]
   */
  async marketHistory(market) {
    if (!market) throw new Error('market is required')
    const results = await this.request('get', `/markets/${market}/trades`)
    return this.parseDates(results, ['TimeStamp'])
  }

  /**
   * @method orderBook - Get orderbook for specified market. 25 levels deep if no depth specified. Returns an object containing 2 arrays, one for each side of the orderbook.
   * @param {String} market - Required. Example: 'BTC-USD'
   * @param {Number} depth - optional, default depth is 25 if this param is not included.
   * @return {Promise} - {
    "bid": [
      {
        "quantity": "number (double)",
        "rate": "number (double)"
      }
    ],
    "ask": [
      {
        "quantity": "number (double)",
        "rate": "number (double)"
      }
    ]
  }
   */
  async orderBook(market, depth) {
    if (!market) throw new Error('market is required')
    if (!depth) throw new Error('options.depth is required')
    return this.request('get', `/markets/${market}/orderbook`, { depth })
  }

  /*-------------------------------------------------------------------------*
   * Authenticated API Calls
   *-------------------------------------------------------------------------*/
  // Trading:
  /**
   * @method sendOrder - Submit a new order to the exchange.
   * @param  {String} market - Required. Example: 'BTC-USD'
   * @param  {String} direction - Required. ['BUY'|'SELL']
   * @param  {String} type - Required. ['LIMIT'|'MARKET'|'CEILING_LIMIT'|'CEILING_MARKET']
   * @param  {Number} quantity - Required if type=['LIMIT'|'MARKET']. Excluded if type=['CEILING_LIMIT'|'CEILING_MARKET'].
   * @param  {Number} ceiling - Required if type=['CEILING_LIMIT'|'CEILING_MARKET']. Excluded if type=['LIMIT'|'MARKET'].
   * @param  {Number} limit - Order price. Required if type=['LIMIT'|'CEILING_LIMIT']. Excluded if type=['MARKET'|'CEILING_MARKET']
   * @param  {String} timeInForce - Required. ['GOOD_TIL_CANCELLED'|'IMMEDIATE_OR_CANCEL'|'FILL_OR_KILL'|'POST_ONLY_GOOD_TIL_CANCELLED'|'BUY_NOW'|'INSTANT']
   * @param  {String} clientOrderId - Optional. UUID for advanced order tracking.
   * @param  {Boolean} useAwards - Optional. Set useAwards=true to use Bittrex credits to pay transaction fee.
   */
  async sendOrder(market, direction, type, quantity=null, ceiling=null, limit=null, timeInForce, clientOrderId, useAwards){
    if (!market) throw new Error('market is required')
    if (direction !== 'BUY'|'SELL') throw new Error('direction must be either \'BUY\' or \'SELL\'')
    if (type !== 'LIMIT'|'MARKET'|'CEILING_LIMIT'|'CEILING_MARKET') throw new Error('type must be either [\'LIMIT\'|\'MARKET\'|\'CEILING_LIMIT\'|\'CEILING_MARKET\']')
    if (type === 'LIMIT'|'MARKET' && !quantity) throw new Error('quantity must be included if type=[\'MARKET\'|\'LIMIT\']')    
    if (type === 'LIMIT'|'MARKET' && ceiling) throw new Error('Do not specify ceiling if type=[\'MARKET\'|\'LIMIT\']')
    if (type === 'CIELING_LIMIT'|'CIELING_MARKET' && !ceiling) throw new Error('ceiling must be included if type=[\'CEILING_MARKET\'|\'CEILING_LIMIT\']')
    if (type === 'CIELING_LIMIT'|'CIELING_MARKET' && quantity) throw new Error('Do not specify quantity if type=[\'CEILING_MARKET\'|\'CEILING_LIMIT\']')
    if (type === 'LIMIT'|'CEILING_LIMIT' && !limit) throw new Error('limit must be included if type=[\'LIMIT\'|\'CEILING_LIMIT\']')
    if (type === 'MARKET'|'CEILING_MARKET' && limit) throw new Error('Do not specify limit if type=[\'MARKET\'|\'CEILING_MARKET\']')
    const requestBody = {
      market: market,
      direction: direction,
      type: type,
      quantity: quantity,
      ceiling: ceiling,
      limit: limit,
      timeInForce: timeInForce,
      clientOrderId: clientOrderId,
      useAwards: useAwards
    }

  }

  /**
   * @method buyLimit
   * @param {String} market
   * @param {String|Number} options.quantity
   * @param {String|Number} options.price
   * @return {Promise}
   */
  async buyLimit(market, { quantity, rate, timeInForce = 'GTC' } = {}) {
    if (!market) throw new Error('market is required')
    if (!quantity) throw new Error('options.quantity is required')
    if (!rate) throw new Error('options.rate is required')
    if (timeInForce !== 'IOC' && timeInForce !== 'GTC') throw new Error('options.timeInForce not IOC or GTC')
    const params = {
      market,
      quantity: parseFloat(quantity).toFixed(8),
      rate: parseFloat(rate).toFixed(8),
      timeInForce
    }
    return this.request('get', '/market/buylimit', { params })
  }

  /**
   * @method sellLimit
   * @param {String} market
   * @param {String|Number} options.quantity
   * @param {String|Number} options.price
   * @return {Promise}
   */
  async sellLimit(market, { quantity, rate, timeInForce = 'GTC' } = {}) {
    if (!market) throw new Error('market is required')
    if (!quantity) throw new Error('options.quantity is required')
    if (!rate) throw new Error('options.rate is required')
    if (timeInForce !== 'IOC' && timeInForce !== 'GTC') throw new Error('options.timeInForce not IOC or GTC')

    const params = {
      market,
      quantity: parseFloat(quantity).toFixed(8),
      rate: parseFloat(rate).toFixed(8),
      timeInForce
    }
    return this.request('get', '/market/selllimit', { params })
  }

  /**
   * @method cancelOrder
   * @param {String} uuid
   * @return {Promise}
   */
  async cancelOrder(uuid) {
    if (!uuid) throw new Error('uuid is required')
    const params = { uuid }
    return this.request('get', '/market/cancel', { params })
  }

  /**
   * @method openOrders
   * @param {String} market
   * @return {Promise}
   */
  async openOrders(market) {
    const params = { market }
    const results = await this.request('get', '/market/getopenorders', { params })
    return this.parseDates(results, ['Opened'])
  }

  // User/Account:

  /**
   * @method balances
   * @return {Promise}
   */
  async balances() {
    return this.request('get', '/account/getbalances')
  }

  /**
   * @method balance
   * @param {String} currency
   * @return {Promise}
   */
  async balance(currency) {
    if (!currency) throw new Error('currency is required')
    const params = { currency }
    return this.request('get', '/account/getbalance', { params })
  }

  /**
   * @method depositAddress
   * @param {String} currency
   * @return {Promise}
   */
  async depositAddress(currency) {
    if (!currency) throw new Error('currency is required')
    const params = { currency }
    return this.request('get', '/account/getdepositaddress', { params })
  }

  /**
   * @method withdraw
   * @param {String} currency
   * @param {String|Number} options.quantity
   * @param {String} options.address
   * @param {String} [options.paymentid]
   * @return {Promise}
   */
  async withdraw(currency, { quantity, address, paymentid } = {}) {
    if (!currency) throw new Error('currency is required')
    if (!quantity) throw new Error('options.quantity is required')
    if (!address) throw new Error('options.address is required')
    const params = { currency, quantity, address, paymentid }
    return this.request('get', '/account/withdraw', { params })
  }

  /**
   * @method orderHistory
   * @param {String} market
   * @return {Promise}
   */
  async orderHistory(market) {
    const params = { market }
    const results = await this.request('get', '/account/getorderhistory', { params })
    return this.parseDates(results, ['TimeStamp', 'Closed'])
  }

  /**
   * @method order
   * @param {String} uuid
   * @return {Promise}
   */
  async order(uuid) {
    if (!uuid) throw new Error('uuid is required')
    const params = { uuid }
    const result = await this.request('get', '/account/getorder', { params })
    return this.parseDates([result], ['Opened', 'Closed'])[0]
  }

  /**
   * @method withdrawalHistory
   * @param {String} [currency]
   * @return {Promise}
   */
  async withdrawalHistory(currency) {
    const params = { currency }
    const results = await this.request('get', '/account/getwithdrawalhistory', { params })
    return this.parseDates(results, ['LastUpdated'])
  }

  /**
   * @method depositHistory
   * @param {String} [currency]
   * @return {Promise}
   */
  async depositHistory(currency) {
    const params = { currency }
    const results = await this.request('get', '/account/getdeposithistory', { params })
    return this.parseDates(results, ['LastUpdated'])
  }

  /*-------------------------------------------------------------------------*
   * Private
   *-------------------------------------------------------------------------*/

  /**
   * @private
   * @method request
   * @param {String} method
   * @param {String} url
   * @param {Object} [options.data]
   * @param {Object} [options.params]
   */
  async request(method, url, { headers = {}, params = {} } = {}) {
    params = this.sanitizeParams(params)

    if (this._apiKey) {
      params.nonce = ++this._nonce
      params.apikey = this._apiKey
      headers.apisign = this.requestSignature(url, params)
    }

    const { data } = await this._client.request({ method, url, headers, params })

    if (!data.success) {
      throw new Error(data.message)
    }

    return data.result
  }

  /**
   * @private
   * @method requestSignature
   * @param {String} url
   * @return {String}
   */
  requestSignature(path, params) {
    const query = querystring.stringify(params)
    const url = `${this._client.defaults.baseURL}${path}?${query}`
    const hmac = crypto.createHmac('sha512', this._apiSecret)
    return hmac.update(url).digest('hex')
  }

  /**
   * @private
   * @method sanitizeParams
   * @param {Object} params
   * @return {Object}
   */
  sanitizeParams(params = {}) {
    const obj = {}
    for (const key of Object.keys(params)) {
      if (params[key] === undefined) continue
      obj[key] = params[key]
    }
    return obj
  }

  /**
   * @private
   * @method parseDates
   * @param {Array<Object>} results
   * @param {Array<String>} keys
   * @return {Array<Object>}
   */
  parseDates(results, keys) {
    for (const result of results) {
      for (const key of keys) {
        if (!result[key]) continue
        result[key] = new Date(`${result[key]}Z`)
      }
    }
    return results
  }
}

module.exports = BittrexClient
