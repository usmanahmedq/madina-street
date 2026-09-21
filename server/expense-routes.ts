import type { Express, Request } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from './db';
import type { Expense, User } from '../src/types';
import { localDate, money } from './collection-finance';
import { activeLedger, reconcileExpenseLedger } from './expense-finance';

type AuthRequest = Request & { user?: User };
function validate(expense: Expense) {
  if (!Number.isFinite(expense.amount) || expense.amount <= 0 || money(expense.amount) !== expense.amount) throw new Error('A positive expense amount with at most two decimal places is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expense.date) || Number.isNaN(Date.parse(expense.date)) || new Date(expense.date).toISOString().slice(0,10) !== expense.date) throw new Error('A valid expense date is required.');
  if (!expense.title.trim() || !expense.category.trim()) throw new Error('Expense description and category are required.');
}
export function registerExpenseRoutes(app: Express, store: Pick<typeof db, 'get' | 'set' | 'save'> = db) {
  const data = () => ({ expenses: store.get('expenses'), ledger: store.get('ledger') });
  app.get('/api/ledger', (req, res) => res.json({success:true,ledger:req.query.includeVoided==='true' ? store.get('ledger') : activeLedger(store.get('ledger'))}));
  app.post('/api/expenses', (req: AuthRequest, res) => {
    try {
      const body = req.body;
      if (body.status && !['Pending','Approved'].includes(body.status)) throw new Error('New expenses must be Pending or Approved.');
      const uuid = randomUUID();
      const expense: Expense = {
        id:'exp-'+uuid, voucherNo:'EV-'+uuid.toUpperCase(), title:String(body.title||'Expense Item'), category:String(body.category||'General'),
        amount:Number(body.amount), date:body.date||localDate(), paidTo:body.paidTo||'Vendor', paymentMethod:body.paymentMethod||'Cash',
        referenceNo:body.referenceNo||'', receiptAttachmentUrl:body.receiptAttachmentUrl||'', createdBy:req.user?.name||'Admin',
        status:body.status||'Approved', notes:body.notes||'', createdAt:new Date().toISOString(),
      };
      validate(expense);
      const categories = store.get('expenseCategories') || [];
      if (!categories.some(c=>c.name===expense.category)) { categories.push({id:'category-'+randomUUID(),name:expense.category}); store.set('expenseCategories',categories); }
      store.get('expenses').unshift(expense);
      reconcileExpenseLedger(data(),[expense.id]);
      store.save();
      res.json({success:true,expense});
    } catch(e:any) { res.status(400).json({success:false,message:e.message}); }
  });
  app.put('/api/expenses/:id', (req, res) => {
    try {
      const expense=store.get('expenses').find(e=>e.id===req.params.id);
      if (!expense) return res.status(404).json({success:false,message:'Expense not found.'});
      if (['Void','Cancelled'].includes(expense.status)) return res.status(409).json({success:false,message:'Voided expense history cannot be edited.'});
      const patch=Object.fromEntries(['title','category','amount','date','paidTo','paymentMethod','referenceNo','receiptAttachmentUrl','notes'].filter(k=>Object.hasOwn(req.body,k)).map(k=>[k,req.body[k]]));
      const updated={...expense,...patch,amount:Number(patch.amount??expense.amount),updatedAt:new Date().toISOString()} as Expense;
      validate(updated);
      // Validate the prior posting before an explicit user edit updates the same linked entry.
      reconcileExpenseLedger(data(),[expense.id]);
      Object.assign(expense,updated);
      reconcileExpenseLedger(data(),[expense.id],true);
      store.save();res.json({success:true,expense});
    } catch(e:any) {res.status(409).json({success:false,message:e.message});}
  });
  app.post('/api/expenses/:id/approve', (req:AuthRequest,res)=>{
    try {
      const expense=store.get('expenses').find(e=>e.id===req.params.id);
      if (!expense) return res.status(404).json({success:false,message:'Expense not found.'});
      if (['Void','Cancelled','Rejected'].includes(expense.status)) return res.status(409).json({success:false,message:'This expense cannot be approved.'});
      validate(expense);
      if (expense.status!=='Approved') Object.assign(expense,{status:'Approved',approvedBy:req.user?.name,updatedAt:new Date().toISOString()});
      reconcileExpenseLedger(data(),[expense.id]);store.save();res.json({success:true,expense});
    } catch(e:any) {res.status(409).json({success:false,message:e.message});}
  });
  const voidExpense=(req:AuthRequest,res:any)=>{
    try {
      const expense=store.get('expenses').find(e=>e.id===req.params.id);
      if (!expense) return res.status(404).json({success:false,message:'Expense not found.'});
      if (!['Void','Cancelled'].includes(expense.status)) Object.assign(expense,{status:'Void',voidedAt:new Date().toISOString(),voidedBy:req.user?.name||'Admin',voidReason:String(req.body?.reason||'Voided by operator')});
      reconcileExpenseLedger(data(),[expense.id]);store.save();
      res.json({success:true,expense,message:'Expense voided; source and ledger history retained.'});
    } catch(e:any) {res.status(409).json({success:false,message:e.message});}
  };
  app.post('/api/expenses/:id/void',voidExpense);
  // Compatibility: old clients may still use DELETE. Never hard-delete financial history.
  app.delete('/api/expenses/:id',voidExpense);
}
