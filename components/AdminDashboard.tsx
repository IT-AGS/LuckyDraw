'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { employees as defaultEmployees, PRIZES, type PrizeType, type Employee, type PrizeConfig } from '@/data/employees';
import { Settings, Download, RotateCcw, Plus, Trash2, FileSpreadsheet, Search, RefreshCw, Edit2, Check, X, Trophy, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

type ConfirmData = number | string | Employee[] | null;

function readJsonFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toStringValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function getFirstValue(row: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const str = toStringValue(row[key]);
    if (str) return str;
  }
  return '';
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'employees' | 'prizes' | 'winners'>('employees');
  
  // Data States
  const [employees, setEmployees] = useState<Employee[]>(() => readJsonFromStorage<Employee[]>('employees_data', defaultEmployees));
  const [prizesConfig, setPrizesConfig] = useState<PrizeConfig[]>(() => readJsonFromStorage<PrizeConfig[]>('prizesConfig', PRIZES));
  const [winners, setWinners] = useState<(Employee & { prize: PrizeType })[]>(() =>
    readJsonFromStorage<(Employee & { prize: PrizeType })[]>('winners', [])
  );
  const [spinSettings, setSpinSettings] = useState<{ stopMode: 'manual' | 'auto'; autoStopMs: number }>(() =>
    readJsonFromStorage<{ stopMode: 'manual' | 'auto'; autoStopMs: number }>('spinSettings', { stopMode: 'manual', autoStopMs: 3500 })
  );
  const [enableKeyboard, setEnableKeyboard] = useState(() => readJsonFromStorage<boolean>('enableKeyboard', true));
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Employee | null>(null);

  // Confirmation State
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    type: 'DELETE_WINNER' | 'DELETE_EMPLOYEE' | 'RESET_DEFAULT' | 'RESET_GAME' | 'IMPORT_OVERWRITE' | 'ALERT' | null;
    data: ConfirmData;
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: null,
    data: null,
    title: '',
    message: ''
  });
  
  // Initialize data
  useEffect(() => {
    // Listen for storage changes to sync winners
    const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'winners' && e.newValue) {
            try {
                setWinners(JSON.parse(e.newValue));
            } catch (error) {
                console.error(error);
            }
        }
        if (e.key === 'spinSettings' && e.newValue) {
            try {
                setSpinSettings(JSON.parse(e.newValue));
            } catch (error) {
                console.error(error);
            }
        }
        if (e.key === 'enableKeyboard' && e.newValue) {
            try {
                setEnableKeyboard(JSON.parse(e.newValue));
            } catch (error) {
                console.error(error);
            }
        }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Save Helpers
  const saveEmployees = (newEmployees: Employee[]) => {
    setEmployees(newEmployees);
    localStorage.setItem('employees_data', JSON.stringify(newEmployees));
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'employees_data',
        newValue: JSON.stringify(newEmployees)
    }));
  };

  const saveConfig = (newConfig: PrizeConfig[]) => {
    setPrizesConfig(newConfig);
    localStorage.setItem('prizesConfig', JSON.stringify(newConfig));
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'prizesConfig',
        newValue: JSON.stringify(newConfig)
    }));
  };

  const saveSpinSettings = (nextSettings: { stopMode: 'manual' | 'auto'; autoStopMs: number }) => {
    setSpinSettings(nextSettings);
    localStorage.setItem('spinSettings', JSON.stringify(nextSettings));
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'spinSettings',
        newValue: JSON.stringify(nextSettings)
    }));
  };

  const saveKeyboardSetting = (enabled: boolean) => {
    setEnableKeyboard(enabled);
    localStorage.setItem('enableKeyboard', JSON.stringify(enabled));
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'enableKeyboard',
        newValue: JSON.stringify(enabled)
    }));
  };

  const handleConfirmAction = () => {
    if (!confirmState.type) return;

    switch (confirmState.type) {
        case 'DELETE_WINNER': {
            const index = typeof confirmState.data === 'number' ? confirmState.data : -1;
            if (index < 0) break;
            const newWinners = [...winners];
            newWinners.splice(index, 1);
            setWinners(newWinners);
            localStorage.setItem('winners', JSON.stringify(newWinners));
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'winners',
                newValue: JSON.stringify(newWinners)
            }));
            break;
        }
        case 'DELETE_EMPLOYEE': {
            const id = typeof confirmState.data === 'string' ? confirmState.data : '';
            if (!id) break;
            const newEmployees = employees.filter(e => e.id !== id);
            saveEmployees(newEmployees);
            break;
        }
        case 'RESET_DEFAULT': {
            saveEmployees(defaultEmployees);
            break;
        }
        case 'RESET_GAME': {
            localStorage.setItem('winners', JSON.stringify([]));
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'winners',
                newValue: JSON.stringify([])
            }));
            break;
        }
        case 'IMPORT_OVERWRITE': {
            const nextEmployees = Array.isArray(confirmState.data) ? confirmState.data : [];
            saveEmployees(nextEmployees);
            break;
        }
        case 'ALERT': {
            break;
        }
    }
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const deleteWinner = (index: number) => {
      setConfirmState({
          isOpen: true,
          type: 'DELETE_WINNER',
          data: index,
          title: 'Xóa Kết Quả',
          message: 'Bạn có chắc chắn muốn xóa kết quả trúng thưởng này? Lượt quay sẽ được khôi phục.'
      });
  };

  const handleExportExcel = () => {
    const data = winners.map(w => ({
        'Giải Thưởng': prizesConfig.find(p => p.id === w.prize)?.name || w.prize,
        'Mã NV': w.code,
        'Họ Tên': w.name,
        'Phòng Ban': w.department
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Danh Sách Trúng Thưởng");
    
    // Auto fit column width
    const max_width = data.reduce((w, r) => Math.max(w, r['Họ Tên'].length), 10);
    worksheet['!cols'] = [ { wch: 20 }, { wch: 10 }, { wch: max_width + 5 }, { wch: 20 } ];

    XLSX.writeFile(workbook, "DanhSachTrungThuong.xlsx");
  };

  // Employee Actions
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      
      // Map data to Employee interface
      // Assumes columns: ID, Code, Name, Department or similar
      const newEmployees: Employee[] = data
        .map((row, index) => ({
          id: getFirstValue(row, ['id', 'ID']) || String(Date.now() + index),
          code: getFirstValue(row, ['code', 'Code', 'Mã NV']),
          name: getFirstValue(row, ['name', 'Name', 'Họ Tên']),
          department: getFirstValue(row, ['department', 'Department', 'Phòng Ban']),
        }))
        .filter(e => e.code && e.name); // Basic validation

      if (newEmployees.length > 0) {
        setConfirmState({
            isOpen: true,
            type: 'IMPORT_OVERWRITE',
            data: newEmployees,
            title: 'Xác Nhận Import',
            message: `Tìm thấy ${newEmployees.length} nhân viên. Bạn có muốn thay thế danh sách hiện tại không?`
        });
      } else {
        setConfirmState({
            isOpen: true,
            type: 'ALERT',
            data: null,
            title: 'Thông Báo',
            message: 'Không tìm thấy dữ liệu hợp lệ trong file Excel'
        });
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDeleteEmployee = (id: string) => {
    setConfirmState({
        isOpen: true,
        type: 'DELETE_EMPLOYEE',
        data: id,
        title: 'Xóa Nhân Viên',
        message: 'Bạn có chắc chắn muốn xóa nhân viên này?'
    });
  };

  const handleAddEmployee = () => {
    const newEmp: Employee = {
        id: String(Date.now()),
        code: '',
        name: '',
        department: ''
    };
    const newEmployees = [newEmp, ...employees];
    saveEmployees(newEmployees);
    setEditingId(newEmp.id);
    setEditForm(newEmp);
  };

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setEditForm({ ...emp });
  };

  const cancelEdit = () => {
    if (editForm && !editForm.code && !editForm.name) {
        // If it was a new empty employee, remove it
        const newEmployees = employees.filter(e => e.id !== editForm.id);
        saveEmployees(newEmployees);
    }
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = () => {
    if (!editForm) return;
    const newEmployees = employees.map(e => e.id === editForm.id ? editForm : e);
    saveEmployees(newEmployees);
    setEditingId(null);
    setEditForm(null);
  };

  const handleResetToDefault = () => {
    setConfirmState({
        isOpen: true,
        type: 'RESET_DEFAULT',
        data: null,
        title: 'Khôi phục mặc định',
        message: 'Hành động này sẽ khôi phục danh sách nhân viên về mặc định ban đầu. Bạn có chắc chắn không?'
    });
  };
  
  // Game Actions
  const handleResetGame = () => {
    setConfirmState({
        isOpen: true,
        type: 'RESET_GAME',
        data: null,
        title: 'Reset Game',
        message: 'Bạn có chắc chắn muốn reset toàn bộ game? Tất cả kết quả trúng thưởng sẽ bị xóa.'
    });
  };

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#002855] text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-3xl font-bold uppercase tracking-wider flex items-center gap-3">
                    <Settings className="text-blue-400" size={32} />
                    Quản Lý Hệ Thống
                </h1>
                <p className="text-blue-200 mt-2">Cấu hình giải thưởng và danh sách nhân viên</p>
            </div>
            <div className="flex gap-4">
                <button
                    onClick={handleResetGame}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 px-6 py-3 rounded-xl font-bold uppercase tracking-wider transition-all flex items-center gap-2 border border-red-500/20"
                >
                    <RotateCcw size={20} />
                    Reset Game
                </button>
            </div>
        </header>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-white/10 pb-1">
            <button
                onClick={() => setActiveTab('employees')}
                className={cn(
                    "px-6 py-3 rounded-t-xl font-bold transition-all relative top-[1px]",
                    activeTab === 'employees' 
                        ? "bg-white/10 text-white border border-white/10 border-b-[#002855]" 
                        : "text-white/50 hover:text-white hover:bg-white/5"
                )}
            >
                Danh Sách Nhân Viên ({employees.length})
            </button>
            <button
                onClick={() => setActiveTab('prizes')}
                className={cn(
                    "px-6 py-3 rounded-t-xl font-bold transition-all relative top-[1px]",
                    activeTab === 'prizes' 
                        ? "bg-white/10 text-white border border-white/10 border-b-[#002855]" 
                        : "text-white/50 hover:text-white hover:bg-white/5"
                )}
            >
                Cấu Hình Giải Thưởng
            </button>
            <button
                onClick={() => setActiveTab('winners')}
                className={cn(
                    "px-6 py-3 rounded-t-xl font-bold transition-all relative top-[1px]",
                    activeTab === 'winners' 
                        ? "bg-white/10 text-white border border-white/10 border-b-[#002855]" 
                        : "text-white/50 hover:text-white hover:bg-white/5"
                )}
            >
                Danh Sách Trúng Thưởng ({winners.length})
            </button>
        </div>

        {/* Content */}
        <div className="bg-white/5 border border-white/10 rounded-b-xl rounded-tr-xl p-6 min-h-[600px]">
            {activeTab === 'employees' ? (
                <div className="space-y-6">
                    {/* Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={20} />
                            <input
                                type="text"
                                placeholder="Tìm kiếm theo tên, mã, phòng ban..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
                            />
                        </div>
                        <div className="flex gap-3">
                            <label className="cursor-pointer bg-green-600 hover:bg-green-500 text-white px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-2">
                                <FileSpreadsheet size={20} />
                                Import Excel
                                <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileUpload} />
                            </label>
                            <button
                                onClick={handleResetToDefault}
                                className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
                            >
                                <RefreshCw size={20} />
                                Mặc định
                            </button>
                            <button
                                onClick={handleAddEmployee}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
                            >
                                <Plus size={20} />
                                Thêm Mới
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-hidden rounded-xl border border-white/10">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/10 text-blue-200">
                                    <th className="p-4 font-bold border-b border-white/10">Mã NV</th>
                                    <th className="p-4 font-bold border-b border-white/10">Họ Tên</th>
                                    <th className="p-4 font-bold border-b border-white/10">Phòng Ban</th>
                                    <th className="p-4 font-bold border-b border-white/10 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEmployees.map((emp) => (
                                    <tr key={emp.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        {editingId === emp.id ? (
                                            <>
                                                <td className="p-3">
                                                    <input 
                                                        className="w-full bg-black/40 border border-white/20 rounded px-2 py-1"
                                                        value={editForm?.code}
                                                        onChange={e => setEditForm(prev => prev ? {...prev, code: e.target.value} : null)}
                                                        placeholder="Mã NV"
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <input 
                                                        className="w-full bg-black/40 border border-white/20 rounded px-2 py-1"
                                                        value={editForm?.name}
                                                        onChange={e => setEditForm(prev => prev ? {...prev, name: e.target.value} : null)}
                                                        placeholder="Họ Tên"
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <input 
                                                        className="w-full bg-black/40 border border-white/20 rounded px-2 py-1"
                                                        value={editForm?.department}
                                                        onChange={e => setEditForm(prev => prev ? {...prev, department: e.target.value} : null)}
                                                        placeholder="Phòng Ban"
                                                    />
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={saveEdit} className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500/40 rounded-lg">
                                                            <Check size={18} />
                                                        </button>
                                                        <button onClick={cancelEdit} className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-lg">
                                                            <X size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-4 font-mono text-yellow-400">{emp.code}</td>
                                                <td className="p-4 font-bold">{emp.name}</td>
                                                <td className="p-4 text-blue-200">{emp.department}</td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => startEdit(emp)} className="p-2 hover:bg-white/10 rounded-lg text-blue-300 transition-colors">
                                                            <Edit2 size={18} />
                                                        </button>
                                                        <button 
                                                            suppressHydrationWarning
                                                            onClick={() => handleDeleteEmployee(emp.id)} 
                                                            className="p-2 hover:bg-white/10 rounded-lg text-red-400 transition-colors"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredEmployees.length === 0 && (
                            <div className="text-center py-12 text-white/30 italic">
                                Không tìm thấy nhân viên nào
                            </div>
                        )}
                    </div>
                </div>
            ) : activeTab === 'prizes' ? (
                <div className="space-y-6 max-w-2xl">
                    <div className="bg-white/5 p-6 rounded-xl flex items-center justify-between border border-white/5">
                        <div className="flex flex-col">
                            <label className="text-lg text-blue-200 font-medium">Điều khiển bằng bàn phím</label>
                            <span className="text-sm text-white/40">Sử dụng các phím mũi tên để điều khiển (Lên/Xuống: Chọn giải, Trái/Phải: Quay/Dừng)</span>
                        </div>
                        <button
                            onClick={() => saveKeyboardSetting(!enableKeyboard)}
                            className={cn(
                                "w-14 h-7 rounded-full transition-colors relative",
                                enableKeyboard ? "bg-blue-500" : "bg-white/10"
                            )}
                        >
                            <div className={cn(
                                "absolute top-1 w-5 h-5 rounded-full bg-white transition-all shadow-lg",
                                enableKeyboard ? "left-8" : "left-1"
                            )} />
                        </button>
                    </div>

                    <h3 className="text-xl font-bold text-blue-200 mb-6">Cấu Hình Số Lượng Giải Thưởng</h3>
                    {prizesConfig.map((prize, idx) => (
                        <div key={prize.id} className="bg-white/5 p-6 rounded-xl flex items-center justify-between border border-white/5">
                            <label className="text-lg text-blue-200 font-medium">{prize.name}</label>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-white/50 uppercase tracking-wider">Số lượng:</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={prize.maxSpins}
                                    onChange={(e) => {
                                        const newVal = parseInt(e.target.value) || 0;
                                        const newConfig = [...prizesConfig];
                                        newConfig[idx] = { ...newConfig[idx], maxSpins: newVal };
                                        saveConfig(newConfig);
                                    }}
                                    className="w-32 bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-center text-xl font-bold text-yellow-400 focus:outline-none focus:border-blue-400"
                                />
                            </div>
                        </div>
                    ))}

                    <div className="bg-white/5 p-6 rounded-xl border border-white/5">
                        <div className="text-lg font-bold text-blue-200 mb-4">Cấu Hình Dừng</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                                onClick={() => saveSpinSettings({ ...spinSettings, stopMode: 'manual' })}
                                className={cn(
                                    "px-4 py-3 rounded-xl font-bold transition-all border",
                                    spinSettings.stopMode === 'manual'
                                        ? "bg-blue-600 text-white border-blue-400/40"
                                        : "bg-black/20 text-white/60 border-white/10 hover:bg-white/5 hover:text-white"
                                )}
                            >
                                Cho phép bấm Dừng
                            </button>
                            <button
                                onClick={() => saveSpinSettings({ ...spinSettings, stopMode: 'auto' })}
                                className={cn(
                                    "px-4 py-3 rounded-xl font-bold transition-all border",
                                    spinSettings.stopMode === 'auto'
                                        ? "bg-blue-600 text-white border-blue-400/40"
                                        : "bg-black/20 text-white/60 border-white/10 hover:bg-white/5 hover:text-white"
                                )}
                            >
                                Tự dừng sau thời gian
                            </button>
                        </div>

                        {spinSettings.stopMode === 'auto' && (
                            <div className="mt-4 bg-black/20 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
                                <span className="text-sm text-white/50 uppercase tracking-wider">Thời gian quay (giây)</span>
                                <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={Math.round((spinSettings.autoStopMs || 3500) / 1000)}
                                    onChange={(e) => {
                                        const seconds = parseInt(e.target.value) || 1;
                                        saveSpinSettings({ ...spinSettings, autoStopMs: Math.max(1000, Math.min(30000, seconds * 1000)) });
                                    }}
                                    className="w-32 bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-center text-xl font-bold text-yellow-400 focus:outline-none focus:border-blue-400"
                                />
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-blue-200 flex items-center gap-3">
                            <Trophy className="text-yellow-400" />
                            Danh Sách Trúng Thưởng
                        </h3>
                        <button 
                            onClick={handleExportExcel}
                            className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 text-sm"
                        >
                            <Download size={18} />
                            Xuất Excel
                        </button>
                    </div>
                    
                    <div className="overflow-hidden rounded-xl border border-white/10">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white/10 text-blue-200">
                                    <th className="p-4 font-bold border-b border-white/10">STT</th>
                                    <th className="p-4 font-bold border-b border-white/10">Giải Thưởng</th>
                                    <th className="p-4 font-bold border-b border-white/10">Mã NV</th>
                                    <th className="p-4 font-bold border-b border-white/10">Họ Tên</th>
                                    <th className="p-4 font-bold border-b border-white/10">Phòng Ban</th>
                                    <th className="p-4 font-bold border-b border-white/10 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {winners.map((winner, idx) => (
                                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-white/50">{idx + 1}</td>
                                        <td className="p-4 font-bold text-yellow-400">
                                            {prizesConfig.find(p => p.id === winner.prize)?.name}
                                        </td>
                                        <td className="p-4 font-mono">{winner.code}</td>
                                        <td className="p-4 font-bold">{winner.name}</td>
                                        <td className="p-4 text-blue-200">{winner.department}</td>
                                        <td className="p-4 text-right">
                                            <button 
                                                onClick={() => deleteWinner(idx)}
                                                className="p-2 hover:bg-white/10 rounded-lg text-red-400 transition-colors"
                                                title="Xóa kết quả này"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {winners.length === 0 && (
                            <div className="text-center py-12 text-white/30 italic">
                                Chưa có kết quả trúng thưởng nào
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Generic Confirmation Modal */}
      <AnimatePresence>
          {confirmState.isOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                  <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.9, opacity: 0 }}
                      className="bg-[#002855] border-2 border-white/20 rounded-3xl p-8 max-w-md w-full shadow-2xl relative"
                  >
                      <div className="flex flex-col items-center text-center gap-6">
                          <div className={cn(
                              "w-16 h-16 rounded-full flex items-center justify-center",
                              confirmState.type?.includes('DELETE') || confirmState.type?.includes('RESET') 
                                  ? "bg-red-500/10 text-red-500" 
                                  : "bg-blue-500/10 text-blue-400"
                          )}>
                              <AlertTriangle size={32} />
                          </div>
                          
                          <div>
                              <h3 className="text-2xl font-bold text-white mb-2">{confirmState.title}</h3>
                              <p className="text-blue-200">{confirmState.message}</p>
                          </div>

                          <div className="flex gap-3 w-full">
                              {confirmState.type !== 'ALERT' && (
                                  <button
                                      onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
                                      className="flex-1 px-4 py-3 rounded-xl font-bold text-white/50 hover:text-white hover:bg-white/10 transition-colors bg-white/5"
                                  >
                                      Hủy
                                  </button>
                              )}
                              <button
                                  onClick={confirmState.type === 'ALERT' ? () => setConfirmState(prev => ({ ...prev, isOpen: false })) : handleConfirmAction}
                                  className={cn(
                                      "flex-1 px-4 py-3 rounded-xl font-bold text-white shadow-lg transition-all",
                                      confirmState.type?.includes('DELETE') || confirmState.type?.includes('RESET')
                                          ? "bg-red-600 hover:bg-red-500 shadow-red-600/20"
                                          : "bg-blue-600 hover:bg-blue-500 shadow-blue-600/20"
                                  )}
                              >
                                  {confirmState.type === 'ALERT' ? 'Đóng' : 'Xác Nhận'}
                              </button>
                          </div>
                      </div>
                  </motion.div>
              </div>
          )}
      </AnimatePresence>
    </div>
  );
}
