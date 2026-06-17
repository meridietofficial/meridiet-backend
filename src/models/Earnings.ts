import { query } from '../config/database';
import { getSetting } from './Setting';

export type EarningsPeriod = 'week' | 'month' | 'quarter' | 'year';

function periodConditions(period: EarningsPeriod): { current: string; previous: string } {
  switch (period) {
    case 'week':
      return {
        current:  `YEARWEEK(appointment_date, 1) = YEARWEEK(CURDATE(), 1)`,
        previous: `YEARWEEK(appointment_date, 1) = YEARWEEK(DATE_SUB(CURDATE(), INTERVAL 1 WEEK), 1)`,
      };
    case 'quarter':
      return {
        current:  `YEAR(appointment_date) = YEAR(CURDATE()) AND QUARTER(appointment_date) = QUARTER(CURDATE())`,
        previous: `YEAR(appointment_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 3 MONTH)) AND QUARTER(appointment_date) = QUARTER(DATE_SUB(CURDATE(), INTERVAL 3 MONTH))`,
      };
    case 'year':
      return {
        current:  `YEAR(appointment_date) = YEAR(CURDATE())`,
        previous: `YEAR(appointment_date) = YEAR(CURDATE()) - 1`,
      };
    default: // month
      return {
        current:  `YEAR(appointment_date) = YEAR(CURDATE()) AND MONTH(appointment_date) = MONTH(CURDATE())`,
        previous: `YEAR(appointment_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND MONTH(appointment_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))`,
      };
  }
}

function changePct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

async function fetchCommissionPct(): Promise<number> {
  const raw = await getSetting('platform_commission_pct');
  const pct = raw !== null ? Number(raw) : 20;
  return isNaN(pct) ? 20 : pct;
}

function applyCommission(gross: number, pct: number) {
  const commission = Math.round(gross * (pct / 100));
  return { gross, commission, net: gross - commission };
}

// ── Summary ───────────────────────────────────────────────────────────────────

export interface EarningsSummary {
  period: EarningsPeriod;
  platform_commission_pct: number;
  // Completed sessions in the selected period
  gross_earnings: number;
  platform_commission: number;
  net_earnings: number;
  earnings_change_pct: number | null;
  completed_sessions: number;
  completed_sessions_change_pct: number | null;
  // Confirmed upcoming sessions — payment already collected, session not done yet
  pending_booking_gross: number;
  pending_booking_commission: number;
  pending_booking_net: number;
  // All-time net balance the dietitian can withdraw
  pending_withdrawal: number;
}

export const getEarningsSummary = async (
  dietitianId: number,
  period: EarningsPeriod = 'month',
): Promise<EarningsSummary> => {
  const { current, previous } = periodConditions(period);
  const commPct = await fetchCommissionPct();

  const completedFilter = `dietitian_id = ? AND status = 'completed' AND payment_status = 'paid'`;

  const [currentRows, previousRows, pendingBookingRows, withdrawalRows] = await Promise.all([
    query<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(fee), 0) AS total, COUNT(*) AS count
       FROM appointments
       WHERE ${completedFilter} AND ${current}`,
      [dietitianId],
    ),
    query<{ total: number; count: number }>(
      `SELECT COALESCE(SUM(fee), 0) AS total, COUNT(*) AS count
       FROM appointments
       WHERE ${completedFilter} AND ${previous}`,
      [dietitianId],
    ),
    query<{ amount: number }>(
      `SELECT COALESCE(SUM(fee), 0) AS amount
       FROM appointments
       WHERE dietitian_id = ?
         AND status = 'confirmed'
         AND payment_status = 'paid'`,
      [dietitianId],
    ),
    query<{ amount: number }>(
      `SELECT COALESCE(SUM(fee), 0) AS amount
       FROM appointments
       WHERE dietitian_id = ?
         AND status = 'completed'
         AND payment_status = 'paid'`,
      [dietitianId],
    ),
  ]);

  const curGross   = Number(currentRows[0]?.total  ?? 0);
  const curCount   = Number(currentRows[0]?.count  ?? 0);
  const prevGross  = Number(previousRows[0]?.total ?? 0);
  const prevCount  = Number(previousRows[0]?.count ?? 0);
  const pendGross  = Number(pendingBookingRows[0]?.amount ?? 0);
  const allGross   = Number(withdrawalRows[0]?.amount ?? 0);

  const cur  = applyCommission(curGross, commPct);
  const pend = applyCommission(pendGross, commPct);

  return {
    period,
    platform_commission_pct:       commPct,
    gross_earnings:                cur.gross,
    platform_commission:           cur.commission,
    net_earnings:                  cur.net,
    earnings_change_pct:           changePct(curGross, prevGross),
    completed_sessions:            curCount,
    completed_sessions_change_pct: changePct(curCount, prevCount),
    pending_booking_gross:         pend.gross,
    pending_booking_commission:    pend.commission,
    pending_booking_net:           pend.net,
    pending_withdrawal:            applyCommission(allGross, commPct).net,
  };
};

// ── Monthly Revenue ───────────────────────────────────────────────────────────

export interface MonthlyRevenueRow {
  year: number;
  month: number;
  label: string;
  gross_revenue: number;
  platform_commission: number;
  net_revenue: number;
}

export const getMonthlyRevenue = async (
  dietitianId: number,
  months = 6,
): Promise<{ months: MonthlyRevenueRow[]; total_gross: number; total_commission: number; total_net: number; platform_commission_pct: number }> => {
  const commPct = await fetchCommissionPct();

  const rows = await query<{ yr: number; mo: number; gross: number }>(
    `SELECT
       YEAR(appointment_date)  AS yr,
       MONTH(appointment_date) AS mo,
       COALESCE(SUM(fee), 0)  AS gross
     FROM appointments
     WHERE dietitian_id = ?
       AND status = 'completed'
       AND payment_status = 'paid'
       AND appointment_date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL ? MONTH), '%Y-%m-01')
     GROUP BY yr, mo
     ORDER BY yr ASC, mo ASC`,
    [dietitianId, months - 1],
  );

  const revenueMap = new Map<string, number>();
  for (const r of rows) {
    revenueMap.set(`${r.yr}-${r.mo}`, Number(r.gross));
  }

  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const now = new Date();
  const result: MonthlyRevenueRow[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const d  = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = d.getFullYear();
    const mo = d.getMonth() + 1;
    const g  = applyCommission(revenueMap.get(`${yr}-${mo}`) ?? 0, commPct);
    result.push({
      year:                yr,
      month:               mo,
      label:               monthLabels[mo - 1],
      gross_revenue:       g.gross,
      platform_commission: g.commission,
      net_revenue:         g.net,
    });
  }

  const totalGross = result.reduce((s, r) => s + r.gross_revenue, 0);
  const totalComm  = result.reduce((s, r) => s + r.platform_commission, 0);

  return {
    platform_commission_pct: commPct,
    months:                  result,
    total_gross:             totalGross,
    total_commission:        totalComm,
    total_net:               totalGross - totalComm,
  };
};

// ── Earnings by Plan (grouped by notes field) ─────────────────────────────────

export interface EarningsByPlanRow {
  plan_name: string;
  gross_revenue: number;
  platform_commission: number;
  net_revenue: number;
  percentage: number;
}

export const getEarningsByPlan = async (
  dietitianId: number,
): Promise<{ platform_commission_pct: number; plans: EarningsByPlanRow[] }> => {
  const commPct = await fetchCommissionPct();

  const rows = await query<{ plan_name: string; gross: number }>(
    `SELECT
       COALESCE(NULLIF(TRIM(notes), ''), 'Other') AS plan_name,
       SUM(fee)                                    AS gross
     FROM appointments
     WHERE dietitian_id = ?
       AND status = 'completed'
       AND payment_status = 'paid'
     GROUP BY plan_name
     ORDER BY gross DESC`,
    [dietitianId],
  );

  const grandTotal = rows.reduce((s, r) => s + Number(r.gross), 0);

  const plans: EarningsByPlanRow[] = rows.map((r) => {
    const g = applyCommission(Number(r.gross), commPct);
    return {
      plan_name:           r.plan_name,
      gross_revenue:       g.gross,
      platform_commission: g.commission,
      net_revenue:         g.net,
      percentage:          grandTotal > 0 ? Math.round((g.gross / grandTotal) * 100) : 0,
    };
  });

  return { platform_commission_pct: commPct, plans };
};

// ── Payout Info ───────────────────────────────────────────────────────────────

export interface PayoutInfo {
  platform_commission_pct: number;
  next_payout_date: string;
  payout_upi: string | null;
  // Completed sessions this month
  gross_paid_this_month: number;
  platform_commission_this_month: number;
  net_paid_this_month: number;
  // Upcoming confirmed sessions (payment collected, session not done yet)
  pending_booking_gross: number;
  pending_booking_net: number;
}

export const getPayoutInfo = async (
  dietitianId: number,
  payoutUpi: string | null,
): Promise<PayoutInfo> => {
  const commPct = await fetchCommissionPct();

  const [paidRows, pendingRows] = await Promise.all([
    query<{ total: number }>(
      `SELECT COALESCE(SUM(fee), 0) AS total
       FROM appointments
       WHERE dietitian_id = ?
         AND status = 'completed'
         AND payment_status = 'paid'
         AND YEAR(appointment_date)  = YEAR(CURDATE())
         AND MONTH(appointment_date) = MONTH(CURDATE())`,
      [dietitianId],
    ),
    query<{ total: number }>(
      `SELECT COALESCE(SUM(fee), 0) AS total
       FROM appointments
       WHERE dietitian_id = ?
         AND status = 'confirmed'
         AND payment_status = 'paid'`,
      [dietitianId],
    ),
  ]);

  const paidGross    = Number(paidRows[0]?.total   ?? 0);
  const pendingGross = Number(pendingRows[0]?.total ?? 0);
  const paid         = applyCommission(paidGross, commPct);
  const pend         = applyCommission(pendingGross, commPct);

  const now            = new Date();
  const nextPayoutDate = new Date(now.getFullYear(), now.getMonth() + 1, 10)
    .toISOString().split('T')[0];

  return {
    platform_commission_pct:        commPct,
    next_payout_date:               nextPayoutDate,
    payout_upi:                     payoutUpi,
    gross_paid_this_month:          paid.gross,
    platform_commission_this_month: paid.commission,
    net_paid_this_month:            paid.net,
    pending_booking_gross:          pend.gross,
    pending_booking_net:            pend.net,
  };
};

// ── Transactions ──────────────────────────────────────────────────────────────

export type TransactionStatus = 'all' | 'paid' | 'pending' | 'refunded';

export interface TransactionRow {
  id: number;
  invoice_number: string;
  client_name: string;
  client_avatar: string | null;
  plan_name: string | null;
  date: string;
  payment_status: string;
  gross_amount: number;
  platform_commission: number;
  net_amount: number;
  currency: string;
}

export interface TransactionSummary {
  all: number;
  paid: number;
  pending: number;
  refunded: number;
}

export const getEarningsTransactions = async (
  dietitianId: number,
  status: TransactionStatus = 'all',
  search: string | undefined,
  page = 1,
  limit = 10,
): Promise<{ platform_commission_pct: number; summary: TransactionSummary; transactions: TransactionRow[]; total: number }> => {
  const offset  = (page - 1) * limit;
  const commPct = await fetchCommissionPct();

  const baseWhere = `a.dietitian_id = ? AND (a.payment_status <> 'unpaid' OR a.status IN ('confirmed', 'completed'))`;
  const searchCond = search
    ? `AND (COALESCE(u.full_name, a.name) LIKE ? OR CONCAT('INV-', YEAR(a.appointment_date), '-', LPAD(a.id, 3, '0')) LIKE ?)`
    : '';
  const searchParams: unknown[] = search ? [`%${search}%`, `%${search}%`] : [];

  const statusCond =
    status === 'paid'     ? `AND a.payment_status = 'paid'` :
    status === 'pending'  ? `AND a.payment_status = 'unpaid'` :
    status === 'refunded' ? `AND a.payment_status = 'refunded'` :
    '';

  const [summaryRows, rows, countRows] = await Promise.all([
    query<{ paid: number; pending: number; refunded: number; all: number }>(
      `SELECT
         SUM(a.payment_status = 'paid')     AS paid,
         SUM(a.payment_status = 'unpaid')   AS pending,
         SUM(a.payment_status = 'refunded') AS refunded,
         COUNT(*)                            AS \`all\`
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE ${baseWhere} ${searchCond}`,
      [dietitianId, ...searchParams],
    ),
    query<{
      id: number;
      appointment_date: string;
      client_name: string;
      client_avatar: string | null;
      plan_name: string | null;
      payment_status: string;
      fee: number;
      currency: string;
    }>(
      `SELECT
         a.id,
         DATE_FORMAT(a.appointment_date, '%Y-%m-%d') AS appointment_date,
         COALESCE(u.full_name, a.name)               AS client_name,
         u.avatar_url                                AS client_avatar,
         NULLIF(TRIM(a.notes), '')                   AS plan_name,
         a.payment_status,
         a.fee,
         a.currency
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE ${baseWhere} ${statusCond} ${searchCond}
       ORDER BY a.appointment_date DESC, a.id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [dietitianId, ...searchParams],
    ),
    query<{ total: number }>(
      `SELECT COUNT(*) AS total
       FROM appointments a
       LEFT JOIN users u ON a.user_id = u.id AND u.is_delete = 0
       WHERE ${baseWhere} ${statusCond} ${searchCond}`,
      [dietitianId, ...searchParams],
    ),
  ]);

  const s = summaryRows[0];
  const summary: TransactionSummary = {
    all:      Number(s?.all      ?? 0),
    paid:     Number(s?.paid     ?? 0),
    pending:  Number(s?.pending  ?? 0),
    refunded: Number(s?.refunded ?? 0),
  };

  const transactions: TransactionRow[] = rows.map((r) => {
    const year = r.appointment_date ? r.appointment_date.substring(0, 4) : new Date().getFullYear();
    const g    = applyCommission(Number(r.fee), commPct);
    return {
      id:                  r.id,
      invoice_number:      `INV-${year}-${String(r.id).padStart(3, '0')}`,
      client_name:         r.client_name,
      client_avatar:       r.client_avatar,
      plan_name:           r.plan_name,
      date:                r.appointment_date,
      payment_status:      r.payment_status === 'unpaid' ? 'pending' : r.payment_status,
      gross_amount:        g.gross,
      platform_commission: g.commission,
      net_amount:          g.net,
      currency:            r.currency,
    };
  });

  return { platform_commission_pct: commPct, summary, transactions, total: Number(countRows[0]?.total ?? 0) };
};
