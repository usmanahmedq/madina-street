import 'dotenv/config';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createDatabasePool } from '../server/database-pool';
import { RelationalStore, STORAGE_LOCK, TABLES } from '../server/relational-store';
import { reconcileExpenseLedger, activeLedger } from '../server/expense-finance';
import { monthSummary, money } from '../server/collection-finance';
const apply=process.argv.includes('--apply');
const expenseId=process.argv.find(a=>a.startsWith('--expense-id='))?.split('=').slice(1).join('=');
if (!expenseId) throw new Error('Provide --expense-id=<source ID>. Backfill is restricted to that expense.');
if (!process.env.DATABASE_URL) throw new Error('Configured PostgreSQL database required.');
const pool=createDatabasePool();
const client=await pool.connect();
try {
 await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock($1)',[STORAGE_LOCK]);
 await client.query(fs.readFileSync('database/expense-flow.sql','utf8'));
 const store=new RelationalStore();await store.initialize(client);
 const data=await store.load(client), before=structuredClone(data);
 const expense=data.expenses.find(e=>e.id===expenseId);
 assert.ok(expense && expense.status==='Approved','Requested approved expense not found.');
 const result=reconcileExpenseLedger(data,[expenseId]);
 const once=structuredClone(data);
 assert.deepEqual(reconcileExpenseLedger(data,[expenseId]),{added:0,linked:0,voided:0});
 assert.ok(isDeepStrictEqual(once,data),'Second reconciliation changed data');
 const preserved=(after:typeof data)=>{
  for(const key of Object.keys(TABLES).filter(k=>k!=='ledger') as (keyof typeof data)[]) assert.ok(isDeepStrictEqual(after[key],before[key]),'Unrelated dataset changed: '+key);
  for(const entry of before.ledger) assert.ok(isDeepStrictEqual(after.ledger.find(e=>e.id===entry.id),entry),'Existing ledger record changed unexpectedly');
 };
 preserved(data);
 assert.equal(data.ledger.filter(e=>e.expenseId===expenseId).length,1);
 if(apply){await store.persist(client,data,before);preserved(await store.load(client));await client.query('COMMIT');}else await client.query('ROLLBACK');
 const month=expense.date.slice(0,7),m=monthSummary(data,month),entries=activeLedger(data.ledger).filter(e=>e.date.startsWith(month));
 const inflow=money(entries.reduce((s,e)=>s+e.credit,0)),outflow=money(entries.reduce((s,e)=>s+e.debit,0));
 const openingBalance=money(activeLedger(data.ledger).filter(e=>e.date<month+'-01').reduce((s,e)=>s+e.credit-e.debit,0));
 console.log(JSON.stringify({mode:apply?'APPLY':'DRY RUN',...result,entry:data.ledger.find(e=>e.expenseId===expenseId),month,registeredHouses:data.houses.filter(h=>!h.isDeleted).length,expected:m.expected,collected:m.collected,outstandingHouseDues:m.remaining,approvedExpenses:money(data.expenses.filter(e=>e.status==='Approved'&&e.date.startsWith(month)).reduce((s,e)=>s+e.amount,0)),openingBalance,inflow,outflow,netLiquidity:money(openingBalance+inflow-outflow),ledgerTransactions:data.ledger.length,expenseAndAllOtherRecordsPreserved:true,idempotency:'Second reconciliation added 0 entries'},null,2));
} catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await pool.end();}
