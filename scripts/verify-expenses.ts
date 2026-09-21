import 'dotenv/config';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import express from 'express';
import { Pool } from 'pg';
import { RelationalStore } from '../server/relational-store';
import { reconcileExpenseLedger, activeLedger } from '../server/expense-finance';
import { registerExpenseRoutes } from '../server/expense-routes';
import { monthSummary, money } from '../server/collection-finance';
import { mainDashboardSummary } from '../server/dashboard-finance';
import { reportSummary } from '../server/collection-routes';
const beforeBackfill=process.argv.includes('--before-backfill');
if(!process.env.DATABASE_URL) throw new Error('Real PostgreSQL configuration required.');
const pool=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:15000});
const client=await pool.connect();
let checks=0;
const check=(condition:unknown,message:string)=>{assert.ok(condition,message);checks++;};
try {
 const store=new RelationalStore();await store.initialize(client);
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const original=await store.load(client);await client.query('ROLLBACK');
 const source=original.expenses.find(e=>e.id==='exp-1789805406010');
 check(source?.status==='Approved','The real approved source expense exists');
 const month=source!.date.slice(0,7);
 const trial=structuredClone(original);
 reconcileExpenseLedger(trial,[source!.id]);const once=structuredClone(trial);
 check(isDeepStrictEqual(reconcileExpenseLedger(trial,[source!.id]),{added:0,linked:0,voided:0}),'Reconciliation repeated adds nothing');
 check(isDeepStrictEqual(trial,once),'Repeat reconciliation is stable');
 check(trial.ledger.filter(e=>e.expenseId===source!.id).length===1,'Exactly one ledger source');
 check(isDeepStrictEqual(trial.expenses,original.expenses),'Reconciliation preserves expense records');
 const ledgerEntry=trial.ledger.find(e=>e.expenseId===source!.id)!;
 check(ledgerEntry.debit===source!.amount&&ledgerEntry.referenceNo===source!.voucherNo,'Correct expense debit and voucher');
 // Route tests operate only on transactionally isolated IN-MEMORY copies, never SQL fixtures.
 let committed=structuredClone(trial),working=structuredClone(trial),failSave=false;
 const memoryStore={get:(key:any)=>(working as any)[key],set:(key:any,value:any)=>{(working as any)[key]=value;},save:()=>{if(failSave)throw new Error('Simulated persistence failure');}};
 const testApp=express();testApp.use(express.json());
 testApp.use((req,res,next)=>{working=structuredClone(committed);const end=res.end.bind(res);res.end=((...args:any[])=>{if(res.statusCode<400)committed=working;return (end as any)(...args);}) as any;next();});
 registerExpenseRoutes(testApp,memoryStore as any);
 const testServer=testApp.listen(0,'127.0.0.1');await new Promise<void>(r=>testServer.once('listening',r));
 const base='http://127.0.0.1:'+(testServer.address() as any).port;
 const request=async(path:string,method='GET',body?:any)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json() as any};};
 try {
  const requestBody={title:source!.title,category:source!.category,amount:source!.amount,date:source!.date,paymentMethod:source!.paymentMethod,paidTo:source!.paidTo};
  const created=await request('/api/expenses','POST',requestBody);
  check(created.status===200,'Approved expense creation succeeds');
  const newId=created.data.expense.id;
  check(committed.ledger.filter(e=>e.expenseId===newId).length===1,'Creation posts exactly one ledger outflow');
  const approve=await request('/api/expenses/'+newId+'/approve','POST',{});
  check(approve.status===200&&committed.ledger.filter(e=>e.expenseId===newId).length===1,'Repeated approval does not duplicate');
  const pending=await request('/api/expenses','POST',{...requestBody,status:'Pending'});
  check(pending.status===200&&!committed.ledger.some(e=>e.expenseId===pending.data.expense.id),'Pending expense does not post');
  await request('/api/expenses/'+pending.data.expense.id+'/approve','POST',{});
  check(committed.ledger.filter(e=>e.expenseId===pending.data.expense.id).length===1,'Pending approval posts');
  const beforeFailure=structuredClone(committed);failSave=true;
  const failed=await request('/api/expenses','POST',requestBody);failSave=false;
  check(failed.status>=400&&isDeepStrictEqual(committed,beforeFailure),'Failed save commits neither expense nor ledger');
  const invalid=await request('/api/expenses/'+newId,'PUT',{amount:-1});
  check(invalid.status>=400&&isDeepStrictEqual(committed,beforeFailure),'Invalid edit rolls back');
  const changed=await request('/api/expenses/'+newId,'PUT',{amount:source!.amount+1});
  check(changed.status===200&&committed.ledger.find(e=>e.expenseId===newId)!.debit===source!.amount+1,'Explicit edit updates the same posting');
  const beforeVoidCount=committed.ledger.length;
  const voided=await request('/api/expenses/'+newId,'DELETE');
  check(voided.status===200&&committed.expenses.some(e=>e.id===newId&&e.status==='Void'),'Delete becomes a historical void');
  check(committed.ledger.length===beforeVoidCount&&committed.ledger.find(e=>e.expenseId===newId)!.status==='Voided','Voided ledger history retained');
  check(!(await request('/api/ledger')).data.ledger.some((e:any)=>e.expenseId===newId),'Active ledger excludes void');
  check((await request('/api/ledger?includeVoided=true')).data.ledger.some((e:any)=>e.expenseId===newId),'Historical ledger remains accessible');
  const voidSnapshot=structuredClone(committed);await request('/api/expenses/'+newId,'DELETE');
  check(isDeepStrictEqual(committed,voidSnapshot),'Repeated void is idempotent');
  check((await request('/api/expenses/'+newId+'/approve','POST',{})).status===409,'Cannot reactivate void');
  const expectedExpenses=money(committed.expenses.filter(e=>e.status==='Approved'&&e.date.startsWith(month)).reduce((s,e)=>s+e.amount,0));
  check(mainDashboardSummary(committed).stats.totalExpensesThisMonth===expectedExpenses,'Dashboard excludes voids');
  check(reportSummary(committed).stats.totalExpenses===money(committed.expenses.filter(e=>e.status==='Approved').reduce((s,e)=>s+e.amount,0)),'Reports exclude voids');
  check(monthSummary(committed,month).remaining===monthSummary(original,month).remaining,'Expense lifecycle never changes house receivables');
 }finally{await new Promise<void>((resolve,reject)=>testServer.close(e=>e?reject(e):resolve()));}
 if(!beforeBackfill){
  check(original.ledger.filter(e=>e.expenseId===source!.id).length===1,'Real database has exactly one expense ledger entry');
  // A conflicting INSERT must fail before any row can be inserted; the transaction is rolled back.
  await client.query('BEGIN');let code='';
  try {await client.query("INSERT INTO public.ledger SELECT (jsonb_populate_record(NULL::public.ledger,to_jsonb(l)||jsonb_build_object('id',l.id||'-duplicate-check'))).* FROM public.ledger l WHERE extra_data->>'expenseId'=$1",[source!.id]);}catch(error:any){code=error.code;}finally{await client.query('ROLLBACK');}
  check(code==='23505','Database unique constraint prevents duplicate expense posting');
  process.env.MADINA_TEST_MODE='1';const {app}=await import('../server');const {db}=await import('../server/db');await db.initialize();
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));
  const live='http://127.0.0.1:'+(server.address() as any).port;
  try {
   const paths=['/api/dashboard/stats','/api/expenses','/api/ledger','/api/reports/summary','/api/financial-summary','/api/reports/monthly-closing?month='+month];
   const responses=await Promise.all(paths.map(async path=>{const r=await fetch(live+path);check(r.status===200,'Live GET '+path);return r.json() as any;}));
   const [dashboard,expenses,ledger,reports,financial,closing]=responses;
   const total=money(original.expenses.filter(e=>e.status==='Approved'&&e.date.startsWith(month)).reduce((s,e)=>s+e.amount,0));
   check(dashboard.stats.totalExpensesThisMonth===total,'Live dashboard expense total');
   check(isDeepStrictEqual(expenses.expenses,original.expenses),'Live expense API preserves real source');
   check(reports.stats.totalExpenses===total,'Live reports expense total');
   check(financial.summary.monthlyExpenses===total,'Live financial summary expense total');
   check(closing.summary.totalExpenses===total,'Live monthly closing expense total');
   const monthLedger=ledger.ledger.filter((e:any)=>e.date.startsWith(month));
   const outflow=money(monthLedger.reduce((s:number,e:any)=>s+e.debit,0));
   check(outflow===total,'Live ledger reconciles to approved expenses');
   console.log(JSON.stringify({month,inflow:money(monthLedger.reduce((s:number,e:any)=>s+e.credit,0)),outflow,netLiquidity:ledger.ledger.at(-1)?.runningBalance,expenses:total,outstandingHouseDues:dashboard.stats.outstandingDuesTotal,ledgerTransactions:ledger.ledger.length},null,2));
  }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await db.close();}
 }
 await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const after=await store.load(client);await client.query('ROLLBACK');
 check(isDeepStrictEqual(after,original),'Verification changed no database records');
 console.log(JSON.stringify({checksPassed:checks,beforeBackfill,permanentTestRecordsCreated:0,allRealRecordsUnchanged:true}));
}finally{client.release();await pool.end();}
