import { dateFromToday, daysAgo } from '@/data/mock/mock-dates'
import { type RentPayment } from '@/types'

/** Fictional rent payments around today's date. */
export const rentPayments: RentPayment[] = [
  { id: 'pay_5101', tenantName: 'Marcus Chen', propertyId: 'prop_105', unit: 'Unit 214', amount: 2_040, dueDate: dateFromToday(-4), autopay: false, paidAt: null },
  { id: 'pay_5102', tenantName: 'Northwind Analytics', propertyId: 'prop_202', unit: 'Suite 410', amount: 7_500, dueDate: dateFromToday(-2), autopay: false, paidAt: null },
  { id: 'pay_5103', tenantName: 'Jordan Ellis', propertyId: 'prop_102', unit: 'Unit 12', amount: 1_850, dueDate: dateFromToday(-1), autopay: false, paidAt: daysAgo(0.03) },
  { id: 'pay_5104', tenantName: 'Sofia Martinez', propertyId: 'prop_101', unit: 'Unit 4B', amount: 1_625, dueDate: dateFromToday(1), autopay: true, paidAt: null },
  { id: 'pay_5105', tenantName: 'Brightline Dental Group', propertyId: 'prop_205', unit: 'Suite 120', amount: 9_200, dueDate: dateFromToday(2), autopay: true, paidAt: null },
  { id: 'pay_5106', tenantName: 'Priya Raman', propertyId: 'prop_103', unit: 'Unit 7A', amount: 1_920, dueDate: dateFromToday(3), autopay: false, paidAt: null },
  { id: 'pay_5107', tenantName: 'Ethan Brooks', propertyId: 'prop_107', unit: 'Unit 5D', amount: 1_990, dueDate: dateFromToday(5), autopay: false, paidAt: null },
  { id: 'pay_5108', tenantName: 'Harvest Table Café', propertyId: 'prop_203', unit: 'Unit 102', amount: 5_400, dueDate: dateFromToday(6), autopay: true, paidAt: null },
  { id: 'pay_5109', tenantName: 'Amara Okafor', propertyId: 'prop_106', unit: 'Unit 22', amount: 1_700, dueDate: dateFromToday(8), autopay: true, paidAt: null },
  { id: 'pay_5110', tenantName: 'Lumen Architecture', propertyId: 'prop_201', unit: 'Suite 600', amount: 8_150, dueDate: dateFromToday(10), autopay: false, paidAt: null },
  { id: 'pay_5111', tenantName: 'Daniel Kim', propertyId: 'prop_104', unit: 'Unit 11', amount: 2_030, dueDate: dateFromToday(12), autopay: false, paidAt: null },
  { id: 'pay_5112', tenantName: 'Forge & Co. Workspace', propertyId: 'prop_204', unit: 'Suite 205', amount: 5_500, dueDate: dateFromToday(13), autopay: false, paidAt: null },
  { id: 'pay_5113', tenantName: 'Grace Liu', propertyId: 'prop_102', unit: 'Unit 31', amount: 2_710, dueDate: dateFromToday(20), autopay: true, paidAt: null },
]
