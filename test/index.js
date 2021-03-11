const should = require('should')
const { BittrexClient } = require('../')
require('dotenv').config()
const client = new BittrexClient({
  apiKey: process.env.KEY,
  apiSecret: process.env.SECRET,
  timeout: 3000})
describe('bittrex-node', () => {
  describe('non-authenticated API calls', () => {
    xit('should get markets', async () => {
      let results = await client.markets()
      should.exist(results)
      results.length.should.be.above(0)
    })

    xit('should get currencies', async () => {
      let results = await client.currencies()
      should.exist(results)
      results.length.should.be.above(0)
    })

    xit('should get ticker', async () => {
      let ticker = await client.ticker('BTC-USD')
      ticker.symbol.should.equal('BTC-USD')
      ticker.lastTradeRate.should.be.above(0)
      ticker.bidRate.should.be.above(0)
      ticker.askRate.should.be.above(0)
    })

    xit('should get market summaries', async () => {
      let results = await client.marketSummaries()
      should.exist(results)
      results.length.should.be.above(0)
    })

    xit('should get market summary', async () => {
      let results = await client.marketSummary('BTC-USD')
      should.exist(results)
      results.symbol.should.equal('BTC-USD')
      results.high.should.be.above(0)
    })

    xit('should get recent market trades', async () => {
      let results = await client.marketTrades('BTC-USD')
      should.exist(results)
      results.length.should.be.above(0)
      results[0].rate.should.be.above(0)
    })

    xit('should get order book', async () => {
      let results = await client.orderBook('BTC-USD',1)
      should.exist(results)
      results.bid.length.should.be.above(0)
      results.ask.length.should.be.below(2)
    })

    xit('should get recent candles', async () => {
      let results = await client.getCandlesRecent('BTC-USD','MINUTE_5')
      should.exist(results)
      results.length.should.be.above(0)
      results[0].quoteVolume.length.should.be.above(0)
    })

    xit('should get historical candles', async () => {
      let date = new Date()
      let results = await client.getCandlesHistorical('BTC-USD','MINUTE_5',date.getFullYear()-1,date.getMonth(),date.getDay())
      should.exist(results)
      results.length.should.be.above(0)
      results[0].quoteVolume.length.should.be.above(0)
    })
  })

  xdescribe('authenticated trading API calls', () => {
    let buyOrderId

    xit('should get open orders', async () => {
      let results = await client.getOpenOrders()
      should.exist(results)
      results.length.should.be.aboveOrEqual(0)
    })

    it('should place a buy market order', async () => {
      try {
        let result = await client.sendOrder('BTC-USD', 'BUY', 'MARKET', { quantity:5000 })
        should.not.exist(result)
      } catch(err) {
        should.exist(err)
        err.message.should.equal('{"code":"INSUFFICIENT_FUNDS"}')
      }

    })

    xit('should cancel an order', async () => {
      await client.cancelOrder(buyOrderId)
    })

    xit('should attempt a sell limit order', async () => {
      try {
        let result = await client.sellLimit('BTC-USD', { quantity: 500000 })
        should.not.exist(result)
      } catch(err) {
        should.exist(err)
        err.message.should.equal('INSUFFICIENT_FUNDS')
      }
    })
  })

  describe('authenticated account API calls', () => {
    it('should get balances', async () => {
      let results = await client.balance('')
      should.exist(results)
      results.length.should.be.aboveOrEqual(0)
      let Balance = await client.balance('BTC')
      should.exist(Balance)
      Balance.total.should.be.aboveOrEqual(0)
    })


    xit('should get deposit addresses', async () => {
      let allAddresses = await client.getAddresses()
      allAddresses.length.should.be.aboveOrEqual(0)
    })

    xit('should create a deposit address', async () => {
      let Address = await client.getAddresses('BTC')
      should.exist(Address)
    })

    it('should get order history', async () => {
      let results = await client.getOrderHistory('BTC-USD')
      should.exist(results)
      results.length.should.be.aboveOrEqual(0)
    })

    xit('should get withdrawl history', async () => {
      let results = await client.withdrawalHistory()
      should.exist(results)
      results.length.should.be.aboveOrEqual(0)
    })

    xit('should get deposit history', async () => {
      let results = await client.depositHistory('BTC')
      should.exist(results)
      results.length.should.be.aboveOrEqual(0)
    })
  })
})
