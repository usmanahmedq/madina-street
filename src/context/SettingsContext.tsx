import React, { createContext, useContext, useState, useEffect } from 'react';
import { MohallaSettings } from '../types/index';
import { api } from '../services/api';

interface SettingsContextType {
  settings: MohallaSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<MohallaSettings>) => Promise<boolean>;
  formatCurrency: (amount: number) => string;
}

const defaultSettings: MohallaSettings = {
  mohallaName: 'Madina Street Welfare Society',
  registrationNo: 'REG/MSWS/2022/8841',
  address: 'Madina Street, Sector A & B, Model Town, Lahore',
  phone: '+92 300 1234567',
  email: 'info@madinastreet.org',
  currencySymbol: 'Rs.',
  defaultMonthlyFee: 1500,
  lateFeeAmount: 200,
  dueDayOfMonth: 10,
  presidentName: 'Haji Mohammad Ismail',
  treasurerName: 'Syed Tariq Mahmood',
  receiptHeader: 'Official Monthly Contribution Receipt',
  receiptFooter: 'Thank you for keeping our Mohalla safe, clean, and well-maintained.',
  showBismillah: true,
  enableSmsAlerts: true,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<MohallaSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const refreshSettings = async () => {
    try {
      const res = await api.getSettings();
      if (res.success && res.settings) {
        setSettings(res.settings);
      }
    } catch (e) {
      console.warn('Could not fetch settings from API, using default', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<MohallaSettings>): Promise<boolean> => {
    try {
      const res = await api.updateSettings(newSettings);
      if (res.success && res.settings) {
        setSettings(res.settings);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to update settings', e);
      return false;
    }
  };

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('en-PK', {
      maximumFractionDigits: 0,
    }).format(amount || 0);
    return `${settings.currencySymbol} ${formatted}`;
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        refreshSettings,
        updateSettings,
        formatCurrency,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within a SettingsProvider');
  return context;
};
