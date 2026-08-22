import React, { useState, useEffect, useRef } from 'react';
import { Search, Home, User, Phone, ChevronRight, AlertCircle, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { api } from '../../services/api';
import { House } from '../../types/index';
import { useNavigate } from 'react-router-dom';

export const GlobalHouseSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<House[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await api.quickSearchHouses(query);
        if (res.success) {
          setResults(res.houses);
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Quick search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (houseId: string) => {
    setQuery('');
    setIsOpen(false);
    navigate(`/houses/${houseId}`);
  };

  const getStatusBadge = (status: string) => {
    if (status === 'Good Standing' || status === 'Active') {
      return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3 h-3" /> Good Standing</span>;
    }
    if (status === 'Warning') {
      return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"><AlertTriangle className="w-3 h-3" /> Warning (1 Mo)</span>;
    }
    if (status === 'Defaulter') {
      return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200"><AlertCircle className="w-3 h-3" /> Defaulter</span>;
    }
    return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{status}</span>;
  };

  return (
    <div className="relative w-full max-w-xs md:max-w-sm" ref={dropdownRef}>
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setIsOpen(true)}
          placeholder="Search house #, owner or phone..."
          className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:bg-white transition-all text-slate-800 placeholder:text-slate-400"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setIsOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in max-h-80 overflow-y-auto">
          <div className="p-2 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between text-[11px] font-semibold text-slate-500">
            <span>House Quick Search</span>
            {isLoading && <span className="text-teal-600">Searching...</span>}
          </div>

          {results.length === 0 && !isLoading ? (
            <div className="p-4 text-center text-xs text-slate-500">
              No matching house profile found.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {results.map((house) => (
                <button
                  key={house.id}
                  onClick={() => handleSelect(house.id)}
                  className="w-full p-2.5 text-left hover:bg-teal-50/50 transition-colors flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900 group-hover:text-teal-700">{house.houseNo}</span>
                      {getStatusBadge(house.status)}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1"><User className="w-3 h-3 text-slate-400" /> {house.headName}</span>
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> {house.phone}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-600 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
