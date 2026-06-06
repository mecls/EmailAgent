import { hello } from './hello'
import { indexKickoff } from './index-kickoff'
import { indexPage } from './index-page'
import { indexBatch } from './index-batch'
import { indexDeriveStatus } from './index-derive-status'
import { freshnessPoll } from './freshness-poll'
import { freshnessAccount } from './freshness-account'
import { briefScheduler } from './brief-scheduler'
import { briefGenerate } from './brief-generate'

/**
 * Single registry of Inngest functions served at /api/inngest. Append new
 * functions here as milestones land.
 */
export const functions = [
  hello,
  indexKickoff,
  indexPage,
  indexBatch,
  indexDeriveStatus,
  freshnessPoll,
  freshnessAccount,
  briefScheduler,
  briefGenerate,
]
