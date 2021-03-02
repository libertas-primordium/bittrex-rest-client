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
   * @returns {Promise} - [{
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
    return this.parseDates(results, ['createdAt'])
  }

  /**
   * @method currencies - List all available currencies. Returns an array.
   * @returns {Promise} - [{
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
   * @returns {Promise} - {
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
   * @returns {Promise} - [
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
    return this.parseDates(results, ['updatedAt'])
  }

  /**
   * @method marketSummary - Get 24 hour summary for specified market. Returns a single object.
   * @param {String} market - Required. Example: 'BTC-USD'
   * @returns {Promise} - {
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
    return this.parseDates(results, ['updatedAt'])
  }

  /**
   * @method marketHistory - Get list of most recently executed trades for specified market. Returns an array.
   * @param {String} market - Reqired. Example: 'BTC-USD'
   * @returns {Promise} - [
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
    return this.parseDates(results, ['executedAt'])
  }

  /**
   * @method orderBook - Get orderbook for specified market. 25 levels deep if no depth specified. Returns an object containing 2 arrays, one for each side of the orderbook.
   * @param {String} market - Required. Example: 'BTC-USD'
   * @param {Number} depth - optional, default depth is 25 if this param is not included.
   * @returns {Promise} - {
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
    return this.request('get', `/markets/${market}/orderbook`, depth)
  }

  /*-------------------------------------------------------------------------*
   * Authenticated API Calls
   *-------------------------------------------------------------------------*/
  // Trading:
  /**
   * @method sendOrder - Submit a new order to the exchange. Returns a single object.
   * @param  {String} market - Required. Example: 'BTC-USD'
   * @param  {String} direction - Required. ['BUY'|'SELL']
   * @param  {String} type - Required. ['LIMIT'|'MARKET'|'CEILING_LIMIT'|'CEILING_MARKET']
   * @param  {Number} quantity=null - Required if type=['LIMIT'|'MARKET']. Excluded if type=['CEILING_LIMIT'|'CEILING_MARKET'].
   * @param  {Number} ceiling=null - Required if type=['CEILING_LIMIT'|'CEILING_MARKET']. Excluded if type=['LIMIT'|'MARKET'].
   * @param  {Number} limit=null - Order price. Required if type=['LIMIT'|'CEILING_LIMIT']. Excluded if type=['MARKET'|'CEILING_MARKET']
   * @param  {String} timeInForce='GOOD_TIL_CANCELLED' - Required. ['GOOD_TIL_CANCELLED'|'IMMEDIATE_OR_CANCEL'|'FILL_OR_KILL'|'POST_ONLY_GOOD_TIL_CANCELLED'|'BUY_NOW'|'INSTANT']
   * @param  {String} clientOrderId - Optional. UUID for advanced order tracking.
   * @param  {Boolean} useAwards - Optional. Set useAwards=true to use Bittrex credits to pay transaction fee.
   * @returns  {Promise} - {
   * "id": "string (uuid)",
    "marketSymbol": "string",
    "direction": "string",
    "type": "string",
    "quantity": "number (double)",
    "limit": "number (double)",
    "ceiling": "number (double)",
    "timeInForce": "string",
    "clientOrderId": "string (uuid)",
    "fillQuantity": "number (double)",
    "commission": "number (double)",
    "proceeds": "number (double)",
    "status": "string",
    "createdAt": "string (date-time)",
    "updatedAt": "string (date-time)",
    "closedAt": "string (date-time)",
    "orderToCancel": {
      "type": "string",
      "id": "string (uuid)"
    }
   */
  async sendOrder(market, direction, type, {quantity=null, ceiling=null, limit=null, timeInForce='GOOD_TIL_CANCELLED'}, clientOrderId, useAwards){
    if (!market) throw new Error('market is required')
    if (direction !== 'BUY'|'SELL') throw new Error('direction must be either \'BUY\' or \'SELL\'')
    if (type !== 'LIMIT'|'MARKET'|'CEILING_LIMIT'|'CEILING_MARKET') throw new Error('type must be either: [\'LIMIT\'|\'MARKET\'|\'CEILING_LIMIT\'|\'CEILING_MARKET\']')
    if (type === 'LIMIT'|'MARKET' && !quantity) throw new Error('quantity must be included if type=[\'MARKET\'|\'LIMIT\']')    
    if (type === 'LIMIT'|'MARKET' && ceiling) throw new Error('Do not specify ceiling if type=[\'MARKET\'|\'LIMIT\']')
    if (type === 'CIELING_LIMIT'|'CIELING_MARKET' && !ceiling) throw new Error('ceiling must be included if type=[\'CEILING_MARKET\'|\'CEILING_LIMIT\']')
    if (type === 'CIELING_LIMIT'|'CIELING_MARKET' && quantity) throw new Error('Do not specify quantity if type=[\'CEILING_MARKET\'|\'CEILING_LIMIT\']')
    if (type === 'LIMIT'|'CEILING_LIMIT' && !limit) throw new Error('limit must be included if type=[\'LIMIT\'|\'CEILING_LIMIT\']')
    if (type === 'MARKET'|'CEILING_MARKET' && limit) throw new Error('Do not specify limit if type=[\'MARKET\'|\'CEILING_MARKET\']')
    if (timeInForce !== 'GOOD_TIL_CANCELLED'|'IMMEDIATE_OR_CANCEL'|'FILL_OR_KILL'|'POST_ONLY_GOOD_TIL_CANCELLED'|'BUY_NOW'|'INSTANT') throw new Error('timeInForce must be one of: [\'GOOD_TIL_CANCELLED\'|\'IMMEDIATE_OR_CANCEL\'|\'FILL_OR_KILL\'|\'POST_ONLY_GOOD_TIL_CANCELLED\'|\'BUY_NOW\'|\'INSTANT\']')
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
    const results = await this.request('post', '/orders', requestBody)
    return this.parseDates(results, ['createdAt','updatedAt','closedAt'])
  }

  /**
   * @method openOrders - Retrieve all open orders. Can be narrowed by specifying market or clientOrderId. Returns an array of objects.
   * @param {String} clientOrderId='open' - Optional. UUID-formatted string.
   * @param {String} market - Optional. Example: 'BTC-USD'
   * @returns {Promise} - [{
    "id": "string (uuid)",
    "marketSymbol": "string",
    "direction": "string",
    "type": "string",
    "quantity": "number (double)",
    "limit": "number (double)",
    "ceiling": "number (double)",
    "timeInForce": "string",
    "clientOrderId": "string (uuid)",
    "fillQuantity": "number (double)",
    "commission": "number (double)",
    "proceeds": "number (double)",
    "status": "string",
    "createdAt": "string (date-time)",
    "updatedAt": "string (date-time)",
    "closedAt": "string (date-time)",
    "orderToCancel": {
      "type": "string",
      "id": "string (uuid)"
    }}]
   */
  async getOpenOrders(clientOrderId='open',market) {
    const requestBody = {
      market: market
    }
    const results = await this.request('get', `/orders/${clientOrderId}`, requestBody)
    return this.parseDates(results, ['createdAt','updatedAt','closedAt'])
  }

  
  /**
   * @method cancelOrder - Cancel existing orders. Default will cancel ALL orders. Specify either market or clientOrderId to cancel specific orders only. Returns an object or array of objects.
   * @param  {String} clientOrderId='open' - Optional. UUID-formatted string.
   * @param  {String} market - Optional. Example: 'BTC-USD'
   * @returns {promise} - [{
    "id": "string (uuid)",
    "statusCode": "string",
    "result": {
      "id": "string (uuid)",
      "marketSymbol": "string",
      "direction": "string",
      "type": "string",
      "quantity": "number (double)",
      "limit": "number (double)",
      "ceiling": "number (double)",
      "timeInForce": "string",
      "clientOrderId": "string (uuid)",
      "fillQuantity": "number (double)",
      "commission": "number (double)",
      "proceeds": "number (double)",
      "status": "string",
      "createdAt": "string (date-time)",
      "updatedAt": "string (date-time)",
      "closedAt": "string (date-time)",
      "orderToCancel": {
        "type": "string",
        "id": "string (uuid)"
      }
    }}]
   */
  async cancelOrder(clientOrderId='open',market){
    const requestBody = {
      market: market
    }
    const results = this.request('delete',`/orders/${clientOrderId}`,requestBody)
    return this.parseDates(results, ['createdAt','updatedAt','closedAt'])
  }

   
  
  /**
   * @method getOrderHistory - Retrieve a lost of all closed orders. Query can by narrowed by specifying market. Returns an array of Order objects.
   * @param  {String} market - Optional. Example: 'BTC'
   * @param  {String} nextPageToken - Optional. Used for traversing a paginated set in the forward direction. May only be specified if PreviousPageToken is not specified.
   * @param  {String} previousPageToken - Optional. Used for traversing a paginated set in the reverse direction. May only be specified if NextPageToken is not specified.
   * @param  {Number} pageSize - Integer. [1-200] Optional. Default 100. Maximum number of items to retrieve.
   * @param  {Date} startDate - DateTime. Optional. Filter out orders before this date-time.
   * @param  {Date} endDate - DateTime. Optional. Filter out orders after this date-time.
   * @returns {Promise} - [{
    "id": "string (uuid)",
    "marketSymbol": "string",
    "direction": "string",
    "type": "string",
    "quantity": "number (double)",
    "limit": "number (double)",
    "ceiling": "number (double)",
    "timeInForce": "string",
    "clientOrderId": "string (uuid)",
    "fillQuantity": "number (double)",
    "commission": "number (double)",
    "proceeds": "number (double)",
    "status": "string",
    "createdAt": "string (date-time)",
    "updatedAt": "string (date-time)",
    "closedAt": "string (date-time)",
    "orderToCancel": {
      "type": "string",
      "id": "string (uuid)"
      }
    }]
   */
  async getOrderHistory({market, nextPageToken, previousPageToken, pageSize, startDate, endDate}) {
    const requestBody = {
      market: market,
      nextPageToken: nextPageToken,
      previousPageToken: previousPageToken,
      pageSize: pageSize,
      startDate: startDate,
      endDate: endDate
    }
    const results = await this.request('get', '/account/getorderhistory', requestBody)
    return this.parseDates(results, ['createdAt', 'updatedAt', 'closedAt'])
  }


  // User/Account:

  /**
   * @method balances - Retrieve account balances for all available currencies. Returns an array with an object for each currency for which there is either a balance or an address.
   * @returns {Promise} - [{
    "currencySymbol": "string",
    "total": "number (double)",
    "available": "number (double)",
    "updatedAt": "string (date-time)"
    }]
  */
  async balances() {
    const results = this.request('get', '/balances')
    return this.parseDates(results, ['updatedAt'])
  }

  /**
   * @method balance - Retrieve current balance for specified currency.
   * @param {String} currency - Required. Example: 'BTC'
   * @returns {Promise} - {
    "currencySymbol": "string",
    "total": "number (double)",
    "available": "number (double)",
    "updatedAt": "string (date-time)"
    }
  */
  async balance(currency) {
    if (!currency) throw new Error('currency is required')
    const results = this.request('get', `/balances/${currency}`)
    return this.parseDates(results, ['updatedAt'])
  }

  /**
   * @method getNewDepositAddress - Request a new deposit address for specified currency. Returns an address object.
   * @param {String} currency - Required. Example: 'BTC'
   * @returns {Promise} - {
    "status": "string",
    "currencySymbol": "string",
    "cryptoAddress": "string",
    "cryptoAddressTag": "string"
  }
  */
  async getNewDepositAddress(currency) {
    if (!currency) throw new Error('currency is required')
    const requestBody = {
      currencySymbol: currency }
    return this.request('post', '/addresses', requestBody)
  }
  /**
   * @method getAddresses - Retrieve existing deposit address for specified currency, or for all currencies if not specified. Returns an array of address objects.
   * @param {} currency - Optional. Example: 'BTC'
   * @returns {Promise} - [{
    "status": "string",
    "currencySymbol": "string",
    "cryptoAddress": "string",
    "cryptoAddressTag": "string"
    }]
    */
  async getAddresses(currency){
    const requestBody = {
      currencySymbol: currency
    }
    return this.request('get', requestBody)
  }

  /**
   * @method withdraw
   * @param {String} currency
   * @param {String|Number} options.quantity
   * @param {String} options.address
   * @param {String} [options.paymentid]
   * @returns {Promise}
   */
  async withdraw(currency, { quantity, address, paymentid } = {}) {
    if (!currency) throw new Error('currency is required')
    if (!quantity) throw new Error('options.quantity is required')
    if (!address) throw new Error('options.address is required')
    const params = { currency, quantity, address, paymentid }
    return this.request('get', '/account/withdraw', { params })
  }


  /**
   * @method withdrawalHistory
   * @param {String} [currency]
   * @returns {Promise}
   */
  async withdrawalHistory(currency) {
    const params = { currency }
    const results = await this.request('get', '/account/getwithdrawalhistory', { params })
    return this.parseDates(results, ['LastUpdated'])
  }

  /**
   * @method depositHistory
   * @param {String} [currency]
   * @returns {Promise}
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
   * @returns {String}
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
   * @returns {Object}
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
   * @returns {Array<Object>}
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
