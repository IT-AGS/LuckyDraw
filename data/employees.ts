import employeesData from './employees.json';

export interface Employee {
  id: string;
  code: string;
  name: string;
  department: string;
}

export const employees: Employee[] = employeesData as Employee[];

export type PrizeType = 'SPECIAL' | 'FIRST' | 'SECOND' | 'THIRD';

export interface PrizeConfig {
  id: PrizeType;
  name: string;
  maxSpins: number;
}

export const PRIZES: PrizeConfig[] = [
  { id: 'SPECIAL', name: 'GIẢI ĐẶC BIỆT', maxSpins: 1 },
  { id: 'FIRST', name: 'GIẢI NHẤT', maxSpins: 2 },
  { id: 'SECOND', name: 'GIẢI NHÌ', maxSpins: 5 },
  { id: 'THIRD', name: 'GIẢI BA', maxSpins: 20 },
];
