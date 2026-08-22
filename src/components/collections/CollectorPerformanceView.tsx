import React from 'react';
import { Collection } from '../../types/index';
import { useSettings } from '../../context/SettingsContext';
import { Users, Award, TrendingUp, CheckCircle2, DollarSign } from 'lucide-react';

interface CollectorPerformanceViewProps {
  collections: Collection[];
}

export const CollectorPerformanceView: React.FC<CollectorPerformanceViewProps> = ({ collections }) => {
  const { formatCurrency } = useSettings();

  const validCollections = collections.filter(c => c.status !== 'Cancelled');

  // Group by collector name
  const collectorMap: Record<string, {
    collectorName: string;
    totalAmount: number;
    count: number;
    lastDate: string;
    methodsCount: Record<string, number>;
  }> = {};

  validCollections.forEach(c => {
    const name = c.collectorName || 'Mohalla Collector';
    if (!collectorMap[name]) {
      collectorMap[name] = {
        collectorName: name,
        totalAmount: 0,
        count: 0,
        lastDate: c.paymentDate,
        methodsCount: {},
      };
    }
    collectorMap[name].totalAmount += c.totalPaid;
    collectorMap[name].count += 1;
    if (c.paymentDate > collectorMap[name].lastDate) {
      collectorMap[name].lastDate = c.paymentDate;
    }
    const m = c.paymentMethod || 'Cash';
    collectorMap[name].methodsCount[m] = (collectorMap[name].methodsCount[m] || 0) + 1;
  });

  const collectorList = Object.values(collectorMap).sort((a, b) => b.totalAmount - a.totalAmount);
  const overallTotal = validCollections.reduce((sum, c) => sum + c.totalPaid, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Collector Performance Metrics</h2>
          <p className="text-xs text-slate-500">Track collections logged per fee collector staff member</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Active Fee Collectors</span>
            <h3 className="text-2xl font-black text-slate-900 mt-1">{collectorList.length} Staff</h3>
            <p className="text-xs text-slate-500 mt-1">Operating in Mohalla</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-800">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Receipts Logged</span>
            <h3 className="text-2xl font-black text-emerald-800 mt-1">{validCollections.length} Receipts</h3>
            <p className="text-xs text-slate-500 mt-1">Average {validCollections.length > 0 ? Math.round(overallTotal / validCollections.length) : 0} Rs/Receipt</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Top Collector Inflow</span>
            <h3 className="text-2xl font-black text-teal-900 mt-1">
              {collectorList.length > 0 ? formatCurrency(collectorList[0].totalAmount) : formatCurrency(0)}
            </h3>
            <p className="text-xs text-teal-700 font-bold mt-1">
              {collectorList.length > 0 ? collectorList[0].collectorName : 'N/A'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Collector List Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 flex justify-between items-center">
          <span>Collector Staff Audit Table</span>
          <span>{collectorList.length} Active Records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                <th className="p-4">Rank & Collector</th>
                <th className="p-4">Receipts Issued</th>
                <th className="p-4">Total Cash Collected</th>
                <th className="p-4">Avg Per Receipt</th>
                <th className="p-4">Share of Total</th>
                <th className="p-4">Last Payment Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {collectorList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 font-semibold">
                    No collector performance logs found.
                  </td>
                </tr>
              ) : (
                collectorList.map((col, idx) => {
                  const sharePercent = overallTotal > 0 ? Math.round((col.totalAmount / overallTotal) * 100) : 0;
                  const avgAmount = col.count > 0 ? Math.round(col.totalAmount / col.count) : 0;
                  return (
                    <tr key={col.collectorName} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <span className={`w-6 h-6 rounded-full font-black text-[10px] flex items-center justify-center shrink-0 ${
                            idx === 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                            idx === 1 ? 'bg-slate-200 text-slate-800' :
                            idx === 2 ? 'bg-orange-100 text-orange-900' : 'bg-slate-100 text-slate-600'
                          }`}>
                            #{idx + 1}
                          </span>
                          <div>
                            <p className="font-extrabold text-slate-900">{col.collectorName}</p>
                            <p className="text-[10px] text-slate-400">Verified Collector</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-slate-800">{col.count} Receipts</td>
                      <td className="p-4 font-black text-emerald-700 text-sm">{formatCurrency(col.totalAmount)}</td>
                      <td className="p-4 text-slate-700 font-semibold">{formatCurrency(avgAmount)}</td>
                      <td className="p-4">
                        <div className="space-y-1">
                          <span className="font-bold text-slate-900">{sharePercent}%</span>
                          <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-teal-700 h-full rounded-full" style={{ width: `${sharePercent}%` }}></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">{col.lastDate}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
