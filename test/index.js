const should = require('should')
const { BittrexClient } = require('../')
const client = new BittrexClient({
  apiKey: process.env.KEY,
  apiSecret: process.env.SECRET
})

describe('bittrex-node', () => {
  describe('non-authenticated API calls', () => {
    it('should get markets', async () => {
      let results = await client.markets()
      should.exist(results)
      results.length.should.be.above(0)
    })

    it('should get currencies', async () => {
      let results = await client.currencies()
      should.exist(results)
      results.length.should.be.above(0)
    })

    it('should get ticker', async () => {
      let ticker = await client.ticker('BTC-USD')
      ticker.symbol.should.equal('BTC-USD')
      ticker.lastTradeRate.should.be.above(0)
      ticker.bidRate.should.be.above(0)
      ticker.askRate.should.be.above(0)
    })

    it('should get market summaries', async () => {
      let results = await client.marketSummaries()
      should.exist(results)
      results.length.should.be.above(0)
    })

    it('should get market summary', async () => {
      let results = await client.marketSummary('BTC-USD')
      should.exist(results)
      results.symbol.should.equal('BTC-USD')
      results.high.should.be.above(0)
    })

    it('should get recent market trades', async () => {
      let results = await client.marketTrades('BTC-USD')
      should.exist(results)
      results.length.should.be.above(0)
      results[0].rate.should.be.above(0)
    })

    it('should get order book', async () => {
      let results = await client.orderBook('BTC-USD')
      should.exist(results)
      results.bid.length.should.be.above(0)
      results.ask.length.should.be.above(0)
    })

    it('should get recent candles', async () => {
      let results = await client.getCandlesRecent('BTC-USD','MINUTE_5')
      should.exist(results)
      results.length.should.be.above(0)
      results[0].quoteVolume.length.should.be.above(0)
    })

    it('should get historical candles', async () => {
      let date = new Date()
      let results = await client.getCandlesHistorical('BTC-USD','MINUTE_5',date.getFullYear()-1,date.getMonth(),date.getDay())
      should.exist(results)
      results.length.should.be.above(0)
      results[0].quoteVolume.length.should.be.above(0)
    })
  })

  describe('authenticated trading API calls', () => {
    let buyOrderId

    it('should get open orders', async () => {
      let results = await client.getOpenOrders('BTC-USD')
      should.exist(results)
      results.length.should.be.aboveOrEqual(0)
    })

    it('should place a buy limit order', async () => {
      let { uuid } = await client.buyLimit('BTC-ETH', { quantity: 50000, rate: 0.0000001 })
      should.exist(uuid)
      buyOrderId = uuid
    })

    it('should cancel an order', async () => {
      await client.cancelOrder(buyOrderId)
    })

    it('should attempt a sell limit order', async () => {
      try {
        let result = await client.sellLimit('BTC-ETH', { quantity: 50000, rate: 0.0000001 })
        should.not.exist(result)
      } catch(err) {
        should.exist(err)
        err.message.should.equal('INSUFFICIENT_FUNDS')
      }
    })
  })

  describe('authenticated account API calls', () => {
    it('should get balances', async () => {
      let results = await client.balances()
      should.exist(results)
      results.length.should.be.aboveOrEqual(0)
    })

    it('should get balance', async () => {
      let { Balance } = await client.balance('BTC')
      should.exist(Balance)
      Balance.should.be.aboveOrEqual(0)
    })

    it('should get deposit address', async () => {
      let { Address } = await client.depositAddress('BTC')
      should.exist(Address)
    })

    it('should get order history', async () => {
      let results = await client.orderHistory('BTC-USD')
      should.exist(results)
      results.length.should.be.aboveOrEqual(0)
    })

    it('should get withdrawl history', async () => {
      let results = await client.withdrawalHistory('BTC')
      should.exist(results)
      results.length.should.be.aboveOrEqual(0)
    })

    it('should get deposit history', async () => {
      let results = await client.depositHistory('BTC')
      should.exist(results)
      results.length.should.be.aboveOrEqual(0)
    })
  })
})
