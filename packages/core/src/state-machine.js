'use strict'
// @flow
import BN from 'bn.js'

import Listing from './listing'
import Challenge from './challenge'
import Web3Utils from './web3-utils'

export default class StateMachine {
  web3: Object
  web3Utils: Web3Utils
  registry: Object
  plcr: Object
  synced: boolean
  listings: Map<string, Listing>
  challenges: Map<string, Challenge>
  validEvents: Set<string>

  constructor (web3: Object, registry: Object, plcr: Object) {
    this.web3 = web3
    this.web3Utils = new Web3Utils(web3)
    this.registry = registry
    this.plcr = plcr
    this.synced = false
    this.listings = new Map()
    this.challenges = new Map()
    this.validEvents = new Set([
      '_Application',
      '_ApplicationWhitelisted',
      '_ApplicationRemoved',
      '_Deposit',
      '_Withdrawal',
      '_ListingRemoved',
      '_ListingWithdrawn',
      '_TouchAndRemoved',
      '_Challenge',
      '_PollCreated',
      '_ChallengeFailed',
      '_ChallengeSucceeded',
      '_RewardClaimed'
    ])
  }

  async sync () {
    let logs = await this.registry.getPastEvents('allEvents', { fromBlock: 0, toBlock: 'latest' })
    for (let i = 0; i < logs.length; i++) {
      let log = logs[i]
      this.updateState(log)
    }
    this.synced = true
  }

  async updateFromTx (tx: Object) {
    let keys = Object.keys(tx.events)
    for (let i = 0; i < keys.length; i++) {
      let k = keys[i]
      if (this.validEvents.has(k)) {
        this.updateState(tx.events[k])
      }
    }
  }

  updateState (log: Object) {
    let values = log.returnValues
    values = this.sanitizeValues(values)
    let hash = values.listingHash
    let l
    let c
    switch (log.event) {
      case '_Application':
        this.listings.set(hash, new Listing(this, values))
        break
      case '_Challenge':
        this.challenges.set(hash, new Challenge(this, values))
        break
      case '_ChallengeFailed':
        c = this.challenges.get(hash)
        if (!c) break

        c.finished = true
        break
      case '_ChallengeSucceeded':
        c = this.challenges.get(hash)
        if (!c) break

        c.finished = true
        c.succeeded = true
        break
      case '_ApplicationWhitelisted':
        l = this.listings.get(hash)
        if (!l) break

        l.whitelisted = true
        break
      case '_Deposit':
        l = this.listings.get(hash)
        if (!l) break

        l.deposit = values.newTotal
        break
      case '_Withdrawal':
        l = this.listings.get(hash)
        if (!l) break

        l.deposit = values.newTotal
        break
      case '_ListingRemoved':
      case '_ListingWithdrawn':
      case '_TouchAndRemoved':
        this.listings.delete(hash)
        break
      case '_ApplicationRemoved':
        this.listings.delete(hash)
        break
      default:
        console.error('Invalid event type')
    }
  }

  sanitizeValues (values: Object) {
    let res = Object.assign({}, values)

    if (res.deposit) {
      res.deposit = new BN(res.deposit)
    }

    if (res.newTotal) {
      res.newTotal = new BN(res.newTotal)
    }

    return values
  }
}
